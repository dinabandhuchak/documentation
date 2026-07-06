# Request Hub Local Runbook

This document is a practical local setup/run reference for future use.

## Prerequisites

- Docker + Docker Compose
- Node.js (compatible with the versions used by this repo)
- Yarn
- Python 3.12+ (for orchestrator)

## Services and Ports

- Client (Nuxt): `http://localhost:4000`
- API (NestJS): `http://localhost:3001`
- API Swagger: `http://localhost:3001/api`
- Orchestrator (FastAPI): `http://localhost:5001`
- Mock Crawler: `http://localhost:4002`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- Postgres: `localhost:5432`

## 1) Start Infrastructure

From repository root:

```bash
docker compose up -d postgres minio
```

## 2) Configure and Run API

Path: `tool/api`

### Required .env values

If `tool/api/.env` does not include these, add/update:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/request_hub?schema=public
ORCHESTRATOR_URL=http://localhost:5001
```

### Install, migrate, run

```bash
cd tool/api
yarn install
npx prisma generate
npx prisma migrate deploy
yarn start:dev
```

Notes:
- API default port is 3001 (from `tool/api/src/main.ts`).
- If you want API-only mode, leave `ORCHESTRATOR_URL` empty.

## 3) Run Mock Crawler

In a new terminal:

```bash
cd tool/api
yarn start:crawler
```

## 4) Configure and Run Orchestrator

Path: `orchestrator`

### Prepare env file

```bash
cd orchestrator
cp .env.example .env
```

Ensure these values in `orchestrator/.env`:

```env
PORT=5001
HUB_API_URL=http://localhost:3001
CRAWLER_URL=http://localhost:4002
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=crawler-events
```

### Create venv, install, run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python debug_server.py
```

## 5) Run Client

Path: `tool/client`

Option A: set env inline when starting:

```bash
cd tool/client
yarn install
API_URL=http://localhost:3001 LOCAL_DEV_BYPASS=true yarn dev
```

Option B: put values in `tool/client/.env`:

```env
API_URL=http://localhost:3001
LOCAL_DEV_BYPASS=true
```

Then run:

```bash
cd tool/client
yarn dev
```

## Health Checks

- API health (basic): open Swagger at `http://localhost:3001/api`
- Orchestrator health: `http://localhost:5001/health`
- Client UI: `http://localhost:4000`
- MinIO console: `http://localhost:9001`

## Common Issues

### Port already in use

Find and kill process on a port:

```bash
lsof -ti :3001 | xargs kill -9
lsof -ti :4000 | xargs kill -9
lsof -ti :4002 | xargs kill -9
lsof -ti :5001 | xargs kill -9
```

### API cannot connect to DB

- Confirm Postgres container is up: `docker compose ps`
- Confirm `DATABASE_URL` in `tool/api/.env`
- Re-run Prisma:

```bash
cd tool/api
npx prisma generate
npx prisma migrate deploy
```

### Orchestrator callbacks do nothing

- Ensure `ORCHESTRATOR_URL=http://localhost:5001` in `tool/api/.env`
- Ensure orchestrator `HUB_API_URL=http://localhost:3001`
- Ensure mock crawler is running on port 4002

## Quick Start Summary

Run in this order:

1. `docker compose up -d postgres minio`
2. `cd tool/api && yarn install && npx prisma generate && npx prisma migrate deploy && yarn start:dev`
3. `cd tool/api && yarn start:crawler`
4. `cd orchestrator && cp .env.example .env && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && python debug_server.py`
5. `cd tool/client && yarn install && API_URL=http://localhost:3001 LOCAL_DEV_BYPASS=true yarn dev`
