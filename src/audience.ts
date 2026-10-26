// Which account on a network a row is.
//
// An organization is not a person. It can hold a personal X and the company
// X, a personal LinkedIn and a Company Page, a Facebook Page and an Instagram
// Business account — several on one network, and the list is the record.
// The social account row itself has no field for this (handle, provider,
// status), so the kind is kept beside it, under the org's own settings, and
// a missing kind is left missing rather than guessed.

export type Audience = 'personal' | 'business'

export interface AudienceChoice {
  id: Audience
  label: string
}

/** The settings product that holds `{ accounts: { [id]: audience } }`.
 *  Not `social`: that document is the Postiz door's post settings, and a
 *  second writer of the same blob is how one feature erases the other. */
export const AUDIENCE_PRODUCT = 'social-audiences'

/**
 * The two kinds this network actually has, in the network's own words.
 *
 * Personal is the person's profile. Business is whatever that network calls
 * the organization's presence: a company account, a Company Page, a Facebook
 * Page, an Instagram professional account.
 */
export function audiencesFor(provider: string): AudienceChoice[] {
  const business =
    provider === 'x'
      ? 'Company'
      : provider === 'linkedin'
        ? 'Company Page'
        : provider === 'facebook'
          ? 'Page'
          : provider === 'instagram'
            ? 'Business'
            : 'Business'
  return [
    { id: 'personal', label: 'Personal' },
    { id: 'business', label: business },
  ]
}

export function audienceLabel(provider: string, audience: Audience | undefined): string {
  if (!audience) return ''
  return audiencesFor(provider).find((choice) => choice.id === audience)?.label ?? ''
}

export function isAudience(value: unknown): value is Audience {
  return value === 'personal' || value === 'business'
}

/** Pull the kind map out of a settings config. Anything else is ignored. */
export function readAudiences(config: unknown): Record<string, Audience> {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return {}
  const accounts = (config as { accounts?: unknown }).accounts
  if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts)) return {}
  const out: Record<string, Audience> = {}
  for (const [id, value] of Object.entries(accounts)) {
    if (id && isAudience(value)) out[id] = value
  }
  return out
}

/**
 * A settings config with this kind map written in, and every other key left
 * where it was. The settings write stores the document verbatim, so a writer
 * that sent only `accounts` would drop whatever else the org had put there.
 */
export function writeAudiences(
  config: unknown,
  accounts: Record<string, Audience>,
): Record<string, unknown> {
  const base =
    config && typeof config === 'object' && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>) }
      : {}
  base.accounts = accounts
  return base
}

/** The line above the handles: how many, and which kinds are among them. */
export function whereLine(
  provider: string,
  rows: readonly { id: string }[],
  audiences: Record<string, Audience>,
): string {
  return `Where posts go — ${accountLine(
    rows.length,
    rows.map((row) => audienceLabel(provider, audiences[row.id])),
  )}`
}

/** "2 accounts · Personal, Company Page" — kinds named once, unlabeled rows
 *  still counted. */
export function accountLine(count: number, labels: readonly string[]): string {
  const noun = `${count} account${count === 1 ? '' : 's'}`
  const named: string[] = []
  for (const label of labels) {
    if (label && !named.includes(label)) named.push(label)
  }
  return named.length ? `${noun} · ${named.join(', ')}` : noun
}
