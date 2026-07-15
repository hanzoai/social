'use client';
// Calendar — a month view of scheduled/published posts on their dates. Local
// month-navigation state only (presentational); all post data via props. Pure
// data contract → Phase B @hanzo/ui extraction target (alongside QueueBoard).
import { useState } from 'react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { ChannelBadge } from './ChannelBadge';
import type { Post } from '../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Calendar({
  posts,
  onEdit,
}: {
  posts: Post[];
  onEdit: (p: Post) => void;
}) {
  const [month, setMonth] = useState(dayjs().startOf('month'));
  const gridStart = month.startOf('month').startOf('week');
  const days = Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'));
  const today = dayjs().format('YYYY-MM-DD');

  const byDay = new Map<string, Post[]>();
  for (const p of posts) {
    if (!p.scheduleAt) continue;
    const key = dayjs.unix(p.scheduleAt).format('YYYY-MM-DD');
    (byDay.get(key) || byDay.set(key, []).get(key)!).push(p);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#101013]/60">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-100">{month.format('MMMM YYYY')}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth(month.subtract(1, 'month'))}
            className="rounded-md px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
          >
            ‹
          </button>
          <button
            onClick={() => setMonth(dayjs().startOf('month'))}
            className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
          >
            Today
          </button>
          <button
            onClick={() => setMonth(month.add(1, 'month'))}
            className="rounded-md px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-t border-white/10 text-[11px] text-zinc-500">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = d.format('YYYY-MM-DD');
          const items = byDay.get(key) || [];
          const inMonth = d.month() === month.month();
          return (
            <div
              key={key}
              className={clsx(
                'min-h-[92px] border-b border-r border-white/5 p-1.5',
                !inMonth && 'bg-black/20'
              )}
            >
              <div
                className={clsx(
                  'mb-1 text-right text-[11px] tabular-nums',
                  key === today
                    ? 'font-semibold text-[#a48bff]'
                    : inMonth
                    ? 'text-zinc-400'
                    : 'text-zinc-700'
                )}
              >
                {d.date()}
              </div>
              <div className="flex flex-col gap-1">
                {items.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onEdit(p)}
                    className="flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-1 text-left hover:bg-white/10"
                    title={p.content}
                  >
                    <ChannelBadge channel={p.channel} size={14} />
                    <span className="truncate text-[11px] text-zinc-300">{p.content}</span>
                  </button>
                ))}
                {items.length > 3 && (
                  <span className="pl-1 text-[10px] text-zinc-500">+{items.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
