# RACEMAKE telemetry analysis

## Local development

```bash
bun install
bun run dev
```

Open <http://localhost:3000>.

## Docker

Build and run the production application with Docker Compose:

```bash
docker compose up --build
```

Alternatively, use Docker directly:

```bash
docker build -t racemake-hard .
docker run --rm -p 3000:3000 racemake-hard
```

Open <http://localhost:3000>. Set the host port when needed with, for example,
`PORT=8080 docker compose up --build`; the service will then be available at
<http://localhost:8080>.

The image builds the Vite frontend and serves it together with the Bun + Hono
API from one non-root production container. Analyses are stored only in memory
and are therefore cleared whenever the container restarts.
