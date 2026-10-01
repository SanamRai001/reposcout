# Native arm64-compatible build for OCI Ampere Always Free.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --no-audit --no-fund
COPY apps/api ./apps/api
COPY apps/web ./apps/web
RUN npm run build

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production PORT=4000
WORKDIR /app
# Ops CLIs still use tsx and node-pg-migrate: keep locked workspace deps.
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/tsconfig.base.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json /app/apps/api/tsconfig.json ./apps/api/
COPY --from=build --chown=node:node /app/apps/api/src ./apps/api/src
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/migrations ./apps/api/migrations
COPY --from=build --chown=node:node /app/apps/web/package.json ./apps/web/package.json
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]

FROM caddy:2-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
