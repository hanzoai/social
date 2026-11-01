import type { IncomingMessage, ServerResponse } from 'node:http'

export const TOOLS: Array<{ name: string; description: string; inputSchema: unknown }>
export function callPostizTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { hanzo: unknown; fetchRemote?: typeof fetch },
  url: URL,
): Promise<unknown>
export function isPostizPath(url: string | undefined): boolean
export function postizMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void
export function handlePostiz(
  req: IncomingMessage,
  res: ServerResponse,
  options?: {
    client?: unknown
    fetchImpl?: typeof fetch
    base?: string
    fetchRemote?: typeof fetch
  },
): Promise<void>
