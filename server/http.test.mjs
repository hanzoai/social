import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { createHandler, isApiPath } from './http.mjs'
import { isPostizPath } from './postiz.mjs'

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

test('Postiz paths stay off /v1/social', () => {
  for (const path of ['/v1/social/posts', '/v1/social/accounts', '/v1/social/summary', '/v1/images/generations']) {
    assert.equal(isPostizPath(path), false, path)
    assert.equal(isApiPath(path), true, path)
  }
  for (const path of ['/mcp', '/mcp/key', '/api/mcp', '/public/v1/integrations', '/api/public/v1/posts']) {
    assert.equal(isPostizPath(path), true, path)
    assert.equal(isApiPath(path), false, path)
  }
  assert.equal(isApiPath('/v1'), true)
  assert.equal(isApiPath('/v1social'), false)
  assert.equal(isPostizPath('/'), false)
})

test('this process proxies /v1 and answers Postiz and the app itself', async () => {
  const seen = []
  const upstream = createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      seen.push(req.url)
      res.writeHead(201, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          door: 'api',
          path: req.url,
          auth: req.headers.authorization || null,
          body: Buffer.concat(chunks).toString(),
        }),
      )
    })
  })
  const upPort = await listen(upstream)
  const root = mkdtempSync(join(tmpdir(), 'social-'))
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>social</title>')
  const app = createServer(createHandler({ root, upstream: `http://127.0.0.1:${upPort}` }))
  const port = await listen(app)
  try {
    const summary = await fetch(`http://127.0.0.1:${port}/v1/social/summary?x=1`, {
      headers: { authorization: 'Bearer k' },
    })
    assert.equal(summary.status, 201)
    assert.deepEqual(await summary.json(), {
      door: 'api',
      path: '/v1/social/summary?x=1',
      auth: 'Bearer k',
      body: '',
    })

    const created = await fetch(`http://127.0.0.1:${port}/v1/social/posts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer k' },
      body: JSON.stringify({ content: 'hello' }),
    })
    assert.equal(created.status, 201)
    const posted = await created.json()
    assert.equal(posted.path, '/v1/social/posts')
    assert.equal(posted.body, '{"content":"hello"}')

    const mcp = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    assert.equal(mcp.status, 401)
    assert.equal(mcp.headers.get('content-type'), 'application/json; charset=utf-8')
    const refused = await mcp.json()
    assert.match(refused.message, /rejected this API key/)

    const page = await fetch(`http://127.0.0.1:${port}/posts`)
    assert.equal(page.status, 200)
    assert.match(page.headers.get('content-type'), /text\/html/)
    assert.match(await page.text(), /social/)

    assert.deepEqual(seen, ['/v1/social/summary?x=1', '/v1/social/posts'])
  } finally {
    app.close()
    upstream.close()
  }
})

test('a dead Hanzo API is a 502 on /v1 and leaves Postiz alone', async () => {
  const app = createServer(
    createHandler({ root: mkdtempSync(join(tmpdir(), 'social-')), upstream: 'http://127.0.0.1:1' }),
  )
  const port = await listen(app)
  try {
    const api = await fetch(`http://127.0.0.1:${port}/v1/social/accounts`)
    assert.equal(api.status, 502)
    assert.match((await api.json()).message, /did not answer/)

    const mcp = await fetch(`http://127.0.0.1:${port}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    assert.equal(mcp.status, 401)
  } finally {
    app.close()
  }
})
