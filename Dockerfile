# Production images, built in GitHub Actions and pulled by the server (deploy/compose.yaml).
#   docker build --target app      the site
#   docker build --target migrate  migrations, and the seed on a fresh database

# CI passes the major version from .nvmrc, so it is set in one place.
ARG NODE_VERSION=26

# Debian slim rather than Alpine: sharp's prebuilt binaries target glibc.
FROM node:${NODE_VERSION}-slim AS base
# Links the GHCR package to the repository.
LABEL org.opencontainers.image.source=https://github.com/ivom2k/coffeebeans
WORKDIR /app

# Only the manifests, so this layer is rebuilt when the lockfile changes, not on every commit.
FROM base AS deps
COPY package.json package-lock.json ./
# Skips the root postinstall (`nuxt prepare`), which needs the source; `nuxt build` prepares itself.
RUN npm ci --ignore-scripts

FROM deps AS build
COPY . .
RUN npm run build

# One-shot tool container: the full node_modules (drizzle-kit is a dev dependency) plus server/db.
FROM deps AS migrate
# npm checks the registry for a newer npm on each run; a --rm container forgets the daily cache.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY drizzle.config.ts ./
COPY server/db ./server/db
USER node
CMD ["npm", "run", "db:migrate"]

# The site. .output is self-contained: Nitro copies in only the node_modules files the server
# imports, so the full node_modules stays behind in the build stage.
FROM base AS app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
# Root owns the files and the server runs as `node`, so it can't modify its own code.
USER node
EXPOSE 3000
# Node runs as PID 1; Nitro handles SIGTERM itself and finishes open requests before exiting.
CMD ["node", ".output/server/index.mjs"]
