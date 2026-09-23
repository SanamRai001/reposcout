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
   ├── readiness: /ready
   └── catalog: /api/repositories
                 ↓
          RepositoryStore
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
   ├── canonical repository state
   └── measured repository metadata
          ↓
PostgreSQL

Schema changes
   ↓
node-pg-migrate
   ↓
PostgreSQL
```

Phase 2A contains the synchronous single-repository ingestion boundary. Phase 2B adds refresh eligibility, retry/unavailable decisions, structured operational logging, and an internal maintainer CLI. Phase 3A adds PostgreSQL-only public repository list/detail reads with bounded opaque keyset pagination. Background job execution remains deferred.

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
Canonical repository identity/current GitHub state.

### repository metadata
Measured current GitHub facts collected with a repository observation, including stars, forks, open issue/PR count, primary language, SPDX license, and topics. Stored separately from canonical identity and future derived/model signals.

### ingestion
GitHub client, normalization, refresh, rate-limit handling, retries.

### repository content
Bounded source evidence collected independently from canonical ingestion.

Phase 3D.1 supports bounded README evidence.

Phase 3D.2 adds contribution-document evidence without repository crawling:

~~~text
maintainer/internal trigger
        |
RepositoryContributionEvidenceService
        |
        +-- GitHub community profile
        |      +-- CONTRIBUTING
        |      +-- Code of Conduct
        |      +-- issue template
        |      +-- PR template
        |
        +-- fixed SECURITY.md path probes
        |
RepositoryContributionEvidenceStore
        |
repository_contribution_evidence
~~~

Community-profile links are treated as GitHub effective evidence. SECURITY evidence is repository-local and branch-attributed.

README flow:

~~~text
maintainer/internal trigger
        |
RepositoryReadmeService
        |
GitHub README endpoint
        |
size + encoding + UTF-8 validation
        |
RepositoryReadmeStore
        |
repository_readme_content
~~~

README collection is a separate failure domain so content API failures do not block canonical repository/metadata refresh.

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

## Planned model-assisted intelligence layer

This layer is **not implemented yet**.

RepoScout is evaluating Jev as an optional decision component after authoritative data/content collection and after normal candidate retrieval.

Planned flow:

~~~text
GitHub facts/content
        |
RepoScout normalization
        |
PostgreSQL
        |
search / filters / candidate retrieval
        |
deterministic RepoScout signals
        |
optional Jev assessment
        |
transparent reranking / classification / moderation support
~~~

Architectural rules:
- Jev is not a source of GitHub facts;
- Jev is not the primary retrieval engine;
- model output is untrusted external data and must be validated;
- model/provider failures must degrade to deterministic RepoScout behavior;
- high-impact moderation decisions require human review;
- model assessment provenance/versioning must be stored if assessments become persistent;
- no Jev table/service should be added until the planned evaluation phase proves value.

See [JEV_INTELLIGENCE_ARCHITECTURE.md](JEV_INTELLIGENCE_ARCHITECTURE.md).

## Search evolution

### MVP
PostgreSQL-backed search and filters.

### Later
Hybrid retrieval may combine:
- lexical/full-text search;
- metadata filters;
- semantic/vector similarity;
- transparent deterministic reranking;
- optional model-assisted reranking over a bounded candidate set.

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


## Phase 4A lexical discovery boundary

The first search path is PostgreSQL-only and remains independent of GitHub and model providers.

~~~text
GET /api/repositories/search
        |
query normalization
        |
RepositoryStore.searchPage
        |
PostgreSQL plainto_tsquery(simple)
        |
canonical repository text match
        |
stable UUID keyset page
~~~

Searchable Phase 4A text:
- owner;
- repository name;
- full repository name;
- description.

Search cursors include the normalized query as well as the last repository UUID so a cursor cannot silently cross query boundaries.

Phase 4A intentionally does not add relevance rank ordering or a persisted/generated search vector. RepoScout should measure realistic query plans and latency before introducing GIN/search-index migration complexity.


## Phase 4B.1 scalar filter boundary

Scalar filters compose with the Phase 4A lexical retrieval path:

~~~text
GET /api/repositories/search
        |
query normalization
        |
scalar filter normalization
        |
query + filter scoped cursor
        |
RepositoryStore.searchPage
        |
PostgreSQL
  lexical match
  + language/license metadata predicates
  + fork/archive canonical predicates
        |
stable UUID page
~~~

Language/license filters depend only on captured authoritative metadata.

Missing metadata does not satisfy those filters.

Fork/archive filters use canonical repository columns.

The route/store remain independent of GitHub refresh and model providers.


## Phase 4B.2 collection/numeric filter boundary

Phase 4B.2 extends the same deterministic PostgreSQL retrieval path:

~~~text
lexical query
        |
normalized scalar filters
        |
normalized topic collection + star range
        |
scope-bound opaque cursor
        |
PostgreSQL
  canonical text match
  + metadata scalar predicates
  + topic containment
  + inclusive star bounds
        |
stable UUID page
~~~

Topic and star filters depend on measured repository metadata.

Missing metadata never satisfies these filters.

The lexical query remains required in Phase 4B.2; filter-only discovery is intentionally deferred to a separate contract decision.
