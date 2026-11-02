import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'

import { handleAgent, OPERATIONS } from './agent.mjs'

const KEY = 'hanzo-test-key'

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function fetchImpl(url, init) {
  const path = new URL(url).pathname
  const method = init?.method || 'GET'
  if (init.headers.authorization !== `Bearer ${KEY}`) return json(401, { detail: 'a validated principal is required' })
  if (path === '/v1/social/summary') return json(200, { accounts: 1, posts: 0, published: 0, scheduled: 0 })
  if (path === '/v1/social/accounts' && method === 'GET') {
    return json(200, {
      data: [{ id: 'acct_x', provider: 'x', handle: '@hanzo', status: 'connected', createdAt: 1, updatedAt: 1 }],
    })
  }
  if (path === '/v1/social/credentials') {
    return json(200, { apps: [{ provider: 'x', clientId: 'app', secretSet: true }] })
  }
  if (path === '/v1/social/posts' && method === 'POST') {
    return json(201, { id: 'post_1', ...JSON.parse(init.body) })
  }
  return json(404, { detail: path })
}

function invoke(body, authorization) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body))
    const res = {
      statusCode: 0,
      headers: {},
      body: '',
      writeHead(status, headers) {
        this.statusCode = status
        this.headers = headers
      },
      end(text) {
        this.body = text || ''
        resolve(this)
      },
    }
    const req = {
      method: 'POST',
      url: '/v1/social/mcp',
      headers: { authorization: authorization || '' },
      on(event, fn) {
        if (event === 'data') fn(payload)
        if (event === 'end') fn()
        return this
      },
      destroy() {},
    }
    handleAgent(req, res, { fetchImpl, base: 'https://api.hanzo.ai' }).catch(reject)
  })
}

test('the native tool lists the agent operations with no key', async () => {
  const res = await invoke({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  const names = body.result.tools.find((tool) => tool.name === 'social').inputSchema.properties.op.enum
  for (const op of ['list_social_accounts', 'list_social_credentials', 'schedule_social_post', 'generate_social_image', 'generate_social_video', 'clip_social_video', 'run_social_provider']) {
    assert.ok(names.includes(op), op)
  }
  assert.equal(names.length, OPERATIONS.length)
  assert.equal(names.includes('put_social_credentials'), false)
})

test('tools/call without a key is the Hanzo credential refusal', async () => {
  const res = await invoke({
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: { name: 'social', arguments: { op: 'list_social_accounts' } },
  })
  assert.equal(res.statusCode, 401)
  const body = JSON.parse(res.body)
  assert.equal(body.id, 7)
  assert.equal(body.error.code, -32001)
  assert.match(body.error.message, /bearer credential/)
})

test('a key reads credentials without the secret and can draft a post', async () => {
  const listed = await invoke(
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'social', arguments: { op: 'list_social_credentials' } },
    },
    `Bearer ${KEY}`,
  )
  assert.equal(listed.statusCode, 200)
  const apps = JSON.parse(listed.body).result.structuredContent
  assert.equal(apps.apps[0].secretSet, true)
  assert.equal(apps.apps[0].clientSecret, undefined)

  const drafted = await invoke(
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'social',
        arguments: {
          op: 'schedule_social_post',
          input: {
            socialPost: [
              {
                integrationId: 'acct_x',
                type: 'draft',
                postsAndComments: [{ content: 'Native agent draft' }],
              },
            ],
          },
        },
      },
    },
    `Bearer ${KEY}`,
  )
  assert.equal(drafted.statusCode, 200)
  const result = JSON.parse(drafted.body).result
  assert.equal(result.isError, false)
  assert.equal(result.structuredContent[0].postId, 'post_1')
  assert.equal(result.structuredContent[0].integration, 'acct_x')
})

test('setting an audience keeps the rest of the settings document', async () => {
  let saved = null
  const store = {
    config: { note: 'keep', accounts: { acct_x: 'personal', acct_old: 'business' } },
  }
  function impl(url, init) {
    const path = new URL(url).pathname
    const method = init?.method || 'GET'
    if (init.headers.authorization !== `Bearer ${KEY}`) return json(401, { detail: 'no' })
    if (path === '/v1/social/summary') return json(200, { accounts: 1, posts: 0, published: 0, scheduled: 0 })
    if (path === '/v1/settings/social-audiences' && method === 'GET') return json(200, store)
    if (path === '/v1/settings/social-audiences' && method === 'PUT') {
      saved = JSON.parse(init.body)
      store.config = saved.config
      return json(200, saved)
    }
    return json(404, { detail: path })
  }
  const res = await new Promise((resolve, reject) => {
    const payload = Buffer.from(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'social',
          arguments: { op: 'set_social_audience', input: { id: 'acct_li', audience: 'business' } },
        },
      }),
    )
    const response = {
      statusCode: 0,
      body: '',
      writeHead(status) {
        this.statusCode = status
      },
      end(text) {
        this.body = text || ''
        resolve(this)
      },
    }
    handleAgent(
      {
        method: 'POST',
        url: '/v1/social/mcp',
        headers: { authorization: `Bearer ${KEY}` },
        on(event, fn) {
          if (event === 'data') fn(payload)
          if (event === 'end') fn()
          return this
        },
        destroy() {},
      },
      response,
      { fetchImpl: impl, base: 'https://api.hanzo.ai' },
    ).catch(reject)
  })
  assert.equal(res.statusCode, 200)
  assert.equal(saved.config.note, 'keep')
  assert.deepEqual(saved.config.accounts, {
    acct_x: 'personal',
    acct_old: 'business',
    acct_li: 'business',
  })
})

test('describe returns one operation schema', async () => {
  const server = createServer((req, res) => {
    handleAgent(req, res, { fetchImpl, base: 'https://api.hanzo.ai' })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/social/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'describe', arguments: { op: 'schedule_social_post' } },
      }),
    })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.result.structuredContent.name, 'schedule_social_post')
    assert.equal(body.result.isError, false)
    assert.ok(body.result.structuredContent.inputSchema.required.includes('socialPost'))
  } finally {
    server.close()
  }
})
