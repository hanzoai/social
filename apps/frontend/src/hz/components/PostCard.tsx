// PostCard — one social post: channel, status, body, schedule time, media, and
// edit/delete affordances. Pure (all data + callbacks via props). Phase B
// @hanzo/ui extraction target.
import dayjs from 'dayjs';
import { ChannelBadge } from './ChannelBadge';
import { StatusPill } from './StatusPill';
import type { Post } from '../types';

export function PostCard({
  post,
  onEdit,
  onDelete,
}: {
  post: Post;
  onEdit: (p: Post) => void;
  onDelete: (p: Post) => void;
}) {
  const when =
    post.scheduleAt > 0
      ? dayjs.unix(post.scheduleAt).format('MMM D · HH:mm')
      : dayjs.unix(post.updatedAt || post.createdAt).format('MMM D');
  const media = post.media || [];
  return (
    <div className="group rounded-xl border border-white/10 bg-[#17171b] p-3 transition-colors hover:border-white/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChannelBadge channel={post.channel} />
          <StatusPill status={post.status} />
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onEdit(post)}
            title="Edit"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            onClick={() => onDelete(post)}
            title="Delete"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <p className="mt-2.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-zinc-200 line-clamp-4">
        {post.content}
      </p>

      {media.length > 0 && (
        <div className="mt-2.5 flex gap-1.5">
          {media.slice(0, 4).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className="h-12 w-12 rounded-md object-cover ring-1 ring-white/10"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ))}
          {media.length > 4 && (
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-white/5 text-xs text-zinc-400 ring-1 ring-white/10">
              +{media.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{when}</span>
        {post.status === 'failed' && post.error ? (
          <span className="max-w-[60%] truncate text-red-400/80" title={post.error}>
            {post.error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
