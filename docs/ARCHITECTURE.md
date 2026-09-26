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

Canonical storage and public publication are separate concerns. `repositories.is_listed` is RepoScout-owned state: evidence-preparation rows may exist unlisted, while public catalog/detail/search read only listed rows. Normal GitHub refresh does not change an existing listing decision.

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
Approval/rejection workflow, publication boundary, and audit trail.

Phase 5C.1 flow:

~~~text
VALID submission
      |
evidence handoff
      |
canonical repository (unlisted)
      |
human moderation
      +-- REJECTED -> remains unlisted + audit event
      |
      +-- APPROVED -> listed + audit event
                         |
                         v
                 public discovery
~~~

Approval locks the submission and atomically updates submission status, repository listing state, and the append-only moderation event.

No moderation HTTP route is exposed until reviewer authentication/authorization is added.

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

## Browser discovery flow

Phase 4C exposes deterministic discovery in the web application:

~~~text
browser URL / discovery form
        |
normalized discovery scope
        |
same-origin /api/repositories/search
        |
server-owned deterministic order + opaque cursor
        |
repository cards
~~~

Browser rules:
- discovery scope is shareable in URL parameters;
- pagination cursor remains ephemeral component state;
- applying discovery updates browser history;
- back/forward restores discovery scope;
- frontend preserves backend order;
- no client-side ranking or hidden relevance heuristic is allowed.

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

Phase 6A introduces daily append-only repository metric history:

~~~text
authoritative measured metadata
        |
RepositorySnapshotStore
        |
repository_snapshots
        |
one row / repository / UTC day
~~~

Current snapshot facts:
- stars;
- forks;
- GitHub-style open issue count.

Each row stores:
- actual `captured_at`;
- UTC `captured_on` bucket;
- measured values.

The database enforces one row per repository/day and validates that the bucket matches the UTC capture day.

Retries are first-write-wins: a same-day retry returns the existing row instead of rewriting history. Different-day backfills remain independent rows.

Future contributor/activity summaries or release/commit aggregates require explicit authoritative collection semantics before they enter snapshot storage.

Phase 6B connects history capture to authoritative metadata persistence:

~~~text
GitHub repository observation
        |
RepositoryIngestionService
        |
RepositoryStore.upsertWithMetadata
        |
single PostgreSQL transaction
        +-- canonical repository
        +-- current repository_metadata
        +-- daily repository_snapshots row
~~~

No second GitHub request is made for snapshot capture.

If multiple observations are accepted on the same UTC day, current metadata may advance while the first daily snapshot remains immutable.

Pre-6A current metadata can be backfilled without provider access:

~~~text
repository_metadata
        |
missing snapshot for metadata.observed_at UTC day
        |
bounded oldest-first selection
        |
RepositorySnapshotBackfillService
        |
repository_snapshots
~~~

Backfill reads only facts already persisted by RepoScout, defaults to 50 rows, and is capped at 500 rows per run.

Unlisted canonical repositories are included because snapshot persistence is internal measured history, not publication state.

Phase 6B still does not add scheduled provider refreshes, delta math, or ranking.



### Deterministic trend reads — Phase 6C

Trend reads stay inside the PostgreSQL historical-data boundary:

~~~text
GET /api/repositories/:id/trend?windowDays=N
        |
listed repository lookup
        |
latest repository snapshot
        |
UTC cutoff = latest day - N
        |
closest snapshot on/before cutoff
        |
signed measured deltas
~~~

The public route first resolves the repository through the existing listed catalog reader. Snapshot history for an unlisted canonical repository is therefore not exposed.

For sparse history, baseline selection is conservative: use the closest observation on or **before** the requested cutoff. The response exposes `actualWindowDays`, which may be greater than `requestedWindowDays`.

If no baseline reaches the cutoff, the result is `window_not_covered`; if no history exists at all, it is `no_snapshots`. Neither case produces an extrapolated or synthetic delta.

Phase 6C derives trends at read time. It does not persist trend scores, assign good/bad direction, call GitHub, or invoke a model provider.

## Community submission intake

Phase 5A introduces the first community write path:

~~~text
POST /api/submissions
        |
strict body validation
        |
GitHub URL parser
        |
lowercase owner/name intake normalization
        |
already-indexed check
        |
RepositorySubmissionService
        |
RepositorySubmissionStore
        |
repository_submissions
~~~

Important boundaries:
- intake performs no GitHub API request;
- intake accepts no free-form metadata;
- canonical GitHub repository ID is resolved later;
- database uniqueness prevents concurrent duplicate pending submissions;
- moderation/approval is not part of the intake transaction;
- submission endpoints require rate limiting before broad public launch.

