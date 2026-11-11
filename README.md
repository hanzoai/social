# Hanzo Social

Write once. Publish to every account your organization owns — now, or at a time
you pick.

Thirteen networks: X, Facebook, Instagram, LinkedIn, TikTok, YouTube, Threads,
Bluesky, Mastodon, Pinterest, Reddit, Telegram and Discord. Text, photos and
video on every one that takes them. Hacker News has no posting API, so it is not
here.

Nine connect by consent, in a window beside the screen: X, Facebook, Instagram,
LinkedIn, TikTok, YouTube, Threads, Pinterest and Reddit. Four connect with a
credential the person holds, which the network verifies before anything is kept:
a Bluesky app password, a Mastodon access token, a Telegram bot, a Discord
webhook. Either way the account joins the same list, and Remove ends that one.

## Run, build & verify

```bash
pnpm install
pnpm dev        # hanzo serve --port 3300 (dev server + SSE live reload + /v1 proxy)
pnpm build      # tsc --noEmit && hanzo serve build (outputs dist/)
pnpm preview    # hanzo serve preview --port 3300
pnpm test       # server unit tests (node --test)
pnpm e2e        # native headless Chromium CDP + server/http.mjs E2E suite
```

No Vite and no Playwright are used anywhere in this repository. Local dev,
TypeScript/TSX/CSS bundling, SPA history fallback, live reload (`/__hanzo_hmr`),
and `/v1` reverse proxying are provided natively by `hanzo serve` (`hanzoai/cli`).
End-to-end browser verification runs directly over raw Chrome DevTools Protocol
(CDP) WebSockets + `fetch` in `e2e/social.e2e.mjs`.

The port is pinned to `3300` because it is half of an OIDC redirect: IAM returns
the browser to the address the client registered, and that address carries the
port. `hanzo serve` proxies `/v1`, `/mcp`, and `/api` to `HANZO_API` (default
`https://api.hanzo.ai`, or `http://localhost:3690` when local `hanzo up` is
running). `pnpm start` runs the production server (`node server/http.mjs`) on
port `3000`.

## How it is put together

| | |
|---|---|
| `src/social.ts` | Every `/v1` address this app speaks, in one file |
| `src/network.ts` | What each network accepts, and whether this post satisfies it |
| `src/status.tsx` | How a state is drawn on a palette with no hues |
| `src/client.tsx` | The platform client, and the organization it speaks for |
| `src/page.tsx` | The heading, the signed-out gate, the way a refusal reads |
| `src/post.tsx` | One post, as every pane shows it |
| `e2e/social.e2e.mjs` | Native CDP WebSocket + `server/http.mjs` end-to-end suite |

Six screens, one per address: Overview, Compose, Posts, Calendar, Accounts,
Analytics. `src/routes.tsx` is the table, and the sidebar reads the same one.

## Two planes, not one

A network needs both before anything goes out, and the Accounts screen shows
them side by side:

- **`/v1/provider`** — the organization's *credential* for a network. The
  OAuth consent a person gives once, sealed into KMS. `Connect` leads here.
- **`/v1/social`** — the *accounts* a post fans out to, and the posts
  themselves (served natively in Go on `hanzo.ai/zip` with unified OpenAPI 3.1,
  Streamable-HTTP MCP, and typed client SDKs).

No credential ever reaches this code. `GET /v1/connection/:id/token`
is the platform's one custody exit and nothing here calls it: a browser has no
use for a provider token, and a surface holding one would be a place to leak it
from.

## Two doors

The native API is what agents should call. Postiz is a second contract for a client that already speaks it. The two stay separate. The catalog pages are the [API](https://docs.hanzo.ai/docs/openapi/social), the [MCP tool](https://docs.hanzo.ai/docs/mcp-tools/social), and the [CLI](https://docs.hanzo.ai/docs/cli/social).

| Door | Who uses it | Where |
|---|---|---|
| Hanzo API | This app, MCP, the CLI, the SDKs | [`https://api.hanzo.ai/v1/social`](https://docs.hanzo.ai/docs/openapi/social). MCP tool [`social`](https://docs.hanzo.ai/docs/mcp-tools/social) at `https://api.hanzo.ai/v1/mcp`. CLI [`hanzo social`](https://docs.hanzo.ai/docs/cli/social). |
| Postiz drop-in | Grok's "Use self-hosted", and any Postiz client moving onto Hanzo | `https://social.hanzo.ai` — `/mcp`, `/api/mcp`, `/public/v1`, `/api/public/v1` |

The frontend on `*.hanzo.ai` already calls `https://api.hanzo.ai`. It does not call Postiz paths, and those paths are not under `/v1/social`. On this process a `/v1` request, including `/v1/social`, is proxied to `HANZO_API` (default `https://api.hanzo.ai`). Postiz paths are answered here. Every other path is the app.

### Use it from Postiz

An install that already runs Postiz keeps that client. The instance URL is this host, and the key is a Hanzo key.

| Field | Value |
|---|---|
| Instance URL | `https://social.hanzo.ai`. `http://localhost:3300` answers the same routes for a client on this machine. Postiz Cloud can only reach a public `https` origin. |
| API key | A Hanzo API key from [platform.hanzo.ai/api-keys](https://platform.hanzo.ai/api-keys). |

The same key is accepted as `Authorization: Bearer`, as the raw `Authorization` value, or inside `https://<origin>/mcp/<api key>`.

`/mcp` and `/api/mcp` are the MCP session. `/public/v1` is the public REST API. Image generation calls `/v1/images/generations`, video calls `/v1/videos/generations`, clips are a Studio `video.edit` run, uploads are kept in the Library, provider helpers call `/v1/provider/{provider}/run`, and per-post settings are stored with `/v1/settings/social`.

`pnpm start` serves a production build the same way, on port 3000.

On `social.hanzo.ai`, `/mcp`, `/api/mcp`, `/public/v1`, and `/api/public/v1` are the worker `hanzo-social-postiz` (`server/edge.mjs`), which runs this same handler. The app and `/v1/social` stay on the origin. The API key is a Hanzo key, not a Postiz key.

### Native agent MCP

`POST /v1/social/mcp` is the native tool, the same shape as `social` on `https://api.hanzo.ai/v1/mcp`: name an operation in `op`, pass its arguments in `input`, and call `describe` for that operation's schema. `tools/list` needs no key. `tools/call` needs the Hanzo key.

## What it does not do

The platform records no engagement — no views, likes or reach — and no endpoint
serves any, so the Analytics screen measures delivery and says so. Media is
given as an address rather than uploaded, because a presigned URL expires and a
network fetches the media when the post goes out.
