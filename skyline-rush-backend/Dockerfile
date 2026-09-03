# Build context is the repository root (see docker-compose.prod.yml's
# `context: ..`), not this directory, so this image can also bundle the
# playable web client from the sibling skyline-rush-client checkout.
FROM node:20-alpine AS builder
WORKDIR /app
COPY skyline-rush-backend/package*.json ./
RUN npm ci
COPY skyline-rush-backend/ .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY skyline-rush-backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY skyline-rush-backend/tsconfig.json ./
COPY skyline-rush-client/web ./web
EXPOSE 3000
# tsc does not rewrite @libs/* path aliases into relative requires, so the
# compiled output needs a runtime resolver. TS_NODE_BASEURL points
# tsconfig-paths at dist/ instead of the source-relative baseUrl in
# tsconfig.json's compilerOptions.
ENV TS_NODE_BASEURL=./dist
CMD ["node", "-r", "tsconfig-paths/register", "dist/apps/gateway/main.js"]
