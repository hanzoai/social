// Postiz, as Grok's self-hosted connection speaks it, answered by Hanzo.
//
// Postiz Cloud opens a streamable-HTTP MCP session at <instance>/api/mcp or
// <instance>/mcp with `Authorization: Bearer <api key>`, and refuses the
// instance unless the tool list contains integrationList and
// integrationSchedulePostTool plus every core tool a current Postiz install
// exposes. /public/v1 is the same product for clients that are not MCP.
//
// Each tool calls the Hanzo API that already does that job:
// social accounts and posts, /v1/images/generations, /v1/videos/generations,
// the Library, Studio video.edit, /v1/provider/{id}/run, and /v1/settings/social.

import { createHash } from 'node:crypto'

import { apiKeyFrom, HanzoError, hanzoClient } from './hanzo.mjs'

const WORKSPACE = { id: 'workspace', name: 'Workspace' }

/** What each network accepts. Same caps the composer checks before a post is stored. */
const RULES = {
  x: { name: 'X', text: 280, needs: 'text, or text with up to 4 images and 1 video', images: 4, videos: 1, mix: true },
  facebook: { name: 'Facebook', text: 63206, needs: 'text, images, or one video', images: 10, videos: 1, mix: true },
  instagram: { name: 'Instagram', text: 2200, needs: 'at least one image or video', images: 10, videos: 10, mix: true },
  linkedin: { name: 'LinkedIn', text: 3000, needs: 'text, images, or one video, never both media kinds', images: 9, videos: 1, mix: false },
  tiktok: { name: 'TikTok', text: 2200, needs: 'a video, or images, never both in one post', images: 10, videos: 1, mix: false },
  youtube: { name: 'YouTube', text: 5000, needs: 'one video', images: 0, videos: 1, mix: false },
  threads: { name: 'Threads', text: 500, needs: 'text, images, or one video', images: 10, videos: 1, mix: true },
  bluesky: { name: 'Bluesky', text: 300, needs: 'text, or text with up to 4 images', images: 4, videos: 0, mix: false },
  mastodon: { name: 'Mastodon', text: 500, needs: 'text, up to 4 images, or one video', images: 4, videos: 1, mix: false },
  pinterest: { name: 'Pinterest', text: 800, needs: 'at least one image, up to 5', images: 5, videos: 0, mix: false },
  reddit: { name: 'Reddit', text: 40000, needs: 'text, or one link', images: 1, videos: 1, mix: false },
  'telegram-bot': { name: 'Telegram', text: 4096, needs: 'text, images, or videos', images: 10, videos: 10, mix: true },
  'discord-webhook': { name: 'Discord', text: 2000, needs: 'text, images, or videos', images: 10, videos: 10, mix: true },
}

const IMAGE_MODEL = process.env.HANZO_IMAGE_MODEL || 'zen3-image'
const LIBRARY_BYTES = 7_500_000
const SETTINGS_PRODUCT = 'social'

const PROTOCOL = '2025-03-26'

