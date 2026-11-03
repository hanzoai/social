# Layout

One line each for the top-level directories and key config files.

## Directories

| Path | Contains |
|------|----------|
| `src/` | React SPA: screens, routes, API bindings, and the `~/...` alias root |
| `server/` | Node server: production HTTP entry, Postiz compatibility paths, agent MCP, and edge worker |
| `e2e/` | Playwright end-to-end specs against the running app |
| `docs/` | This documentation directory |

## Key config files

| Path | Purpose |
|------|---------|
| `README.md` | Project overview: networks, two doors (Hanzo API vs Postiz), two planes (provider credential vs social accounts) |
| `package.json` | Node manifest: name `@hanzo/social`, scripts (`dev`, `build`, `start`, `test`, `e2e`), dependency catalog |
| `pnpm-workspace.yaml` | Pnpm catalog (one version of every `@hanzo`/gui dependency) and overrides that keep a single gui runtime |
| `pnpm-lock.yaml` | Frozen dependency lockfile; CI installs with `--frozen-lockfile` |
| `vite.config.ts` | Vite config: `hanzo()` plugin, port 3300, `/v1` proxy to `api.hanzo.ai`, SPA fallback to `index.html`, Postiz compat middleware |
| `tsconfig.json` | TypeScript: ES2023, strict, `jsx: react-jsx`, `~/*` → `./src/*`, includes `src/`, `e2e/`, and the two config TS files |
| `hanzo.yml` | CI/CD: test gate (unit tests + build + file checks), Docker image `ghcr.io/hanzoai/social`, site deploy binding `social.hanzo.ai` |
| `Dockerfile` | Two-stage Node 24 Alpine image: build stage runs `pnpm build`; runtime serves `dist/` plus `server/` on port 3000 |
| `index.html` | SPA entry: mounts `#root`, syncs next-themes class with gui's theme attribute, loads `/src/main.tsx` |
| `SMOKE.txt` | Smoke-test placeholder ("sleep-900 test ok") |

## Licenses / other top-level files

- `LICENSE-APACHE`, `LICENSE-MIT`, `NOTICE` — dual Apache-2.0 / MIT licensing
- `CLAUDE.md`, `GEMINI.md` — model-specific instructions for Claude and Gemini
