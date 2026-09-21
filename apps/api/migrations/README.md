# Database migrations

RepoScout uses **node-pg-migrate** for explicit PostgreSQL migrations.

The first application table, `repositories`, was introduced in Phase 1B.2A. New schema changes must continue to use explicit migrations.

## Commands

From the repository root:

```bash
npm run db:migrate -w @reposcout/api
npm run db:migrate:down -w @reposcout/api
```

Create a TypeScript migration:

```bash
npm run db:migrate:create -w @reposcout/api -- <migration-name> -j ts -m migrations
```

Migration rules:

- migrations are immutable after they have shipped;
- schema changes must include a rollback path when safely reversible;
- destructive migrations require explicit review;
- never place secrets or environment-specific values in migration files;
- database constraints are preferred over application-only assumptions for data integrity.


## Current migrations

- `1790008200000_create_repositories.ts` — canonical repository identity and basic GitHub state.

Phase 1B.2A verifies both the up and down paths in CI.
