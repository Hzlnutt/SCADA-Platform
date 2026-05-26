FROM node:20-alpine AS build

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@11.1.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/

RUN pnpm install --frozen-lockfile

COPY apps/frontend apps/frontend

RUN pnpm -C apps/frontend build

FROM nginx:1.27-alpine

COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80
