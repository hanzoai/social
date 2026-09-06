# Hanzo Social

The dedicated frontend for **social.hanzo.ai** — compose, schedule and publish your
content across networks (X, Facebook, Instagram, LinkedIn, TikTok, YouTube, Threads),
per org.

## What is here, and what is not

The **product** is not here. It is `SocialResource` in
[`@hanzo/ui/product/social`](https://www.npmjs.com/package/@hanzo/ui) — the same
component the Hanzo Cloud Console renders for its Publish surface. This repo is the
second HOST of that one surface, so the two can never drift apart.

The **backend** is not here either. It is `/v1/social` in the unified cloud binary
(`hanzoai/cloud`, `clients/social`): a native-Go per-org accounts + posts store on
Base/SQLite with a scheduler and a publish edge. The Postiz-derived backend /
orchestrator / frontend that used to live in this repo were folded into that binary
and retired; they are gone rather than left to rot.

So the whole app is four files:

| file | what it owns |
|---|---|
| `src/api.ts` | transport — same-origin `/v1/social/...`, session cookie, nothing else |
| `app/page.tsx` | mount `SocialResource` with that transport |
| `app/providers.tsx` | Hanzo GUI theme on the shared scale (`@hanzo/ui/gui-config`) |
| `app/layout.tsx` | document shell |

## Auth

Same-origin and server-authoritative. The edge routes `social.hanzo.ai/v1` to the
cloud binary, which resolves the caller from the first-party IAM session cookie and
scopes every read and write to that owner's org SERVER-SIDE. No org header is ever
sent from the browser, and no credential lives in this app.

## Develop

```sh
pnpm install
pnpm dev      # http://localhost:4200
pnpm build
```

`.npmrc` pins the hoisted linker: Next discovers the `@hanzogui/*` packages to
transpile by reading `node_modules`, so the tree has to be flat.

## Build + deploy

`hanzo.yml` declares the one image (`ghcr.io/hanzoai/social`); `Dockerfile` builds it.
Both the `hanzoai/ci` reusable workflow and platform.hanzo.ai read that file — there is
no per-repo build logic.
