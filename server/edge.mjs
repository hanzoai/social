// Cloudflare entry for the Postiz door on social.hanzo.ai.
//
// The hostname's DNS still points at the static origin. A route sends only
// /mcp, /api/mcp, /public/v1, and /api/public/v1 here. Everything else stays
// on that origin, including the app and /v1/social.

import { handlePostiz, isPostizPath } from './postiz.mjs'

export async function handleEdgeRequest(request) {
  const url = new URL(request.url)
  if (!isPostizPath(url.pathname)) return fetch(request)

  const payload = new Uint8Array(await request.arrayBuffer())
  const req = nodeRequest(request, url, payload)
  const res = nodeResponse()
  try {
    await handlePostiz(req, res)
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'request failed' }))
    }
  }
  return new Response(res.body, { status: res.statusCode, headers: res.headers })
}

function nodeRequest(request, url, payload) {
  const data = []
  const end = []
  const error = []
  let opened = false
  function open() {
    if (opened) return
    opened = true
    queueMicrotask(() => {
      if (payload.byteLength) for (const fn of data) fn(payload)
      for (const fn of end) fn()
    })
  }
  return {
    url: url.pathname + url.search,
    method: request.method,
    headers: { authorization: request.headers.get('authorization') || '' },
    on(event, fn) {
      if (event === 'data') data.push(fn)
      else if (event === 'end') end.push(fn)
      else if (event === 'error') error.push(fn)
      open()
      return this
    },
    destroy() {},
  }
}

function nodeResponse() {
  return {
    statusCode: 200,
    headers: {},
    headersSent: false,
    body: '',
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = Object.fromEntries(
        Object.entries(headers || {}).map(([key, value]) => [key, String(value)]),
      )
      this.headersSent = true
    },
    end(body) {
      this.body = body == null ? '' : String(body)
    },
  }
}

export default { fetch: handleEdgeRequest }
