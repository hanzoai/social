// THE PLATFORM, AS A TEST SERVES IT.
//
// Every screen reads `/v1` and nothing else, so a test that answers `/v1`
// answers the whole product. The fixtures below are the platform's OWN shapes —
// `{data: […]}` for the social plane, `{providers: […]}` for the provider plane,
// unix SECONDS on every timestamp — because @hanzo/ai unwraps a named envelope
// and reads a re-shaped one as EMPTY rather than throwing. A fixture with the
// wrong key therefore draws a screen that looks like a working empty product,
// which is the one failure these specs exist to catch: every populated assertion
// names a row, not a container.
//
// NOTHING LEAVES THE MACHINE. One handler answers the gateway, one answers the
// issuer, and any other host is aborted — so a screen that starts talking to
// something new fails here rather than passing on somebody's live data.

import { expect, type Page, type Route } from '@playwright/test'

/** The six addresses this app answers, and the heading each one draws. */
export const SCREENS = [
  { path: '/', title: 'Overview' },
  { path: '/compose', title: 'Compose' },
  { path: '/posts', title: 'Posts' },
  { path: '/calendar', title: 'Calendar' },
  { path: '/accounts', title: 'Accounts' },
  { path: '/analytics', title: 'Analytics' },
] as const

/** The tenant every fixture belongs to, and the person reading it. */
export const ORG = 'acme'
const SUBJECT = 'u-e2e'

/**
 * A moment on one day of the month the calendar opens on, in unix SECONDS.
 *
 * The calendar opens on TODAY's month and `src/time.ts` groups by the LOCAL
 * calendar day, so a fixture pinned to a fixed date would fall outside the grid
 * eleven months of the year. Days 1–28 are in every month; the specs use 20 and
 * 24, which no adjacent month's padding can also number.
 */
export function onDay(date: number, hour = 12, minute = 0): number {
  const today = new Date()
  return Math.floor(
    new Date(today.getFullYear(), today.getMonth(), date, hour, minute).getTime() / 1000,
  )
}

