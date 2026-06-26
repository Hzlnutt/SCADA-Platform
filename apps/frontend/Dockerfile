FROM node:22-alpine AS build

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

# Copy workspace root + ALL workspace member package.json files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/
COPY apps/backend/package.json apps/backend/
COPY shared/package.json shared/

# Use hoisted node_modules for Docker builds (avoids symlink resolution issues)
RUN echo "node-linker=hoisted" > .npmrc && pnpm install --frozen-lockfile

COPY apps/frontend apps/frontend

RUN pnpm -C apps/frontend build

FROM nginx:1.27-alpine

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

