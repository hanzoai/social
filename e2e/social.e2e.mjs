// Zero-Playwright native headless Chrome/Chromium CDP WebSocket + `server/http.mjs` E2E suite.
//
// Drives headless Chromium directly over raw Chrome DevTools Protocol (CDP) WebSockets
// (`globalThis.WebSocket`) against the real production `server/http.mjs` handler and
// deterministic in-process `/v1/social` + `/v1/provider` fixtures — nothing leaves the machine.

process.env.TZ = 'America/Los_Angeles'

import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { createHandler } from '../server/http.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const distDir = join(repoRoot, 'dist')

const ORG = 'acme'
const SUBJECT = 'u-e2e'

/** Six core screens and the heading + sidebar label each renders. */
const SCREENS = [
  { path: '/', title: 'Overview', nav: 'Overview' },
  { path: '/compose', title: 'Post', nav: 'Post' },
  { path: '/posts', title: 'Posts', nav: 'Posts' },
  { path: '/calendar', title: 'Schedule', nav: 'Schedule' },
  { path: '/accounts', title: 'Connect', nav: 'Connect' },
  { path: '/analytics', title: 'Analytics', nav: 'Analytics' },
]

function onDay(date, hour = 12, minute = 0) {
  const today = new Date()
  return Math.floor(
    new Date(today.getFullYear(), today.getMonth(), date, hour, minute).getTime() / 1000,
  )
}

function openMonth() {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

const SUMMARY = { accounts: 2, posts: 5, published: 2, scheduled: 2 }

const NETWORKS = [
  { provider: 'x', credentialsConfigured: true },
  { provider: 'linkedin', credentialsConfigured: true },
  {
    provider: 'youtube',
    credentialsConfigured: false,
    missingCredentials: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
  },
]

const ACCOUNTS = [
  {
    id: 'acct_x',
    provider: 'x',
    handle: '@acme',
    externalId: 'x-org-1',
    status: 'connected',
    createdAt: onDay(2),
    updatedAt: onDay(2),
  },
  {
    id: 'acct_li',
    provider: 'linkedin',
    handle: 'Acme Inc',
    externalId: 'li-org-1',
    status: 'connected',
    createdAt: onDay(2),
    updatedAt: onDay(2),
  },
]

const REFUSAL =
  'linkedin needs LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET (set as deployment env) plus a connected account access token'

const POSTS = [
  {
    id: 'post_ship',
    content: 'Shipping the calendar today.',
    channel: 'x',
    status: 'published',
    scheduleAt: 0,
    media: [],
    accountId: 'acct_x',
    externalId: 'x-88213',
    createdAt: onDay(20, 8),
    updatedAt: onDay(20, 9),
  },
  {
    id: 'post_note',
    content: 'A longer note on how the queue works.',
    channel: 'linkedin',
    status: 'published',
    scheduleAt: 0,
    media: [],
    accountId: 'acct_li',
    externalId: 'li-4410',
    createdAt: onDay(20, 10),
    updatedAt: onDay(20, 11),
  },
  {
    id: 'post_soon',
    content: "Thursday's announcement.",
    channel: 'x',
    status: 'scheduled',
    scheduleAt: onDay(24, 9, 30),
    media: [],
    createdAt: onDay(20, 12),
    updatedAt: onDay(20, 12),
  },
  {
    id: 'post_film',
    content: 'The launch film.',
    channel: 'youtube',
    status: 'scheduled',
    scheduleAt: onDay(24, 17, 0),
    media: ['https://cdn.example.test/launch.mp4'],
    createdAt: onDay(20, 13),
    updatedAt: onDay(20, 13),
  },
  {
    id: 'post_stuck',
    content: 'The one that did not go out.',
    channel: 'linkedin',
    status: 'failed',
    scheduleAt: 0,
    media: [],
    error: REFUSAL,
    createdAt: onDay(20, 14),
    updatedAt: onDay(20, 15),
  },
]

const CONNECTORS = {
  x: {
    id: 'x',
    name: 'X',
    description: 'Post to X as your organization.',
    category: 'Marketing',
    available: true,
    connected: true,
    kind: 'oauth',
    connection: {
      account: '@acme',
      externalId: 'x-org-1',
      scopes: ['tweet.write', 'users.read'],
      connectedAt: new Date(onDay(2) * 1000).toISOString(),
    },
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Share to a LinkedIn page.',
    category: 'Marketing',
    available: true,
    connected: false,
    kind: 'oauth',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    description: 'Upload to a YouTube channel.',
    category: 'Marketing',
    available: false,
    connected: false,
    kind: 'oauth',
  },
}

function findBrowserBinary() {
  const candidates = [
    process.env.CHROMIUM_BIN,
    '/snap/chromium/current/usr/lib/chromium-browser/chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/local/bin/chromium',
    '/usr/local/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  for (const bin of candidates) {
    if (existsSync(bin)) return bin
  }
  throw new Error(`No headless Chromium/Chrome binary found in: ${candidates.join(', ')}`)
}

function ensureBuilt() {
  if (existsSync(join(distDir, 'index.html'))) return
  const hanzoBin = existsSync(`${process.env.HOME}/.local/bin/hanzo`)
    ? `${process.env.HOME}/.local/bin/hanzo`
    : 'hanzo'
  execFileSync(hanzoBin, ['serve', 'build'], { cwd: repoRoot, stdio: 'inherit' })
}

function listenEphemeral(server) {
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      resolvePromise(`http://127.0.0.1:${addr.port}`)
    })
  })
}

