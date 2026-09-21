# Database migrations

RepoScout uses **node-pg-migrate** for explicit PostgreSQL migrations.

No application tables are created in Phase 1B.1. The first canonical repository schema belongs to Phase 1B.2.

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
