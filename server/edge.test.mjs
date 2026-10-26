import assert from 'node:assert/strict'
import test from 'node:test'

import { handleEdgeRequest } from './edge.mjs'

test('the edge answers Postiz with JSON instead of the SPA', async () => {
  const response = await handleEdgeRequest(
    new Request('https://social.hanzo.ai/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }),
  )
  assert.equal(response.status, 401)
  assert.match(response.headers.get('content-type'), /application\/json/)
  const body = await response.json()
  assert.match(body.message, /rejected this API key/)
})
