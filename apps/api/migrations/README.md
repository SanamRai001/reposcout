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

RepoScout migrations now cover canonical repositories, measured metadata, README/contribution evidence, community submissions, validation, evidence handoff, protected moderation/publication, and the Phase 5E.2 terminal-resubmission lookup index.

The newest migration is:

- `1790558400000_add_submission_resubmission_lookup.ts` — partial terminal-submission lookup index used by the repository resubmission cooldown.

CI verifies the current schema, rolls back the newest migration, verifies the rollback state, and reapplies migrations.
