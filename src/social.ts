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

import {
  AUDIENCE_PRODUCT,
  readAudiences,
  writeAudiences,
  type Audience,
} from '~/audience'
import { providerPath, readConnections, settleConnections, type CatalogRow } from '~/catalog'
import {
  credentialsUnshipped,
  parseCredentials,
  type OrgApps,
  type OrgAppWrite,
} from '~/credentials'

// ── what the platform answers ────────────────────────────────────────────────

/** A publish target: one network, one handle. */
export interface Account {
  id: string
  /** The network: x, facebook, instagram, linkedin, tiktok, youtube, threads,
   *  bluesky, mastodon, pinterest, reddit, telegram-bot or discord-webhook. */
  provider: string
  handle: string
  /** The platform id the sealed credential is kept under. Absent for a handle
   *  typed in by hand, which has no consent behind it and cannot be posted to. */
  externalId?: string
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

/** One input of a connector that takes a credential instead of a consent. */
export interface ConnectorField {
  name: string
  label: string
  /** Masked on entry, sealed on save, never read back. */
  secret: boolean
  required: boolean
  help?: string
  /** What an empty input stands for. */
  default?: string
}

/** A network's connector, and this org's standing with it. */
export interface Connection {
  id: string
  name: string
  description: string
  category: string
  /** Whether a person can connect it now: the deployment holds the app for a
   *  consent, or the connector takes a credential and needs no app at all. */
  available: boolean
  /** Whether THIS ORG has connected at least one account. */
  connected: boolean
  /** `oauth` is a consent at the network's own site; `credential` is a form. */
  kind?: string
  /** The form of a credential connector. */
  fields?: ConnectorField[]
  connection?: {
    account: string
    externalId: string
    scopes: string[]
    connectedAt: string
  }
  /** Every account connected, not only the first. */
  accounts?: { account: string; externalId: string; label?: string; kind?: string }[]
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
  /**
   * Do not ask yet. The Connect screen learns which ids to read from
   * `/v1/social/providers`; asking with an empty list would record an empty
   * answer, and an empty answer is what "not in the catalog" is decided from.
   */
  hold = false,
): Read<T> {
  const [it, setIt] = useState<T | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [turn, setTurn] = useState(0)

  // The caller's `get` closes over its own arguments and is a new function every
  // render; the deps it was built from are what this actually depends on.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchIt = useCallback(get, deps)

  useEffect(() => {
    if (!http || hold) return
    let live = true
    setFailed(null)
    fetchIt(http)
      .then((got) => live && setIt(got))
      .catch((e: unknown) => live && setFailed(why(e)))
    return () => {
      live = false
    }
  }, [http, fetchIt, turn, hold])

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

interface SettingsView {
  config?: unknown
}

/** Which stored account is personal and which is the organization's.
 *  GET /v1/settings/social-audiences. A product never written answers an
 *  empty config, not a 404. */
export function useAudiences(http: HttpClient | null): Read<Record<string, Audience>> {
  return useRead(
    http,
    async (h) => {
      const view = await h.json<SettingsView>({ path: `/v1/settings/${AUDIENCE_PRODUCT}` })
      return readAudiences(view?.config)
    },
    [],
  )
}

async function putAudiences(
  http: HttpClient,
  change: (accounts: Record<string, Audience>) => void,
): Promise<void> {
  const view = await http.json<SettingsView>({ path: `/v1/settings/${AUDIENCE_PRODUCT}` })
  const accounts = readAudiences(view?.config)
  change(accounts)
  await http.json({
    method: 'PUT',
    path: `/v1/settings/${AUDIENCE_PRODUCT}`,
    body: { config: writeAudiences(view?.config, accounts) },
  })
}

/** Remember the kind of one account. The account row itself cannot hold it. */
export function saveAudience(http: HttpClient, id: string, audience: Audience): Promise<void> {
  return putAudiences(http, (accounts) => {
    accounts[id] = audience
  })
}

/** Drop a kind when its account is gone. A missing id is not an error. */
export function forgetAudience(http: HttpClient, id: string): Promise<void> {
  return putAudiences(http, (accounts) => {
    delete accounts[id]
  })
}

/**
 * The org's own developer apps: GET /v1/social/credentials.
 *
 * A 404 or 501 is the route not being on this deployment, which is an answer,
 * not a failure — the Keys screen uses it to stay off the rail. Any other
 * refusal is a failure of a route that does exist.
 */
export function useOrgApps(http: HttpClient | null): Read<OrgApps> {
  return useRead(
    http,
    async (h) => {
      try {
        const body = await h.json<unknown>({ path: '/v1/social/credentials' })
        return { unshipped: false, apps: parseCredentials(body) }
      } catch (e) {
        if (credentialsUnshipped(e)) return { unshipped: true, apps: [] }
        throw e
      }
    },
    [],
  )
}

/**
 * Write the apps the person edited: PUT /v1/social/credentials.
 *
 * Only those providers are in the body. A secret is included only when they
 * typed one or asked to clear it — see `credentialWrite`.
 */
export function saveOrgApps(http: HttpClient, apps: OrgAppWrite[]): Promise<void> {
  return http
    .raw({ method: 'PUT', path: '/v1/social/credentials', body: { apps } })
    .then(() => undefined)
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
 * One network's row in the connector catalog.
 *
 * `failed` is that id's own refusal. A 404 is not a failure: the row is
 * present and `connection` is absent, which is "not in the catalog".
 */
export type Standing = CatalogRow<Connection>

/**
 * The org's credential standing, network by network.
 *
 * One `GET /v1/provider/:id` per network the social API named, in parallel.
 * The list route answers the whole registry and takes no filter — about 755
 * connectors, most of a megabyte — and the console's Integrations page is the
 * caller that wants all of them. This screen wants the networks a post can name. An id the registry
 * does not have is a 404 and stays a missing row; it is not dropped into the
 * same bucket as a read that never came back.
 *
 * `hold` while the social list itself has not answered. Asking with no ids
 * would resolve to an empty catalog, and an empty catalog is the sentence
 * "not in the catalog".
 */
export function useConnections(
  http: HttpClient | null,
  networks: string[],
  hold = false,
): Read<Standing[]> {
  const only = networks.join(',')
  return useRead(
    http,
    async (h) => {
      const ids = only ? only.split(',') : []
      const rows = await readConnections(ids, (id) =>
        h.json<Connection>({ path: providerPath(id) }),
      )
      return settleConnections(rows, why)
    },
    [only],
    hold,
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

/**
 * Change a stored post: PUT /v1/social/posts/:id.
 *
 * A REPLACEMENT, not a merge — the platform says so, and omitting `content`
 * is a 400, omitting `media` clears the attachments, omitting `status` resets
 * the post to draft. Callers therefore send the whole post they mean to keep,
 * plus the fields they are changing. A partial body here was how reschedule
 * wiped a caption.
 */
export function edit(http: HttpClient, post: Post, draft: Partial<Draft>): Promise<Post> {
  return http.json<Post>({
    method: 'PUT',
    path: `/v1/social/posts/${encodeURIComponent(post.id)}`,
    body: {
      content: draft.content ?? post.content,
      channel: draft.channel ?? post.channel,
      media: draft.media ?? post.media,
      scheduleAt: draft.scheduleAt ?? post.scheduleAt,
      status: draft.status ?? post.status,
    },
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

/** What `connect` answers: the network's consent address for the browser to
 *  follow, or `connected` when a credential was taken and verified. */
export interface Connected {
  authorizeUrl?: string
  connected?: boolean
  account?: string
}

/**
 * Begin the org's consent for one network: POST /v1/provider/:provider/connect.
 *
 * With no `fields` the body carries no `token` key, and that absence is what
 * selects the three-legged flow over sealing a credential directly — the
 * platform answers the network's own consent URL for the browser to follow. A
 * deployment without the network's app credentials answers 503 here, which is
 * why the card offers this only where `available` is true.
 *
 * With `fields` — Bluesky's handle and app password, Mastodon's server and
 * token, a Telegram bot, a Discord webhook — the platform verifies them with
 * the network and seals them, and answers `connected`. Nothing is stored for a
 * credential the network refuses. `back` is the page the consent returns to.
 */
export function connect(
  http: HttpClient,
  provider: string,
  how: { fields?: Record<string, string>; back?: string } = {},
): Promise<Connected> {
  const body: Record<string, unknown> = {}
  if (how.fields) body.fields = how.fields
  if (how.back) body.return = how.back
  return http.json<Connected>({
    method: 'POST',
    path: `/v1/provider/${encodeURIComponent(provider)}/connect`,
    body,
  })
}

/**
 * Revoke and forget the org's credential: POST /v1/provider/:provider/disconnect.
 *
 * With an `account` — the platform id the account lists — only that account
 * goes and the org's others stay; the platform also takes it off the list this
 * app shows. Without one, every account of the network goes.
 */
export function disconnect(
  http: HttpClient,
  provider: string,
  account?: string,
): Promise<{ disconnected: boolean }> {
  return http.json<{ disconnected: boolean }>({
    method: 'POST',
    path: `/v1/provider/${encodeURIComponent(provider)}/disconnect`,
    body: account ? { account } : {},
  })
}

/** Copy invented from a brief, still only words — nothing is stored or sent. */
export interface Copy {
  shared: string
  /** Per-network wording. A missing key means that network still shares. */
  apart: Record<string, string>
}

/**
 * Invent a caption from a brief: POST /v1/chat/completions.
 *
 * THIS DOES NOT PUBLISH. It does not store a post, it does not file a CMS
 * document, and it does not call the publish route. The words come back here
 * so a person can read them, cut them, and then choose Save draft or Schedule
 * — the same control they would have used had they typed the words.
 *
 * The CMS generate route (`POST /v1/content/generate`) files a document and
 * answers a name, not the copy, so it is the wrong door for a composer that
 * still has to show the words.
 */
export async function invent(http: HttpClient, brief: string, networks: string[]): Promise<Copy> {
  const listed = networks.length ? networks.join(', ') : 'x, facebook, instagram, linkedin, tiktok, youtube, threads, bluesky, mastodon, pinterest, reddit, telegram-bot, discord-webhook'
  const got = await http.json<{
    choices?: { message?: { content?: string | null } }[]
  }>({
    method: 'POST',
    path: '/v1/chat/completions',
    body: {
      model: 'hanzo/zen',
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content:
            'You write social posts. Reply with JSON only, no fences: ' +
            '{"shared":"...","apart":{"x":"..."}}. "shared" is the default caption. ' +
            `"apart" is optional per-network wording, keyed only by: ${listed}. ` +
            "Honour each network's character limit. No hashtag walls. No preamble.",
        },
        { role: 'user', content: brief },
      ],
    },
  })
  const raw = (got.choices?.[0]?.message?.content ?? '').trim()
  return readCopy(raw)
}

/** Pull a Copy out of a model reply. A reply that is not JSON is the shared caption. */
function readCopy(raw: string): Copy {
  const empty: Copy = { shared: '', apart: {} }
  if (!raw) return empty
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start < 0 || end <= start) return { shared: stripped, apart: {} }
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as {
      shared?: unknown
      apart?: unknown
    }
    const shared = typeof parsed.shared === 'string' ? parsed.shared : stripped
    const apart: Record<string, string> = {}
    if (parsed.apart && typeof parsed.apart === 'object') {
      for (const [k, v] of Object.entries(parsed.apart as Record<string, unknown>)) {
        if (typeof v === 'string' && v.trim()) apart[k] = v
      }
    }
    return { shared, apart }
  } catch {
    return { shared: stripped, apart: {} }
  }
}
