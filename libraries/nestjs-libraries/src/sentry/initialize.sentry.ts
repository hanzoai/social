import * as Sentry from '@sentry/nestjs';
import { capitalize } from 'lodash';

// @sentry/profiling-node loads a native binding that is not built for every
// Node release. Importing it at module scope crashed the whole backend on
// startup even when Sentry was disabled — the early return below never got to
// run. Resolve it lazily, after the DSN guard, and treat it as optional.
const loadProfilingIntegration = () => {
  try {
    return require('@sentry/profiling-node').nodeProfilingIntegration();
  } catch {
    return null;
  }
};

export const initializeSentry = (appName: string, allowLogs = false) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return null;
  }

  const profiling = loadProfilingIntegration();

  try {
    Sentry.init({
      initialScope: {
        tags: {
          service: appName,
          component: 'nestjs',
        },
        contexts: {
          app: {
            name: `Hanzo Social ${capitalize(appName)}`,
          },
        },
      },
      environment: process.env.NODE_ENV || 'development',
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      spotlight: process.env.SENTRY_SPOTLIGHT === '1',
      integrations: [
        ...(profiling ? [profiling] : []),
        Sentry.consoleLoggingIntegration({ levels: ['log', 'info', 'warn', 'error', 'debug', 'assert', 'trace'] }),
        Sentry.openAIIntegration({
          recordInputs: true,
          recordOutputs: true,
        }),
      ],
      tracesSampleRate: 1.0,
      enableLogs: true,

      // Profiling
      profileSessionSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.45,
      profileLifecycle: 'trace',
    });
  } catch (err) {
    console.log(err);
  }
  return true;
};
