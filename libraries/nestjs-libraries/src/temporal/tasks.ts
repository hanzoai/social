import 'reflect-metadata';
import {
  DynamicModule,
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Client,
  Connection,
  Worker,
  WorkflowStatus,
  type WorkflowExecutionInfo,
} from '@hanzoai/tasks';
import { socialIntegrationList } from '@social/nestjs-libraries/integrations/integration.manager';

// The @hanzoai/tasks bearer source shape. Declared locally because the SDK
// declares this type but does not re-export it from its package root.
type TokenProvider = () => string | Promise<string>;

// Hanzo Tasks NestJS integration — the drop-in replacement for
// nestjs-temporal-core. Durable workflow execution runs on the ONE Hanzo Tasks
// engine embedded in cloud, reached over its identity-gated ZAP listener
// (cloud.hanzo.svc:9999) and authenticated with a Hanzo IAM client_credentials
// bearer. There is no upstream Temporal anywhere.
//
// This module preserves the exact surface social's code already depends on:
//   • @Activity() / @ActivityMethod() class + method decorators
//   • TemporalService with .client.getRawClient() / .client.getWorkflowHandle()
//     and .terminateWorkflow()
//   • getTemporalModule(isWorkers, workflowsPath, activityClasses)
// so the migration is an import + dependency swap, not a rewrite.

// ── @Activity / @ActivityMethod decorators ─────────────────────────────
const ACTIVITY_METHODS = Symbol('hanzo.tasks.activityMethods');

/** Marks a class as an activity provider (parity with nestjs-temporal-core). */
export function Activity(): ClassDecorator {
  return () => {
    /* marker only — methods are discovered via @ActivityMethod */
  };
}

/** Marks a method as a durable activity, optionally under an explicit name. */
export function ActivityMethod(name?: string): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = (target as { constructor: unknown }).constructor;
    const methods: Array<{ prop: string; name: string }> =
      Reflect.getOwnMetadata(ACTIVITY_METHODS, ctor as object) || [];
    methods.push({ prop: String(propertyKey), name: name || String(propertyKey) });
    Reflect.defineMetadata(ACTIVITY_METHODS, methods, ctor as object);
  };
}

function activityMethodsOf(ctor: unknown): Array<{ prop: string; name: string }> {
  return Reflect.getOwnMetadata(ACTIVITY_METHODS, ctor as object) || [];
}

// ── Hanzo IAM client_credentials bearer (cached) ───────────────────────
let cachedToken = '';
let cachedExpMs = 0;

/**
 * Mints (and caches) a Hanzo IAM service token via the client_credentials
 * grant. The token carries `owner` (the org) + `iss=https://hanzo.id`, which
 * cloud's gated engine validates against its IAM JWKS and scopes the request
 * to. Refreshed a minute before expiry.
 */
