# Hanzo Social — the dedicated social.hanzo.ai frontend. AGPL-3.0 (see LICENSE).
#
# One Node process, one port. There is no backend stage: the API is the unified
# cloud binary's /v1/social, served SAME-ORIGIN at this host by the edge — so this
# image ships only the UI, and the product itself lives in @hanzo/ui/product/social
# (the same component the console renders).
FROM public.ecr.aws/docker/library/node:24-alpine AS build
WORKDIR /app
# Copy ALL source FIRST, then install — order matters under Kaniko --single-snapshot:
# a COPY that FOLLOWS the install in the same stage drops the freshly created
# node_modules (the "next not found" cause). Putting COPY first means node_modules is
# created by the LAST RUNs and nothing clobbers it.
COPY . .
# pnpm with the hoisted linker (.npmrc): Next's transpilePackages discovers the
# @hanzogui/* packages by reading node_modules, so the tree has to be flat.
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate \
 && pnpm install --no-frozen-lockfile --prod=false
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=6144
RUN pnpm run build

FROM public.ecr.aws/docker/library/node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=4200
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
USER app
EXPOSE 4200
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "4200"]
