// Start the hanzo.id OIDC login: mint a CSRF state, redirect the browser to the
// PUBLIC authorize endpoint. No password fields, ever — identity is hanzo.id.
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import {
  buildAuthorizeUrl,
  STATE_COOKIE,
  cookieOpts,
} from '@social/frontend/hz/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, cookieOpts(600));
  return res;
}
