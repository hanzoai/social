// SummaryHeader — the real, non-fabricated roll-up from /v1/social/summary and
// /v1/marketing/summary. Pure.
import { StatTile } from './ui';
import type { SocialSummary, MarketingSummary } from '../types';

export function SummaryHeader({
  social,
  marketing,
}: {
  social?: SocialSummary;
  marketing?: MarketingSummary;
}) {
  const money = (cents = 0) =>
    `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <StatTile label="Posts" value={social?.posts ?? '—'} />
      <StatTile label="Scheduled" value={social?.scheduled ?? '—'} accent />
      <StatTile label="Published" value={social?.published ?? '—'} />
      <StatTile label="Accounts" value={social?.accounts ?? '—'} />
      <StatTile label="Campaigns" value={marketing?.campaigns ?? '—'} sub={`${marketing?.active ?? 0} active`} />
      <StatTile label="Ad spend" value={money(marketing?.spend)} sub={`of ${money(marketing?.budget)}`} />
    </div>
  );
}
