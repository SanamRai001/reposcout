# Phase 1B.1 — Persistence Foundation

## Goal

Establish a production-shaped PostgreSQL connection and migration foundation without creating RepoScout application tables yet.

## Implemented

- `pg` / node-postgres connection pooling;
- `node-pg-migrate` migration tooling;
- validated database environment configuration;
- explicit database TLS toggle;
- connection/pool timeouts;
- fail-fast API startup when PostgreSQL is unavailable;
- `/health` liveness endpoint;
- `/ready` readiness endpoint backed by a real database query;
- database integration test against PostgreSQL in CI;
- committed root `package-lock.json`;
- CI switched from `npm install` to frozen `npm ci`;
- CI PostgreSQL 18 service;
- migration runner verification in CI.

## Persistence choice

RepoScout intentionally starts with:

```text
TypeScript application
        ↓
node-postgres (pg)
        ↓
PostgreSQL
```

Migrations use `node-pg-migrate`.

No ORM is introduced in this phase.

Reason:
- SQL behavior stays explicit;
- parameterized queries and transactions remain directly available;
- there is no need to commit to an ORM before real query patterns exist;
- migration history stays independent from application query abstractions.

An ORM or typed query builder may be reconsidered later if repetitive mapping or query complexity creates a measurable maintenance problem.

## Environment

Required:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/reposcout
```

Optional:

```env
DATABASE_SSL=false
DATABASE_POOL_MAX=10
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_IDLE_TIMEOUT_MS=10000
```

`DATABASE_URL` must use the `postgres://` or `postgresql://` protocol.

When `DATABASE_SSL=true`, certificate verification remains enabled. RepoScout does not silently opt into insecure TLS.

## Health semantics

### `GET /health`

Liveness only.

It answers whether the API process is running and does not depend on PostgreSQL.

### `GET /ready`

Readiness.

It executes a lightweight PostgreSQL connectivity query. If the database is unavailable, the endpoint responds with HTTP 503.

This separation prevents a temporary database outage from incorrectly reporting the process itself as dead while still allowing deployment systems to stop routing traffic to an unready API.

## Migration commands

From the repository root:

```bash
npm run db:migrate -w @reposcout/api
npm run db:migrate:down -w @reposcout/api
npm run db:migrate:create -w @reposcout/api -- <name> -j ts -m migrations
```

No RepoScout domain table is created in Phase 1B.1.

## Verification gate

CI must pass:

- `npm ci`;
- lint;
- TypeScript checks;
- unit tests;
- production builds;
- migration runner against PostgreSQL;
- database integration test against PostgreSQL.

## Next checkpoint

Phase 1B.2 creates the smallest canonical `repositories` schema and its first repository persistence layer.

That phase must include:
- stable GitHub repository ID uniqueness;
- rename/transfer-safe identity;
- timestamps;
- safe migration rollback/review;
- repository persistence tests.