const TOOLS = [
  tool(
    'integrationList',
    'List connected social accounts. Optionally pass a group id from groupList; the only group is "workspace".',
    { type: 'object', properties: { group: { type: 'string' } } },
  ),
  tool(
    'groupList',
    'List groups. Accounts on this instance belong to the workspace group.',
    { type: 'object', properties: {} },
  ),
  tool(
    'integrationSchema',
    'Posting rules for one platform before integrationSchedulePostTool. platform is x, facebook, instagram, linkedin, tiktok, youtube, threads, bluesky, mastodon, pinterest, reddit, telegram-bot, or discord-webhook.',
    {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        isPremium: { type: 'boolean' },
      },
      required: ['platform'],
    },
  ),
  tool(
    'triggerTool',
    'Call a provider action (a methodName from integrationSchema tools) with the org credential stored for that network. methodName is required. dataSchema carries the action inputs.',
    {
      type: 'object',
      properties: {
        integrationId: { type: 'string' },
        methodName: { type: 'string' },
        dataSchema: { type: 'array' },
      },
      required: ['integrationId', 'methodName'],
    },
  ),
  tool(
    'integrationSchedulePostTool',
    'Create a draft, schedule a post, or publish now on a connected account from integrationList. The first postsAndComments item is the post. Further items are appended to the text of the same post. settings are stored on the post and merged later by postSettingsTool.',
    {
      type: 'object',
      properties: {
        socialPost: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              integrationId: { type: 'string' },
              isPremium: { type: 'boolean' },
              date: { type: 'string' },
              shortLink: { type: 'boolean' },
              type: { type: 'string', enum: ['draft', 'schedule', 'now'] },
              postsAndComments: { type: 'array' },
              settings: { type: 'array' },
            },
            required: ['integrationId', 'type', 'postsAndComments'],
          },
        },
      },
      required: ['socialPost'],
    },
  ),
  tool(
    'postsListTool',
    'List posts whose time falls between startDate and endDate (UTC). States are QUEUE, DRAFT, PUBLISHED, and ERROR.',
    {
      type: 'object',
      properties: {
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        customer: { type: 'string' },
      },
      required: ['startDate', 'endDate'],
    },
  ),
  tool(
    'postSettingsTool',
    'Merge provider settings into a draft or scheduled post. Content and publish date stay as they are. Keys you omit stay as they are. A published post is refused.',
    {
      type: 'object',
      properties: {
        id: { type: 'string' },
        settings: { type: 'array' },
      },
      required: ['id', 'settings'],
    },
  ),
  tool(
    'deletePostTool',
    'Delete a post by the id from postsListTool. This removes it from Hanzo Social. A post already on the network stays there.',
    { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  ),
  tool(
    'uploadFromUrlTool',
    'Fetch a public http(s) image or video and keep it in the media library. Returns { id, path, status } to attach, or { error }. status is ready when the library item exists. Local and private hosts are refused.',
    {
      type: 'object',
      properties: { url: { type: 'string' }, adjust: { type: 'boolean' } },
      required: ['url'],
    },
  ),
  tool(
    'mediaListTool',
    'List media already in the library, newest first, 18 per page. Use path as an attachment URL.',
    {
      type: 'object',
      properties: { search: { type: 'string' }, page: { type: 'number' } },
    },
  ),
  tool(
    'mediaStatusTool',
    'Read one library item by the id uploadFromUrlTool or generateImageTool returned. status is ready when the item exists.',
    { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  ),
  tool(
    'generateImageTool',
    'Generate an image from a prompt and keep it in the media library. Use path as a post attachment. Returns { error } when generation fails.',
    { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
  ),
  tool(
    'generateVideoOptions',
    'List the video models you can pass as identifier to generateVideoTool, with the durations and sizes each one accepts. Call videoFunctionTool with functionName spec for the full spec of one model.',
    { type: 'object', properties: { reasoning: { type: 'string' } } },
  ),
  tool(
    'generateVideoTool',
    'Start a video render and return jobId. identifier is a type from generateVideoOptions. output is vertical or horizontal. customParams must include prompt, and may include seconds and image. Poll videoStatusTool until status is completed, then use url as the attachment. Rendering takes minutes.',
    {
      type: 'object',
      properties: {
        identifier: { type: 'string' },
        output: { type: 'string', enum: ['vertical', 'horizontal'] },
        customParams: { type: 'array' },
      },
      required: ['identifier', 'output', 'customParams'],
    },
  ),
  tool(
    'videoFunctionTool',
    'Read extra information a video model needs before generateVideoTool. functionName spec returns that model durations, sizes, aspect ratios and resolutions.',
    {
      type: 'object',
      properties: {
        identifier: { type: 'string' },
        functionName: { type: 'string' },
      },
      required: ['identifier', 'functionName'],
    },
  ),
  tool(
    'videoStatusTool',
    'Check a video job started by generateVideoTool. pending means it is still rendering. completed includes the library url to attach. failed includes error.',
    { type: 'object', properties: { jobId: { type: 'string' } }, required: ['jobId'] },
  ),
  tool(
    'clippingTool',
    'Turn a long video URL into short vertical clips with a Hanzo Studio video edit, and keep each clip in the library. Ask how the picture should fill the vertical frame before calling: blur keeps the whole picture over a blurred copy, crop fills the frame with the centre. clips defaults to 5. When integrations are passed, a draft post is created for every finished clip on every channel once clippingStatusTool reports completed. Returns clippingId. Clipping takes several minutes.',
    {
      type: 'object',
      properties: {
        url: { type: 'string' },
        integrations: { type: 'array', items: { type: 'string' } },
        clips: { type: 'number' },
        fit: { type: 'string', enum: ['crop', 'blur'] },
      },
      required: ['url', 'fit'],
    },
  ),
  tool(
    'clippingStatusTool',
    'Check a clipping started by clippingTool. pending means it is still running. completed includes each clip url, title and content. failed includes error and no clip.',
    { type: 'object', properties: { clippingId: { type: 'string' } }, required: ['clippingId'] },
  ),
]

function tool(name, description, inputSchema) {
  return { name, description, inputSchema }
}

export function isPostizPath(url) {
  const path = (url || '/').split('?')[0]
  return (
    path === '/mcp' ||
    path.startsWith('/mcp/') ||
    path === '/api/mcp' ||
    path.startsWith('/api/mcp/') ||
    path === '/public/v1' ||
    path.startsWith('/public/v1/') ||
    path === '/api/public/v1' ||
    path.startsWith('/api/public/v1/')
  )
}

/** Connect-style middleware. Calls next() for every other path. */
export function postizMiddleware(req, res, next) {
  if (!isPostizPath(req.url)) {
    next()
    return
  }
  handlePostiz(req, res).catch((error) => {
    if (res.headersSent) return
    json(res, 500, { message: error instanceof Error ? error.message : 'request failed' })
  })
}

export async function handlePostiz(req, res, options = {}) {
  const url = new URL(req.url || '/', 'http://localhost')
  const key = apiKeyFrom(req.headers.authorization, url.pathname)
  if (!key) return json(res, 401, { message: 'Your Postiz instance rejected this API key' })

  let hanzo
  try {
    hanzo = options.client || hanzoClient(key, options.fetchImpl, options.base)
    await hanzo.probe()
  } catch (error) {
    if (error instanceof HanzoError && (error.status === 401 || error.status === 403)) {
      return json(res, 401, { message: 'Your Postiz instance rejected this API key' })
    }
    const status = error instanceof HanzoError ? error.status : 502
    return json(res, status === 401 ? 401 : status >= 400 && status < 600 ? status : 502, {
      message: error instanceof Error ? error.message : 'Hanzo Social did not answer',
    })
  }

  const ctx = { hanzo, fetchRemote: options.fetchRemote || fetch }
  if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/') || url.pathname === '/api/mcp' || url.pathname.startsWith('/api/mcp/')) {
    return mcp(req, res, ctx, url)
  }
  return rest(req, res, ctx, url)
}

async function mcp(req, res, ctx, url) {
  if (req.method === 'DELETE') return empty(res, 200)
  if (req.method === 'GET') return json(res, 405, { message: 'This MCP server answers JSON on POST' })
  if (req.method !== 'POST') return json(res, 405, { message: 'POST only' })

  const body = await readJson(req)
  if (Array.isArray(body)) {
    const out = []
    for (const message of body) out.push(await rpc(message, ctx, url))
    const replies = out.filter(Boolean)
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
  const id = Object.prototype.hasOwnProperty.call(message, 'id') ? message.id : undefined
  if (id === undefined) return null
  try {
    const result = await method(message.method, message.params || {}, ctx, url)
    return { jsonrpc: '2.0', id, result }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
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
  if (name === 'tools/list') return { tools: TOOLS }
  if (name === 'tools/call') {
    const toolName = params?.name
    const args = params?.arguments || {}
    const output = await callTool(toolName, args, ctx, url)
    const text = JSON.stringify(output)
    return {
      content: [{ type: 'text', text }],
      structuredContent: output,
      isError: false,
    }
  }
  throw new Error(`Unknown method ${name}`)
}

async function callTool(name, args, ctx, url) {
  const { hanzo } = ctx
  switch (name) {
    case 'integrationList':
      return { output: (await integrations(hanzo, args.group)).map(asMcpIntegration) }
    case 'groupList':
      return { output: [WORKSPACE] }
    case 'integrationSchema':
      return { output: await schemaFor(hanzo, String(args.platform || '')) }
    case 'triggerTool':
      return trigger(hanzo, args)
    case 'integrationSchedulePostTool':
      return schedule(hanzo, args, originOf(url))
    case 'postsListTool':
      return { output: { posts: await listPosts(hanzo, args) } }
    case 'postSettingsTool':
      return updateSettings(hanzo, args)
    case 'deletePostTool':
      return removePost(hanzo, args.id)
    case 'uploadFromUrlTool':
      return keepRemote(hanzo, args.url, ctx.fetchRemote)
    case 'mediaListTool':
      return mediaLibrary(hanzo, args)
    case 'mediaStatusTool':
      return mediaStatus(hanzo, args.id)
    case 'generateImageTool':
      return generateImage(hanzo, args, ctx.fetchRemote)
    case 'generateVideoOptions':
      return videoOptions(hanzo)
    case 'generateVideoTool':
      return generateVideo(hanzo, args)
    case 'videoFunctionTool':
      return videoFunction(hanzo, args)
    case 'videoStatusTool':
      return videoStatus(hanzo, args.jobId)
    case 'clippingTool':
      return startClipping(hanzo, args)
    case 'clippingStatusTool':
      return clippingStatus(hanzo, args.clippingId)
    default:
      throw new Error(`Unknown tool ${name}`)
  }
}

async function rest(req, res, ctx, url) {
  const { hanzo } = ctx
  const path = url.pathname.replace(/^\/api/, '')
  const method = req.method || 'GET'

  if (method === 'GET' && path === '/public/v1/is-connected') return json(res, 200, { connected: true })
  if (method === 'GET' && path === '/public/v1/groups') return json(res, 200, [WORKSPACE])
  if (method === 'GET' && path === '/public/v1/me') return json(res, 200, await me(hanzo))
  if (method === 'GET' && path === '/public/v1/integrations') {
    return json(res, 200, await integrations(hanzo, url.searchParams.get('group')))
  }
  if (method === 'GET' && path === '/public/v1/posts') {
    const posts = await listPosts(hanzo, {
      startDate: url.searchParams.get('startDate') || '1970-01-01T00:00:00Z',
      endDate: url.searchParams.get('endDate') || '2999-01-01T00:00:00Z',
      customer: url.searchParams.get('customer') || undefined,
    })
    return json(res, 200, { posts: posts.map(asPublicPost) })
  }
  if (method === 'POST' && path === '/public/v1/posts') {
    const body = await readJson(req)
    const created = await schedule(hanzo, { socialPost: publicToSocial(body) }, originOf(url))
    if (!Array.isArray(created.output)) return json(res, 400, { message: created.output.errors })
    return json(res, 200, created.output.map((row) => ({ postId: row.postId, integration: row.integration })))
  }
  if (method === 'DELETE' && path.startsWith('/public/v1/posts/')) {
    const id = decodeURIComponent(path.slice('/public/v1/posts/'.length))
    const removed = await removePost(hanzo, id)
    if (removed.output.errors) return json(res, 404, { message: removed.output.errors })
    return json(res, 200, { id })
  }
  if (method === 'POST' && (path === '/public/v1/upload-from-url' || path === '/public/v1/upload')) {
    const body = await readJson(req).catch(() => ({}))
    const accepted = await keepRemote(hanzo, body.url, ctx.fetchRemote)
    if (accepted.error) return json(res, 400, { message: accepted.error })
    return json(res, 201, accepted)
  }
  if (method === 'PUT' && path.startsWith('/public/v1/posts/') && path.endsWith('/settings')) {
    const id = decodeURIComponent(path.slice('/public/v1/posts/'.length, -'/settings'.length))
    const body = await readJson(req)
    const pairs = Array.isArray(body?.settings)
      ? body.settings
      : Object.entries(body?.settings || {}).map(([key, value]) => ({ key, value }))
    const updated = await updateSettings(hanzo, { id, settings: pairs })
    if (updated.output.errors) return json(res, 400, { message: updated.output.errors })
    return json(res, 200, updated.output)
  }
  if (method === 'GET' && path.startsWith('/public/v1/integration-settings/')) {
    const id = decodeURIComponent(path.slice('/public/v1/integration-settings/'.length))
    const rows = await integrations(hanzo)
    const row = rows.find((one) => one.id === id)
    if (!row) return json(res, 404, { message: 'Integration not found' })
    return json(res, 200, { output: await schemaFor(hanzo, row.identifier) })
  }
  return json(res, 404, { message: 'not found' })
}

async function integrations(hanzo, group) {
  if (group && group !== WORKSPACE.id) return []
  const page = await hanzo.accounts()
  const rows = Array.isArray(page?.data) ? page.data : []
  return rows.map((account) => ({
    id: String(account.id),
    name: String(account.handle || account.provider || account.id),
    identifier: String(account.provider || ''),
    picture: null,
    disabled: account.status !== 'connected',
    profile: String(account.handle || ''),
    customer: WORKSPACE,
  }))
}

function asMcpIntegration(row) {
  return {
    id: row.id,
    name: row.name,
    picture: row.picture || '',
    platform: row.identifier,
  }
}

async function schemaFor(hanzo, platform) {
  const rule = RULES[platform]
  if (!rule) return { rules: '', maxLength: 0, settings: 'No additional settings required', tools: [] }
  let provider = null
  try {
    provider = await hanzo.provider(platform)
  } catch (error) {
    if (!(error instanceof HanzoError) || error.status !== 404) throw error
  }
  const actions = Array.isArray(provider?.actions) ? provider.actions : []
  const tools = actions
    .filter((action) => action?.name)
    .map((action) => ({
      description: String(action.description || action.displayName || action.name),
      methodName: String(action.name),
      dataSchema: (Array.isArray(action.props) ? action.props : []).map((prop) => ({
        key: String(prop.name || ''),
        description: String(prop.description || prop.displayName || prop.name || ''),
        type: String(prop.type || 'string'),
      })),
    }))
  const postAction = actions.find((action) => /post|publish|upload/i.test(String(action.name || '')))
  const settings = postAction
    ? (postAction.props || []).map((prop) => ({
        key: String(prop.name || ''),
        type: String(prop.type || 'string'),
        description: String(prop.description || prop.displayName || ''),
      }))
    : 'No additional settings required'
  const mix = rule.mix
    ? 'Photos and video may share a post.'
    : 'A video is the whole post and cannot carry photos as well.'
  return {
    rules: `${rule.name} accepts ${rule.needs}. Up to ${rule.images} images and ${rule.videos} video. ${mix} Further postsAndComments blocks are appended to the same post.`,
    maxLength: rule.text,
    settings,
    tools,
  }
}

async function schedule(hanzo, args, origin) {
  const items = Array.isArray(args.socialPost) ? args.socialPost : null
  if (!items?.length) return { output: { errors: 'socialPost must list at least one post' } }
  const accounts = await integrations(hanzo)
  const made = []
  for (const item of items) {
    const account = accounts.find((row) => row.id === item.integrationId)
    if (!account) {
      return { output: { errors: `Integration not found: ${item.integrationId}. Call integrationList.` } }
    }
    if (account.disabled) {
      return { output: { errors: `${account.name} is not a connected account.` } }
    }
    const blocks = Array.isArray(item.postsAndComments) ? item.postsAndComments : []
    const content = blocks
      .map((block) => plain(block?.content))
      .filter(Boolean)
      .join('\n\n')
    const media = blocks.flatMap((block) => mediaOf(block?.attachments))
    if (!content && media.length === 0) {
      return { output: { errors: 'Your post should have at least one character or one image.' } }
    }
    const rule = RULES[account.identifier]
    if (rule && content.length > rule.text) {
      return { output: { errors: `${rule.name} allows ${rule.text} characters and this post has ${content.length}.` } }
    }
    const type = item.type === 'now' || item.type === 'schedule' || item.type === 'draft' ? item.type : 'draft'
    let scheduleAt = 0
    if (type === 'schedule') {
      const when = Date.parse(item.date)
      if (Number.isNaN(when)) return { output: { errors: 'A scheduled post needs date as a UTC timestamp.' } }
      scheduleAt = Math.floor(when / 1000)
    }
    try {
      const created = await hanzo.createPost({
        content: content || ' ',
        channel: account.identifier,
        media,
        status: type === 'schedule' ? 'scheduled' : 'draft',
        scheduleAt,
      })
      let id = String(created.id)
      if (type === 'now') {
        const published = await hanzo.publish(id)
        id = String(published.id || id)
      }
      if (Array.isArray(item.settings) && item.settings.length) {
        await mergeSettings(hanzo, id, item.settings)
      }
      made.push({
        postId: id,
        integration: account.id,
        previewUrl: `${origin}/posts`,
      })
    } catch (error) {
      return { output: { errors: error instanceof Error ? error.message : 'The post was refused.' } }
    }
  }
  return { output: made }
}

async function listPosts(hanzo, args) {
  if (args.customer && args.customer !== WORKSPACE.id) return []
  const start = Date.parse(args.startDate || '')
  const end = Date.parse(args.endDate || '')
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error('startDate and endDate must be UTC timestamps')
  }
  const page = await hanzo.posts()
  const accounts = await integrations(hanzo)
  const stored = await loadPostsConfig(hanzo)
  const byId = new Map(accounts.map((row) => [row.id, row]))
  const rows = Array.isArray(page?.data) ? page.data : []
  return rows
    .filter((post) => {
      const seconds = post.scheduleAt > 0 ? post.scheduleAt : post.createdAt || post.updatedAt || 0
      const at = seconds * 1000
      return at >= start && at <= end
    })
    .map((post) => {
      const account = post.accountId ? byId.get(String(post.accountId)) : undefined
      return {
        id: String(post.id),
        publishDate: new Date((post.scheduleAt > 0 ? post.scheduleAt : post.createdAt || 0) * 1000).toISOString(),
        state: stateOf(post.status),
        error: post.status === 'failed' ? post.error || 'The last publish failed.' : null,
        content: String(post.content || ''),
        settings: { __type: post.channel, ...(stored[String(post.id)] || {}) },
        group: String(post.id),
        integrationId: String(post.accountId || ''),
        platform: String(post.channel || ''),
        integrationName: account?.name || String(post.channel || ''),
      }
    })
}

function asPublicPost(post) {
  return {
    id: post.id,
    content: post.content,
    publishDate: post.publishDate,
    releaseURL: '',
    state: post.state,
    error: post.error,
    integration: {
      id: post.integrationId,
      providerIdentifier: post.platform,
      name: post.integrationName,
      picture: '',
    },
  }
}

function publicToSocial(body) {
  const posts = Array.isArray(body?.posts) ? body.posts : []
  return posts.map((post) => ({
    integrationId: post?.integration?.id,
    date: body?.date,
    type: body?.type || 'draft',
    postsAndComments: (Array.isArray(post?.value) ? post.value : [{}]).map((value) => ({
      content: value?.content || '',
      attachments: (Array.isArray(value?.image) ? value.image : []).map((image) =>
        typeof image === 'string' ? image : image?.path,
      ),
    })),
    settings: [],
  }))
}

async function removePost(hanzo, id) {
  if (!id) return { output: { errors: 'Pass the id of the post to delete.' } }
  try {
    await hanzo.deletePost(String(id))
    return { output: { postId: String(id) } }
  } catch (error) {
    if (error instanceof HanzoError && error.status === 404) return { output: { errors: 'Post not found' } }
    return { output: { errors: error instanceof Error ? error.message : 'The post could not be deleted.' } }
  }
}

async function loadPostsConfig(hanzo) {
  try {
    const view = await hanzo.settings(SETTINGS_PRODUCT)
    const config = view?.config && typeof view.config === 'object' && !Array.isArray(view.config) ? view.config : {}
    const posts = config.posts && typeof config.posts === 'object' && !Array.isArray(config.posts) ? config.posts : {}
    return posts
  } catch {
    return {}
  }
}

async function mergeSettings(hanzo, id, pairs) {
  const view = await hanzo.settings(SETTINGS_PRODUCT)
  const config = view?.config && typeof view.config === 'object' && !Array.isArray(view.config) ? { ...view.config } : {}
  const posts = config.posts && typeof config.posts === 'object' && !Array.isArray(config.posts) ? { ...config.posts } : {}
  const prev = posts[id] && typeof posts[id] === 'object' && !Array.isArray(posts[id]) ? { ...posts[id] } : {}
  for (const pair of pairs) {
    if (pair && typeof pair.key === 'string' && pair.key) prev[pair.key] = pair.value
  }
  posts[id] = prev
  config.posts = posts
  await hanzo.saveSettings(SETTINGS_PRODUCT, { config })
  return prev
}

async function updateSettings(hanzo, args) {
  const id = String(args.id || '')
  if (!id) return { output: { errors: 'Pass the id of the post.' } }
  let post
  try {
    post = await hanzo.getPost(id)
  } catch (error) {
    if (error instanceof HanzoError && error.status === 404) return { output: { errors: 'Post not found' } }
    return { output: { errors: error instanceof Error ? error.message : 'The post could not be read.' } }
  }
  if (post.status === 'published') {
    return { output: { errors: 'A published post keeps the settings it went out with.' } }
  }
  try {
    await mergeSettings(hanzo, id, Array.isArray(args.settings) ? args.settings : [])
  } catch (error) {
    return { output: { errors: error instanceof Error ? error.message : 'The settings could not be saved.' } }
  }
  const seconds = post.scheduleAt > 0 ? post.scheduleAt : post.createdAt || 0
  return { output: { postId: id, publishDate: new Date(seconds * 1000).toISOString() } }
}

async function trigger(hanzo, args) {
  const rows = await integrations(hanzo)
  const account = rows.find((row) => row.id === args.integrationId)
  if (!account) {
    return { output: 'Integration not found, use integrationList to get a valid integration id' }
  }
  const input = {}
  for (const pair of Array.isArray(args.dataSchema) ? args.dataSchema : []) {
    if (pair && typeof pair.key === 'string') input[pair.key] = pair.value
  }
  try {
    const result = await hanzo.runProvider(account.identifier, String(args.methodName || ''), input)
    if (result && result.ok === false) return { output: String(result.error || 'The provider action failed.') }
    const output = result && Object.prototype.hasOwnProperty.call(result, 'output') ? result.output : result
    if (typeof output === 'string' || Array.isArray(output) || (output && typeof output === 'object')) return { output }
    return { output: output == null ? '' : String(output) }
  } catch (error) {
    return { output: error instanceof Error ? error.message : 'The provider action failed.' }
  }
}

async function generateImage(hanzo, args, fetchRemote) {
  const prompt = String(args.prompt || '').trim()
  if (!prompt) return { error: 'prompt is required' }
  try {
    const image = await hanzo.generateImage({
      model: typeof args.model === 'string' && args.model ? args.model : IMAGE_MODEL,
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    })
    const first = Array.isArray(image?.data) ? image.data[0] : null
    if (!first) return { error: 'Image generation returned no image.' }
    if (typeof first.b64_json === 'string' && first.b64_json) {
      const kept = await hanzo.libraryKeep({
        data: first.b64_json,
        mime: 'image/png',
        name: 'generated.png',
        source: 'studio',
        kind: 'image',
        key: `image:${digest(prompt)}`,
      })
      return mediaRef(kept)
    }
    if (typeof first.url === 'string' && first.url) return keepRemote(hanzo, first.url, fetchRemote)
    return { error: 'Image generation returned no image.' }
  } catch (error) {
    return { error: `Image generation failed: ${error instanceof Error ? error.message : String(error)}` }
  }
}

async function videoOptions(hanzo) {
  const catalog = await hanzo.models()
  const models = Array.isArray(catalog?.data) ? catalog.data : []
  const video = models
    .filter((model) => Array.isArray(model.outputs) && model.outputs.includes('video'))
    .map((model) => ({
      type: String(model.id),
      output: 'vertical|horizontal',
      tools: [{ functionName: 'spec', output: 'durations, sizes, aspect ratios and resolutions' }],
      customParams: {
        prompt: { type: 'string', description: 'What the video shows' },
        seconds: { type: 'integer', enum: model.video?.durations || [] },
        image: { type: 'string', description: 'Optional starting image URL' },
        size: { type: 'string', enum: model.video?.sizes || [] },
      },
    }))
  return { video }
}

async function generateVideo(hanzo, args) {
  const params = {}
  for (const pair of Array.isArray(args.customParams) ? args.customParams : []) {
    if (pair && typeof pair.key === 'string') params[pair.key] = pair.value
  }
  const prompt = String(params.prompt || params.text || '').trim()
  if (!args.identifier) return { error: 'identifier is a type from generateVideoOptions' }
  if (!prompt) return { error: 'customParams must include prompt' }
  const body = {
    model: String(args.identifier),
    prompt,
    size: typeof params.size === 'string' && params.size ? params.size : args.output === 'vertical' ? '720x1280' : '1280x720',
  }
  if (params.seconds != null && params.seconds !== '') body.seconds = Number(params.seconds)
  try {
    const job = await hanzo.startVideo(body)
    if (!job?.id) return { error: 'Video generation did not return a job id.' }
    return { jobId: String(job.id) }
  } catch (error) {
    return { error: `Video generation failed: ${error instanceof Error ? error.message : String(error)}` }
  }
}

async function videoFunction(hanzo, args) {
  if (args.functionName !== 'spec') {
    return { error: `Function ${args.functionName || ''} is not on this model. Call spec.` }
  }
  const catalog = await hanzo.models()
  const models = Array.isArray(catalog?.data) ? catalog.data : []
  const model = models.find((item) => item.id === args.identifier)
  if (!model) return { error: `Model ${args.identifier} is not in the catalog.` }
  return {
    identifier: model.id,
    name: model.name || model.id,
    description: model.description || '',
    ...(model.video || {}),
  }
}

async function videoStatus(hanzo, jobId) {
  if (!jobId) return { error: 'jobId is required' }
  try {
    const job = await hanzo.video(String(jobId))
    const status = mediaState(job?.status)
    const failure = job?.error?.message || (typeof job?.error === 'string' ? job.error : '')
    if (status !== 'completed') {
      return { status, id: String(job?.id || jobId), ...(failure ? { error: failure } : {}) }
    }
    const file = await hanzo.videoContent(String(job.id || jobId))
    if (file.body.length > LIBRARY_BYTES) {
      return {
        status: 'completed',
        id: String(job.id || jobId),
        error: `The video is ${file.body.length} bytes. The library keep accepts 10 MiB in one call, so download /v1/videos/${job.id}/content with this API key.`,
      }
    }
    const kept = await hanzo.libraryKeep({
      data: file.body.toString('base64'),
      mime: file.type.split(';')[0] || 'video/mp4',
      name: `${job.id || jobId}.mp4`,
      source: 'studio',
      kind: 'video',
      key: `video:${job.id || jobId}`,
    })
    const ref = mediaRef(kept)
    return { status: 'completed', id: ref.id, url: ref.path }
  } catch (error) {
    return { error: `Video job lookup failed: ${error instanceof Error ? error.message : String(error)}` }
  }
}

async function startClipping(hanzo, args) {
  const address = publicUrl(args.url)
  if (!address) return { error: 'url must be a public http(s) address' }
  if (args.fit !== 'crop' && args.fit !== 'blur') return { error: 'fit must be crop or blur' }
  const clips = Number.isInteger(args.clips) ? args.clips : 5
  if (clips < 1 || clips > 10) return { error: 'clips must be from 1 to 10' }
  const integrations = Array.isArray(args.integrations) ? args.integrations.map(String).slice(0, 20) : []
  try {
    const run = await hanzo.studioRun({
      title: 'Clip',
      input: { url: address.href, clips, fit: args.fit, integrations },
      graph: {
        steps: [
          {
            id: 'clip',
            op: 'video.edit',
            title: 'Clip',
            with: {
              url: address.href,
              clips,
              fit: args.fit,
              aspect: '9:16',
            },
          },
        ],
      },
    })
    if (!run?.id) return { error: 'Clipping did not return an id.' }
    return { clippingId: String(run.id) }
  } catch (error) {
    return { error: `Clipping could not start: ${error instanceof Error ? error.message : String(error)}` }
  }
}

async function clippingStatus(hanzo, clippingId) {
  if (!clippingId) return { error: 'clippingId is required' }
  try {
    const run = await hanzo.studioRunGet(String(clippingId))
    const status = mediaState(run?.status)
    const clips = (Array.isArray(run?.outputs) ? run.outputs : []).map((item) => ({
      id: String(item.id || ''),
      title: String(item.name || run.title || 'Clip'),
      content: String(item.name || run.text || ''),
      status: item.url || item.download ? 'completed' : status,
      ...(item.url || item.download ? { url: String(item.url || item.download) } : {}),
      ...(item.preview ? { thumbnail: String(item.preview) } : {}),
    }))
    if (status === 'completed') await draftClips(hanzo, String(clippingId), run, clips)
    const failure = run?.error?.detail || run?.error?.title || ''
    return {
      status,
      step: String(run?.status || status),
      ...(run?.title ? { title: String(run.title) } : {}),
      clips,
      ...(failure ? { error: String(failure) } : {}),
    }
  } catch (error) {
    return { error: `Clipping lookup failed: ${error instanceof Error ? error.message : String(error)}` }
  }
}

async function draftClips(hanzo, clippingId, run, clips) {
  const integrations = Array.isArray(run?.input?.integrations) ? run.input.integrations.map(String) : []
  const ready = clips.filter((clip) => clip.url)
  if (!integrations.length || !ready.length) return
  const view = await hanzo.settings(SETTINGS_PRODUCT).catch(() => ({ config: {} }))
  const config = view?.config && typeof view.config === 'object' ? { ...view.config } : {}
  const drafted = config.clipDrafts && typeof config.clipDrafts === 'object' ? { ...config.clipDrafts } : {}
  if (drafted[clippingId]) return
  const accounts = await integrationsListSafe(hanzo)
  for (const clip of ready) {
    for (const integrationId of integrations) {
      const account = accounts.find((row) => row.id === integrationId && !row.disabled)
      if (!account) continue
      await hanzo.createPost({
        content: clip.content || clip.title || 'Clip',
        channel: account.identifier,
        media: [clip.url],
        status: 'draft',
        scheduleAt: 0,
      })
    }
  }
  drafted[clippingId] = true
  config.clipDrafts = drafted
  await hanzo.saveSettings(SETTINGS_PRODUCT, { config })
}

async function integrationsListSafe(hanzo) {
  return integrations(hanzo)
}

async function keepRemote(hanzo, value, fetchRemote) {
  const address = publicUrl(value)
  if (!address) return { error: 'url must be a public http(s) address' }
  try {
    const remote = await (fetchRemote || fetch)(address.href, { redirect: 'error' })
    if (!remote.ok) return { error: `Failed to upload media from URL: the host answered ${remote.status}` }
    const body = Buffer.from(await remote.arrayBuffer())
    if (body.length > LIBRARY_BYTES) {
      return { error: `The file is ${body.length} bytes. The library keep accepts 10 MiB in one call.` }
    }
    const mime = (remote.headers?.get?.('content-type') || guessMime(address.pathname)).split(';')[0]
    const name = address.pathname.split('/').pop() || 'upload'
    const kept = await hanzo.libraryKeep({
      data: body.toString('base64'),
      mime,
      name,
      source: 'studio',
      kind: mime.startsWith('video/') ? 'video' : 'image',
      key: `url:${digest(address.href)}`,
    })
    return { ...mediaRef(kept), status: 'ready' }
  } catch (error) {
    return { error: `Failed to upload media from URL: ${error instanceof Error ? error.message : String(error)}` }
  }
}

async function mediaLibrary(hanzo, args) {
  const search = String(args.search || '')
  const pageNo = Number(args.page) > 0 ? Number(args.page) : 1
  let cursor = ''
  let page = { data: [], next: '' }
  for (let i = 0; i < pageNo; i += 1) {
    const query = new URLSearchParams()
    if (search) query.set('search', search)
    if (cursor) query.set('cursor', cursor)
    page = await hanzo.library(query)
    cursor = page?.next || ''
    if (!cursor) break
  }
  const rows = Array.isArray(page?.data) ? page.data : []
  return {
    pages: cursor ? pageNo + 1 : pageNo,
    output: rows.slice(0, 18).map(asMedia),
  }
}

async function mediaStatus(hanzo, id) {
  if (!id) return { error: 'id is required' }
  try {
    const item = await hanzo.libraryItem(String(id))
    const ref = mediaRef(item)
    return { id: ref.id, path: ref.path, status: 'ready' }
  } catch (error) {
    return { error: `Media status lookup failed: ${error instanceof Error ? error.message : String(error)}` }
  }
}

function mediaRef(item) {
  const path = String(item?.url || item?.download || '')
  return { id: String(item?.id || path), path }
}

function asMedia(item) {
  const ref = mediaRef(item)
  const name = String(item?.name || ref.path.split('/').pop() || ref.id)
  return {
    id: ref.id,
    name,
    originalName: name,
    path: ref.path,
    createdAt: typeof item?.created === 'string' && item.created ? item.created : new Date(0).toISOString(),
  }
}

function mediaState(status) {
  const value = String(status || '').toLowerCase()
  if (['completed', 'succeeded', 'success', 'done'].includes(value)) return 'completed'
  if (['failed', 'error', 'cancelled', 'canceled'].includes(value)) return 'failed'
  return 'pending'
}

function publicUrl(value) {
  if (typeof value !== 'string') return null
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return null
  if (host === '0.0.0.0' || host === '::1' || host === '::') return null
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return null
  const sixteen = host.match(/^172\.(\d+)\./)
  if (sixteen && Number(sixteen[1]) >= 16 && Number(sixteen[1]) <= 31) return null
  return url
}

function guessMime(pathname) {
  if (/\.(mp4|m4v|mov|webm)$/i.test(pathname)) return 'video/mp4'
  if (/\.png$/i.test(pathname)) return 'image/png'
  if (/\.gif$/i.test(pathname)) return 'image/gif'
  if (/\.webp$/i.test(pathname)) return 'image/webp'
  return 'image/jpeg'
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}

async function me(hanzo) {
  try {
    const who = await hanzo.whoami()
    const org = who?.organization || who?.org || who?.owner || {}
    return {
      organization: {
        id: String(org.id || org.name || WORKSPACE.id),
        name: String(org.displayName || org.name || WORKSPACE.name),
      },
      user: null,
    }
  } catch {
    return { organization: WORKSPACE, user: null }
  }
}

function stateOf(status) {
  if (status === 'scheduled' || status === 'publishing') return 'QUEUE'
  if (status === 'published') return 'PUBLISHED'
  if (status === 'failed') return 'ERROR'
  return 'DRAFT'
}

function plain(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function mediaOf(attachments) {
  if (!Array.isArray(attachments)) return []
  return attachments
    .map((item) => (typeof item === 'string' ? item : item?.path))
    .filter((item) => typeof item === 'string' && item)
}

function originOf(url) {
  return process.env.PUBLIC_ORIGIN?.replace(/\/+$/, '') || `${url.protocol}//${url.host}`
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
      if (!chunks.length) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('The request body is not JSON.'))
      }
    })
    req.on('error', reject)
  })
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  })
  res.end(payload)
}

function empty(res, status) {
  res.writeHead(status, { 'cache-control': 'no-store' })
  res.end()
}
