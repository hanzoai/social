'use client';
// Dashboard — the ONE stateful container. It owns the data (SWR hooks) and the
// composer/tab UI state, and hands pure data + callbacks to the presentational
// components. Everything below it is fetch-free and Phase B-portable.
import { useState } from 'react';
import clsx from 'clsx';
import {
  useSocialSummary,
  useMarketingSummary,
  usePosts,
  useCampaigns,
  useProviders,
  postActions,
  campaignActions,
} from '../hooks';
import type { Post } from '../types';
import { SummaryHeader } from './SummaryHeader';
import { QueueBoard } from './QueueBoard';
import { Calendar } from './Calendar';
import { Campaigns } from './Campaigns';
import { ProvidersPanel } from './ProvidersPanel';
import { PostComposer } from './PostComposer';
import { Button } from './ui';

type Tab = 'queue' | 'calendar' | 'campaigns' | 'channels';
const TABS: { id: Tab; label: string }[] = [
  { id: 'queue', label: 'Queue' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'channels', label: 'Channels' },
];

export function Dashboard({ org }: { org: string }) {
  const [tab, setTab] = useState<Tab>('queue');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);

  const social = useSocialSummary();
  const marketing = useMarketingSummary();
  const posts = usePosts();
  const campaigns = useCampaigns();
  const providers = useProviders();

  const openNew = () => {
    setEditing(null);
    setComposerOpen(true);
  };
  const openEdit = (p: Post) => {
    setEditing(p);
    setComposerOpen(true);
  };
  const remove = async (p: Post) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this post?')) return;
    await postActions.remove(p.id);
  };

  const authError =
    (posts.error as Error | undefined)?.message?.includes('unauthenticated') ||
    (social.error as Error | undefined)?.message?.includes('unauthenticated');

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0b]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c5cff] to-[#4c37b8] text-sm font-bold text-white">
              S
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Hanzo Social</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {org ? (
              <span className="hidden rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-400 sm:inline">
                {org}
              </span>
            ) : null}
            <Button variant="primary" onClick={openNew}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              New post
            </Button>
            <a
              href="/hz/auth/logout"
              className="text-xs text-zinc-500 hover:text-zinc-300"
              title="Sign out"
            >
              Sign out
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {authError && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span>Your session isn’t active. Sign in to load your workspace.</span>
            <a href="/hz/auth/login" className="font-medium underline">
              Sign in
            </a>
          </div>
        )}

        <SummaryHeader social={social.data} marketing={marketing.data} />

        {/* tabs */}
        <div className="mt-6 flex gap-1 border-b border-white/10">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                '-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'border-[#7c5cff] text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {posts.isLoading && tab !== 'campaigns' && tab !== 'channels' ? (
            <div className="py-16 text-center text-sm text-zinc-600">Loading…</div>
          ) : tab === 'queue' ? (
            <QueueBoard posts={posts.data || []} onEdit={openEdit} onDelete={remove} />
          ) : tab === 'calendar' ? (
            <Calendar posts={posts.data || []} onEdit={openEdit} />
          ) : tab === 'campaigns' ? (
            <Campaigns
              campaigns={campaigns.data || []}
              onCreate={async (input) => {
                await campaignActions.create(input);
              }}
            />
          ) : (
            <ProvidersPanel providers={providers.data || []} />
          )}
        </div>
      </main>

      <PostComposer
        open={composerOpen}
        initial={editing}
        onClose={() => setComposerOpen(false)}
        onSubmit={async (input) => {
          if (editing) await postActions.update(editing.id, input);
          else await postActions.create(input);
        }}
        onDelete={(p) => postActions.remove(p.id)}
      />
    </div>
  );
}
