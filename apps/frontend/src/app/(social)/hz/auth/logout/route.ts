// Clear the session cookie and return to the dashboard (which then shows SignIn).
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@social/frontend/hz/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const home = req.nextUrl.clone();
  home.pathname = '/';
  home.search = '';
  const res = NextResponse.redirect(home);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