function closeServer(server) {
  return new Promise((resolvePromise) => {
    server.closeAllConnections?.()
    server.close(() => resolvePromise())
  })
}

function makeSignedInSession() {
  const seg = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const token = [
    seg({ alg: 'none', typ: 'JWT' }),
    seg({
      sub: SUBJECT,
      name: 'Ada Lovelace',
      email: 'ada@acme.test',
      owner: ORG,
      orgs: [{ org: ORG, role: 'owner' }],
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    'e2e',
  ].join('.')
  return { token, org: ORG, who: SUBJECT, until: Date.now() + 3_600_000 }
}

/** Minimal zero-dependency raw CDP WebSocket client. */
class CdpBrowser {
  constructor(proc, ws, userDataDir) {
    this.proc = proc
    this.ws = ws
    this.userDataDir = userDataDir
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()

    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString())
      if (msg.id !== undefined) {
        const waiter = this.pending.get(msg.id)
        if (waiter) {
          this.pending.delete(msg.id)
          if (msg.error) waiter.reject(new Error(`CDP ${msg.error.message || JSON.stringify(msg.error)}`))
          else waiter.resolve(msg.result)
        }
        return
      }
      if (msg.method) {
        const handlers = this.listeners.get(msg.method)
        if (handlers) {
          for (const fn of [...handlers]) fn(msg.params, msg.sessionId)
        }
      }
    })
  }

  static async launch() {
    const bin = findBrowserBinary()
    const snapCommon = process.env.HOME ? join(process.env.HOME, 'snap/chromium/common') : ''
    const baseTmp =
      bin.includes('snap') && !bin.endsWith('/chrome') && snapCommon && existsSync(snapCommon)
        ? snapCommon
        : existsSync('/tmp')
          ? '/tmp'
          : tmpdir()
    const userDataDir = mkdtempSync(join(baseTmp, 'hanzo-social-cdp-'))
    const proc = spawn(
      bin,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=0',
        '--window-size=1280,900',
        '--lang=en-US',
        `--user-data-dir=${userDataDir}`,
        'about:blank',
      ],
      {
        detached: true,
        env: { ...process.env, TZ: 'America/Los_Angeles' },
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    )
    proc.unref()

    const hardKill = () => {
      try {
        process.kill(-proc.pid, 'SIGKILL')
      } catch {}
      try {
        proc.kill('SIGKILL')
      } catch {}
    }
    process.once('exit', hardKill)

    let wsUrl
    try {
      wsUrl = await new Promise((resolvePromise, reject) => {
        let stderrBuf = ''
        const timer = setTimeout(() => {
          reject(new Error(`Timed out waiting for Chromium CDP endpoint. Stderr:\n${stderrBuf}`))
        }, 12_000)
        proc.stderr.on('data', (chunk) => {
          stderrBuf += chunk.toString('utf8')
          const match = stderrBuf.match(/DevTools listening on (ws:\/\/[^\s]+)/)
          if (match) {
            clearTimeout(timer)
            resolvePromise(match[1])
          }
        })
        proc.once('exit', (code) => {
          clearTimeout(timer)
          reject(new Error(`Chromium exited prematurely (${code}):\n${stderrBuf}`))
        })
      })
    } catch (err) {
      hardKill()
      rmSync(userDataDir, { recursive: true, force: true })
      throw err
    }

    proc.stderr.destroy()

    const ws = new WebSocket(wsUrl)
    await new Promise((resolvePromise, reject) => {
      ws.addEventListener('open', resolvePromise, { once: true })
      ws.addEventListener('error', reject, { once: true })
    })

    return new CdpBrowser(proc, ws, userDataDir)
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params }
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject })
      this.ws.send(JSON.stringify(payload))
    })
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set())
    this.listeners.get(method).add(fn)
    return () => this.listeners.get(method)?.delete(fn)
  }

  async openPage(appOrigin, { signedIn = false } = {}) {
    const { browserContextId } = await this.send('Target.createBrowserContext')
    const { targetId } = await this.send('Target.createTarget', {
      url: 'about:blank',
      browserContextId,
    })
    const { sessionId } = await this.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    })

    const pageErrors = []
    const offException = this.on('Runtime.exceptionThrown', (params, sid) => {
      if (sid === sessionId) {
        pageErrors.push(params.exceptionDetails?.text || 'Runtime exception')
      }
    })

    // Intercept non-localhost requests so OIDC discovery/userinfo answer deterministically
    // and zero packets ever leave the machine.
    const offFetch = this.on('Fetch.requestPaused', async (params, sid) => {
      if (sid !== sessionId) return
      const { requestId, request } = params
      try {
        const u = new URL(request.url)
        if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
          await this.send('Fetch.continueRequest', { requestId }, sessionId)
          return
        }
        if (u.hostname === 'hanzo.id') {
          let payload = null
          if (u.pathname === '/.well-known/openid-configuration') {
            payload = {
              issuer: 'https://hanzo.id',
              authorization_endpoint: 'https://hanzo.id/v1/iam/oauth/authorize',
              token_endpoint: 'https://hanzo.id/v1/iam/oauth/token',
              userinfo_endpoint: 'https://hanzo.id/v1/iam/oauth/userinfo',
              jwks_uri: 'https://hanzo.id/v1/iam/.well-known/jwks',
              response_types_supported: ['code'],
              grant_types_supported: ['authorization_code', 'refresh_token'],
              scopes_supported: ['openid', 'email', 'profile'],
            }
          } else if (u.pathname === '/v1/iam/oauth/userinfo') {
            payload = {
              sub: SUBJECT,
              name: 'Ada Lovelace',
              email: 'ada@acme.test',
              owner: ORG,
            }
          }
          if (payload) {
            await this.send(
              'Fetch.fulfillRequest',
              {
                requestId,
                responseCode: 200,
                responseHeaders: [
                  { name: 'content-type', value: 'application/json' },
                  { name: 'access-control-allow-origin', value: '*' },
                ],
                body: Buffer.from(JSON.stringify(payload)).toString('base64'),
              },
              sessionId,
            )
            return
          }
        }
        await this.send(
          'Fetch.failRequest',
          { requestId, errorReason: 'BlockedByClient' },
          sessionId,
        )
      } catch {
        // Target may have closed mid-flight.
      }
    })

    await this.send('Page.enable', {}, sessionId)
    await this.send('Runtime.enable', {}, sessionId)
    await this.send(
      'Emulation.setDeviceMetricsOverride',
      { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
      sessionId,
    )
    await this.send(
      'Emulation.setTimezoneOverride',
      { timezoneId: 'America/Los_Angeles' },
      sessionId,
    )
    await this.send(
      'Fetch.enable',
      { patterns: [{ urlPattern: 'http*://*' }] },
      sessionId,
    )

    // Install DOM query & React input helpers in every document.
    const helperSource = `
      window.__e2e = {
        norm(s) {
          return (s || '').replace(/\\s+/g, ' ').trim();
        },
        pane() {
          return document.querySelector('.rail + div') || document.body;
        },
        paneText() {
          return this.norm(this.pane().innerText);
        },
        waysText() {
          const el = document.querySelector('.ways');
          return el ? this.norm(el.innerText) : '';
        },
        hasHeading(title) {
          const hs = Array.from(document.querySelectorAll('h1, h2, [role="heading"]'));
          return hs.some((h) => this.norm(h.textContent) === title);
        },
        buttonsIn(root, matcher) {
          const scope = typeof root === 'string' ? document.querySelector(root) : (root || this.pane());
          if (!scope) return [];
          const btns = Array.from(scope.querySelectorAll('button, [role="button"]'));
          return btns.filter((b) => {
            const label = this.norm(b.getAttribute('aria-label') || b.innerText || b.textContent);
            if (matcher instanceof RegExp) return matcher.test(label);
            return label === matcher;
          });
        },
        clickButton(matcher, rootSelector) {
          const scope = rootSelector ? document.querySelector(rootSelector) : this.pane();
          const hits = this.buttonsIn(scope, matcher);
          if (!hits.length) return false;
          hits[0].click();
          return true;
        },
        fillByPlaceholder(placeholder, value) {
          const el = Array.from(this.pane().querySelectorAll('textarea, input')).find(
            (n) => n.getAttribute('placeholder') === placeholder
          );
          if (!el) return false;
          const proto = el.tagName === 'TEXTAREA'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(el, value);
          else el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        },
        tileText(label) {
          const nodes = Array.from(this.pane().querySelectorAll('*')).filter(
            (n) => n.children.length === 0 && this.norm(n.textContent) === label
          );
          return nodes.map((n) => this.norm(n.parentElement?.innerText || '')).join(' | ');
        },
        dayButtons(dayNum) {
          const days = Array.from(document.querySelectorAll('.month .day'));
          for (const d of days) {
            const texts = Array.from(d.querySelectorAll('*'))
              .filter((el) => el.children.length === 0)
              .map((el) => this.norm(el.textContent));
            if (texts[0] === String(dayNum)) {
              return Array.from(d.querySelectorAll('button'));
            }
          }
          return [];
        }
      };
    `
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source: helperSource }, sessionId)

    if (signedIn) {
      const session = makeSignedInSession()
      await this.send(
        'Page.addScriptToEvaluateOnNewDocument',
        {
          source: `
            window.localStorage.setItem('hanzo_iam_access_token', ${JSON.stringify(session.token)});
            window.localStorage.setItem('hanzo_iam_expires_at', ${JSON.stringify(String(session.until))});
            window.localStorage.setItem('hanzo_iam_current_org', ${JSON.stringify(session.org)});
            window.localStorage.setItem('hanzo:who', ${JSON.stringify(session.who)});
          `,
        },
        sessionId,
      )
    }

    const evaluate = async (expression) => {
      const res = await this.send(
        'Runtime.evaluate',
        { expression, awaitPromise: true, returnByValue: true },
        sessionId,
      )
      if (res.exceptionDetails) {
        throw new Error(
          `Page evaluate exception: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`,
        )
      }
      return res.result?.value
    }

    const waitFor = async (predicateExpr, description, timeoutMs = 8_000) => {
      const deadline = Date.now() + timeoutMs
      let lastVal = undefined
      while (Date.now() < deadline) {
        try {
          lastVal = await evaluate(predicateExpr)
          if (lastVal) return lastVal
        } catch {
          // Document may still be navigating.
        }
        await new Promise((r) => setTimeout(r, 50))
      }
      const snapshot = await evaluate('window.__e2e ? window.__e2e.paneText() : document.body?.innerText').catch(
        () => '<unavailable>',
      )
      throw new Error(
        `Timed out waiting for ${description} (last=${JSON.stringify(lastVal)}, errors=${JSON.stringify(pageErrors)}).\nPane text:\n${snapshot}`,
      )
    }

    return {
      evaluate,
      waitFor,
      async goto(path) {
        await this.gotoUrl(`${appOrigin}${path}`)
      },
      gotoUrl: async (url) => {
        await this.send('Page.navigate', { url }, sessionId)
        await waitFor('document.readyState === "complete" && Boolean(window.__e2e)', `load ${url}`)
      },
      async openScreen(path, heading) {
        await this.goto(path)
        await waitFor(
          `window.__e2e.hasHeading(${JSON.stringify(heading)})`,
          `heading "${heading}" on ${path}`,
        )
      },
      close: async () => {
        offFetch()
        offException()
        await this.send('Target.closeTarget', { targetId }).catch(() => {})
        await this.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {})
      },
    }
  }

  async close() {
    try {
      this.ws.close()
    } catch {}
    try {
      process.kill(-this.proc.pid, 'SIGKILL')
    } catch {}
    try {
      this.proc.kill('SIGKILL')
    } catch {}
    rmSync(this.userDataDir, { recursive: true, force: true })
  }
}

