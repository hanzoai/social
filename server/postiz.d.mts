import type { IncomingMessage, ServerResponse } from 'node:http'

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
