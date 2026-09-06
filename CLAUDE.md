# Hanzo Social — social.hanzo.ai

This repo is the dedicated frontend, and only the frontend.

It began as a hard fork of gitroomhq/postiz-app. That stack — `apps/backend` (NestJS),
`apps/orchestrator` (Temporal), `apps/frontend`, `libraries/` — was **folded into the
unified cloud binary** as `/v1/social` (`hanzoai/cloud`, `clients/social`: a native-Go
per-org accounts + posts store on Base/SQLite, with the scheduler and the publish edge)
and its pods were retired. The fork is therefore **deleted**, not disabled: keeping a
dead second implementation of the same product is the drift this repo now exists to
avoid.

## The shape

- **Product** → `SocialResource` in `@hanzo/ui/product/social`. The Hanzo Cloud Console
  renders the SAME component for its Publish surface. Change the product THERE; a
  change made here would be a fork.
- **Contract** → `@hanzo/ui/product/social/api` (`createSocialApi`), the typed
  `/v1/social` routes + defensive normalizers. Imports nothing — no React — so a data
  layer can bind it without a component tree.
- **This repo** → the transport (`src/api.ts`), the mount (`app/page.tsx`), the theme on
  the shared scale (`app/providers.tsx` + `@hanzo/ui/gui-config`), the shell
  (`app/layout.tsx`). Four files.

## Rules

- pnpm only, hoisted linker (`.npmrc`) — Next discovers the `@hanzo gui` packages to
  transpile by reading `node_modules`, so the tree must be flat.
- Never add a component here that belongs in `@hanzo/ui/product`. If Publish needs a
  new piece, it lands in the package and BOTH hosts get it.
- `/v1` only, same-origin, no prefix. The org is resolved SERVER-SIDE from the session
  owner claim; the browser never sends one.
- Build + deploy is `hanzo.yml` (one image, `ghcr.io/hanzoai/social`) read by both
  `hanzoai/ci` and platform.hanzo.ai. No per-repo build logic.
- LICENSE remains AGPL-3.0 as inherited; relicensing is a decision for a human, not a
  side effect of deleting the derived code.
