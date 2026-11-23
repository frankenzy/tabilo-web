# syntax=docker/dockerfile:1
# Image du frontend TABILO (Next.js, sortie autonome).

FROM node:22-alpine AS build
WORKDIR /app
# pnpm à la version fixée par `packageManager` dans package.json.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# URL publique de l'API : figée dans le bundle au build (ce n'est pas un secret).
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL BUILD_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1
RUN test -n "$NEXT_PUBLIC_API_URL" && pnpm build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3004 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3004
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3004/ || exit 1
CMD ["node", "server.js"]
