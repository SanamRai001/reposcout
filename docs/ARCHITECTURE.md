# Initial Architecture

## Status

This is the starting architecture, not a permanent commitment. Changes should be recorded in DECISIONS.md.

## Architectural goal

Keep RepoScout simple enough to build and operate while leaving a clean path for background ingestion, historical snapshots, search, and later semantic discovery.

## Current shape

```text
Browser
   ↓
React / Vite web
   ↓
Express API
   ├── liveness: /health
   └── readiness: /ready
          ↓
   node-postgres pool
          ↓
      PostgreSQL

GitHub repository reference
          ↓
reference parser
          ↓
GitHub REST client ─────→ https://api.github.com
          ↓
response validator
          ↓
RepositoryRefreshService
   ├── refresh-window decision
   ├── retry/unavailable policy
   └── operational logging
          ↓
RepositoryIngestionService
          ↓
RepositoryStore
          ↓
PostgreSQL

Schema changes
   ↓
node-pg-migrate
   ↓
PostgreSQL
```

Phase 2A contains the synchronous single-repository ingestion boundary. Phase 2B adds refresh eligibility, retry/unavailable decisions, structured operational logging, and an internal maintainer CLI. Background job execution remains deferred.

## Repository structure

```text
reposcout/
├── apps/
│   ├── web/   React + Vite + Tailwind CSS
│   └── api/
│       ├── migrations/
│       └── src/
│           ├── config/
│           └── database/
├── docs/
├── .github/workflows/
├── package-lock.json
├── package.json
└── tsconfig.base.json
```

The project uses npm workspaces without a monorepo framework. A shared package will only be introduced when stable shared code exists.

## Technology choices

### Frontend
- React;
- TypeScript;
- Vite;
- Tailwind CSS.

### Backend
- Node.js;
- TypeScript;
- Express 5.

Express is sufficient for the first modular API surface. Do not introduce NestJS or another framework unless growing complexity creates a concrete need.

### Database
- PostgreSQL;
- `pg` / node-postgres for runtime connections and queries;
- `node-pg-migrate` for schema migrations.

PostgreSQL is now an accepted architecture decision.

Why PostgreSQL:
- strong relational model for canonical repository data;
- JSONB available for selected raw metadata;
- good filtering/search primitives;
- can add pgvector later without introducing a separate vector database during MVP;
- strong uniqueness and transactional guarantees for submissions/moderation.

Why no ORM yet:
- real query patterns do not exist yet;
- direct SQL keeps behavior explicit;
- adding an abstraction before it solves a demonstrated problem would increase complexity.

Revisit a typed query builder or ORM only when repetitive mapping/query maintenance provides evidence that it is worth the cost.

### Database connection lifecycle

The API:
1. validates database configuration;
2. constructs a bounded connection pool;
3. verifies PostgreSQL connectivity before accepting traffic;
4. exposes a database-backed readiness check;
5. closes the pool during graceful shutdown.

Database URLs and credentials must never be written to logs.

### Migrations

Migration history uses `node-pg-migrate`.

Rules:
- application schema changes go through migrations;
- shipped migrations are immutable;
- destructive changes require explicit review;
- database constraints are preferred over application-only integrity assumptions;
- migration execution must be verified in CI.

### Background jobs

Required once ingestion becomes asynchronous.

Responsibilities:
- fetch repository metadata;
- refresh repositories;
- create snapshots;
- recompute derived signals;
- retry transient GitHub/API failures;
- respect rate limits.

Avoid introducing Redis until job volume or coordination actually requires it. A database-backed job strategy is acceptable early.

## Modules

### repositories
Canonical repository records and normalized GitHub metadata.

### ingestion
GitHub client, normalization, refresh, rate-limit handling, retries.

### discovery
Filtering, text search, ordering, ranking inputs.

### snapshots
Historical metric snapshots used for momentum/trend calculations.

### submissions
Community-submitted repository candidates.

### moderation
Approval/rejection workflow and audit trail.

### taxonomy
Categories, tags, use cases, and controlled classification.

### identity
Authentication and authorization where needed.

## Data ownership

GitHub is authoritative for GitHub-originated fields.

RepoScout is authoritative for:
- moderation state;
- RepoScout categories;
- curator notes;
- derived signals;
- ranking inputs;
- snapshots;
- submission history.

Never silently overwrite community-curated data with automated classification.

## API boundaries

Frontend should not directly call privileged GitHub APIs with secret tokens.

```text
Browser → RepoScout API → GitHub API
```

Canonical ingestion should remain server-side so:
- tokens remain secret;
- rate limits can be coordinated;
- responses can be cached;
- normalization is consistent.

## GitHub rate limits

Rate limits are a first-class production concern.

The ingestion system must:
- avoid refetching unchanged data unnecessarily;
- store last refresh timestamps;
- back off on rate-limit responses;
- expose ingestion state;
- distinguish temporary fetch failure from repository deletion/private conversion;
- never hammer GitHub from per-page browser requests.

## Search evolution

### MVP
PostgreSQL-backed search and filters.

### Later
Hybrid retrieval may combine:
- lexical/full-text search;
- metadata filters;
- semantic/vector similarity;
- transparent reranking.

Do not add embeddings until there is enough repository content and a concrete query-quality problem they solve.

## Historical data

Snapshots should be append-only measurements, for example:
- stars;
- forks;
- open issues;
- contributor/activity summaries when available;
- release/commit aggregates.

Do not snapshot every field unnecessarily.

## Security baseline

MUST:
- keep GitHub and database credentials server-side;
- validate GitHub URLs/owner/repo identifiers;
- apply authorization to moderation endpoints;
- rate-limit submission endpoints;
- prevent SSRF by never fetching arbitrary user-provided URLs;
- fetch only from allowlisted GitHub endpoints;
- parameterize database queries;
- validate all external API data before persistence;
- log moderation actions;
- avoid rendering unsanitized README/HTML content;
- keep TLS certificate verification enabled when database TLS is enabled.

## Reliability baseline

- ingestion should be idempotent;
- repository identity should use GitHub repository ID, not only owner/name;
- renames must not create duplicates;
- refresh failures must not delete healthy existing records;
- moderation writes should be transactional;
- derived scores must be recomputable;
- production installs should use the committed npm lockfile and `npm ci`.

## Observability

Initially capture:
- database connectivity failures;
- ingestion success/failure;
- GitHub rate-limit state;
- job retries;
- submission volume;
- moderation actions;
- slow API/database operations.

## Scaling rule

Do not prematurely design for millions of repositories.

Scale one bottleneck at a time:
1. prove discovery with a curated dataset;
2. measure load;
3. optimize database/query paths;
4. separate workers if needed;
5. add specialized search infrastructure only after PostgreSQL is no longer sufficient.
