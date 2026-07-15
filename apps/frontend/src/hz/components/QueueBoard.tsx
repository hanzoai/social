// QueueBoard — the post queue as lifecycle columns (draft → scheduled →
// published, plus failed). Pure: receives posts + callbacks, groups client-side.
import { PostCard } from './PostCard';
import type { Post, PostStatus } from '../types';

const COLUMNS: { status: PostStatus; label: string; dot: string }[] = [
  { status: 'draft', label: 'Drafts', dot: 'bg-zinc-400' },
  { status: 'scheduled', label: 'Scheduled', dot: 'bg-amber-400' },
  { status: 'published', label: 'Published', dot: 'bg-emerald-400' },
  { status: 'failed', label: 'Failed', dot: 'bg-red-400' },
];

export function QueueBoard({
  posts,
  onEdit,
  onDelete,
}: {
  posts: Post[];
  onEdit: (p: Post) => void;
  onDelete: (p: Post) => void;
}) {
  const by = (s: PostStatus) =>
    posts
      .filter((p) => p.status === s)
      .sort((a, b) =>
        s === 'scheduled'
          ? (a.scheduleAt || a.updatedAt) - (b.scheduleAt || b.updatedAt)
          : b.updatedAt - a.updatedAt
      );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = by(col.status);
        return (
          <div
            key={col.status}
            className="flex min-h-[10rem] flex-col rounded-2xl border border-white/10 bg-[#101013]/60"
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-2.5">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              <span className="text-sm font-medium text-zinc-200">{col.label}</span>
              <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-xs tabular-nums text-zinc-400">
                {items.length}
              </span>
            </div>
            <div className="hz-scroll flex max-h-[64vh] flex-col gap-2.5 overflow-y-auto p-2.5">
              {items.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-600">Nothing here yet</div>
              ) : (
                items.map((p) => (
                  <PostCard key={p.id} post={p} onEdit={onEdit} onDelete={onDelete} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
