// How a person connects a network, and what a card says about it.
//
// No React in this file, so the sentences can be checked without a browser.
//
// A network is connected one of two ways, and a card shows the one it has:
//
//   consent    The network's own sign-in, in a window. The deployment holds the
//              developer app. X, Facebook, Instagram, LinkedIn, TikTok, YouTube,
//              Threads, Pinterest and Reddit.
//   form       A credential the person holds, typed here and verified by the
//              network before anything is kept. Bluesky's app password,
//              Mastodon's access token, a Telegram bot, a Discord webhook.
//
// A consent network whose app the deployment does not hold has neither, and
// says so: it needs the owner's credentials, and the person reading cannot
// supply them.

import type { ConnectorField } from '~/social'

export type Way = 'consent' | 'form' | 'owner'

export function way(row: { available: boolean; kind?: string; fields?: ConnectorField[] } | undefined): Way {
  if (!row) return 'owner'
  if (row.kind === 'credential' && (row.fields?.length ?? 0) > 0) return 'form'
  return row.available ? 'consent' : 'owner'
}

export type Standing = { tone: 'up' | 'quiet'; says: string }

/** The word beside a network's name. */
export function standing(how: Way, accounts: number): Standing {
  if (accounts > 0) return { tone: 'up', says: accounts === 1 ? 'connected' : `${accounts} connected` }
  if (how === 'owner') return { tone: 'quiet', says: 'needs owner credentials' }
  return { tone: 'quiet', says: 'not connected' }
}

/** The label on the button. A second account on a network is "another". */
export function connectLabel(name: string, accounts: number): string {
  return accounts > 0 ? `Connect another ${name} account` : `Connect ${name}`
}

export interface Form {
  /** What the platform is sent. A blank optional field is left out, so the
   *  connector's own default stands. */
  body: Record<string, string>
  /** The labels of required fields still blank. */
  missing: string[]
}

export function formOf(fields: readonly ConnectorField[], values: Record<string, string>): Form {
  const body: Record<string, string> = {}
  const missing: string[] = []
  for (const field of fields) {
    const typed = (values[field.name] ?? '').trim()
    if (typed) body[field.name] = typed
    else if (field.required) missing.push(field.label)
  }
  return { body, missing }
}

/** What the browser is told when a consent window comes back to this app. */
export interface Return {
  connected?: string
  account?: string
  error?: string
  reason?: string
}

/**
 * The result the platform added to the page a consent returned to:
 * `connected=<provider>&account=<label>` or `error=<provider>&reason=<why>`.
 * Anything else on the address is not a return.
 */
export function readReturn(search: string): Return | null {
  const q = new URLSearchParams(search)
  const connected = q.get('connected')
  const error = q.get('error')
  if (!connected && !error) return null
  const out: Return = {}
  if (connected) {
    out.connected = connected
    const account = q.get('account')
    if (account) out.account = account
  }
  if (error) {
    out.error = error
    const reason = q.get('reason')
    if (reason) out.reason = reason
  }
  return out
}

/** The sentence a return is reported in. */
export function returnSays(back: Return, name: (provider: string) => string): string {
  if (back.connected) {
    const who = back.account ? ` as ${back.account}` : ''
    return `Connected ${name(back.connected)}${who}.`
  }
  const why = back.reason ? `: ${back.reason}` : ''
  return `Could not connect ${name(back.error ?? '')}${why}.`
}

/** The address with the return taken off, so a reload does not report it again. */
export function withoutReturn(search: string): string {
  const q = new URLSearchParams(search)
  for (const key of ['connected', 'account', 'error', 'reason']) q.delete(key)
  const rest = q.toString()
  return rest ? `?${rest}` : ''
}