/** The month the calendar opens on, as its heading writes it. */
export function openMonth(): string {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

/** GET /v1/social/summary — the org's roll-up, and the four counts every screen
 *  that shows a percentage divides by. */
export const SUMMARY = { accounts: 2, posts: 5, published: 2, scheduled: 2 }

/** GET /v1/social/providers — publish-readiness per network on THIS deployment.
 *  Two configured, one not, so both halves of the Accounts card are exercised. */
export const NETWORKS = [
  { provider: 'x', credentialsConfigured: true },
  { provider: 'linkedin', credentialsConfigured: true },
  {
    provider: 'youtube',
    credentialsConfigured: false,
    missingCredentials: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
  },
]

/** GET /v1/social/accounts — the publish targets. YouTube has none, which is
 *  what makes the composer's "nowhere to go" warning reachable. */
export const ACCOUNTS = [
  {
    id: 'acct_x',
    provider: 'x',
    handle: '@acme',
    status: 'connected',
    createdAt: onDay(2),
    updatedAt: onDay(2),
  },
  {
    id: 'acct_li',
    provider: 'linkedin',
    handle: 'Acme Inc',
    status: 'connected',
    createdAt: onDay(2),
    updatedAt: onDay(2),
  },
]

/** The platform's own refusal, verbatim: RFC 7807 `detail`, naming the
 *  environment variables a deployment has not set. Every screen that reports a
 *  failure reports THIS sentence, so the specs assert it whole. */
export const REFUSAL =
  'linkedin needs LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET (set as deployment env) plus a connected account access token'

/**
 * GET /v1/social/posts — five posts in four states.
 *
 * The counts agree with SUMMARY on purpose: the Analytics headline divides the
 * roll-up's `published` by its `posts`, and the by-network tallies are counted
 * off these rows, so a mismatch would make one of the two assertions unfalsifiable.
 */
export const POSTS = [
  {
    id: 'post_ship',
    content: 'Shipping the calendar today.',
    channel: 'x',
    status: 'published',
    scheduleAt: 0,
    media: [],
    accountId: 'acct_x',
    externalId: 'x-88213',
    createdAt: onDay(20, 8),
    updatedAt: onDay(20, 9),
  },
  {
    id: 'post_note',
    content: 'A longer note on how the queue works.',
    channel: 'linkedin',
    status: 'published',
    scheduleAt: 0,
    media: [],
    accountId: 'acct_li',
    externalId: 'li-4410',
    createdAt: onDay(20, 10),
    updatedAt: onDay(20, 11),
  },
  {
    id: 'post_soon',
    content: "Thursday's announcement.",
    channel: 'x',
    status: 'scheduled',
    scheduleAt: onDay(24, 9, 30),
    media: [],
    createdAt: onDay(20, 12),
    updatedAt: onDay(20, 12),
  },
  {
    id: 'post_film',
    content: 'The launch film.',
    channel: 'youtube',
    status: 'scheduled',
    scheduleAt: onDay(24, 17, 0),
    media: ['https://cdn.example.test/launch.mp4'],
    createdAt: onDay(20, 13),
    updatedAt: onDay(20, 13),
  },
  {
    id: 'post_stuck',
    content: 'The one that did not go out.',
    channel: 'linkedin',
    status: 'failed',
    scheduleAt: 0,
    media: [],
    error: REFUSAL,
    createdAt: onDay(20, 14),
    updatedAt: onDay(20, 15),
  },
]

/**
 * GET /v1/provider — the connector catalog and this org's standing with it.
 *
 * Slack and GitHub are in it because they are in the real one: the catalog
 * carries every connector the platform knows, and the Accounts screen narrows it
 * to the networks the social plane can publish to. A card for Slack would be a
 * control wired to nothing, so the spec asserts neither appears.
 */
export const CONNECTORS = [
  {
    id: 'x',
    name: 'X',
    description: 'Post to X as your organization.',
    category: 'Marketing',
    scopes: ['tweet.write', 'users.read'],
    available: true,
    connected: true,
    connection: {
      account: '@acme',
      externalId: 'x-org-1',
      scopes: ['tweet.write', 'users.read'],
      connectedAt: new Date(onDay(2) * 1000).toISOString(),
    },
    modes: ['oauth'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Share to a LinkedIn page.',
    category: 'Marketing',
    scopes: ['w_member_social'],
    available: true,
    connected: false,
    modes: ['oauth'],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Upload to a YouTube channel.',
    category: 'Marketing',
    scopes: ['youtube.upload'],
    available: false,
    connected: false,
    modes: ['oauth'],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Not a publish target on this surface.',
    category: 'Communication',
    scopes: [],
    available: true,
    connected: true,
    modes: ['oauth'],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Not a publish target on this surface.',
    category: 'Developer',
    scopes: [],
    available: true,
    connected: false,
    modes: ['oauth'],
  },
]

/** What the app asked the platform for, in order. */
export interface Traffic {
  /** Every `/v1` address, method and search string included. */
  asked: string[]
  /** The ones nothing served — a stale path, or one this harness has not met. */
  unserved: string[]
}

const local = (url: URL): boolean =>
  url.hostname === 'localhost' || url.hostname === '127.0.0.1'

const body = (route: Route, value: unknown, status = 200): Promise<void> =>
  route.fulfill({
    status,
    headers: {
      'content-type': 'application/json',
      // The issuer is a second origin, and a fulfilled answer still has to say
      // the reader may read it.
      'access-control-allow-origin': '*',
    },
    body: JSON.stringify(value),
  })

/**
 * Answer the platform, and record what was asked.
 *
 * The two handlers cannot both match one request — one takes this origin's
 * `/v1`, the other takes every other host — so there is no question of which
 * runs, and a request to a host neither expects is aborted rather than sent.
 */
export async function platform(page: Page): Promise<Traffic> {
  const seen: Traffic = { asked: [], unserved: [] }

  await page.route(
    (url) => local(url) && url.pathname.startsWith('/v1/'),
    async (route) => {
      const url = new URL(route.request().url())
      const path = url.pathname
      seen.asked.push(`${route.request().method()} ${path}${url.search}`)

      if (path === '/v1/social/summary') return body(route, SUMMARY)
      if (path === '/v1/social/providers') return body(route, { data: NETWORKS })
      if (path === '/v1/social/accounts') return body(route, { data: ACCOUNTS })
      if (path === '/v1/social/posts') {
        const state = url.searchParams.get('status')
        return body(route, { data: state ? POSTS.filter((p) => p.status === state) : POSTS })
      }
      if (path === '/v1/provider') return body(route, { providers: CONNECTORS })

      // An address nothing here serves is the platform's own 404, in the
      // platform's own words — so a screen reporting it reports `detail`, and
      // the spec that reads `unserved` names the path that moved.
      seen.unserved.push(`${route.request().method()} ${path}`)
      return body(
        route,
        {
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: `no route serves ${path}`,
        },
        404,
      )
    },
  )

  await page.route(
    (url) => !local(url),
    async (route) => {
      const url = new URL(route.request().url())
      if (url.hostname !== 'hanzo.id') return route.abort()
      // The issuer, as far as this app reads it: where the endpoints are, and
      // who the stored token names. Nothing here mints or exchanges anything —
      // the token is already in storage before the first script runs.
      if (url.pathname === '/.well-known/openid-configuration')
        return body(route, {
          issuer: 'https://hanzo.id',
          authorization_endpoint: 'https://hanzo.id/v1/iam/oauth/authorize',
          token_endpoint: 'https://hanzo.id/v1/iam/oauth/token',
          userinfo_endpoint: 'https://hanzo.id/v1/iam/oauth/userinfo',
          jwks_uri: 'https://hanzo.id/v1/iam/.well-known/jwks',
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          scopes_supported: ['openid', 'email', 'profile'],
        })
      if (url.pathname === '/v1/iam/oauth/userinfo')
        return body(route, {
          sub: SUBJECT,
          name: 'Ada Lovelace',
          email: 'ada@acme.test',
          owner: ORG,
        })
      return route.abort()
    },
  )

  return seen
}

const segment = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url')

/**
 * The session, as the browser keeps it.
 *
 * `@hanzo/iam` reads the bearer out of `localStorage` on mount and answers
 * authenticated without a round trip, and `src/token.ts` reads the tenant off
 * the token's own `orgs` claim — so a signed-in browser is four keys, and no
 * sign-in flow has to be driven. `hanzo:who` carries the same subject the token
 * names, because `own()` empties the last person's keys when it does not.
 *
 * An init script rather than a write after `goto`: `Root` reads storage in its
 * first render, which is before a test could get a word in.
 */
export async function signIn(page: Page): Promise<void> {
  const token = [
    segment({ alg: 'none', typ: 'JWT' }),
    segment({
      sub: SUBJECT,
      name: 'Ada Lovelace',
      email: 'ada@acme.test',
      owner: ORG,
      orgs: [{ org: ORG, role: 'owner' }],
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    'e2e',
  ].join('.')

  await page.addInitScript(
    (session: { token: string; org: string; who: string; until: number }) => {
      window.localStorage.setItem('hanzo_iam_access_token', session.token)
      window.localStorage.setItem('hanzo_iam_expires_at', String(session.until))
      window.localStorage.setItem('hanzo_iam_current_org', session.org)
      window.localStorage.setItem('hanzo:who', session.who)
    },
    { token, org: ORG, who: SUBJECT, until: Date.now() + 3600_000 },
  )
}

/** Signed in, with the platform answering. The state every populated spec opens in. */
export async function signedIn(page: Page): Promise<Traffic> {
  const seen = await platform(page)
  await signIn(page)
  return seen
}

/**
 * The pane beside the rail — the screen itself.
 *
 * The rail carries a link per screen, so `Posts` and `Calendar` are words in two
 * places at once and an unscoped match is ambiguous. The frame is a row of
 * exactly two children (`src/frame.tsx`), so the second one is the screen.
 */
export const pane = (page: Page) => page.locator('.rail + div')

/** One of the overview's count cards, as a whole: the number and what it counts. */
export const tile = (page: Page, says: string) =>
  pane(page).getByText(says, { exact: true }).locator('..')

/** The screen this address drew. */
export async function open(page: Page, path: string, title: string): Promise<void> {
  await page.goto(path)
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
}
