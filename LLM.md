# Hanzo Social (`@hanzo/social`) — Agent Guide

Sovereign multi-network social publishing web application (`social.hanzo.ai`) and
Postiz-compatible MCP/API adapter backed by Hanzo IAM (`hanzo.id`), Hanzo KMS,
and the native Go `/v1/social` contract (`hanzo.ai/zip/social` on `api.hanzo.ai`).

## Toolchain & Commands (Zero Vite, Zero Playwright)

- **Dev server**: `pnpm dev` (`hanzo serve --port 3300`) — native SPA dev server
  with TS/TSX/CSS bundling, `react-native` -> `react-native-web` resolution,
  SSE live reload (`/__hanzo_hmr`), SPA history fallback (`/*` -> `index.html`),
  and `/v1` proxy to `HANZO_API` (`https://api.hanzo.ai` or local `:3690`).
- **Typecheck**: `pnpm typecheck` (`tsc --noEmit`).
- **Production build**: `pnpm build` (`tsc --noEmit && hanzo serve build`) —
  emits `dist/index.html`, `dist/404.html`, and hashed `dist/assets/*`.
- **Preview build**: `pnpm preview` (`hanzo serve preview --port 3300`).
- **Server unit tests**: `pnpm test` (`node --test server/*.test.mjs`).
- **Headless CDP E2E tests**: `pnpm e2e` (`node --test e2e/social.e2e.mjs`) —
  drives headless Chrome/Chromium directly over raw CDP WebSocket + `server/http.mjs`
  with deterministic in-process `/v1/social` and `/v1/provider` fixtures and zero
  external network traffic.

## Architecture Invariants

1. **Identity & Auth**: Hanzo IAM OIDC (`@hanzo/iam`, `https://hanzo.id`) only.
   Signed-out browsers render the single sign-in gate and issue zero `/v1` calls.
2. **Secret Custody**: Provider OAuth secrets and tokens live exclusively in
   Hanzo KMS (`/v1/provider` + `/v1/social/credentials`). Never ship or fetch
   provider tokens into the browser.
3. **API Surface**: Frontend calls `/v1/social/*` (`summary`, `providers`,
   `accounts`, `posts`, `publish`, `channels`, `credentials`) and `/v1/provider`
   on `api.hanzo.ai` (proxied locally by `hanzo serve` and `server/http.mjs`).
4. **Runtime Deduplication**: `pnpm-workspace.yaml` pins singletons for
   `@hanzo/gui` and `@hanzogui/*` so React theme contexts never split.
5. **No Foreign Tooling**: Never reintroduce `vite`, `@vitejs/plugin-react`,
   `@hanzo/vite`, or `@playwright/test`. Use `hanzo serve` and native CDP (`e2e/social.e2e.mjs`).