export const iamTokenSource: TokenProvider = async () => {
  const now = Date.now();
  if (cachedToken && now < cachedExpMs - 60_000) return cachedToken;
  const iamUrl = process.env.IAM_URL || 'https://hanzo.id';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.IAM_CLIENT_ID || 'hanzo-social',
    client_secret: process.env.IAM_CLIENT_SECRET || '',
  });
  const res = await fetch(`${iamUrl}/v1/iam/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(
      `Hanzo IAM client_credentials failed: ${res.status} ${res.statusText}`
    );
  }
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error('Hanzo IAM returned no access_token');
  cachedToken = j.access_token;
  cachedExpMs = now + (j.expires_in ? j.expires_in * 1000 : 3_600_000);
  return cachedToken;
};

const tasksAddress = () => process.env.TASKS_ADDRESS || 'cloud.hanzo.svc:9999';
const tasksNamespace = () => process.env.TASKS_NAMESPACE || 'default';

const STATUS_NAME: Record<number, string> = {
  [WorkflowStatus.Unspecified]: 'UNSPECIFIED',
  [WorkflowStatus.Running]: 'RUNNING',
  [WorkflowStatus.Completed]: 'COMPLETED',
  [WorkflowStatus.Failed]: 'FAILED',
  [WorkflowStatus.Canceled]: 'CANCELED',
  [WorkflowStatus.Terminated]: 'TERMINATED',
  [WorkflowStatus.ContinuedAsNew]: 'CONTINUED_AS_NEW',
  [WorkflowStatus.TimedOut]: 'TIMED_OUT',
};

// Adapt a Hanzo WorkflowHandle to the @temporalio shape social's legacy code
// reads — notably `describe().status.name` as a string.
function adaptHandle(handle: ReturnType<Client['workflow']['getHandle']>) {
  return {
    workflowId: handle.workflowId,
    runId: handle.runId,
    signal: (name: string, arg?: unknown) => handle.signal(name, arg),
    terminate: (reason = '') => handle.terminate(reason),
    cancel: () => handle.cancel(),
    async describe() {
      const info = await handle.describe();
      return { ...info, status: { name: STATUS_NAME[info.status] ?? 'UNSPECIFIED' } };
    },
  };
}

// getRawClient() exposes the @temporalio/client-shaped surface social uses:
// .workflow.{start,signalWithStart,getHandle,list}. start/signalWithStart pass
// straight through to the @hanzoai/tasks WorkflowClient (which already accepts
// typedSearchAttributes + workflowIdConflictPolicy). list() streams executions
// by visibility query (used to find + terminate running post workflows).
function rawClientAdapter(client: Client) {
  return {
    connection: client.connection,
    workflow: {
      start: (type: string, opts: Record<string, unknown>) =>
        client.workflow.start(type, opts as never),
      signalWithStart: (type: string, opts: Record<string, unknown>) =>
        client.workflow.signalWithStart(type, opts as never),
      getHandle: (workflowId: string, runId = '') =>
        adaptHandle(client.workflow.getHandle(workflowId, runId)),
      async *list(opts: { query?: string } = {}): AsyncGenerator<WorkflowExecutionInfo> {
        let cursor: string | undefined;
        do {
          const page = await client.connection.listWorkflows(opts.query ?? '', 0, cursor);
          for (const e of page.executions) yield e;
          cursor = page.nextPageToken;
        } while (cursor && cursor.length > 0);
      },
    },
  };
}

// ── Module wiring ──────────────────────────────────────────────────────
const TASKS_OPTIONS = Symbol('hanzo.tasks.options');

interface TasksModuleOptions {
  workers: boolean;
  workflowsPath?: string;
  activityClasses: unknown[];
}

@Global()
@Injectable()
export class TemporalService implements OnModuleInit, OnModuleDestroy {
  private connection?: Connection;
  private _client?: Client;
  private readonly workers: Worker[] = [];

  constructor(
    @Inject(TASKS_OPTIONS) private readonly opts: TasksModuleOptions,
    private readonly moduleRef: ModuleRef
  ) {}

  /** The @temporalio-shaped client facade social's services consume. */
  get client() {
    return {
      getRawClient: () => (this._client ? rawClientAdapter(this._client) : undefined),
      getWorkflowHandle: (workflowId: string, runId = '') =>
        adaptHandle(this._client!.workflow.getHandle(workflowId, runId)),
    };
  }

  async terminateWorkflow(workflowId: string): Promise<void> {
    await this._client?.connection.terminateWorkflow(workflowId);
  }

  async onModuleInit(): Promise<void> {
    this.connection = await Connection.connect({
      address: tasksAddress(),
      token: iamTokenSource,
    });
    this._client = await Client.create({
      connection: this.connection,
      namespace: tasksNamespace(),
    });
    // The embedded engine registers only its own `default` namespace at boot
    // and never lazily creates one on ExecuteWorkflow; register the org's
    // namespace once (idempotent) so ExecuteWorkflow does not block.
    try {
      await this._client.connection.registerNamespace({ name: tasksNamespace() });
    } catch {
      /* already registered — idempotent */
    }

    if (!this.opts.workers) return;

    // Flatten the decorated activity classes (resolved from Nest DI) into the
    // { activityName: boundFn } map the worker dispatches.
    const activities: Record<string, (...args: unknown[]) => unknown> = {};
    for (const cls of this.opts.activityClasses) {
      let instance: Record<string, (...a: unknown[]) => unknown>;
      try {
        instance = this.moduleRef.get(cls as never, { strict: false });
      } catch {
        continue;
      }
      for (const m of activityMethodsOf(cls)) {
        const fn = instance[m.prop];
        if (typeof fn === 'function') activities[m.name] = fn.bind(instance);
      }
    }

    // Workflow functions, keyed by name (from the orchestrator workflows barrel).
    const workflows: Record<string, (...a: unknown[]) => unknown> = {};
    if (this.opts.workflowsPath) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(this.opts.workflowsPath) as Record<string, unknown>;
      for (const [name, val] of Object.entries(mod)) {
        if (typeof val === 'function') workflows[name] = val as (...a: unknown[]) => unknown;
      }
    }

    // One worker per task queue: 'main' plus one per single-segment social
    // integration identifier (post workflows dispatch on the provider's queue).
    const queues = Array.from(
      new Set<string>([
        'main',
        ...socialIntegrationList
          .map((i) => i.identifier)
          .filter((id) => id.indexOf('-') === -1)
          .map((id) => id.split('-')[0]),
      ])
    );
    for (const taskQueue of queues) {
      const worker = await Worker.create({
        address: tasksAddress(),
        namespace: tasksNamespace(),
        taskQueue,
        token: iamTokenSource,
        activities,
        workflows,
      });
      await worker.start();
      this.workers.push(worker);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const w of this.workers) {
      try {
        await w.shutdown();
      } catch {
        /* best effort */
      }
    }
    try {
      await this.connection?.close();
    } catch {
      /* best effort */
    }
  }
}

@Global()
@Module({})
export class HanzoTasksModule {}

/**
 * Builds the Hanzo Tasks module. `isWorkers` starts the workers (orchestrator);
 * false is a client-only wiring (backend). Signature-compatible with the prior
 * nestjs-temporal-core getTemporalModule call sites.
 */
export function getTemporalModule(
  isWorkers: boolean,
  workflowsPath?: string,
  activityClasses?: unknown[]
): DynamicModule {
  return {
    module: HanzoTasksModule,
    global: true,
    providers: [
      {
        provide: TASKS_OPTIONS,
        useValue: {
          workers: isWorkers,
          workflowsPath,
          activityClasses: activityClasses ?? [],
        } satisfies TasksModuleOptions,
      },
      TemporalService,
    ],
    exports: [TemporalService],
  };
}
