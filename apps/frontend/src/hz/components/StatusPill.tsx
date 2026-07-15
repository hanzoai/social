// StatusPill — post/campaign lifecycle state as a colored pill. Pure.
import clsx from 'clsx';

const META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-zinc-500/15 text-zinc-300 ring-zinc-400/20' },
  scheduled: { label: 'Scheduled', cls: 'bg-amber-500/15 text-amber-300 ring-amber-400/25' },
  publishing: { label: 'Publishing', cls: 'bg-sky-500/15 text-sky-300 ring-sky-400/25' },
  published: { label: 'Published', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/25' },
  failed: { label: 'Failed', cls: 'bg-red-500/15 text-red-300 ring-red-400/25' },
  active: { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/25' },
  paused: { label: 'Paused', cls: 'bg-amber-500/15 text-amber-300 ring-amber-400/25' },
  completed: { label: 'Completed', cls: 'bg-zinc-500/15 text-zinc-300 ring-zinc-400/20' },
};

export function StatusPill({ status }: { status: string }) {
  const m = META[status] || { label: status, cls: 'bg-white/5 text-zinc-300 ring-white/10' };
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
        m.cls
      )}
    >
      {m.label}
    </span>
  );
}
