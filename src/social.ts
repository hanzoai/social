// The platform, as this app speaks it. Every `/v1` address on this surface is
// written here once and nowhere else, so a screen asks for posts rather than
// building a path, and a route that moves is one edit.
//
// TWO PLANES, and they are not the same thing.
//
//   /v1/social        the org's channels and the posts it publishes to them.
//                     An ACCOUNT here is a publish target — a network and a
//                     handle. A POST is content on one channel, with a state.
//
//   /v1/provider   the org's CREDENTIAL for a network: the OAuth consent a
//                     person gives once, sealed into KMS and never returned.
//                     This is where `Connect` actually leads.
//
// A network needs both before anything goes out, and the Accounts screen shows
// them side by side rather than folding one into the other — they are separately
// true, and a screen that merged them would have to lie about which was missing.
//
// NO CREDENTIAL EVER REACHES THIS CODE. `GET /v1/connection/:id/token`
// is the one custody exit the platform offers and nothing here calls it: a
// browser has no use for a provider token, and a surface that held one would be
// a place to leak it from. The publisher reads it server-side.

import { useCallback, useEffect, useState } from 'react'
import type { HttpClient } from '@hanzo/ai'

// ── what the platform answers ────────────────────────────────────────────────

/** A publish target: one network, one handle. */
export interface Account {
  id: string
  /** x, facebook, instagram, linkedin, tiktok, youtube or threads. */
  provider: string
  handle: string
  /** connected, disconnected or error. Only a connected account is a target. */
  status: string
  createdAt: number
  updatedAt: number
}

/** Content on one channel, and where it got to. */
export interface Post {
  id: string
  content: string
  /** The network this post targets. A post has ONE. */
  channel: string
  /** draft, scheduled, published or failed. `publishing` is a transient claim a
   *  reader sees only mid-attempt; it is never settable from here. */
  status: string
  /** Unix SECONDS, and meaningful only while the status is scheduled. */
  scheduleAt: number
  /** Media as addresses. Always an array. */
  media: string[]
  /** Set by the publish path, never by an update: which account it went through,
   *  the id the network gave it back, and why the last attempt failed. */
  accountId?: string
  externalId?: string
  error?: string
  createdAt: number
  updatedAt: number
}

/** One network's publish-readiness on THIS deployment. */
export interface Network {
  provider: string
  /** Whether the deployment holds the network's OAuth app credentials. It says
   *  nothing about whether this org has connected an account. */
  credentialsConfigured: boolean
  /** The environment variables still unset, by NAME. Never a value. */
  missingCredentials?: string[]
}

/** The org's roll-up. Four counts, one read. */
export interface Summary {
  accounts: number
  posts: number
  published: number
  scheduled: number
}

/** A network's connector, and this org's standing with it. */
export interface Connection {
  id: string
  name: string
  description: string
  category: string
  /** Whether the DEPLOYMENT holds this connector's app credentials. */
  available: boolean
  /** Whether THIS ORG has given consent. */
  connected: boolean
  connection?: {
    account: string
    externalId: string
    scopes: string[]
    connectedAt: string
  }
}

/**
 * Why the platform refused, in ITS words.
 *
 * The platform answers RFC 7807: the actionable sentence is `detail` — "youtube
 * needs YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET (set as deployment env) plus a
 * connected account access token". The SDK's own extractor looks for `msg` and
 * `error`, finds neither, and falls back to a status-code phrase: "The service
 * is not running right now." That phrase is true and useless — it names nothing
 * anybody can supply.
 *
 * So the refusal is read off the error's BODY, which `APIError` carries whole,
 * and the SDK's message is the fallback rather than the answer. One function,
 * because a screen that reported a refusal any other way would report a
 * different product's refusal.
 */
export function why(e: unknown): string {
  const body = (e as { body?: unknown } | null)?.body
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) return detail
  }
  return e instanceof Error ? e.message : String(e)
}

// ── reading ──────────────────────────────────────────────────────────────────

export interface Read<T> {
  /** Null until the first answer arrives. */
  it: T | null
  failed: string | null
  again: () => void
}

/**
 * One read, with its loading and its failure.
 *
 * Every screen wants the same three things and would otherwise grow its own
 * copy, and three copies of "did this come back yet" disagree at the edges. The
 * client is the dependency: it is rebuilt when the organization changes, so a
 * switch re-reads everything without a screen having to know that.
 *
 * `live` rather than an abort: an answer that arrives after the screen moved on
 * is discarded instead of setting state on a component that is gone.
 */
function useRead<T>(
  http: HttpClient | null,
  get: (http: HttpClient) => Promise<T>,
  deps: unknown[],
): Read<T> {
  const [it, setIt] = useState<T | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [turn, setTurn] = useState(0)

  // The caller's `get` closes over its own arguments and is a new function every
  // render; the deps it was built from are what this actually depends on.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchIt = useCallback(get, deps)

  useEffect(() => {
    if (!http) return
    let live = true
    setFailed(null)
    fetchIt(http)
      .then((got) => live && setIt(got))
      .catch((e: unknown) => live && setFailed(why(e)))
    return () => {
      live = false
    }
  }, [http, fetchIt, turn])

  return { it, failed, again: () => setTurn((t) => t + 1) }
}

/** The org's roll-up: GET /v1/social/summary. */
export function useSummary(http: HttpClient | null): Read<Summary> {
  return useRead(http, (h) => h.json<Summary>({ path: '/v1/social/summary' }), [])
}

