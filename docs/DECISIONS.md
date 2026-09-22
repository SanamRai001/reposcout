# Decision Log

Important decisions should be appended here rather than silently changing project direction.

## D-001 — RepoScout is not primarily an AI chat product

**Status:** Accepted

Natural language may become a discovery interface, but the core value is specialized repository data, historical signals, community curation, and explainable discovery.

## D-002 — Start curated, not internet-scale

**Status:** Accepted

The MVP will index a smaller set of useful repositories instead of attempting to crawl all of GitHub.

Reason:
- lower infrastructure cost;
- better data quality;
- simpler moderation;
- faster product validation.

## D-003 — Community repository submission is core

**Status:** Accepted

Users and repository owners can submit projects that RepoScout does not yet contain.

Submissions require validation and moderation.

## D-004 — Self-submission is allowed

**Status:** Accepted

Maintainers may submit their own repositories.

Self-submission does not buy or guarantee favorable ranking.

## D-005 — Total stars will not be the default definition of quality

**Status:** Accepted

Stars remain visible and sortable, but discovery modes can use activity, maintenance, momentum, and contribution signals.

## D-006 — Do not publish a universal quality score

**Status:** Accepted

RepoScout will prefer named, explainable rankings such as Hidden Gems, Rising, Recently Active, or Contribution Friendly.

## D-007 — PostgreSQL is the persistence database

**Status:** Accepted

PostgreSQL fits normalized repository data, filters, historical snapshots, full-text search, and later pgvector if semantic search becomes justified.

## D-008 — AI must not fabricate repository metrics

**Status:** Accepted

AI may summarize/classify/interpret, but measured facts must originate from traceable data sources.

## D-009 — GitHub repository ID is canonical external identity

**Status:** Accepted

Owner/name can change. GitHub repository ID is used to prevent duplicate records after rename/transfer.

## D-010 — Implementation proceeds in small phases

**Status:** Accepted

Each phase should:
- have a narrow goal;
- preserve working behavior;
- include verification;
- document meaningful architectural changes;
- avoid unrelated refactors/features.

## D-011 — Use a small npm workspace for the initial application

**Status:** Accepted

Phase 1A uses:
- `apps/web` — React + Vite + Tailwind CSS;
- `apps/api` — Node.js + Express + TypeScript;
- npm workspaces at the repository root.

No shared package is created until stable shared code actually exists.

## D-012 — Adopt the “Scout Signal” brand direction

**Status:** Accepted for foundation; logo remains open

The first visual direction uses a calm dark developer interface with Scout Mint as the primary signal color and restrained radar/navigation motifs.

The temporary Phase 1A mark is not the final logo.

## D-013 — Start with node-postgres instead of an ORM

**Status:** Accepted

Runtime persistence begins with `pg` / node-postgres.

Reason:
- parameterized SQL and transactions remain explicit;
- the application does not yet have enough real queries to justify an ORM;
- adding an ORM now would create abstraction cost before demonstrating value.

This can be revisited later if real query complexity justifies a typed query builder or ORM.

## D-014 — Use node-pg-migrate for schema migrations

**Status:** Accepted

Migrations use `node-pg-migrate` and are validated against PostgreSQL in CI.

Schema changes should not be performed implicitly by application startup.

## D-015 — Dependency installations are lockfile-driven

**Status:** Accepted

The repository commits a root `package-lock.json`.

CI and deployment-oriented installation should use `npm ci` so dependency drift causes a failure rather than silently rewriting the dependency graph.

## D-016 — Separate liveness from readiness

**Status:** Accepted

`/health` reports process liveness.

`/ready` verifies required runtime dependencies, starting with PostgreSQL, and reports HTTP 503 when they are unavailable.


## D-017 — Repository names are mutable attributes, not identity

**Status:** Accepted

`github_repository_id` is the canonical external identity and is unique in PostgreSQL.

`owner`, `name`, `full_name`, and `github_url` may change when a repository is renamed or transferred. They must be updated on the existing canonical row rather than used to create a new identity.

## D-018 — Keep repository metrics outside the canonical repository table

**Status:** Accepted

The first `repositories` table stores stable identity and basic current GitHub state only.

Stars, forks, issue/release statistics, trend snapshots, categories, languages, topics, and derived signals are intentionally excluded so that metrics with different update cadence and ownership can evolve independently.


## D-019 — Represent GitHub repository IDs as strings in TypeScript

**Status:** Accepted

PostgreSQL stores `github_repository_id` as `BIGINT`, while TypeScript persistence models expose the value as a decimal string.

