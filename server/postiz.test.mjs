import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'

import { handlePostiz } from './postiz.mjs'

const KEY = 'hanzo-test-key'

function hanzo() {
  const posts = []
  let config = { posts: {} }
  const library = []
  return {
    posts,
    config: () => config,
    library,
    fetch(url, init) {
      const path = new URL(url).pathname
      const method = init?.method || 'GET'
      const auth = init.headers.authorization
      if (auth !== `Bearer ${KEY}`) {
        return json(401, { detail: 'a validated principal is required' })
      }
      if (path === '/v1/social/summary') {
        return json(200, { accounts: 1, posts: posts.length, published: 0, scheduled: 0 })
      }
      if (path === '/v1/social/accounts') {
        return json(200, {
          data: [
            {
              id: 'acct_x',
              provider: 'x',
              handle: '@hanzo',
              status: 'connected',
              createdAt: 1,
              updatedAt: 1,
            },
            {
              id: 'acct_off',
              provider: 'threads',
              handle: '@old',
              status: 'disconnected',
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        })
      }
      if (path === '/v1/social/posts' && method === 'GET') {
        return json(200, { data: posts })
      }
      const one = path.match(/^\/v1\/social\/posts\/([^/]+)$/)
      if (one && method === 'GET') {
        const row = posts.find((post) => post.id === decodeURIComponent(one[1]))
        if (!row) return json(404, { detail: 'not found' })
        return json(200, row)
      }
      if (path === '/v1/social/posts' && init.method === 'POST') {
        const body = JSON.parse(init.body)
        const row = {
          id: `post_${posts.length + 1}`,
          ...body,
          accountId: '',
          createdAt: 1_700_000_000,
          updatedAt: 1_700_000_000,
        }
        posts.push(row)
        return json(201, row)
      }
      if (init.method === 'POST' && path.endsWith('/publish')) {
        const id = path.split('/')[4]
        const row = posts.find((post) => post.id === id)
        row.status = 'published'
        row.accountId = 'acct_x'
        row.externalId = 'ext_1'
        return json(200, row)
      }
      if (init.method === 'DELETE' && path.startsWith('/v1/social/posts/')) {
        const id = decodeURIComponent(path.split('/').pop())
        const index = posts.findIndex((post) => post.id === id)
        if (index < 0) return json(404, { detail: 'not found' })
        posts.splice(index, 1)
        return json(204, null)
      }
      if (path === '/v1/iam/whoami') {
        return json(200, { organization: { id: 'org_hanzo', name: 'hanzo' } })
      }
      if (path === '/v1/settings/social' && method === 'GET') {
        return json(200, { product: 'social', config, secretKeys: [] })
      }
      if (path === '/v1/settings/social' && method === 'PUT') {
        config = JSON.parse(init.body).config
        return json(200, { product: 'social', config, secretKeys: [] })
      }
      if (path === '/v1/provider/x' && method === 'GET') {
        return json(200, {
          id: 'x',
          actions: [
            {
              name: 'mentions',
              description: 'Search mentions',
              props: [{ name: 'word', description: 'The word to search', type: 'string' }],
            },
          ],
        })
      }
      if (path === '/v1/provider/x/run' && method === 'POST') {
        const body = JSON.parse(init.body)
        return json(200, { ok: true, output: [{ id: 'mention_1', word: body.input.word }] })
      }
      if (path === '/v1/models') {
        return json(200, {
          data: [
            {
              id: 'koma',
              name: 'Koma',
              outputs: ['video'],
              description: 'Cinematic video',
              video: { durations: [5], sizes: ['1280x720', '720x1280'] },
            },
            { id: 'zen5', name: 'Zen 5', outputs: ['text'] },
          ],
        })
      }
      if (path === '/v1/images/generations' && method === 'POST') {
        return json(200, { data: [{ b64_json: Buffer.from('png').toString('base64') }] })
      }
      if (path === '/v1/videos/generations' && method === 'POST') {
        const body = JSON.parse(init.body)
        return json(200, { id: 'vid_1', status: 'queued', model: body.model })
      }
      if (path === '/v1/videos/vid_1' && method === 'GET') {
        return json(200, { id: 'vid_1', status: 'completed' })
      }
      if (path === '/v1/videos/vid_1/content' && method === 'GET') {
        return raw(200, Buffer.from('mp4-bytes'), 'video/mp4')
      }
      if (path === '/v1/library' && method === 'GET') {
        return json(200, { data: library, next: '' })
      }
      if (path === '/v1/library' && method === 'POST') {
        const body = JSON.parse(init.body)
        const item = {
          id: `lib_${library.length + 1}`,
          name: body.name,
          url: `https://library.example/${body.name}`,
          created: '2026-10-26T00:00:00.000Z',
          kind: body.kind,
        }
        library.push(item)
        return json(201, item)
      }
      const kept = path.match(/^\/v1\/library\/([^/]+)$/)
      if (kept && method === 'GET') {
        const item = library.find((row) => row.id === decodeURIComponent(kept[1]))
        if (!item) return json(404, { detail: 'not found' })
        return json(200, item)
      }
      if (path === '/v1/studio/runs' && method === 'POST') {
        const body = JSON.parse(init.body)
        return json(201, { id: 'run_1', status: 'completed', title: 'Clip', input: body.input, outputs: [] })
      }
      if (path === '/v1/studio/runs/run_1' && method === 'GET') {
        return json(200, {
          id: 'run_1',
          status: 'completed',
          title: 'Clip',
          input: { url: 'https://cdn.example/long.mp4', clips: 5, fit: 'blur', integrations: ['acct_x'] },
          outputs: [{ id: 'clip_1', name: 'Opening', url: 'https://library.example/clip.mp4', kind: 'video' }],
        })
      }
      return json(404, { detail: `no mock for ${method} ${path}` })
    },
  }
}

function json(status, body) {
  return raw(status, Buffer.from(body == null ? '' : JSON.stringify(body)), 'application/json')
}

function raw(status, body, type) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? type : null) },
    async text() {
      return body.toString('utf8')
    },
    async arrayBuffer() {
      return body
    },
  }
}

