# RepoScout Roadmap

This roadmap intentionally favors small, verifiable phases.

## Phase 0 — Foundation

Status: complete

- define product;
- define MVP/non-goals;
- define initial architecture;
- define data model;
- define discovery/ranking principles;
- define submission/community rules;
- establish contribution workflow;
- define initial brand guidance.

## Phase 1 — Project skeleton

Status: complete

### Phase 1A — Application foundation

Status: complete

- TypeScript project structure;
- frontend/backend boundaries;
- configuration validation;
- logging/error baseline;
- test/lint/typecheck/build scripts;
- CI;
- initial branded foundation screen.

### Phase 1B — Persistence foundation

#### Phase 1B.1 — Connection and migration infrastructure

Status: complete

- PostgreSQL connection pool;
- database configuration validation;
- fail-fast startup;
- liveness/readiness separation;
- migration tooling;
- root lockfile and frozen CI installs;
- PostgreSQL-backed integration tests.

#### Phase 1B.2 — Canonical repository persistence

##### Phase 1B.2A — Canonical repositories schema

Status: complete

- first `repositories` migration;
- GitHub repository ID uniqueness;
- rename/transfer-safe schema;
- database constraints and targeted indexes;
- migration up/down verification against PostgreSQL.

##### Phase 1B.2B — Repository persistence layer

Status: complete

- explicit repository persistence model;
- idempotent upsert by GitHub repository ID;
- stable internal UUID across syncs;
- find-by-GitHub-ID/current-name lookup;
- rename/transfer-safe updates;
- stale-sync overwrite protection;
- persistence integration tests.

No ingestion or discovery sophistication yet.

## Phase 2 — Repository ingestion

Build the most important backend path first:

```text
GitHub URL → normalize → GitHub API → validate → persist
```

Must handle:
- duplicates;
- repository rename identity;
- GitHub API errors;
- rate limits;
- archived/private/deleted transitions;
- idempotent refresh.

## Phase 3 — Repository catalog

- repository list;
- repository detail API;
- basic web UI;
- metadata/signals;
- refresh timestamps;
- loading/empty/error states.

## Phase 4 — Discovery

- lexical search;
- language/category/topic filters;
- activity/star/license filters;
- transparent sorting;
- shareable query URLs.

Verify useful discovery before adding AI.

## Phase 5 — Community submission

- submit GitHub URL;
- duplicate validation;
- pending moderation queue;
- approve/reject;
- abuse/rate limits;
- audit events.

This is the first major community loop.

## Phase 6 — Historical snapshots

- scheduled metric snapshots;
- star/activity deltas;
- trend storage;
- safe retry/backfill behavior.

## Phase 7 — Hidden Gems and Rising

- implement ranking v1;
- expose explanation;
- evaluate results manually;
- tune weights with documented changes;
- prevent popularity from dominating Hidden Gems.

## Phase 8 — Contribution discovery

- contribution signals;
- good-first-issue discovery;
- contributor-friendly filters;
- evidence-based project recommendations.

## Phase 9 — Semantic discovery

Only after normal search has real usage/data:
- embeddings;
- semantic similarity;
- hybrid search;
- natural-language query parsing.

The AI layer should improve an existing discovery engine, not substitute for one.

## Later possibilities

Not committed:
- repository comparisons;
- alternatives graph;
- community collections;
- user profiles;
- saved repositories;
- contributor recognition;
- public API;
- CLI/browser extension;
- architecture/codebase-learning discovery.

## Production gates

Before broad public launch:
- backups;
- migration/recovery process;
- rate limits;
- abuse handling;
- observability;
- dependency/security checks;
- accessibility pass;
- responsive UX;
- privacy documentation;
- license;
- Code of Conduct;
- contribution templates;
- deployment runbook.
