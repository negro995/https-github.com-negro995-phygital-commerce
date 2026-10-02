# API image (apps/api) — used by Railway, Render, Fly.io or any Docker host.
FROM node:24-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/web3/package.json packages/web3/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/prisma packages/db/prisma
RUN npm ci --include=dev --ignore-scripts

COPY . .
RUN npm run db:generate && npm run build --workspace @phygital/api

EXPOSE 4000
CMD ["sh", "-c", "npm run migrate:deploy --workspace @phygital/db && node apps/api/dist/index.js"]
