/**
 * The app's TRANSPORT onto `/v1/social`. The contract itself — types, normalizers,
 * every route — is `@hanzo/ui/product/social/api`, the same one the console binds; all
 * that differs between the two hosts is these four lines.
 *
 * Same-origin, keyless, prefix-free: the browser calls `<origin>/v1/social/...` and the
 * social.hanzo.ai edge routes `/v1` to the cloud binary, which resolves the caller from
 * the first-party IAM session cookie and scopes every read/write to that owner's org
 * SERVER-SIDE. No org header is ever sent from the browser, and no credential lives here.
 */
import { createSocialApi } from '@hanzo/ui/product/social/api'

/** A `/v1` failure carrying its status, so `classifyBackend` can tell 401 from 503. */
export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(`/v1/social/${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : 'Network request failed')
  }
  if (res.status === 204) return undefined
  const text = await res.text()
  let json: unknown
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      // A non-JSON error body IS the human message; a non-JSON 2xx is malformed.
      throw new ApiError(res.ok ? `Invalid response (HTTP ${res.status})` : text.trim().slice(0, 300), res.status)
    }
  }
  if (!res.ok) {
    const j = (json ?? {}) as { msg?: unknown; error?: unknown }
    const m = typeof j.msg === 'string' ? j.msg : typeof j.error === 'string' ? j.error : ''
    throw new ApiError(m || `Request failed (HTTP ${res.status})`, res.status)
  }
  return json
}

export const SocialApi = createSocialApi({
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path).then(() => undefined),
})
