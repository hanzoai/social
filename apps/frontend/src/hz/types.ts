// Hanzo Social — shared types. These mirror the unified Hanzo Cloud
// /v1/social/* and /v1/marketing/* JSON exactly (github.com/hanzoai/cloud
// clients/social + clients/marketing). Pure types + the ONE channel
// vocabulary; safe to import from both server and client code.

// Channel is the target network. Derived from the cloud's ONE ordered
// provider vocabulary (providerOrder in clients/social/publish.go).
export const CHANNELS = [
  'x',
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'youtube',
  'threads',
] as const;
export type Channel = (typeof CHANNELS)[number];

// Post lifecycle. Four user-settable states (the cloud also holds a transient
// 'publishing' during a publish attempt, never user-settable).
export const POST_STATUSES = [
  'draft',
  'scheduled',
  'published',
  'failed',
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

// Post mirrors clients/social/store.go Post. media is always an array (never
// null) — the cloud serializes it that way.
export interface Post {
  id: string;
  content: string;
  channel: Channel;
  status: PostStatus;
  scheduleAt: number; // unix seconds; 0 = not scheduled
  media: string[]; // image URLs
  accountId?: string;
  externalId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// Draft body for create/update. Only content is required by the cloud.
export interface PostInput {
  content: string;
  channel: Channel;
  status: PostStatus;
  scheduleAt: number;
  media: string[];
}

// Campaign mirrors clients/marketing/store.go Campaign. budget/spend are cents.
export const CAMPAIGN_CHANNELS = [
  'email',
  'sms',
  'social',
  'meta',
  'google',
  'tiktok',
] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

export const CAMPAIGN_STATUSES = [
  'draft',
  'active',
  'paused',
  'completed',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  objective: string;
  budget: number; // cents
  spend: number; // cents
  scheduledAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface CampaignInput {
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  objective: string;
  budget: number;
  scheduledAt: number;
}

// ProviderCapability mirrors clients/social/publish.go ProviderCapability —
// the honest, live publish-readiness of each network.
export interface ProviderCapability {
  provider: Channel;
  credentialsConfigured: boolean;
  missingCredentials?: string[];
}

// Summary mirrors GET /v1/social/summary.
export interface SocialSummary {
  posts: number;
  scheduled: number;
  published: number;
  accounts: number;
}

// MarketingSummary mirrors GET /v1/marketing/summary.
export interface MarketingSummary {
  campaigns: number;
  active: number;
  budget: number;
  spend: number;
}