// ── Shared Harness Lifecycle ──────────────────────────────────────────────────

let platformServer
let appServer
let appOrigin = ''
let browser
const traffic = { asked: [], unserved: [] }

function resetTraffic() {
  traffic.asked.length = 0
  traffic.unserved.length = 0
}

function sendJson(res, value, status = 200) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  })
  res.end(JSON.stringify(value))
}

test.before(async () => {
  ensureBuilt()

  platformServer = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const path = url.pathname
    traffic.asked.push(`${req.method} ${path}${url.search}`)

    if (path === '/v1/social/summary') return sendJson(res, SUMMARY)
    if (path === '/v1/social/providers') return sendJson(res, { data: NETWORKS })
    if (path === '/v1/social/accounts') return sendJson(res, { data: ACCOUNTS })
    if (path === '/v1/social/credentials') return sendJson(res, { data: [] })
    if (path === '/v1/settings/social-audiences') return sendJson(res, { config: {} })
    if (path === '/v1/social/posts') {
      const state = url.searchParams.get('status')
      return sendJson(res, {
        data: state ? POSTS.filter((p) => p.status === state) : POSTS,
      })
    }
    if (path.startsWith('/v1/provider/')) {
      const id = decodeURIComponent(path.slice('/v1/provider/'.length))
      if (CONNECTORS[id]) return sendJson(res, CONNECTORS[id])
      return sendJson(
        res,
        { type: 'about:blank', title: 'Not Found', status: 404, detail: `no connector ${id}` },
        404,
      )
    }
    if (path === '/v1/provider') {
      return sendJson(res, { providers: Object.values(CONNECTORS) })
    }

    traffic.unserved.push(`${req.method} ${path}`)
    return sendJson(
      res,
      { type: 'about:blank', title: 'Not Found', status: 404, detail: `no route serves ${path}` },
      404,
    )
  })

  const upstreamOrigin = await listenEphemeral(platformServer)
  appServer = createServer(createHandler({ root: distDir, upstream: upstreamOrigin }))
  appOrigin = await listenEphemeral(appServer)
  browser = await CdpBrowser.launch()
})

