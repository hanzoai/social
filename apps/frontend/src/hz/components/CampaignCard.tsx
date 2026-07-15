// CampaignCard — one marketing campaign. Pure. Phase B extraction target.
import { StatusPill } from './StatusPill';
import type { Campaign } from '../types';

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const pct = campaign.budget > 0 ? Math.min(100, (campaign.spend / campaign.budget) * 100) : 0;
  return (
    <div className="rounded-xl border border-white/10 bg-[#17171b] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-zinc-100">{campaign.name}</div>
          <div className="mt-0.5 text-xs capitalize text-zinc-500">{campaign.channel}</div>
        </div>
        <StatusPill status={campaign.status} />
      </div>
      {campaign.objective ? (
        <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{campaign.objective}</p>
      ) : null}
      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-zinc-500">
          <span>{money(campaign.spend)} spent</span>
          <span>{money(campaign.budget)} budget</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-[#7c5cff]" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