## Deterministic submission validation

Phase 5B.1 adds an internal validation boundary after intake:

~~~text
PENDING unvalidated submission
        |
RepositorySubmissionValidationService
        |
existing fixed-origin GithubClient.fetchRepository
        |
        +-- 404/inaccessible ----------> INVALID
        |
        +-- private=true --------------> INVALID
        |
        +-- transient provider failure -> unchanged / retryable
        |
        +-- public repository
                |
        canonical GitHub repository ID
                |
        RepositoryStore.findByGithubRepositoryId
                |
        +-- exists --------------------> DUPLICATE
        |
        +-- absent --------------------> VALID + still PENDING
~~~

The original intake identity is preserved. GitHub-resolved current identity is stored separately.

Validation is authoritative/deterministic only. It does not call Jev, approve repositories, or perform moderation.

### Submission validation orchestration

Phase 5B.2A adds a bounded internal execution layer:

~~~text
internal CLI
   |
select PENDING + unvalidated submissions
   |
RepositorySubmissionValidationOrchestrator
   |
RepositorySubmissionValidationService
   |
   +-- VALID / DUPLICATE / INVALID
   |
   +-- retryable provider failure
            |
            +-- request/response failure -> report and continue
            +-- rate limit -> report, preserve retryAt, stop batch
~~~

No retry queue or lease table is introduced yet. Existing first-writer-safe validation writes preserve correctness if two internal runners overlap.

### Submission evidence handoff

Phase 5B.2B connects VALID submissions to existing repository/evidence pipelines:

~~~text
PENDING + VALID + handoff incomplete
        |
bounded oldest-first selection
        |
RepositorySubmissionEvidenceHandoffService
        |
        +-- RepositoryIngestionService
        |      +-- expected validated GitHub repository ID guard
        |      +-- canonical repository state
        |      +-- measured metadata
        |
        +-- RepositoryReadmeService
        |
        +-- RepositoryContributionEvidenceService
        |
all required stages succeed
        |
handoff_repository_id
evidence_handoff_completed_at
        |
submission stays PENDING
        |
Phase 5C human moderation
~~~

Handoff reuses existing ingestion/evidence implementations rather than creating submission-specific copies.

The validated GitHub repository ID is checked again against the fresh ingestion response before persistence. A path/name that now resolves to a different GitHub repository therefore fails loudly instead of silently handing off the wrong project.

External provider failures are isolated by stage. Non-rate-limit README failure does not prevent contribution evidence from being attempted. Existing successful writes are retained and safe to repeat because the underlying repository/evidence stores are idempotent or stale-safe.

A GitHub rate limit stops later provider stages for the current handoff and stops the remaining selected batch.

Handoff completion is durable but is not moderation: status remains PENDING until Phase 5C.

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

The first launch observability surface is structured JSON logging.

Phase 5E.4 adds a request ID and safe boundary events for:
- submission acceptance/rejection;
- submission rate-limit rejection;
- moderation authentication failure;
- moderation queue reads;
- final moderation decisions;
- moderation request rejection;
- submission/moderation request status + duration;
- malformed/oversized body rejection;
- unhandled failures.

Operational events deliberately exclude:
- raw IP addresses;
- authorization headers/bearer credentials;
- request bodies;
- cookies;
- user-agent strings;
- moderation reason text.

The logger also redacts credential-like metadata keys recursively.

A future log aggregation/alerting system may consume these events; Phase 5E.4 does not choose a monitoring vendor or introduce a metrics database.

## Launch security boundary

