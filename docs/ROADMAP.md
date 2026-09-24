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

Status: deferred / experimental

Jev evaluation is intentionally paused because live TypeSafe access is currently unavailable. The completed adapter and harness remain in place, but RepoScout product development does not wait on provider access.

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

Status: in progress

##### Phase 3E.2A — Verified TypeSafe/Jev adapter

Status: complete

- current TypeSafe OpenAPI contract verified;
- fixed TypeSafe API origin and Bearer auth boundary;
- model discovery through `GET /v1/models`;
- System One adapter through `POST /v1/systemone`;
- native Noul / Choice / Score benchmark mapping;
- zero-based Jev score to one-based RepoScout scale conversion;
- requested + resolved model provenance;
- inconsistent model-resolution rejection;
- credential-gated live smoke command;
- TypeSafe config isolated from normal application startup;
- offline mocked provider tests in CI;
- no production persistence/ranking/moderation integration.

##### Phase 3E.2B — Controlled live smoke evaluation

Status: deferred — external access unavailable

Resume only when TypeSafe access becomes available.

A real live smoke result is only considered complete when a valid TypeSafe credential is supplied and the command succeeds.

#### Phase 3E.3 — Real RepoScout evaluation + adoption decision

Status: deferred until 3E.2B can run

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

Status: complete

### Phase 4A — Deterministic lexical search foundation

Status: complete

- `GET /api/repositories/search`;
- PostgreSQL full-text matching over owner/name/full-name/description;
- normalized bounded queries;
- stable UUID ordering;
- opaque query-bound keyset cursor;
- metadata-preserving search responses;
- no total-count query;
- no relevance rank yet;
- no search index migration yet;
- no Jev dependency.

### Phase 4B — Structured repository filters

Status: complete

#### Phase 4B.1 — Scalar search filters

Status: complete

- language exact filter;
- SPDX license exact filter;
- fork state;
- archived state;
- normalized filter echo;
- full search-scope cursor binding;
- parameterized SQL composition;
- no ranking change;
- lexical query remains required.

#### Phase 4B.2 — Topic and star-range filters

Status: complete

- repeated topic filters;
- all-topic containment semantics;
- topic normalization/deduplication/sorting;
- maximum 10 requested topics;
- inclusive minimum stars;
- inclusive maximum stars;
- invalid range rejection;
- missing metadata exclusion;
- full cursor scope binding for topics/star ranges;
- deterministic UUID ordering unchanged;
- lexical query still required.

#### Phase 4B.3 — Filter-only discovery

Status: complete

- existing `/api/repositories/search` endpoint reused;
- lexical query becomes optional only when at least one structured filter exists;
- empty discovery scope rejected;
- explicit invalid/blank query still rejected;
- filter-only PostgreSQL retrieval;
- nullable query included in cursor scope;
- deterministic UUID ordering unchanged;
- no duplicate discovery endpoint.

### Phase 4C — Web discovery UI

Status: complete

- lexical search form;
- structured language/license/topic/star/fork/archive controls;
- filter-only discovery;
- apply-on-submit request model;
- URL-backed normalized discovery scope;
- browser back/forward restoration;
- active-scope chips;
- separate catalog/discovery empty states;
- initial and load-more error handling;
- cursor-aware load more;
- no client-side ranking or fake relevance claims.

Later Phase 4 work:
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

Status: in progress

This is the first major community loop.

### Phase 5A — Submission intake

Status: complete

- `POST /api/submissions`;
- full HTTPS GitHub repository URL only;
- case-insensitive owner/name normalization;
- canonical submitted URL;
- pending submission persistence;
- already-indexed duplicate guard;
- race-safe one-pending-submission constraint;
- stable 201/400/409 API contract;
- no free-form community metadata;
- no GitHub API call during intake;
- no approval/moderation behavior yet.

### Phase 5B — Deterministic submission validation

Status: complete

#### Phase 5B.1 — Validation core and deterministic state

Status: complete

- resolve pending submissions through the existing GitHub client;
- distinguish public availability from token visibility;
- persist canonical GitHub repository ID/current identity;
- re-check indexed duplicates using canonical GitHub ID;
- VALID keeps the submission PENDING for later workflow;
- DUPLICATE transitions submission status to DUPLICATE;
- inaccessible/private repositories transition to INVALID;
- rate-limit/network/provider failures remain retryable and do not alter state;
- validation writes are race-safe/idempotent;
- no moderation or model decision.

#### Phase 5B.2 — Validation orchestration and evidence handoff

Status: complete

##### Phase 5B.2A — Validation orchestration

Status: complete

- bounded oldest-first selection of PENDING + unvalidated submissions;
- default batch size 10, maximum 50;
- reuse existing Phase 5B.1 validator;
- structured deterministic outcome reporting;
- transient request/response failures remain retryable;
- rate limiting stops the remaining selected batch;
- retryAt preserved when GitHub supplies it;
- unexpected internal failures still fail hard;
- internal CLI for manual batch execution;
- no schema change;
- no automatic approval.

##### Phase 5B.2B — Evidence handoff

Status: complete

- bounded oldest-first selection of PENDING + VALID + incomplete submissions;
- durable handoff link to the canonical repository;
- durable evidence-handoff completion timestamp;
- reuse canonical repository ingestion + measured metadata persistence;
- verify validated GitHub repository ID before ingestion persistence;
- reuse README evidence refresh;
- reuse contribution-document evidence refresh;
- isolate retryable evidence failures;
- allow safe partial writes without marking handoff complete;
- rate-limit response stops later provider stages and the remaining selected batch;
- idempotent already-completed handoff behavior;
- internal batch CLI;
- submission remains PENDING;
- no automatic approval.

### Phase 5C — Moderation workflow

Later:
- pending moderation queue;
- approve/reject;
- reviewer reason;
- authorization;
- append-only moderation events.

### Phase 5D — Submission web UI

Later:
- simple Add a Repository form;
- success/duplicate/error states;
- moderation expectations.

### Phase 5E — Abuse/launch hardening

Before broad public launch:
- rate limits;
- spam/abuse controls;
- operational cleanup/retention;
- observability;
- security review.

Model output must remain advisory for permanent moderation decisions.

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
