// The production process for Hanzo Social.
//
// The static site at social.hanzo.ai answers every path with the SPA, which
// is why a Postiz client cannot connect there. This process serves that same
// SPA and, on the Postiz paths, the compatibility API.

import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isPostizPath, postizMiddleware } from './postiz.mjs'

const root = fileURLToPath(new URL('../dist', import.meta.url))
const port = Number(process.env.PORT || 3000)
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

function fileFor(url) {
  const pathname = decodeURIComponent((url || '/').split('?')[0])
  const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const path = join(root, relative)
  if (!path.startsWith(root)) return null
  if (existsSync(path) && statSync(path).isFile()) return path
  const index = join(root, 'index.html')
  return existsSync(index) ? index : null
}

const server = createServer((req, res) => {
  if (isPostizPath(req.url)) {
    postizMiddleware(req, res, () => {})
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    res.end()
    return
  }
  const file = fileFor(req.url)
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
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Hanzo Social listening on :${port}`)
})
