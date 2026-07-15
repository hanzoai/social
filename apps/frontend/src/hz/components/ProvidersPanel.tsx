// ProvidersPanel — honest publish-readiness per network from
// GET /v1/social/providers. When a network's OAuth-app keys are absent the
// cloud says so (missingCredentials); we show that truthfully and DON'T offer a
// fake connect action. Pure.
import { ChannelBadge, CHANNEL_META } from './ChannelBadge';
import { Button } from './ui';
import type { ProviderCapability } from '../types';

export function ProvidersPanel({ providers }: { providers: ProviderCapability[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101013]/60">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-100">Channels</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          Connect provider API keys to publish. Status is read live from the backend.
        </p>
      </div>
      <ul className="divide-y divide-white/5">
        {providers.map((p) => (
          <li key={p.provider} className="flex items-center gap-3 px-4 py-3">
            <ChannelBadge channel={p.provider} showLabel size={26} />
            <div className="ml-auto flex items-center gap-3">
              {p.credentialsConfigured ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ready
                </span>
              ) : (
                <span
                  className="hidden text-xs text-zinc-500 sm:inline"
                  title={
                    p.missingCredentials?.length
                      ? `Missing: ${p.missingCredentials.join(', ')}`
                      : 'Provider keys required'
                  }
                >
                  {p.missingCredentials?.length
                    ? `${p.missingCredentials.length} key${p.missingCredentials.length > 1 ? 's' : ''} missing`
                    : 'Keys required'}
                </span>
              )}
              <Button
                variant="subtle"
                disabled
                title={
                  p.credentialsConfigured
                    ? 'Connected'
                    : `Add ${CHANNEL_META[p.provider].label} keys in KMS to enable`
                }
              >
                {p.credentialsConfigured ? 'Connected' : 'Connect keys'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
