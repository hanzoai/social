// The production process for Hanzo Social.
//
// Two doors on one process:
//   Postiz clients  — /mcp, /api/mcp, /public/v1, /api/public/v1
//   Hanzo clients   — /v1, including /v1/social, proxied to HANZO_API
// Everything else is the app.
//
// social.hanzo.ai is the hostname meant for the Postiz door. The frontend on
// *.hanzo.ai calls https://api.hanzo.ai for /v1/social and does not use these
// Postiz paths. The static site still owns the hostname until this process
// does, and until then /mcp there is the SPA document.

import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { isPostizPath, postizMiddleware } from './postiz.mjs'

const defaultRoot = fileURLToPath(new URL('../dist', import.meta.url))
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

const hop = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
])

/** True for the Hanzo API (/v1/social and the rest of /v1), never for Postiz. */
export function isApiPath(url) {
  const path = (url || '/').split('?')[0]
  return path === '/v1' || path.startsWith('/v1/')
}

function fileFor(root, url) {
  const pathname = decodeURIComponent((url || '/').split('?')[0])
  const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const path = join(root, relative)
  if (!path.startsWith(root)) return null
  if (existsSync(path) && statSync(path).isFile()) return path
  const index = join(root, 'index.html')
  return existsSync(index) ? index : null
}

function serveSpa(req, res, root) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    res.end()
    return
  }
  const file = fileFor(root, req.url)
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('not found')
    return
  }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(file).pipe(res)
}

function copyHeaders(source) {
  const headers = {}
  for (const [key, value] of Object.entries(source)) {
    if (value == null || hop.has(key.toLowerCase())) continue
    headers[key] = value
  }
  return headers
}

/** Stream a /v1 request to the Hanzo API. Postiz paths must not reach this. */
export function proxyApi(req, res, targetOrigin) {
  let upstream
  try {
    upstream = new URL(targetOrigin)
  } catch {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ message: 'Hanzo API did not answer' }))
    return
  }
  const incoming = new URL(req.url || '/', 'http://localhost')
  const headers = copyHeaders(req.headers)
  headers.host = upstream.host
  const lib = upstream.protocol === 'http:' ? httpRequest : httpsRequest
  const proxyReq = lib(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || (upstream.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: incoming.pathname + incoming.search,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, copyHeaders(proxyRes.headers))
      proxyRes.pipe(res)
    },
  )
  proxyReq.on('error', () => {
    if (res.headersSent) {
      res.destroy()
      return
    }
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ message: 'Hanzo API did not answer' }))
  })
  req.pipe(proxyReq)
}

/**
 * Postiz paths are answered here. /v1 is proxied. Every other path is the app.
 * `upstream` defaults to HANZO_API, then https://api.hanzo.ai.
 */
export function createHandler(options = {}) {
  const root = options.root || defaultRoot
  const upstream = options.upstream || process.env.HANZO_API || 'https://api.hanzo.ai'
  return (req, res) => {
    if (isPostizPath(req.url)) {
      postizMiddleware(req, res, () => {})
      return
    }
    if (isApiPath(req.url)) {
      proxyApi(req, res, upstream)
      return
    }
    serveSpa(req, res, root)
  }
}

function startedDirectly() {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry)
  } catch {
    return import.meta.url === pathToFileURL(entry).href
  }
}

if (startedDirectly()) {
  const port = Number(process.env.PORT || 3000)
  createServer(createHandler()).listen(port, '0.0.0.0', () => {
    console.log(`Hanzo Social listening on :${port}`)
  })
}
