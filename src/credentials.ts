// An organization's own developer-app credentials, one pair per network.
//
// THE CONTRACT the connect plane is growing in hanzo-inc/cloud. This file is
// that contract and nothing else — no React — so a change to the wire is a
// change here and the tests notice.
//
//   GET /v1/social/credentials
//   PUT /v1/social/credentials
//
// GET answers 200 `{ apps: OrgApp[] }`. `data` is the same list, the envelope
// the other social collections use. An app is `{ provider, clientId,
// secretSet }`. `clientId` is the public id and comes back in the clear —
// the screen masks it. The secret never comes back. `secretSet` is whether
// one is sealed. A network with no app is absent, not an empty row. A
// deployment that has not shipped the route answers 404 or 501, and the
// Keys screen stays off the rail. Any other status means the route exists.
//
// PUT body is `{ apps: OrgAppWrite[] }`. Only the providers in the body are
// written; the rest stay. `clientSecret` omitted leaves the sealed secret.
// `clientSecret: ""` clears it. `clientId` is the full id, never a mask —
// storing the mask would make the id the mask. 200, with or without a body.
// A value is sent only when the person typed one.

export interface OrgApp {
  provider: string
  clientId: string
  secretSet: boolean
}

export interface OrgAppWrite {
  provider: string
  clientId: string
  /** Absent leaves the sealed secret. An empty string clears it. */
  clientSecret?: string
}

export interface OrgApps {
  /** The route is not on this deployment. */
  unshipped: boolean
  apps: OrgApp[]
}

/**
 * Whether Keys belongs on the rail.
 *
 * Still loading is no — a link that appears and vanishes is worse than one
 * that arrives. Not shipped is no. A refusal of a route that exists is yes,
 * so the screen can show what the platform said.
 */
export function credentialsLive(
  it: { unshipped: boolean } | null,
  failed: boolean,
): boolean {
  if (it) return !it.unshipped
  return failed
}

/** 404 and 501 are "not shipped". A refusal of the caller is not. */
export function credentialsUnshipped(error: unknown): boolean {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : NaN
  return status === 404 || status === 501
}

function appsOf(body: unknown): unknown[] {
  if (!body || typeof body !== 'object') return []
  const record = body as { apps?: unknown; data?: unknown }
  if (Array.isArray(record.apps)) return record.apps
  if (Array.isArray(record.data)) return record.data
  return []
}

/** The catalog a GET body carried. A secret field on a row is dropped. */
export function parseCredentials(body: unknown): OrgApp[] {
  const out: OrgApp[] = []
  for (const row of appsOf(body)) {
    if (!row || typeof row !== 'object') continue
    const provider = (row as { provider?: unknown }).provider
    if (typeof provider !== 'string' || !provider.trim()) continue
    const clientId = (row as { clientId?: unknown }).clientId
    out.push({
      provider: provider.trim(),
      clientId: typeof clientId === 'string' ? clientId : '',
      secretSet: (row as { secretSet?: unknown }).secretSet === true,
    })
  }
  return out
}

/** What one network's form should PUT, or null when nothing was edited. */
export function credentialWrite(input: {
  provider: string
  /** The id the GET returned. Sent back when the person did not type a new one. */
  clientId: string
  nextClientId: string
  nextSecret: string
  clearSecret: boolean
}): OrgAppWrite | null {
  const typedId = input.nextClientId.trim()
  const typedSecret = input.nextSecret.trim()
  const idChanged = typedId !== '' && typedId !== input.clientId
  const secretChanged = input.clearSecret || typedSecret !== ''
  if (!idChanged && !secretChanged) return null
  const write: OrgAppWrite = {
    provider: input.provider,
    clientId: typedId || input.clientId,
  }
  if (input.clearSecret) write.clientSecret = ''
  else if (typedSecret) write.clientSecret = typedSecret
  return write
}

/** The public id, as the screen shows it. Short ids are hidden whole. */
export function maskId(id: string): string {
  const text = id.trim()
  if (!text) return ''
  if (text.length <= 4) return '••••'
  return `••••${text.slice(-4)}`
}

/** The sealed secret, as the screen shows it. There is no value to reveal. */
export function maskSecret(secretSet: boolean): string {
  return secretSet ? '••••••••' : ''
}
