'use client';
// Campaigns — list + a minimal create form for /v1/marketing/campaigns. Emits a
// CampaignInput via onCreate; never fetches.
import { useState } from 'react';
import { Button } from './ui';
import { CampaignCard } from './CampaignCard';
import {
  CAMPAIGN_CHANNELS,
  CampaignChannel,
  Campaign,
  CampaignInput,
} from '../types';

export function Campaigns({
  campaigns,
  onCreate,
}: {
  campaigns: Campaign[];
  onCreate: (input: CampaignInput) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<CampaignChannel>('email');
  const [objective, setObjective] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const field =
    'w-full rounded-lg border border-white/10 bg-[#0d0d10] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#7c5cff]/60';

  const create = async () => {
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await onCreate({
        name: name.trim(),
        channel,
        status: 'draft',
        objective: objective.trim(),
        budget: Math.round((parseFloat(budget) || 0) * 100),
        scheduledAt: 0,
      });
      setName('');
      setObjective('');
      setBudget('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="rounded-2xl border border-white/10 bg-[#101013]/60 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">New campaign</h3>
          <div className="mt-3 flex flex-col gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campaign name"
              className={field}
            />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as CampaignChannel)}
              className={field}
            >
              {CAMPAIGN_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Objective (optional)"
              className={field}
            />
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">$</span>
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Budget"
                inputMode="decimal"
                className={field}
              />
            </div>
            {err && <div className="text-sm text-red-400">{err}</div>}
            <Button variant="primary" onClick={create} disabled={busy}>
              {busy ? 'Creating…' : 'Create campaign'}
            </Button>
          </div>
        </div>
      </div>
      <div className="lg:col-span-2">
        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-zinc-600">
            No campaigns yet
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