Phase 5E.4 adds deployment-independent API hardening:
- request correlation IDs;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: no-referrer`;
- restrictive camera/microphone/geolocation Permissions-Policy;
- `Cache-Control: no-store` for submission/moderation responses;
- stable 400 malformed-JSON handling;
- stable 413 body-size handling;
- HMAC-derived in-memory submission limiter keys;
- high/critical production dependency audit in CI;
- Dependabot monitoring.

Transport/browser controls that require the actual hosting topology remain deployment responsibilities:
- HTTPS/TLS termination;
- HSTS;
- final frontend CSP;
- edge/shared rate limiting for multi-instance API deployment;
- infrastructure access-log retention.

The process-local rate limiter remains acceptable only for the current single-process boundary.



## Phase 6D scheduled history maintenance

Scheduled history work is exposed as a one-run operation rather than a timer embedded in the API server:

~~~text
deployment scheduler
        |
npm run maintain:snapshots
        |
PostgreSQL advisory lock
        |
        +-- provider-free metadata backfill
        |
        +-- listed refresh candidate selection
        |      - refresh eligible
        |      - no snapshot for current UTC day
        |
        +-- sequential RepositoryRefreshService calls
                   |
                   +-- existing GitHub retry policy
                   |
                   +-- transactional metadata + snapshot persistence
~~~

Candidate selection is deterministic and bounded.

Defaults:
- 25 provider refresh candidates;
- 100 stored-metadata backfill candidates.

Maximums:
- 100 provider refresh candidates;
- 500 stored-metadata backfill candidates.

The advisory lock makes overlapping invocations sharing the same PostgreSQL database a safe no-op.

The maintenance operation does not refresh repositories whose current UTC day is already represented in `repository_snapshots`, because Phase 6A history is first-write-wins for that day.

Provider-pressure behavior:
- `retry_later` stops the remaining refresh batch and exposes `retryAt`;
- `manual_review` stops the remaining refresh batch;
- `unavailable` records the repository and continues.

The initial operational cadence should be once per UTC day. The deployment environment owns the actual scheduler. RepoScout does not start a background timer inside each API instance.

Phase 6D adds no ranking logic.



## Phase 7A ranking signal boundary

Ranking evidence is built as a deterministic in-memory snapshot over already-stored repository state:

~~~text
canonical repository + current metadata
        |
README / contribution evidence
        |
Phase 6 trend results
        |
Repository ranking signal collector
        |
ranking-signals-v1
        |
mode-specific scorer (Phase 7B+)
~~~

The signal layer is deliberately separate from scoring.

It preserves:
- source/provenance class;
- semantic role;
- zero vs missing;
- explicit missing reason;
- historical requested/actual window provenance.

Mode contracts classify signal use as primary, supporting, or context for Hidden Gems and Rising.

The signal layer does not:
- assign weights;
- persist a score;
- order candidates;
- call GitHub;
- call Jev/model providers;
- change canonical repository data.

This keeps future formula tuning recomputable and auditable.



## Phase 7B Hidden Gems scorer boundary

Hidden Gems v1 remains a pure deterministic layer over the Phase 7A signal snapshot:

~~~text
ranking-signals-v1
        |
required evidence check
        |
positive components
        +-- maintenance
        +-- README
        +-- CONTRIBUTING
        +-- community readiness
        +-- optional 30d momentum
        |
bounded popularity penalty
        |
hidden-gem-v1 result
~~~

The scorer:
- performs no database query;
- performs no GitHub call;
- invokes no model provider;
- persists no score;
- produces no public ordering.

Missing required evidence returns `ineligible` rather than substituting zero.

Historical momentum is optional and explicitly reports coverage.

Popularity is subtractive only; low star count cannot generate positive quality points.

Candidate retrieval/public ranking integration remains Phase 7D.

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

Phase 4B.2 keeps the lexical query required.

## Phase 4B.3 filter-only discovery boundary

Phase 4B.3 keeps the same discovery endpoint and PostgreSQL path while allowing the lexical query to be absent when structured filters provide the retrieval scope.

~~~text
GET /api/repositories/search
        |
optional lexical query
        +
one or more normalized filters
        |
nullable-query + filter scoped cursor
        |
RepositoryStore.searchPage
        |
PostgreSQL
  optional canonical text match
  + authoritative filter predicates
        |
stable UUID page
~~~

An empty discovery scope with neither query nor filters is rejected because `GET /api/repositories` already provides unscoped catalog traversal.

Filter-only cursors bind `query = null` together with the complete normalized filter set, so they cannot be reused across lexical/filter scope changes.

No relevance ordering, model reranking, or client-side ranking is introduced.


## Protected moderation boundary

Phase 5C.2 exposes moderation through a dedicated protected API:

~~~text
Reviewer Bearer token
        |
ModerationReviewerAuthenticator
        |
/api/moderation
        |
        +-- GET /submissions
        |
        +-- POST /submissions/:id/decision
                  |
RepositorySubmissionModerationService
                  |
RepositorySubmissionStore.moderate()
                  |
Phase 5C.1 atomic publication + audit transaction
~~~

Reviewer credentials are server configuration, not PostgreSQL user records.

The client cannot supply the audit `reviewerRef`; it is derived from the authenticated credential.

The public submission API remains separate and unauthenticated.

This is an initial maintainer/trusted-reviewer authorization boundary. General accounts, OAuth/session auth, reviewer-role management, and token-rotation workflows remain deferred.