/** Which networks this deployment can publish to: GET /v1/social/providers.
 *  The live list, not a constant — it is per deployment. */
export function useNetworks(http: HttpClient | null): Read<Network[]> {
  return useRead(http, (h) => h.collection<Network>('data', { path: '/v1/social/providers' }), [])
}

/** The org's publish targets: GET /v1/social/accounts. */
export function useAccounts(http: HttpClient | null): Read<Account[]> {
  return useRead(http, (h) => h.collection<Account>('data', { path: '/v1/social/accounts' }), [])
}

/**
 * The org's posts: GET /v1/social/posts, newest-updated first.
 *
 * `status` narrows to one state — draft, scheduled, published or failed — and
 * the whole listing is one call, so a screen that wants several states reads
 * once and sorts here rather than making four requests.
 */
export function usePosts(http: HttpClient | null, status?: string): Read<Post[]> {
  return useRead(
    http,
    (h) =>
      h.collection<Post>('data', {
        path: '/v1/social/posts',
        query: status ? { status } : {},
      }),
    [status],
  )
}

/**
 * The org's credential standing, network by network: GET /v1/provider.
 *
 * The catalog carries every connector the platform knows — Slack, GitHub, the
 * rest — so it is narrowed to the networks the social API will actually publish
 * to. A card for a connector no post can name is a control wired to nothing.
 */
export function useConnections(
  http: HttpClient | null,
  networks: string[],
): Read<Connection[]> {
  const only = networks.join(',')
  return useRead(
    http,
    async (h) => {
      const all = await h.collection<Connection>('providers', { path: '/v1/provider' })
      const want = new Set(only ? only.split(',') : [])
      return all.filter((one) => want.has(one.id))
    },
    [only],
  )
}

// ── writing ──────────────────────────────────────────────────────────────────

/** What a post is made of, as the composer holds it. */
export interface Draft {
  content: string
  channel: string
  media: string[]
  /** Unix SECONDS. 0 is unscheduled. */
  scheduleAt: number
  /** draft or scheduled. A post is never CREATED published — publishing is what
   *  the publish route and the scheduler do. */
  status: string
}

/** Store a post: POST /v1/social/posts. A post scheduled for a time already
 *  past is published immediately, and the row that comes back says so. */
export function write(http: HttpClient, draft: Draft): Promise<Post> {
  return http.json<Post>({ method: 'POST', path: '/v1/social/posts', body: draft })
}

/** Change a stored post: PUT /v1/social/posts/:id. */
export function edit(http: HttpClient, id: string, draft: Partial<Draft>): Promise<Post> {
  return http.json<Post>({
    method: 'PUT',
    path: `/v1/social/posts/${encodeURIComponent(id)}`,
    body: draft,
  })
}

/** Forget a post: DELETE /v1/social/posts/:id. */
export function drop(http: HttpClient, id: string): Promise<unknown> {
  // 204: there is no body to parse. A refusal still throws.
  return http.raw({ method: 'DELETE', path: `/v1/social/posts/${encodeURIComponent(id)}` }).then(() => undefined)
}

/**
 * Send it now: POST /v1/social/posts/:id/publish.
 *
 * This is the one call on this surface that can answer 503, and the answer is
 * the useful part: no deployment carries the networks' OAuth app credentials
 * yet, so the platform reports exactly which are missing rather than reporting
 * a success that did not happen. The screens show that sentence verbatim.
 */
export function publish(http: HttpClient, id: string): Promise<Post> {
  return http.json<Post>({
    method: 'POST',
    path: `/v1/social/posts/${encodeURIComponent(id)}/publish`,
  })
}

/** Record a publish target: POST /v1/social/accounts. */
export function addAccount(
  http: HttpClient,
  it: { provider: string; handle: string },
): Promise<Account> {
  return http.json<Account>({ method: 'POST', path: '/v1/social/accounts', body: it })
}

/** Change a target's handle or connection state: PUT /v1/social/accounts/:id. */
export function editAccount(
  http: HttpClient,
  id: string,
  it: { handle?: string; status?: string },
): Promise<Account> {
  return http.json<Account>({
    method: 'PUT',
    path: `/v1/social/accounts/${encodeURIComponent(id)}`,
    body: it,
  })
}

/** Forget a target: DELETE /v1/social/accounts/:id. */
export function dropAccount(http: HttpClient, id: string): Promise<unknown> {
  return http.raw({ method: 'DELETE', path: `/v1/social/accounts/${encodeURIComponent(id)}` }).then(() => undefined)
}

/**
 * Begin the org's consent for one network: POST /v1/provider/:provider/connect.
 *
 * The body carries no `token` key, and that absence is what selects the
 * three-legged flow over sealing a credential directly — the platform answers
 * the network's own consent URL for the browser to follow. A deployment without
 * the network's app credentials answers 503 here, which is why the card offers
 * this only where `available` is true.
 */
export function connect(http: HttpClient, provider: string): Promise<{ authorizeUrl?: string }> {
  return http.json<{ authorizeUrl?: string }>({
    method: 'POST',
    path: `/v1/provider/${encodeURIComponent(provider)}/connect`,
    body: {},
  })
}

/** Revoke and forget the org's credential: POST /v1/provider/:provider/disconnect. */
export function disconnect(http: HttpClient, provider: string): Promise<{ disconnected: boolean }> {
  return http.json<{ disconnected: boolean }>({
    method: 'POST',
    path: `/v1/provider/${encodeURIComponent(provider)}/disconnect`,
    body: {},
  })
}
