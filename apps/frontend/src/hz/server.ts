// Hanzo Social — server-only glue: config, hanzo.id OIDC (authorize + code
// exchange), the httpOnly session cookie, request auth resolution, and the BFF
// proxy to the unified Hanzo Cloud. ONE place for every server concern so the
// route handlers and the root page stay thin. NEVER imported by a client
// component (pulls in next/headers + the client secret).

import 'server-only';
import { cookies, headers } from 'next/headers';
import { NextRequest } from 'next/server';

// ---- config (env with safe in-cluster defaults) ----

// The unified cloud API the BFF proxies to. In-cluster Service DNS by default;
// social.hanzo.ai/v1/* is routed to this same binary at the edge.
const CLOUD_API_URL = (
  process.env.CLOUD_API_URL || 'http://cloud.hanzo.svc.cluster.local:8000'
).replace(/\/+$/, '');

// hanzo.id — PUBLIC issuer for the browser authorize redirect; INTERNAL Service
// for the server-side token exchange (the public host is Cloudflare-fronted and
// 403s in-cluster POSTs).
const IAM_PUBLIC_URL = (process.env.IAM_PUBLIC_URL || 'https://hanzo.id').replace(
  /\/+$/,
  ''
);
// Service port 80 → container 8000; issuer stays https://hanzo.id, only the
// token/JWKS host is internal to avoid the Cloudflare-fronted public 403.
const IAM_INTERNAL_URL = (
  process.env.IAM_INTERNAL_URL ||
  'http://iam.hanzo.svc.cluster.local'
).replace(/\/+$/, '');

const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || 'hanzo-social';
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';
const OIDC_REDIRECT_URI =
  process.env.OIDC_REDIRECT_URI ||
  'https://social.hanzo.ai/hz/auth/callback';

export const SESSION_COOKIE = 'hz_social_session';
export const STATE_COOKIE = 'hz_social_oidc_state';
const SESSION_MAX_AGE = 60 * 60 * 24 * 3; // 3 days

export const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

// ---- claims ----

// decodeOwner reads the Casdoor `owner` org claim from a JWT WITHOUT verifying
// it — the cloud re-validates every token, so this is display-only (never a
// security boundary). Falls back to the org prefix of `sub` ("org/user").
export function decodeOwner(jwt: string): string {
  try {
    const payload = jwt.split('.')[1];
    if (!payload) return '';
    const json = Buffer.from(
      payload.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    const claims = JSON.parse(json) as { owner?: string; sub?: string };
    if (typeof claims.owner === 'string' && claims.owner.trim())
      return claims.owner.trim();
    if (typeof claims.sub === 'string' && claims.sub.includes('/'))
      return claims.sub.split('/')[0];
  } catch {
    /* display-only; ignore malformed */
  }
  return '';
}

// ---- request auth resolution ----

export interface Auth {
  authed: boolean;
  token: string; // bearer value (no scheme)
  owner: string; // org for display
}

// resolveAuth is the ONE decision "is this request authenticated, and as whom":
// an injected `Authorization: Bearer` header (used by e2e/API clients) wins,
// else the httpOnly session cookie. The cloud is the real authority; this only
// picks Dashboard vs SignIn and the org label.
export async function resolveAuth(): Promise<Auth> {
  const h = await headers();
  const c = await cookies();
  const injected = (h.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const cookieTok = c.get(SESSION_COOKIE)?.value || '';
  const token = injected || cookieTok;
  return { authed: !!token, token, owner: token ? decodeOwner(token) : '' };
}

// ---- OIDC ----

export function buildAuthorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: OIDC_CLIENT_ID,
    redirect_uri: OIDC_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email organizations',
    state,
  });
  return `${IAM_PUBLIC_URL}/v1/iam/oauth/authorize?${p}`;
}

export interface TokenSet {
  access_token: string;
  expires_in?: number;
}

// exchangeCode swaps an authorization code for tokens at the INTERNAL IAM
// endpoint (confidential client: client_secret in the body).
export async function exchangeCode(code: string): Promise<TokenSet> {
  const res = await fetch(`${IAM_INTERNAL_URL}/v1/iam/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: OIDC_CLIENT_ID,
      client_secret: OIDC_CLIENT_SECRET,
      redirect_uri: OIDC_REDIRECT_URI,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const data = (await res.json()) as TokenSet & { error?: string };
  if (data.error || !data.access_token)
    throw new Error(`token exchange: ${data.error || 'no access_token'}`);
  return data;
}

export const sessionMaxAge = (t: TokenSet) =>
  t.expires_in && t.expires_in > 0 ? Math.min(t.expires_in, SESSION_MAX_AGE) : SESSION_MAX_AGE;

// ---- BFF proxy ----

// proxyToCloud forwards a /hz/bff/<path> request to the unified cloud
// /v1/<path>, attaching the caller's bearer (injected header, else session
// cookie). The token stays server-side for cookie sessions; the browser never
// sees it. The cloud derives the org from the validated token owner claim.
export async function proxyToCloud(
  req: NextRequest,
  path: string[]
): Promise<Response> {
  const incoming = req.headers.get('authorization');
  const cookieTok = req.cookies.get(SESSION_COOKIE)?.value;
  const bearer = incoming || (cookieTok ? `Bearer ${cookieTok}` : '');
  if (!bearer)
    return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const search = req.nextUrl.search || '';
  const url = `${CLOUD_API_URL}/v1/${path.map(encodeURIComponent).join('/')}${search}`;
  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'DELETE';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: bearer,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      Accept: 'application/json',
    },
    body: hasBody ? await req.text() : undefined,
    cache: 'no-store',
  });

  const bodyText = await res.text();
  return new Response(bodyText, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
  });
}
