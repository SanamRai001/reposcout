# Initial Architecture

## Status

This is the starting architecture, not a permanent commitment. Changes should be recorded in DECISIONS.md.

## Architectural goal

Keep RepoScout simple enough to build and operate while leaving a clean path for background ingestion, historical snapshots, search, and later semantic discovery.

## Recommended starting shape

A modular web application with a relational database and background jobs.

```text
Browser
   ↓
Web/API application
   ├── Discovery
   ├── Repository catalog
   ├── Submission/moderation
   ├── Auth/authorization
   └── Admin tools
          ↓
      PostgreSQL
          ↑
Background ingestion worker
          ↓
      GitHub API
```

## Implemented Phase 1A shape

```text
reposcout/
├── apps/
│   ├── web/   React + Vite + Tailwind CSS
│   └── api/   Express + TypeScript
├── docs/
├── .github/workflows/
├── eslint.config.js
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
- PostgreSQL.

Why PostgreSQL:
- strong relational model for canonical repository data;
- JSONB available for selected raw metadata;
- good filtering/search primitives;
- can add pgvector later without introducing a separate vector database during MVP;
- strong uniqueness and transactional guarantees for submissions/moderation.

PostgreSQL implementation begins in Phase 1B.

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

Public unauthenticated GitHub requests may be possible in limited cases, but canonical ingestion should remain server-side so:
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
- keep GitHub credentials server-side;
- validate GitHub URLs/owner/repo identifiers;
- apply authorization to moderation endpoints;
- rate-limit submission endpoints;
- prevent SSRF by never fetching arbitrary user-provided URLs;
- fetch only from allowlisted GitHub endpoints;
- parameterize database queries;
- validate all external API data before persistence;
- log moderation actions;
- avoid rendering unsanitized README/HTML content.

## Reliability baseline

- ingestion should be idempotent;
- repository identity should use GitHub repository ID, not only owner/name;
- renames must not create duplicates;
- refresh failures must not delete healthy existing records;
- moderation writes should be transactional;
- derived scores must be recomputable.

## Observability

Initially capture:
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
