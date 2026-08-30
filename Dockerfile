FROM oven/bun:1.3.10-slim AS dependencies

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile


FROM dependencies AS frontend-build

COPY vite.config.mts ./
COPY src ./src
COPY frontend ./frontend
RUN bun run build
RUN bun build src/index.ts --target=bun --minify --outfile dist/server.js


FROM oven/bun:1.3.10-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=frontend-build --chown=bun:bun /app/dist/server.js ./dist/server.js
COPY --from=frontend-build --chown=bun:bun /app/dist/frontend ./dist/frontend

USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT ?? '3000') + '/').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["bun", "dist/server.js"]
