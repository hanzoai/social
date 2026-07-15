// BFF proxy: /hz/bff/<path> -> unified cloud /v1/<path>, bearer attached
// server-side (injected header or httpOnly session cookie). ONE catch-all for
// every /v1/social/* and /v1/marketing/* call the dashboard makes.
import { NextRequest } from 'next/server';
import { proxyToCloud } from '@social/frontend/hz/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path: string[] }> };

const handler = async (req: NextRequest, { params }: Ctx) => {
  const { path } = await params;
  return proxyToCloud(req, path || []);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