function listen(mock) {
  const server = createServer((req, res) => {
    handlePostiz(req, res, { fetchImpl: mock.fetch, base: 'http://hanzo.test' }).catch((error) => {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: error.message }))
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({ server, port: address.port })
    })
  })
}

async function rpc(port, key, message) {
  const response = await fetch(`http://127.0.0.1:${port}/api/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(message),
  })
  const body = await response.json()
  return { status: response.status, body }
}

test('a missing or rejected key is the refusal Postiz Cloud looks for', async () => {
  const mock = hanzo()
  const { server, port } = await listen(mock)
  try {
    const missing = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    })
    assert.equal(missing.status, 401)

    const rejected = await rpc(port, 'nope', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26' },
    })
    assert.equal(rejected.status, 401)
    assert.match(rejected.body.message, /rejected this API key/)
  } finally {
    server.close()
  }
})

test('tools/list exposes the Postiz tools a self-hosted connection requires', async () => {
  const { server, port } = await listen(hanzo())
  try {
    const listed = await rpc(port, KEY, { jsonrpc: '2.0', id: 2, method: 'tools/list' })
    assert.equal(listed.status, 200)
    const names = listed.body.result.tools.map((item) => item.name)
    for (const required of [
      'integrationList',
      'integrationSchedulePostTool',
      'groupList',
      'integrationSchema',
      'triggerTool',
      'postsListTool',
      'postSettingsTool',
      'generateImageTool',
      'generateVideoOptions',
      'generateVideoTool',
      'videoFunctionTool',
      'videoStatusTool',
      'uploadFromUrlTool',
      'mediaListTool',
      'mediaStatusTool',
      'clippingTool',
      'clippingStatusTool',
    ]) {
      assert.ok(names.includes(required), required)
    }
  } finally {
    server.close()
  }
})

test('listing, scheduling, publishing, and deleting use the Hanzo social API', async () => {
  const mock = hanzo()
  const { server, port } = await listen(mock)
  try {
    const listed = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'integrationList', arguments: {} },
    })
    const accounts = listed.body.result.structuredContent.output
    assert.deepEqual(
      accounts.map((account) => account.platform),
      ['x', 'threads'],
    )
    assert.equal(accounts[0].id, 'acct_x')
    assert.equal(accounts[0].picture, '')

    const scheduled = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'integrationSchedulePostTool',
        arguments: {
          socialPost: [
            {
              integrationId: 'acct_x',
              isPremium: false,
              date: '2026-10-27T15:00:00.000Z',
              shortLink: false,
              type: 'now',
              postsAndComments: [
                { content: '<p>Hello from <strong>Grok</strong></p>', attachments: ['https://cdn.example/a.png'] },
                { content: '<p>A thread reply</p>', attachments: [] },
              ],
              settings: [{ key: '__type', value: 'x' }],
            },
          ],
        },
      },
    })
    const made = scheduled.body.result.structuredContent.output
    assert.equal(made[0].postId, 'post_1')
    assert.equal(made[0].integration, 'acct_x')
    assert.equal(mock.posts[0].content, 'Hello from Grok\n\nA thread reply')
    assert.deepEqual(mock.posts[0].media, ['https://cdn.example/a.png'])
    assert.equal(mock.posts[0].status, 'published')
    assert.equal(mock.posts[0].channel, 'x')

    const posts = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'postsListTool',
        arguments: { startDate: '2020-01-01T00:00:00Z', endDate: '2030-01-01T00:00:00Z' },
      },
    })
    assert.equal(posts.body.result.structuredContent.output.posts[0].state, 'PUBLISHED')
    assert.equal(posts.body.result.structuredContent.output.posts[0].platform, 'x')

    const removed = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'deletePostTool', arguments: { id: 'post_1' } },
    })
    assert.deepEqual(removed.body.result.structuredContent.output, { postId: 'post_1' })
    assert.equal(mock.posts.length, 0)
  } finally {
    server.close()
  }
})

test('the public REST paths match the Postiz shapes Grok does not use', async () => {
  const mock = hanzo()
  const { server, port } = await listen(mock)
  try {
    const connected = await fetch(`http://127.0.0.1:${port}/public/v1/is-connected`, {
      headers: { authorization: KEY },
    })
    assert.equal(connected.status, 200)
    assert.deepEqual(await connected.json(), { connected: true })

    const integrations = await fetch(`http://127.0.0.1:${port}/api/public/v1/integrations`, {
      headers: { authorization: `Bearer ${KEY}` },
    })
    const rows = await integrations.json()
    assert.equal(rows[0].identifier, 'x')
    assert.equal(rows[0].disabled, false)
    assert.equal(rows[1].disabled, true)

    const created = await fetch(`http://127.0.0.1:${port}/public/v1/posts`, {
      method: 'POST',
      headers: { authorization: KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'draft',
        date: '2026-10-27T15:00:00.000Z',
        posts: [{ integration: { id: 'acct_x' }, value: [{ content: '<p>Draft</p>', image: [] }], settings: { __type: 'x' } }],
      }),
    })
    assert.equal(created.status, 200)
    const body = await created.json()
    assert.equal(body[0].postId, 'post_1')
    assert.equal(body[0].integration, 'acct_x')
    assert.equal(mock.posts[0].status, 'draft')

    const tooLong = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'integrationSchedulePostTool',
        arguments: {
          socialPost: [
            {
              integrationId: 'acct_x',
              type: 'draft',
              postsAndComments: [{ content: 'x'.repeat(281), attachments: [] }],
            },
          ],
        },
      },
    })
    assert.match(tooLong.body.result.structuredContent.output.errors, /280/)
  } finally {
    server.close()
  }
})