test.after(async () => {
  if (browser) await browser.close()
  if (appServer) await closeServer(appServer)
  if (platformServer) await closeServer(platformServer)
})

// ── E2E Tests ─────────────────────────────────────────────────────────────────

test('server/http.mjs serves SPA routes, proxies /v1/social, and answers native MCP over fetch', async () => {
  resetTraffic()

  const htmlRes = await fetch(`${appOrigin}/compose`)
  assert.equal(htmlRes.status, 200)
  assert.match(htmlRes.headers.get('content-type') || '', /text\/html/)
  const html = await htmlRes.text()
  assert.match(html, /\/assets\/main-/)

  const summaryRes = await fetch(`${appOrigin}/v1/social/summary`)
  assert.equal(summaryRes.status, 200)
  const summary = await summaryRes.json()
  assert.deepEqual(summary, SUMMARY)

  const mcpRes = await fetch(`${appOrigin}/v1/social/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  })
  assert.equal(mcpRes.status, 200)
  const mcpBody = await mcpRes.json()
  assert.ok(Array.isArray(mcpBody.result?.tools))
  assert.ok(mcpBody.result.tools.some((t) => t.name === 'social'))
})

test('signed-out browser renders the single gate on every route and makes zero /v1 calls', async () => {
  resetTraffic()
  const page = await browser.openPage(appOrigin, { signedIn: false })
  try {
    for (const screen of SCREENS) {
      await page.goto(screen.path)
      await page.waitFor('window.__e2e.hasHeading("Hanzo Social")', `gate heading on ${screen.path}`)
      const paneText = await page.evaluate('window.__e2e.paneText()')
      assert.match(paneText, /Connect a network, write a post, and schedule it\./)
      assert.ok(!paneText.includes('Could not load'), `unexpected error banner on ${screen.path}`)

      const hasSignIn = await page.evaluate(
        'window.__e2e.buttonsIn(document.body, "Sign in").length >= 1',
      )
      assert.ok(hasSignIn, 'expected Sign in button')

      const ways = await page.evaluate('window.__e2e.waysText()')
      for (const item of SCREENS) {
        assert.ok(ways.includes(item.nav), `sidebar missing "${item.nav}" on ${screen.path}`)
      }
    }
    assert.deepEqual(traffic.asked, [])
  } finally {
    await page.close()
  }
})

test('Overview renders platform roll-up counts, readiness, and recent posts', async () => {
  resetTraffic()
  const page = await browser.openPage(appOrigin, { signedIn: true })
  try {
    await page.openScreen('/', 'Overview')
    await page.waitFor(
      'window.__e2e.paneText().includes("2 of 3 can publish from this deployment.")',
      'Overview network readiness',
    )
    for (const post of POSTS) {
      await page.waitFor(
        `window.__e2e.paneText().includes(${JSON.stringify(post.content)})`,
        `post "${post.content}"`,
      )
    }

    assert.match(await page.evaluate('window.__e2e.tileText("Posts")'), /\b5\b/)
    assert.match(await page.evaluate('window.__e2e.tileText("Scheduled")'), /\b2\b/)
    assert.match(await page.evaluate('window.__e2e.tileText("Published")'), /\b2\b/)
    assert.match(await page.evaluate('window.__e2e.tileText("Accounts")'), /\b2\b/)

    const paneText = await page.evaluate('window.__e2e.paneText()')
    assert.ok(!paneText.includes('Nothing written yet'))
    assert.ok(!paneText.includes('Could not load'))
  } finally {
    await page.close()
  }
})

test('Post composer enforces per-network character limits and missing-account warnings', async () => {
  resetTraffic()
  const page = await browser.openPage(appOrigin, { signedIn: true })
  try {
    await page.openScreen('/compose', 'Post')
    await page.waitFor(
      'window.__e2e.buttonsIn(null, /^X .*280 characters/).length === 1',
      'X network card',
    )

    const hasLinkedIn = await page.evaluate(
      'window.__e2e.buttonsIn(null, /^LinkedIn .*3000 characters/).length === 1',
    )
    const hasYouTube = await page.evaluate(
      'window.__e2e.buttonsIn(null, /^YouTube .*5000 characters/).length === 1',
    )
    assert.ok(hasLinkedIn)
    assert.ok(hasYouTube)

    await page.evaluate('window.__e2e.clickButton(/^X /)')
    await page.waitFor(
      'window.__e2e.paneText().includes("0 of 280 characters")',
      'X 280-char counter',
    )

    await page.evaluate(`window.__e2e.fillByPlaceholder("What is going out?", ${JSON.stringify('n'.repeat(281))})`)
    await page.waitFor(
      `window.__e2e.paneText().includes("1 characters over X's limit of 280.")`,
      'X over-limit warning',
    )

    await page.evaluate('window.__e2e.clickButton(/^YouTube /)')
    await page.waitFor(
      'window.__e2e.paneText().includes("No connected account on YouTube — the post will be stored with nowhere to go.")',
      'YouTube no-account warning',
    )
  } finally {
    await page.close()
  }
})

test('Posts lists every post state and delegates status filtering to GET /v1/social/posts?status=', async () => {
  resetTraffic()
  const page = await browser.openPage(appOrigin, { signedIn: true })
  try {
    await page.openScreen('/posts', 'Posts')
    for (const post of POSTS) {
      await page.waitFor(
        `window.__e2e.paneText().includes(${JSON.stringify(post.content)})`,
        `post "${post.content}"`,
      )
    }

    const paneText = await page.evaluate('window.__e2e.paneText()')
    assert.ok(paneText.includes(REFUSAL))

    await page.evaluate('window.__e2e.clickButton("Failed")')
    await page.waitFor(
      '!window.__e2e.paneText().includes("Shipping the calendar today.") && window.__e2e.paneText().includes("The one that did not go out.")',
      'filtered failed posts',
    )
    assert.ok(traffic.asked.includes('GET /v1/social/posts?status=failed'))

    await page.evaluate('window.__e2e.clickButton("Drafts")')
    await page.waitFor(
      'window.__e2e.paneText().includes("Nothing in drafts.")',
      'empty drafts message',
    )
  } finally {
    await page.close()
  }
})

test('Schedule places every post on its calendar day and opens the selected post', async () => {
  resetTraffic()
  const page = await browser.openPage(appOrigin, { signedIn: true })
  try {
    await page.openScreen('/calendar', 'Schedule')
    const monthHeading = openMonth()
    await page.waitFor(
      `window.__e2e.paneText().includes(${JSON.stringify(monthHeading)})`,
      `month heading ${monthHeading}`,
    )
    await page.waitFor(
      `document.querySelectorAll('.month .day button').length === ${POSTS.length}`,
      'five post buttons on calendar grid',
    )

    assert.equal(await page.evaluate('window.__e2e.dayButtons(20).length'), 3)
    assert.equal(await page.evaluate('window.__e2e.dayButtons(24).length'), 2)

    await page.evaluate(`
      (() => {
        const btn = window.__e2e.dayButtons(24).find((b) => b.textContent.includes('YouTube'));
        if (btn) btn.click();
      })()
    `)
    await page.waitFor(
      'window.__e2e.paneText().includes("The launch film.") && window.__e2e.paneText().includes("Opened")',
      'opened scheduled YouTube post',
    )
  } finally {
    await page.close()
  }
})

test('Connect displays provider consent status, connected handles, and missing deployment env vars', async () => {
  resetTraffic()
  const page = await browser.openPage(appOrigin, { signedIn: true })
  try {
    await page.openScreen('/accounts', 'Connect')
    await page.waitFor(
      'window.__e2e.paneText().includes("Post to X as your organization.")',
      'X connector description',
    )

    const paneText = await page.evaluate('window.__e2e.paneText()')
    assert.ok(paneText.includes('@acme'))
    assert.ok(paneText.includes('Acme Inc'))
    assert.ok(paneText.includes('YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET'))
    assert.ok(!paneText.includes('Slack'))
    assert.ok(!paneText.includes('GitHub'))
  } finally {
    await page.close()
  }
})

test('Analytics reports delivery percentage, per-network tallies, and platform refusal reasons', async () => {
  resetTraffic()
  const page = await browser.openPage(appOrigin, { signedIn: true })
  try {
    await page.openScreen('/analytics', 'Analytics')
    await page.waitFor(
      'window.__e2e.paneText().includes("2 published of 5 written")',
      'Analytics roll-up summary',
    )

    const paneText = await page.evaluate('window.__e2e.paneText()')
    assert.ok(paneText.includes('40%'))
    assert.ok(paneText.includes('of what was written has gone out'))
    assert.ok(paneText.includes('The one that did not go out.'))
    assert.ok(paneText.includes(REFUSAL))
    assert.ok(
      paneText.includes(
        'Engagement — views, likes, reach — is not recorded by this platform and nothing here estimates it.',
      ),
    )
    assert.deepEqual(traffic.unserved, [])
  } finally {
    await page.close()
  }
})
