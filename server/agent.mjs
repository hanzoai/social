// Native agent MCP for Hanzo Social.
//
// api.hanzo.ai/v1/mcp exposes tool `social` with the account and post records.
// This path is that same calling convention, plus the agent operations a
// Postiz client already has: channels, schedule, settings, provider actions,
// media, image, video, and clipping. One tool, one op, arguments in input.
//
// tools/list needs no key. tools/call does, and the key is a Hanzo key.
// Sealing an app secret is not a tool: a value would sit in the agent log.
// list_social_credentials returns the public app id and whether a secret is set.

import { apiKeyFrom, HanzoError, hanzoClient } from './hanzo.mjs'
import { callPostizTool, TOOLS as POSTIZ_TOOLS } from './postiz.mjs'

const PROTOCOL = '2025-03-26'

const POSTIZ_BY_NAME = new Map(POSTIZ_TOOLS.map((tool) => [tool.name, tool]))

function schema(properties, required) {
  return {
    type: 'object',
    properties: properties || {},
    ...(required?.length ? { required } : {}),
  }
}

function api(name, description, properties, required, run) {
  return { name, description, inputSchema: schema(properties, required), run }
}

function idField() {
  return { id: { type: 'string', description: 'The record id.' } }
}

function mapped(name, description, postizName) {
  const tool = POSTIZ_BY_NAME.get(postizName)
  if (!tool) throw new Error(`Postiz tool ${postizName} is not registered`)
  return { name, description, inputSchema: tool.inputSchema, postiz: postizName }
}

const record = {
  channel: { type: 'string', description: 'x, facebook, instagram, linkedin, tiktok, youtube, or threads.' },
  content: { type: 'string' },
  media: { type: 'array', items: { type: 'string' } },
  scheduleAt: { type: 'integer', description: 'Unix seconds. 0 means unscheduled.' },
  status: { type: 'string', description: 'draft, scheduled, published, or failed.' },
}

const account = {
  provider: { type: 'string', description: 'x, facebook, instagram, linkedin, tiktok, youtube, or threads.' },
  handle: { type: 'string' },
  status: { type: 'string', description: 'connected, disconnected, or error.' },
}

export const OPERATIONS = [
  api('get_social_summary', 'Four counts for this org: accounts, posts, published, and scheduled.', {}, [], (hanzo) => hanzo.probe()),
  api('list_social_providers', 'Whether this deployment can publish to each network, and the env var names still missing. Never a secret.', {}, [], (hanzo) => hanzo.providers()),
  api('list_social_credentials', 'Apps this org has sealed. clientId is public. secretSet says a secret is stored. The secret is not returned.', {}, [], (hanzo) => hanzo.credentials()),
  api('list_social_audiences', 'Which stored account is personal and which is the organization. The account row itself cannot hold this.', {}, [], (hanzo) => listAudiences(hanzo)),
  api(
    'set_social_audience',
    'Remember one account as personal or business. Other accounts and any other settings on the document stay.',
    {
      id: { type: 'string' },
      audience: { type: 'string', enum: ['personal', 'business'] },
    },
    ['id', 'audience'],
    (hanzo, input) => setAudience(hanzo, input, false),
  ),
  api('forget_social_audience', 'Drop the kind stored for one account. A missing id is not an error.', idField(), ['id'], (hanzo, input) => setAudience(hanzo, input, true)),
  api('list_social_accounts', 'Connected accounts: id, network, handle, status, timestamps. No access token.', {}, [], (hanzo) => hanzo.accounts()),
  api('get_social_account', 'One connected account by id.', idField(), ['id'], (hanzo, input) => hanzo.account(input.id)),
  api('create_social_account', 'Record an account. The body is the whole record.', account, [], (hanzo, input) => hanzo.createAccount(pick(input, ['provider', 'handle', 'status']))),
  api('set_social_account', 'Replace an account. Omitted fields reset to their defaults.', { ...idField(), ...account }, ['id'], (hanzo, input) => hanzo.setAccount(input.id, pick(input, ['provider', 'handle', 'status']))),
  api('delete_social_account', 'Remove an account record. Posts already published stay on the network.', idField(), ['id'], async (hanzo, input) => {
    await hanzo.deleteAccount(input.id)
    return { id: input.id, deleted: true }
  }),
  api('list_social_posts', 'Posts for this org, newest update first.', {}, [], (hanzo) => hanzo.posts()),
  api('get_social_post', 'One post by id, including the external id once it has published.', idField(), ['id'], (hanzo, input) => hanzo.getPost(input.id)),
  api('create_social_post', 'Store a post. A scheduled time already in the past publishes immediately.', record, ['content'], (hanzo, input) => hanzo.createPost(pick(input, ['channel', 'content', 'media', 'scheduleAt', 'status']))),
  api('set_social_post', 'Replace a post. This does not publish. content is required. Omitting media clears it.', { ...idField(), ...record }, ['id', 'content'], (hanzo, input) => hanzo.setPost(input.id, pick(input, ['channel', 'content', 'media', 'scheduleAt', 'status']))),
  api('publish_social_post', 'Publish one post now. A post already published comes back unchanged.', idField(), ['id'], (hanzo, input) => hanzo.publish(input.id)),
  api('delete_social_post', 'Delete the post record. A post already on the network stays there.', idField(), ['id'], async (hanzo, input) => {
    await hanzo.deletePost(input.id)
    return { id: input.id, deleted: true }
  }),
  mapped('list_social_channels', 'Connected accounts in the shape a scheduler posts to: id, name, picture, platform. picture is empty when the network supplied none.', 'integrationList'),
  mapped('list_social_groups', 'Groups an agent can filter channels by. This instance has one group, workspace.', 'groupList'),
  mapped('social_platform_schema', 'Posting rules, character cap, settings, and provider actions for one network before schedule_social_post.', 'integrationSchema'),
  mapped('run_social_provider', 'Run a provider action named by social_platform_schema, with the org credential stored for that network.', 'triggerTool'),
  mapped('schedule_social_post', 'Draft, schedule, or publish now on a connected account from list_social_channels. type is draft, schedule, or now.', 'integrationSchedulePostTool'),
  mapped('list_social_posts_between', 'Posts whose time falls between startDate and endDate, as UTC timestamps. States are QUEUE, DRAFT, PUBLISHED, and ERROR.', 'postsListTool'),
  mapped('set_social_post_settings', 'Merge provider settings into a draft or scheduled post. A published post is refused.', 'postSettingsTool'),
  mapped('upload_social_media', 'Fetch a public http(s) image or video into the library. Local and private hosts are refused.', 'uploadFromUrlTool'),
  mapped('list_social_media', 'Library items, newest first. path is the attachment URL.', 'mediaListTool'),
  mapped('social_media_status', 'One library item. status is ready when the item exists.', 'mediaStatusTool'),
  mapped('generate_social_image', 'Generate an image from a prompt and keep it in the library. path is the attachment URL.', 'generateImageTool'),
  mapped('list_social_video_models', 'Video models for generate_social_video, with the durations and sizes each one accepts.', 'generateVideoOptions'),
  mapped('social_video_function', 'Extra spec for one video model. functionName spec returns durations, sizes, aspect ratios, and resolutions.', 'videoFunctionTool'),
  mapped('generate_social_video', 'Start a video render. Poll social_video_status until completed, then use url as the attachment.', 'generateVideoTool'),
  mapped('social_video_status', 'A video job. pending is still rendering. completed includes the library url. failed includes error.', 'videoStatusTool'),
  mapped('clip_social_video', 'Cut a long video into vertical clips and keep each one in the library. fit is crop or blur. Poll social_clip_status.', 'clippingTool'),
  mapped('social_clip_status', 'A clipping job. completed includes each clip url, title, and content.', 'clippingStatusTool'),
]

