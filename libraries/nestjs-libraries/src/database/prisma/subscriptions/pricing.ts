// Hanzo Social pricing — derived from @hanzo/plans (~/work/hanzo/plans)
// at module load. The canonical Hanzo plans file is the single source of
// truth and is also what pricing.hanzo.ai/v1/pricing/subscriptions serves.
//
// We adapt the canonical Hanzo plan shape (id="social-*", limits.{channels,
// postsPerMonth,ai,…}) onto the upstream Hanzo Social PricingInnerInterface so
// downstream consumers (subscription.service, permissions.service,
// integrations.controller, users.controller, public.controller,
// impersonate.tsx) compile and run unchanged.
//
// Legacy tier names (FREE/STANDARD/TEAM/PRO/ULTIMATE) map to Hanzo plan
// ids:
//   FREE      → social-free
//   STANDARD  → social-pro
//   TEAM      → social-team
//   PRO       → social-team-max
//   ULTIMATE  → social-enterprise

import { subscriptionPlans } from '@hanzo/plans';

export interface PricingInnerInterface {
  current: string;
  month_price: number;
  year_price: number;
  channel?: number;
  posts_per_month: number;
  team_members: boolean;
  community_features: boolean;
  featured_by_social: boolean;
  ai: boolean;
  import_from_channels: boolean;
  image_generator?: boolean;
  image_generation_count: number;
  generate_videos: number;
  public_api: boolean;
  webhooks: number;
  autoPost: boolean;
}
export interface PricingInterface {
  [key: string]: PricingInnerInterface;
}

interface HanzoSocialPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  category: string;
  limits: {
    channels: number;
    postsPerMonth: number;
    imageGenerationCount: number;
    generateVideos: number;
    teamMembers: number;
    webhooks: number;
    ai: boolean;
    autoPost: boolean;
    publicApi: boolean;
    communityFeatures: boolean;
  };
}

const LEGACY_TO_HANZO: Record<string, string> = {
  FREE: 'social-free',
  STANDARD: 'social-pro',
  TEAM: 'social-team',
  PRO: 'social-team-max',
  ULTIMATE: 'social-enterprise',
};

function findSocialPlan(id: string): HanzoSocialPlan {
  const plan = (subscriptionPlans as HanzoSocialPlan[]).find(
    (p) => p.id === id && p.category === 'social'
  );
  if (!plan) {
    throw new Error(
      `@hanzo/plans is missing required social plan "${id}". Expected the social-* tiers shipped in plans@1.1.2+.`
    );
  }
  return plan;
}

function toSocial(
  legacyName: string,
  plan: HanzoSocialPlan
): PricingInnerInterface {
  const unlimited = (n: number) => (n === -1 ? 1_000_000 : n);
  return {
    current: legacyName,
    month_price: plan.priceMonthly,
    year_price: plan.priceAnnual,
    channel: plan.limits.channels,
    posts_per_month: unlimited(plan.limits.postsPerMonth),
    image_generation_count: plan.limits.imageGenerationCount,
    generate_videos: plan.limits.generateVideos,
    team_members: plan.limits.teamMembers !== 0,
    community_features: plan.limits.communityFeatures,
    // featured_by_social is a legacy upstream flag — true when the tier
    // grants community features in our shape.
    featured_by_social: plan.limits.communityFeatures,
    ai: plan.limits.ai,
    import_from_channels: plan.limits.ai,
    image_generator: plan.limits.imageGenerationCount > 0,
    public_api: plan.limits.publicApi,
    webhooks: plan.limits.webhooks,
    autoPost: plan.limits.autoPost,
  };
}

export const pricing: PricingInterface = Object.fromEntries(
  Object.entries(LEGACY_TO_HANZO).map(([legacy, hanzoId]) => [
    legacy,
    toSocial(legacy, findSocialPlan(hanzoId)),
  ])
);