test('image, video, library, provider actions, settings, and clipping call Hanzo', async () => {
  const mock = hanzo()
  const { server, port } = await listen(mock)
  try {
    const image = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: { name: 'generateImageTool', arguments: { prompt: 'a red square' } },
    })
    assert.equal(image.body.result.structuredContent.path, 'https://library.example/generated.png')
    assert.equal(mock.library[0].kind, 'image')

    const options = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: { name: 'generateVideoOptions', arguments: {} },
    })
    assert.deepEqual(
      options.body.result.structuredContent.video.map((item) => item.type),
      ['koma'],
    )

    const started = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'generateVideoTool',
        arguments: {
          identifier: 'koma',
          output: 'vertical',
          customParams: [
            { key: 'prompt', value: 'a launch' },
            { key: 'seconds', value: 5 },
          ],
        },
      },
    })
    assert.equal(started.body.result.structuredContent.jobId, 'vid_1')

    const ready = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: { name: 'videoStatusTool', arguments: { jobId: 'vid_1' } },
    })
    assert.equal(ready.body.result.structuredContent.status, 'completed')
    assert.equal(ready.body.result.structuredContent.url, 'https://library.example/vid_1.mp4')

    const spec = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/call',
      params: { name: 'videoFunctionTool', arguments: { identifier: 'koma', functionName: 'spec' } },
    })
    assert.deepEqual(spec.body.result.structuredContent.durations, [5])

    const schema = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 15,
      method: 'tools/call',
      params: { name: 'integrationSchema', arguments: { platform: 'x' } },
    })
    assert.equal(schema.body.result.structuredContent.output.maxLength, 280)
    assert.equal(schema.body.result.structuredContent.output.tools[0].methodName, 'mentions')

    const triggered = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 16,
      method: 'tools/call',
      params: {
        name: 'triggerTool',
        arguments: {
          integrationId: 'acct_x',
          methodName: 'mentions',
          dataSchema: [{ key: 'word', value: 'hanzo' }],
        },
      },
    })
    assert.equal(triggered.body.result.structuredContent.output[0].word, 'hanzo')

    await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 17,
      method: 'tools/call',
      params: {
        name: 'integrationSchedulePostTool',
        arguments: {
          socialPost: [
            {
              integrationId: 'acct_x',
              type: 'draft',
              postsAndComments: [{ content: 'Settings', attachments: [] }],
              settings: [{ key: 'privacy', value: 'public' }],
            },
          ],
        },
      },
    })
    const updated = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 18,
      method: 'tools/call',
      params: {
        name: 'postSettingsTool',
        arguments: { id: 'post_1', settings: [{ key: 'title', value: 'Launch' }] },
      },
    })
    assert.equal(updated.body.result.structuredContent.output.postId, 'post_1')
    assert.equal(mock.config().posts.post_1.privacy, 'public')
    assert.equal(mock.config().posts.post_1.title, 'Launch')

    const listed = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 19,
      method: 'tools/call',
      params: { name: 'mediaListTool', arguments: {} },
    })
    assert.equal(listed.body.result.structuredContent.output.length, 2)

    const clip = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 20,
      method: 'tools/call',
      params: {
        name: 'clippingTool',
        arguments: { url: 'https://cdn.example/long.mp4', fit: 'blur', clips: 5, integrations: ['acct_x'] },
      },
    })
    assert.equal(clip.body.result.structuredContent.clippingId, 'run_1')

    const clips = await rpc(port, KEY, {
      jsonrpc: '2.0',
      id: 21,
      method: 'tools/call',
      params: { name: 'clippingStatusTool', arguments: { clippingId: 'run_1' } },
    })
    assert.equal(clips.body.result.structuredContent.status, 'completed')
    assert.equal(clips.body.result.structuredContent.clips[0].url, 'https://library.example/clip.mp4')
    assert.equal(mock.posts.at(-1).status, 'draft')
    assert.deepEqual(mock.posts.at(-1).media, ['https://library.example/clip.mp4'])
  } finally {
    server.close()
  }
})