Reason:
JavaScript `number` cannot safely represent every 64-bit integer. External identity must never be rounded.

## D-020 — Repository upserts reject stale synchronization state

**Status:** Accepted

Repository persistence updates an existing row only when the incoming `last_synced_at` is at least as recent as the stored value.

This prevents an older concurrent fetch or retry from overwriting newer canonical repository state.

## D-021 — Full-name lookup does not assume uniqueness

**Status:** Accepted

`full_name` is mutable and not canonical identity.

Persistence therefore returns all exact matches for a full-name lookup instead of silently treating it as a unique key.


## D-022 — GitHub ingestion fetches from a fixed API origin

**Status:** Accepted

RepoScout constructs repository API requests only against `https://api.github.com`.

User-supplied repository references contribute only validated owner/repository path segments. Redirects are rejected.

This is a core SSRF boundary and must not be replaced by arbitrary URL fetching.

## D-023 — Pin the GitHub REST API version

**Status:** Accepted

RepoScout explicitly sends `X-GitHub-Api-Version: 2026-03-10`.

The API version should only change through a reviewed compatibility update with tests.

## D-024 — GitHub authentication is optional for the initial public-data client

**Status:** Accepted

Phase 2A supports unauthenticated public repository requests for local development and tests.

`GITHUB_TOKEN` is strongly recommended for deployed ingestion due to rate limits. The token remains server-side and must never be logged.

## D-025 — Reject external data before persistence

**Status:** Accepted

The GitHub client validates the subset of repository fields required by the canonical schema before returning a normalized snapshot.

Malformed or internally inconsistent GitHub responses fail with `invalid_response` and are not persisted.


## D-026 — Refresh repositories no more than once every six hours by default

**Status:** Accepted

The initial operational policy skips GitHub fetches when a repository was successfully synchronized within the previous six hours.

Maintainers may explicitly force a refresh.

This is a starting operational limit, not a permanent product promise.

## D-027 — GitHub 404 is treated as unavailable, not deleted

**Status:** Accepted

GitHub 404 does not prove a repository was permanently deleted; it may also reflect private/inaccessible state.

RepoScout preserves the last known good repository record, does not advance `last_synced_at`, and initially retries after 24 hours.

Permanent lifecycle modeling requires stronger evidence and should be added separately.

## D-028 — Retry decisions are explicit but Phase 2B does not run a scheduler

**Status:** Accepted

Rate limits and transient GitHub failures produce a concrete retry timestamp.

Phase 2B exposes that decision to callers but intentionally does not introduce queue/cron infrastructure yet.

## D-029 — Keep transient sync state out of the canonical repository table for now

**Status:** Accepted

The `repositories` table remains focused on canonical repository identity/current GitHub state.

If retry history, availability state, or scheduler coordination becomes necessary, model it explicitly in a dedicated operational table rather than mixing transient workflow state into repository identity.

## D-030 — Manual ingestion stays internal until moderation controls exist

**Status:** Accepted

Maintainers can trigger one repository through the CLI.

RepoScout will not expose an anonymous public ingestion route until community submission, moderation, authorization, and abuse/rate-limit controls are designed.


## D-031 — Defer background refresh scheduling beyond Phase 2

**Status:** Accepted

Phase 2 ends with a validated single-repository ingestion path, refresh eligibility, retry decisions, non-destructive unavailable handling, observability, and a maintainer CLI.

RepoScout will not add cron, queues, or a background refresh worker before there is a concrete product need.

The next implementation phase is the repository catalog/read surface. Background scheduling can return when repository volume, historical snapshots, or operational requirements justify it.


## D-032 — Catalog reads never trigger GitHub ingestion

**Status:** Accepted

Repository list/detail requests read the last known canonical state from PostgreSQL.

Browser-facing catalog traffic must not consume GitHub API quota or make response latency depend on GitHub availability.

Refresh remains an ingestion concern.

## D-033 — Phase 3A uses bounded opaque keyset pagination

**Status:** Accepted

Repository list requests default to 20 items and are capped at 50.

Pagination uses an opaque cursor backed by the stable internal UUID and deterministic UUID ordering.

The traversal order is internal only and must not be presented as newest, best, trending, or another semantic ranking.

Timestamp-based cursors were avoided because PostgreSQL can retain timestamp precision beyond JavaScript Date's millisecond precision.

## D-034 — Catalog API responses expose canonical facts only

**Status:** Accepted

