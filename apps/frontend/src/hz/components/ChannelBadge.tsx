// ChannelBadge — the ONE place a social network is rendered (color + mark +
// label). Data-free and portable: a Phase B @hanzo/ui extraction target.
import clsx from 'clsx';
import type { Channel } from '../types';

export const CHANNEL_META: Record<
  Channel,
  { label: string; bg: string; fg: string; mark: string }
> = {
  x: { label: 'X', bg: '#0f0f12', fg: '#e6e6ea', mark: '𝕏' },
  facebook: { label: 'Facebook', bg: '#1877f2', fg: '#ffffff', mark: 'f' },
  instagram: { label: 'Instagram', bg: '#e1306c', fg: '#ffffff', mark: 'IG' },
  linkedin: { label: 'LinkedIn', bg: '#0a66c2', fg: '#ffffff', mark: 'in' },
  tiktok: { label: 'TikTok', bg: '#111114', fg: '#25f4ee', mark: 'TT' },
  youtube: { label: 'YouTube', bg: '#ff0000', fg: '#ffffff', mark: '▶' },
  threads: { label: 'Threads', bg: '#111114', fg: '#e6e6ea', mark: '@' },
};

export function ChannelBadge({
  channel,
  showLabel = false,
  size = 22,
}: {
  channel: Channel;
  showLabel?: boolean;
  size?: number;
}) {
  const m = CHANNEL_META[channel] || CHANNEL_META.x;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-[6px] font-bold leading-none ring-1 ring-white/10"
        style={{
          background: m.bg,
          color: m.fg,
          width: size,
          height: size,
          fontSize: Math.max(9, size * 0.42),
        }}
        title={m.label}
      >
        {m.mark}
      </span>
      {showLabel ? (
        <span className={clsx('text-sm text-zinc-300')}>{m.label}</span>
      ) : null}
    </span>
  );
}
