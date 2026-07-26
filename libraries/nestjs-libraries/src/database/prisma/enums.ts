// Canonical vocabularies for the SQLite schema.
//
// SQLite has no native enum type, so Prisma stores these columns as String and
// generates no enum members. These const objects are the single source of truth:
// the value gives call sites `State.QUEUE`, the type of the same name gives them
// a union that admits nothing else. Recovered verbatim from the pre-SQLite schema
// so the persisted strings are unchanged.

export const OrderStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  CANCELED: 'CANCELED',
  COMPLETED: 'COMPLETED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const From = {
  BUYER: 'BUYER',
  SELLER: 'SELLER',
} as const;
export type From = (typeof From)[keyof typeof From];

export const State = {
  QUEUE: 'QUEUE',
  PUBLISHED: 'PUBLISHED',
  ERROR: 'ERROR',
  DRAFT: 'DRAFT',
} as const;
export type State = (typeof State)[keyof typeof State];

export const SubscriptionTier = {
  STANDARD: 'STANDARD',
  PRO: 'PRO',
  TEAM: 'TEAM',
  ULTIMATE: 'ULTIMATE',
} as const;
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

export const Period = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;
export type Period = (typeof Period)[keyof typeof Period];

export const Provider = {
  LOCAL: 'LOCAL',
  GITHUB: 'GITHUB',
  GOOGLE: 'GOOGLE',
  FARCASTER: 'FARCASTER',
  WALLET: 'WALLET',
  GENERIC: 'GENERIC',
} as const;
export type Provider = (typeof Provider)[keyof typeof Provider];

export const Role = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const APPROVED_SUBMIT_FOR_ORDER = {
  NO: 'NO',
  WAITING_CONFIRMATION: 'WAITING_CONFIRMATION',
  YES: 'YES',
} as const;
export type APPROVED_SUBMIT_FOR_ORDER = (typeof APPROVED_SUBMIT_FOR_ORDER)[keyof typeof APPROVED_SUBMIT_FOR_ORDER];

export const CreationMethod = {
  UNKNOWN: 'UNKNOWN',
  WEB: 'WEB',
  MCP: 'MCP',
  API: 'API',
  AUTOPOST: 'AUTOPOST',
  CLI: 'CLI',
} as const;
export type CreationMethod = (typeof CreationMethod)[keyof typeof CreationMethod];

export const ShortLinkPreference = {
  ASK: 'ASK',
  YES: 'YES',
  NO: 'NO',
} as const;
export type ShortLinkPreference = (typeof ShortLinkPreference)[keyof typeof ShortLinkPreference];

export const AnnouncementColor = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
} as const;
export type AnnouncementColor = (typeof AnnouncementColor)[keyof typeof AnnouncementColor];