Phase 3A serializes canonical repository records with ISO 8601 timestamps.

It does not expose fabricated metrics, derived quality scores, or incomplete discovery signals.

Search, ranking, metrics, and metadata enrichment remain separate phases.


## D-035 — Catalog browser uses the same-origin RepoScout API

**Status:** Accepted

The web application requests `/api/repositories` rather than calling GitHub directly or hard-coding a production API host.

Vite proxies `/api` to the local API during development.

This preserves a simple production deployment shape and keeps GitHub credentials/rate limits server-side.

## D-036 — Treat catalog cursors as opaque in the browser

**Status:** Accepted

The browser passes `nextCursor` back exactly as supplied by the API.

Frontend code must not decode cursor structure, infer repository ordering from it, or manufacture pagination boundaries.

## D-037 — Do not fake repository intelligence in the first catalog UI

**Status:** Accepted

Phase 3B renders only canonical facts already stored by RepoScout.

Star counts, health, languages, categories, ranking badges, and AI descriptions will appear only after their data pipelines and ownership rules exist.


## D-038 — Enrich repository facts before building a dedicated detail page

**Status:** Accepted

Phase 3B already exposes the canonical repository facts available today.

A new detail route at this point would mostly duplicate the catalog card and create UI surface without adding meaningful repository intelligence.

Phase 3C will therefore add the smallest authoritative metadata/signals foundation first. A repository detail page can follow once it has enough useful information to justify a dedicated view.


## D-039 — Evaluate Jev as an optional decision layer

**Status:** Accepted as an experiment, not a production dependency

RepoScout will evaluate Jev for constrained repository judgments such as classification, relevance assessment, contribution suitability, and submission triage.

Jev is not the source of GitHub facts, not the primary retrieval engine, and not a replacement for deterministic RepoScout signals.

No production dependency should be introduced until RepoScout-specific evaluation demonstrates measurable value.

## D-040 — Keep four intelligence source classes separate

**Status:** Accepted

RepoScout distinguishes:

1. GitHub/external measured facts;
2. deterministic RepoScout signals;
3. model-assisted probabilistic assessments;
4. community/moderator judgments.

These source classes must remain distinguishable in storage, APIs, explanations, and debugging.

Model-assisted inference must never be presented as measured repository fact.

## D-041 — Retrieval comes before model-assisted reranking

**Status:** Accepted

Search/discovery should first produce a bounded candidate set using PostgreSQL lexical search, filters, metadata, and deterministic signals.

Jev may later assess/rerank that candidate set.

RepoScout will not use Jev as the sole repository retrieval mechanism.

## D-042 — RepoScout must degrade gracefully without Jev

**Status:** Accepted

Model-provider unavailability must not break:
- repository ingestion;
- factual metadata;
- catalog reads;
- deterministic search/filtering;
- moderation queue access.

Model-assisted features are optional enhancements over a functioning deterministic system.

## D-043 — Model output cannot be the sole authority for permanent moderation rejection

**Status:** Accepted

Jev may support submission triage and surface uncertainty/risk.

Permanent high-impact moderation decisions require human accountability and must not rely only on model output.

Low-confidence model assessments should be escalated rather than silently converted into hard decisions.

## D-044 — Evaluate model usefulness before creating persistent assessment infrastructure

**Status:** Accepted

RepoScout will not create a Jev-specific production table/service merely because the integration is technically possible.

Phase 3E will evaluate classification quality, confidence usefulness, relevance, latency, cost, consistency, and failure behavior on RepoScout examples first.

Persistent model-assessment storage is introduced only after a demonstrated product need.


## D-045 — Store current measured repository metadata separately from canonical identity

**Status:** Accepted

Phase 3C introduces a one-to-one `repository_metadata` table instead of adding fast-changing counts/topics to `repositories`.

Canonical repository identity/state and measured metadata have different ownership, refresh cadence, and future historical use.

## D-046 — Phase 3C uses only fields available from the existing repository fetch

**Status:** Accepted

The first metadata set is limited to stars, forks, GitHub open issue/PR count, primary language, SPDX license, and topics from the existing repository REST response.

Release history, contributor counts, language-byte breakdown, and contribution metrics are deferred because they require additional GitHub endpoints or different collection semantics.

## D-047 — Repository and metadata ingestion are transactional and stale-safe

**Status:** Accepted

A successful repository ingestion commits canonical repository state and measured metadata together.

Older repository synchronizations cannot overwrite newer canonical state or newer metadata observations.

Missing metadata remains distinguishable from a real zero value.
