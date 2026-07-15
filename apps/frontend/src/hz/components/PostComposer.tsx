'use client';
// PostComposer — create/edit a post: body, channel, draft-or-schedule, and
// media URLs (paste an image URL now; an S3 picker can replace the field later
// without touching this contract). Pure form: emits a PostInput via onSubmit;
// never fetches. Phase B @hanzo/ui extraction target.
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Modal, Button } from './ui';
import { CHANNEL_META } from './ChannelBadge';
import { CHANNELS, Channel, Post, PostInput } from '../types';

const MAX_MEDIA = 10;

export function PostComposer({
  open,
  initial,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  initial: Post | null;
  onClose: () => void;
  onSubmit: (input: PostInput) => Promise<void>;
  onDelete?: (post: Post) => Promise<void>;
}) {
  const [content, setContent] = useState('');
  const [channel, setChannel] = useState<Channel>('x');
  const [scheduled, setScheduled] = useState(false);
  const [when, setWhen] = useState('');
  const [media, setMedia] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Sync form to the post being edited whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setContent(initial?.content || '');
    setChannel((initial?.channel as Channel) || 'x');
    const isSched = initial?.status === 'scheduled';
    setScheduled(isSched);
    setWhen(
      initial?.scheduleAt
        ? dayjs.unix(initial.scheduleAt).format('YYYY-MM-DDTHH:mm')
        : dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm')
    );
    setMedia(initial?.media || []);
    setMediaInput('');
    setErr('');
  }, [open, initial]);

  const addMedia = () => {
    const u = mediaInput.trim();
    if (!u || media.includes(u) || media.length >= MAX_MEDIA) return;
    setMedia([...media, u]);
    setMediaInput('');
  };

  const submit = async () => {
    if (!content.trim()) {
      setErr('Content is required');
      return;
    }
    if (scheduled && !when) {
      setErr('Pick a schedule time');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await onSubmit({
        content: content.trim(),
        channel,
        status: scheduled ? 'scheduled' : 'draft',
        scheduleAt: scheduled ? dayjs(when).unix() : 0,
        media,
      });
      onClose();
    } catch (e) {
      setErr((e as Error).message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-lg border border-white/10 bg-[#0d0d10] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#7c5cff]/60';

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit post' : 'New post'}>
      <div className="flex flex-col gap-4">
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            maxLength={8192}
            placeholder="What do you want to share?"
            className={field}
          />
          <div className="mt-1 text-right text-[11px] text-zinc-600">{content.length}/8192</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-zinc-400">
            Channel
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className={`mt-1 ${field}`}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_META[c].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            When
            <div className="mt-1 flex rounded-lg border border-white/10 bg-[#0d0d10] p-0.5">
              <button
                type="button"
                onClick={() => setScheduled(false)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs ${!scheduled ? 'bg-white/10 text-zinc-100' : 'text-zinc-400'}`}
              >
                Draft
              </button>
              <button
                type="button"
                onClick={() => setScheduled(true)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs ${scheduled ? 'bg-white/10 text-zinc-100' : 'text-zinc-400'}`}
              >
                Schedule
              </button>
            </div>
          </label>
        </div>

        {scheduled && (
          <label className="text-xs text-zinc-400">
            Schedule time
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className={`mt-1 ${field}`}
            />
          </label>
        )}

        <div>
          <div className="text-xs text-zinc-400">Media (image URLs)</div>
          <div className="mt-1 flex gap-2">
            <input
              value={mediaInput}
              onChange={(e) => setMediaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addMedia();
                }
              }}
              placeholder="https://s3.hanzo.ai/…"
              className={field}
            />
            <Button variant="subtle" onClick={addMedia} disabled={media.length >= MAX_MEDIA}>
              Add
            </Button>
          </div>
          {media.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {media.map((u, i) => (
                <span
                  key={i}
                  className="inline-flex max-w-[220px] items-center gap-1 rounded-md bg-white/5 py-1 pl-2 pr-1 text-xs text-zinc-300"
                >
                  <span className="truncate" title={u}>
                    {u.replace(/^https?:\/\//, '')}
                  </span>
                  <button
                    onClick={() => setMedia(media.filter((_, j) => j !== i))}
                    className="rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {err && <div className="text-sm text-red-400">{err}</div>}

        <div className="flex items-center justify-between pt-1">
          {initial && onDelete ? (
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete(initial);
                  onClose();
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : scheduled ? 'Schedule' : 'Save draft'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
