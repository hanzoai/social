// Workflow-side barrel for orchestrator workflows. Re-exports the
// @hanzoai/tasks workflow primitives, but with a `proxyActivities` whose type
// parameter is unconstrained — matching the legacy proxyActivities API — so the existing
// `proxyActivities<PostActivity>()` (typed by an activity CLASS, which lacks a
// string index signature) type-checks. Semantics are unchanged; only the
// declared generic bound differs from the SDK's stricter one.
export * from '@hanzoai/tasks';

import { proxyActivities as _proxyActivities, type ProxyActivityOptions } from '@hanzoai/tasks';

// Accept the legacy ProxyActivityOptions superset (e.g. `cancellationType`)
// for source compatibility; extra fields are ignored by the SDK.
type ProxyActivityOptionsCompat = ProxyActivityOptions & {
  cancellationType?: string;
};

export function proxyActivities<A>(options: ProxyActivityOptionsCompat): A {
  return _proxyActivities<Record<string, (...args: any[]) => any>>(options) as A;
}
