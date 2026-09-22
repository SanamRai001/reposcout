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

Status: complete

Build the most important backend path first:

```text
GitHub URL → normalize → GitHub API → validate → persist
```

### Phase 2A — Single-repository ingestion boundary

Status: complete

- GitHub repository reference parser;
- fixed-origin GitHub REST client;
- pinned REST API version;
- optional server-side token;
- request timeout;
- response validation;
- stable GitHub error model;
- normalized repository snapshot;
- ingestion service feeding RepositoryStore;
- PostgreSQL end-to-end integration test.

### Phase 2B — Refresh operational behavior

Status: complete

- six-hour refresh policy;
- force-refresh override;
- rate-limit-aware retry decisions;
- non-destructive 404/unavailable handling;
- ingestion logging/observability;
- safe internal/manual ingestion CLI;
- PostgreSQL preservation tests.

Phase 2 now handles:
- duplicate-safe canonical identity;
- repository rename/owner transfer;
- GitHub API validation and stable errors;
- rate-limit-aware retry decisions;
- archived repository metadata;
- non-destructive inaccessible/deleted/private-style 404 behavior;
- idempotent refresh.

Background scheduling remains intentionally deferred until product usage or snapshot requirements justify it.

## Phase 3 — Repository catalog

Status: in progress

### Phase 3A — Catalog read API

Status: complete

- `GET /api/repositories`;
- `GET /api/repositories/:id`;
- bounded opaque keyset pagination;
- stable repository response serialization;
- PostgreSQL-only catalog reads;
- end-to-end catalog integration tests.

### Phase 3B — Basic catalog web UI

Status: complete

- repository cards/list UI;
- initial loading skeleton;
- empty state;
- API error + retry state;
- load-more pagination;
- responsive Scout Signal layout;
- same-origin API client with local Vite proxy.

### Phase 3C — Repository metadata/signals foundation

Status: complete

- dedicated one-to-one repository metadata table;
- stars, forks, GitHub open issue/PR count;
- primary language;
- SPDX license;
- GitHub topics;
- metadata observation timestamp;
- transactional repository + metadata ingestion;
- stale metadata overwrite protection;
- catalog API exposure;
- metadata-aware repository cards.

Release history and additional activity metrics remain deferred because they require extra GitHub endpoints and different refresh behavior.

No Jev integration belongs in Phase 3C. This phase establishes the authoritative factual base first.

### Phase 3D — Repository content foundation

Status: complete

#### Phase 3D.1 — Bounded README content foundation

Status: complete

- fixed-origin GitHub README fetch;
- explicit default-branch/ref provenance;
- 256 KiB RepoScout storage ceiling;
- Base64, byte-size, UTF-8, and null-byte validation;
- PRESENT / NOT_FOUND / TOO_LARGE evidence states;
- dedicated one-to-one README content storage;
- stale observation protection;
- independent README refresh service;
- maintainer CLI;
- no raw README public exposure.

#### Phase 3D.2 — Contribution-document evidence

Status: complete

- GitHub effective CONTRIBUTING evidence;
- GitHub effective Code of Conduct evidence;
- issue-template evidence;
- pull-request-template evidence;
- repository-local SECURITY policy evidence;
- bounded fixed-path security lookup;
- fork-aware unsupported state;
- provenance URLs / ref / path / blob SHA / size;
- stale observation protection;
- independent maintainer refresh command;
- no recursive repository crawling;
- no contribution-document body storage.

Phase 3D should provide the evidence Jev or other classifiers may later evaluate.

### Phase 3E — Jev evaluation spike

Status: in progress / experimental

#### Phase 3E.1 — Evaluation harness

Status: complete

- provider-neutral evaluation boundary;
- benchmark versioning;
- 6 synthetic labeled repository cases;
- 5 bounded query-relevance cases;
- project-type accuracy;
- tutorial/demo accuracy + Brier score;
- beginner-suitability MAE;
- relevance MAE;
- confidence and latency reporting;
- runtime validation for replayed provider output;
- CLI benchmark/replay commands;
- no live model dependency;
- no production persistence.

The synthetic benchmark validates the harness and task definitions. It is not evidence of Jev quality.

#### Phase 3E.2 — Live Jev adapter + controlled smoke evaluation

Next:
- verify current TypeSafe OpenAPI schema;
- add server-side Jev credentials;
- implement the provider adapter;
- validate typed Jev responses;
- run a controlled non-production benchmark;
- capture latency/provider/model provenance;
- keep fallback behavior explicit.

#### Phase 3E.3 — Real RepoScout evaluation + adoption decision

Later:
- label real indexed repositories;
- add difficult/ambiguous examples;
- repeat runs for consistency;
- evaluate confidence/calibration, latency, and cost;
- compare with deterministic baselines;
- document failure cases;
- decide which tasks, if any, justify production Jev integration.

Do not create production assessment persistence unless evaluation proves value.

Repository detail UI remains deferred until there is enough intelligence to justify a dedicated page.

## Phase 4 — Discovery

- lexical search;
- language/category/topic filters;
- activity/star/license filters;
- transparent deterministic sorting;
- shareable query URLs;
- bounded candidate retrieval;
- optional Jev-assisted reranking only if Phase 3E proves useful.

Normal search/filtering must work without Jev.

Verify deterministic discovery first. Model-assisted reranking should improve an existing discovery engine, not substitute for one.

## Phase 5 — Community submission

- submit GitHub URL;
- duplicate validation;
- deterministic eligibility checks;
- repository metadata/content collection;
- optional model-assisted triage if already validated;
- pending moderation queue;
- approve/reject;
- abuse/rate limits;
- audit events.

Model output must remain advisory for permanent moderation decisions.

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
