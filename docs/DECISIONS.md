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
