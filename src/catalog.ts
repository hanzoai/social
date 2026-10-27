// What one Connect card may say about the connector catalog.
//
// GET /v1/provider is the whole registry — hundreds of connectors, most of
// them nothing a post can name — and a card used to treat "that read has not
// answered" the same as "this network is not in it". The two are not the same
// fact, and neither is "it is in the catalog but this deployment holds no app
// credentials". This file is the distinction, with no React in it, so the
// sentence can be checked without a browser.

/** Where the read of one network's connector stands. */
export type CatalogState = 'loading' | 'failed' | 'ready'

/**
 * The environment variables that make `available` true.
 *
 * These are the connect plane's names (hanzo-inc/cloud `apps/provider`,
 * catalog.go and x.go): the ones `POST /v1/provider/:id/connect` refuses
 * without. `/v1/social/providers` reports the publish plane, and that plane
 * has asked for a different set — `X_API_KEY`, `FACEBOOK_APP_ID`,
 * `THREADS_APP_ID` — so a card that repeated only that set would tell an
 * operator to set variables Connect does not read.
 *
 * A network this table does not name falls back to the social read. The
 * table is the networks that take a developer app, which is also the set the
 * Keys screen offers; the networks that take the organization's own credential
 * (Bluesky, Mastodon, Telegram, Discord) need nothing from a deployment and are
 * not in it. It is not a second catalog.
 */
export const CONNECT_CREDENTIALS: Record<string, readonly string[]> = {
  x: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
  facebook: ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET'],
  instagram: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET'],
  linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
  tiktok: ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET'],
  youtube: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
  threads: ['THREADS_CLIENT_ID', 'THREADS_CLIENT_SECRET'],
  pinterest: ['PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET'],
  reddit: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],
}

/** The three lines under a network's name. Null means that line is absent. */
export interface CardCopy {
  /** The catalog's own pitch, or why there is no pitch yet. */
  caption: string
  /** Present, but this deployment cannot start consent. Names the variables. */
  needs: string | null
  /**
   * The publish plane's missing names, when they are not already `needs`.
   * Same words the card used before, so a deployment that is connectable and
   * still cannot publish keeps the sentence it had.
   */
  publishing: string | null
}

export function catalogState(
  answered: boolean,
  failed: boolean,
  row: { failed?: string } | undefined,
): CatalogState {
  if (!answered) return failed ? 'failed' : 'loading'
  if (row?.failed) return 'failed'
  return 'ready'
}

function clean(names: readonly string[] | undefined): string[] {
  return (names ?? []).map((name) => name.trim()).filter(Boolean)
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((name, i) => name === right[i])
}

/**
 * The words on one card.
 *
 * `connection` is passed only once the catalog has answered for this id.
 * A missing description is a quiet pitch, not evidence the network is absent —
 * absence is `catalog === 'ready'` and no connection.
 */
/** Whether a network takes a developer app, so the Keys screen offers it. */
export function takesApp(provider: string): boolean {
  return provider in CONNECT_CREDENTIALS
}

export function cardCopy(input: {
  name: string
  provider: string
  catalog: CatalogState
  connection?: { description?: string; available?: boolean }
  missingCredentials?: string[]
  /** A per-id failure. The screen-level failure stays on the banner. */
  detail?: string | null
}): CardCopy {
  const missing = clean(input.missingCredentials)
  const connectVars = CONNECT_CREDENTIALS[input.provider]

  let caption: string
  if (input.catalog === 'loading') caption = 'Reading the connector catalog…'
  else if (input.catalog === 'failed') {
    const whyNot = input.detail?.trim()
    caption = whyNot
      ? `The connector catalog could not be read. ${whyNot}`
      : 'The connector catalog could not be read.'
  } else if (!input.connection) caption = 'This network is not in the connector catalog.'
  else caption = input.connection.description?.trim() ?? ''

  const unavailable = input.catalog === 'ready' && input.connection && !input.connection.available
  let needs: string | null = null
  if (unavailable) {
    const vars = connectVars ? [...connectVars] : missing
    needs = vars.length
      ? `This deployment holds no app credentials for ${input.name}. Set ${vars.join(', ')} on the deployment before there is anything to consent to.`
      : `This deployment holds no app credentials for ${input.name}, so there is nothing to consent to yet.`
  }

  const alreadyNamed = Boolean(unavailable && (connectVars ? sameNames(connectVars, missing) : missing.length > 0))
  const publishing =
    missing.length && !alreadyNamed
      ? `Publishing to ${input.name} also needs ${missing.join(', ')} set on the deployment.`
      : null

  return { caption, needs, publishing }
}

/** `GET /v1/provider/:id` — one connector, not the registry. */
export function providerPath(id: string): string {
  return `/v1/provider/${encodeURIComponent(id)}`
}

/** A refusal that means "no such provider", rather than "the read failed". */
export function providerMissing(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { status?: unknown }).status === 404
}

export interface CatalogHit<T> {
  id: string
  connection?: T
  error?: unknown
}

/**
 * Read just the networks a post can name.
 *
 * One GET /v1/provider/:id each, not the whole registry. The list route takes
 * no filter, and the console's Integrations page is the caller that wants
 * every card — this read must not change what that route returns. An unknown
 * id is a 404 and is absence; any other refusal is kept on that id so one
 * network's failure is not reported as six networks missing.
 */
export async function readConnections<T>(
  ids: string[],
  get: (id: string) => Promise<T>,
): Promise<CatalogHit<T>[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        return { id, connection: await get(id) }
      } catch (error) {
        if (providerMissing(error)) return { id }
        return { id, error }
      }
    }),
  )
}

export interface CatalogRow<T> {
  id: string
  connection?: T
  failed?: string
}

/**
 * Collapse a read into rows the cards can render.
 *
 * Every id failing is one failure of the catalog, thrown so the screen's
 * banner can say why. A mix of answers stays a mix.
 */
export function settleConnections<T>(
  rows: CatalogHit<T>[],
  explain: (error: unknown) => string,
): CatalogRow<T>[] {
  if (rows.length > 0 && rows.every((row) => row.error !== undefined)) throw rows[0].error
  return rows.map((row) => ({
    id: row.id,
    connection: row.connection,
    failed: row.error !== undefined ? explain(row.error) : undefined,
  }))
}