const OP_NAMES = OPERATIONS.map((op) => op.name)

const SOCIAL_TOOL = {
  name: 'social',
  description: [
    `social: ${OPERATIONS.length} operations. Name one in "op" and pass that operation's own arguments in "input". describe returns an operation's input schema.`,
    ...OPERATIONS.map((op) => `${op.name} — ${op.description}`),
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      op: { type: 'string', enum: OP_NAMES, description: 'The operation to run.' },
      input: { type: 'object', description: 'Arguments for the chosen op.' },
    },
    required: ['op'],
  },
}

const DESCRIBE_TOOL = {
  name: 'describe',
  description: 'The description and input schema of ONE social operation, named as it appears in the social tool op enum.',
  inputSchema: schema({ op: { type: 'string', enum: OP_NAMES } }, ['op']),
}

export function isAgentPath(url) {
  const path = (url || '/').split('?')[0]
  return path === '/v1/social/mcp' || path.startsWith('/v1/social/mcp/')
}

export function handleAgent(req, res, options = {}) {
  const url = new URL(req.url || '/', 'http://localhost')
  if (req.method === 'DELETE') return empty(res, 200)
  if (req.method === 'GET') return json(res, 405, { message: 'This MCP server answers JSON on POST' })
  if (req.method !== 'POST') return json(res, 405, { message: 'POST only' })
  return readJson(req)
    .then((body) => dispatch(body, req, res, url, options))
    .catch((error) => {
      if (res.headersSent) return
      json(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: error instanceof Error ? error.message : 'Invalid request' } })
    })
}

async function dispatch(body, req, res, url, options) {
  const messages = Array.isArray(body) ? body : [body]
  const authed = messages.some((message) => message && message.method === 'tools/call')
  let ctx = null
  if (authed) {
    const key = apiKeyFrom(req.headers.authorization, url.pathname)
    if (!key) return refused(res, firstId(messages))
    try {
      const hanzo = options.client || hanzoClient(key, options.fetchImpl, options.base)
      await hanzo.probe()
      ctx = { hanzo, fetchRemote: options.fetchRemote || fetch }
    } catch (error) {
      if (error instanceof HanzoError && (error.status === 401 || error.status === 403)) return refused(res, firstId(messages))
      const status = error instanceof HanzoError && error.status >= 400 && error.status < 600 ? error.status : 502
      return json(res, status, {
        jsonrpc: '2.0',
        id: firstId(messages),
        error: { code: -32000, message: error instanceof Error ? error.message : 'Hanzo Social did not answer' },
      })
    }
  }
  if (Array.isArray(body)) {
    const replies = []
    for (const message of body) {
      const reply = await rpc(message, ctx, url)
      if (reply) replies.push(reply)
    }
    if (!replies.length) return empty(res, 202)
    return json(res, 200, replies)
  }
  const reply = await rpc(body, ctx, url)
  if (!reply) return empty(res, 202)
  return json(res, 200, reply)
}

