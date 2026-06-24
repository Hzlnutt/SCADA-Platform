FROM node:22-alpine

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend apps/backend
COPY shared shared

RUN pnpm install --frozen-lockfile
RUN pnpm -C apps/backend build

WORKDIR /repo/apps/backend

ENV NODE_ENV=production
EXPOSE 3001

CMD ["pnpm", "start"]
