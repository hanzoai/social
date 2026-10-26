// The Hanzo Cloud social API, as this compatibility layer calls it.
//
// A Postiz client sends its API key as `Authorization` (bare, or Bearer).
// Hanzo wants the same key as `Authorization: Bearer`. One translation, so
// every tool and every public route speaks to the same org.

const HANZO_API = (process.env.HANZO_API || 'https://api.hanzo.ai').replace(/\/+$/, '')

export function hanzoBase() {
  return HANZO_API
}

/** Pull the caller's key out of the header Postiz uses, or the /mcp/<key> path. */
export function apiKeyFrom(authorization, pathname) {
  const header = typeof authorization === 'string' ? authorization.trim() : ''
  if (header) {
    const bearer = header.match(/^Bearer\s+(.+)$/i)
    return (bearer ? bearer[1] : header).trim()
  }
  const embedded = pathname.match(/\/mcp\/([^/]+)\/?$/)
  return embedded ? decodeURIComponent(embedded[1]) : ''
}

export class HanzoError extends Error {
  constructor(status, detail, body) {
    super(detail || `Hanzo answered ${status}`)
    this.status = status
    this.body = body
  }
}

/**
 * One authenticated Hanzo client.
 *
 * `fetchImpl` is injectable so a test can stand in for api.hanzo.ai without
 * touching the network.
 */
export function hanzoClient(token, fetchImpl = fetch, base = hanzoBase()) {
  const root = base.replace(/\/+$/, '')

  async function call(method, path, body) {
    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    let json = null
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = { detail: text }
      }
    }
    if (!response.ok) {
      const detail =
        (json && typeof json.detail === 'string' && json.detail) ||
        (json && typeof json.title === 'string' && json.title) ||
        `Hanzo answered ${response.status}`
      throw new HanzoError(response.status, detail, json)
    }
    return json
  }

  async function bytes(path) {
    const response = await fetchImpl(`${root}${path}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, accept: '*/*' },
    })
    const body = Buffer.from(await response.arrayBuffer())
    if (!response.ok) {
      let detail = `Hanzo answered ${response.status}`
      try {
        const json = JSON.parse(body.toString('utf8'))
        if (typeof json.detail === 'string' && json.detail) detail = json.detail
      } catch {
        if (body.length && body.length < 500) detail = body.toString('utf8')
      }
      throw new HanzoError(response.status, detail, null)
    }
    const type = response.headers?.get?.('content-type') || 'application/octet-stream'
    return { body, type }
  }

  return {
    /** The key is real when the org's social summary answers. */
    probe() {
      return call('GET', '/v1/social/summary')
    },
    accounts() {
      return call('GET', '/v1/social/accounts?limit=1000')
    },
    posts() {
      return call('GET', '/v1/social/posts?limit=1000')
    },
    getPost(id) {
      return call('GET', `/v1/social/posts/${encodeURIComponent(id)}`)
    },
    createPost(body) {
      return call('POST', '/v1/social/posts', body)
    },
    publish(id) {
      return call('POST', `/v1/social/posts/${encodeURIComponent(id)}/publish`)
    },
    deletePost(id) {
      return call('DELETE', `/v1/social/posts/${encodeURIComponent(id)}`)
    },
    whoami() {
      return call('GET', '/v1/iam/whoami')
    },
    /** OpenAI-compatible image generation. zen3-image is the native route. */
    generateImage(body) {
      return call('POST', '/v1/images/generations', body)
    },
    /** Async video job. Poll video(), then videoContent() for the MP4. */
    startVideo(body) {
      return call('POST', '/v1/videos/generations', body)
    },
    video(id) {
      return call('GET', `/v1/videos/${encodeURIComponent(id)}`)
    },
    videoContent(id) {
      return bytes(`/v1/videos/${encodeURIComponent(id)}/content`)
    },
    models() {
      return call('GET', '/v1/models')
    },
    provider(id) {
      return call('GET', `/v1/provider/${encodeURIComponent(id)}`)
    },
    runProvider(id, action, input) {
      return call('POST', `/v1/provider/${encodeURIComponent(id)}/run`, { action, input })
    },
    settings(product) {
      return call('GET', `/v1/settings/${encodeURIComponent(product)}`)
    },
    saveSettings(product, body) {
      return call('PUT', `/v1/settings/${encodeURIComponent(product)}`, body)
    },
    library(query) {
      const suffix = query && [...query].length ? `?${query}` : ''
      return call('GET', `/v1/library${suffix}`)
    },
    libraryItem(id) {
      return call('GET', `/v1/library/${encodeURIComponent(id)}`)
    },
    libraryKeep(body) {
      return call('POST', '/v1/library', body)
    },
    studioRun(body) {
      return call('POST', '/v1/studio/runs', body)
    },
    studioRunGet(id) {
      return call('GET', `/v1/studio/runs/${encodeURIComponent(id)}`)
    },
  }
}