async function rpc(message, ctx, url) {
  if (!message || typeof message !== 'object') {
    return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } }
  }
  if (!Object.prototype.hasOwnProperty.call(message, 'id')) return null
  try {
    const result = await method(message.method, message.params || {}, ctx, url)
    return { jsonrpc: '2.0', id: message.id, result }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32000, message: error instanceof Error ? error.message : 'tool failed' },
    }
  }
}

async function method(name, params, ctx, url) {
  if (name === 'initialize') {
    const requested = params?.protocolVersion
    return {
      protocolVersion: typeof requested === 'string' && requested.startsWith('202') ? requested : PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'hanzo-social', version: '1.0.0' },
    }
  }
  if (name === 'ping') return {}
  if (name === 'tools/list') return { tools: [SOCIAL_TOOL, DESCRIBE_TOOL] }
  if (name === 'tools/call') return call(params || {}, ctx, url)
  throw new Error(`Unknown method ${name}`)
}

async function call(params, ctx, url) {
  const name = params.name
  const args = params.arguments || {}
  if (name === 'describe') {
    const op = find(args.op)
    return content({ name: op.name, description: op.description, inputSchema: op.inputSchema }, false)
  }
  if (name !== 'social') throw new Error(`Unknown tool ${name}`)
  const op = find(args.op)
  const input = args.input && typeof args.input === 'object' ? args.input : {}
  if (op.postiz) {
    const raw = await callPostizTool(op.postiz, input, ctx, url)
    const payload = raw && Object.prototype.hasOwnProperty.call(raw, 'output') ? raw.output : raw
    const failed = payload && typeof payload === 'object' && !Array.isArray(payload) && typeof payload.errors === 'string'
    return content(payload, failed)
  }
  requireFields(op, input)
  try {
    return content(await op.run(ctx.hanzo, input), false)
  } catch (error) {
    if (error instanceof HanzoError && (error.status === 401 || error.status === 403)) throw error
    return content({ errors: error instanceof Error ? error.message : 'The operation failed.' }, true)
  }
}

function find(name) {
  const op = OPERATIONS.find((item) => item.name === name)
  if (!op) throw new Error(`Unknown op ${name || ''}`)
  return op
}

function requireFields(op, input) {
  for (const field of op.inputSchema.required || []) {
    if (input[field] == null || input[field] === '') throw new Error(`${field} is required`)
  }
}

const AUDIENCE_PRODUCT = 'social-audiences'

function readAudiences(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return {}
  const accounts = config.accounts
  if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts)) return {}
  const out = {}
  for (const [id, value] of Object.entries(accounts)) {
    if (id && (value === 'personal' || value === 'business')) out[id] = value
  }
  return out
}

async function listAudiences(hanzo) {
  const view = await hanzo.settings(AUDIENCE_PRODUCT)
  return { accounts: readAudiences(view?.config) }
}

async function setAudience(hanzo, input, forget) {
  if (!forget && input.audience !== 'personal' && input.audience !== 'business') {
    throw new Error('audience must be personal or business')
  }
  const view = await hanzo.settings(AUDIENCE_PRODUCT)
  const accounts = readAudiences(view?.config)
  if (forget) delete accounts[String(input.id)]
  else accounts[String(input.id)] = input.audience
  const config =
    view?.config && typeof view.config === 'object' && !Array.isArray(view.config) ? { ...view.config } : {}
  config.accounts = accounts
  await hanzo.saveSettings(AUDIENCE_PRODUCT, { config })
  return { accounts }
}

function pick(input, keys) {
  const out = {}
  for (const key of keys) if (input[key] !== undefined) out[key] = input[key]
  return out
}

function content(payload, isError) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload,
    isError,
  }
}

function firstId(messages) {
  for (const message of messages) {
    if (message && Object.prototype.hasOwnProperty.call(message, 'id')) return message.id
  }
  return null
}

function refused(res, id) {
  return json(res, 401, {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32001,
      message: 'tools/call needs a bearer credential; the resource metadata at https://api.hanzo.ai/.well-known/oauth-protected-resource names the authorization server to sign in at',
    },
  })
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 1_000_000) {
        reject(new Error('The request body is larger than 1 MB.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text) return resolve({})
      try {
        resolve(JSON.parse(text))
      } catch {
        reject(new Error('The request body is not JSON.'))
      }
    })
    req.on('error', reject)
  })
}

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function empty(res, status) {
  res.writeHead(status, { 'cache-control': 'no-store' })
  res.end()
}
