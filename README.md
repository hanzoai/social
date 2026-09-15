# Hanzo Social

Write once. Publish to every account your organization owns — now, or at a time
you pick.

Seven networks: X, Facebook, Instagram, LinkedIn, TikTok, YouTube, Threads. Text,
photos and video on every one of them that takes video, which is all seven.

## Run it

```
pnpm install
pnpm dev        # http://localhost:3300
```

The port is pinned because it is half of a redirect: IAM returns the browser to
the address the client registered, and that address carries the port.

`vite.config.ts` proxies `/v1` to `api.hanzo.ai` on both the dev server and the
preview of a build, so a localhost origin reaches the gateway without failing a
preflight. Point it elsewhere with `VITE_HANZO_API`.

## How it is put together

| | |
|---|---|
| `src/social.ts` | Every `/v1` address this app speaks, in one file |
| `src/network.ts` | What each network accepts, and whether this post satisfies it |
| `src/status.tsx` | How a state is drawn on a palette with no hues |
| `src/client.tsx` | The platform client, and the organization it speaks for |
| `src/page.tsx` | The heading, the signed-out gate, the way a refusal reads |
| `src/post.tsx` | One post, as every pane shows it |

Six screens, one per address: Overview, Compose, Posts, Calendar, Accounts,
Analytics. `src/routes.tsx` is the table, and the sidebar reads the same one.

## Two planes, not one

A network needs both before anything goes out, and the Accounts screen shows
them side by side:

- **`/v1/integration`** — the organization's *credential* for a network. The
  OAuth consent a person gives once, sealed into KMS. `Connect` leads here.
- **`/v1/social`** — the *accounts* a post fans out to, and the posts
  themselves.

No credential ever reaches this code. `GET /v1/integration/connectors/:id/token`
is the platform's one custody exit and nothing here calls it: a browser has no
use for a provider token, and a surface holding one would be a place to leak it
from.

## What it does not do

The platform records no engagement — no views, likes or reach — and no endpoint
serves any, so the Analytics screen measures delivery and says so. Bluesky is
not here because the platform's channel vocabulary does not carry it. Media is
given as an address rather than uploaded, because a presigned URL expires and a
network fetches the media when the post goes out.
