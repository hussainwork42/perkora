# Perkora — production image.
# The server and CLI bundles are self-contained (only Node built-ins at runtime),
# so the final image needs no node_modules.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN NODE_ENV=production npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/migrations ./migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
# Apply pending migrations, then start. Migrations are idempotent and checksummed.
CMD ["sh", "-c", "node dist/cli.cjs migrate && node dist/server.cjs"]
