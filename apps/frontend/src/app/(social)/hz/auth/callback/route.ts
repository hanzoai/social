// hanzo.id OIDC callback: verify state, exchange the code for tokens
// server-side, seal the access token in the httpOnly session cookie, return to
// the dashboard. The token never reaches the browser.
import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCode,
  sessionMaxAge,
  SESSION_COOKIE,
  STATE_COOKIE,
  cookieOpts,
} from '@social/frontend/hz/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') || '';
  const state = req.nextUrl.searchParams.get('state') || '';
  const saved = req.cookies.get(STATE_COOKIE)?.value || '';

  const home = req.nextUrl.clone();
  home.pathname = '/';
  home.search = '';

  if (!code || !state || state !== saved) {
    home.searchParams.set('auth_error', 'state');
    const res = NextResponse.redirect(home);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  try {
    const tok = await exchangeCode(code);
    const res = NextResponse.redirect(home);
    res.cookies.set(SESSION_COOKIE, tok.access_token, cookieOpts(sessionMaxAge(tok)));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch {
    home.searchParams.set('auth_error', 'exchange');
    const res = NextResponse.redirect(home);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }
}
