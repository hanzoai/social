# syntax=docker/dockerfile:1.7

# Hanzo Social — production multi-target build.
#
# Three runtime targets, one per app. No nginx, no pm2 — each container runs
# a single Node process. Cluster ingress (hanzoai/ingress, traefik) does
# the path-based routing across them.
#
# Build all three:
#   docker buildx build --target backend      -t ghcr.io/hanzoai/social-backend      .
#   docker buildx build --target frontend     -t ghcr.io/hanzoai/social-frontend     .
#   docker buildx build --target orchestrator -t ghcr.io/hanzoai/social-orchestrator .

ARG NODE_VERSION=22.20-bookworm-slim
ARG NEXT_PUBLIC_VERSION=dev

# ─── Stage 1: build (shared across all three apps) ───────────────────
FROM node:${NODE_VERSION} AS build
ARG NEXT_PUBLIC_VERSION
ENV NEXT_PUBLIC_VERSION=$NEXT_PUBLIC_VERSION
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends g++ make python3-pip \
 && rm -rf /var/lib/apt/lists/*

RUN npm --no-update-notifier --no-fund --global install pnpm@10.6.1

COPY . /app
RUN pnpm install --frozen-lockfile
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm run build

# ─── Stage 2a: backend (NestJS, port 3000) ───────────────────────────
FROM node:${NODE_VERSION} AS backend
ENV NODE_ENV=production
WORKDIR /app
RUN npm --no-update-notifier --no-fund --global install pnpm@10.6.1
COPY --from=build /app /app
EXPOSE 3000
# Run prisma db push on startup so schema drift is reconciled before serving.
# (Postiz upstream pattern — see root package.json "pm2-run".)
CMD ["sh", "-c", "pnpm run prisma-db-push && pnpm --filter ./apps/backend start"]

# ─── Stage 2b: frontend (Next.js SSR, port 4200) ─────────────────────
FROM node:${NODE_VERSION} AS frontend
ENV NODE_ENV=production
WORKDIR /app
RUN npm --no-update-notifier --no-fund --global install pnpm@10.6.1
COPY --from=build /app /app
EXPOSE 4200
CMD ["sh", "-c", "pnpm --filter ./apps/frontend start"]

# ─── Stage 2c: orchestrator (Temporal worker, no HTTP port) ──────────
FROM node:${NODE_VERSION} AS orchestrator
ENV NODE_ENV=production
WORKDIR /app
RUN npm --no-update-notifier --no-fund --global install pnpm@10.6.1
COPY --from=build /app /app
CMD ["sh", "-c", "pnpm --filter ./apps/orchestrator start"]
