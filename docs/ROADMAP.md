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

Status: complete

#### Phase 5C.1 — Moderation persistence + publication boundary

Status: complete

- canonical repository storage separated from public listing;
- submission evidence handoff creates unlisted repository candidates;
- existing PENDING + VALID handed-off candidates backfilled to unlisted;
- catalog/detail/search expose listed repositories only;
- ordinary refresh preserves listing state;
- already-indexed/duplicate checks use listed repositories only;
- bounded oldest-first moderation-candidate selection;
- atomic APPROVED/REJECTED transition;
- approval publishes the handoff repository;
- rejection keeps prepared evidence hidden;
- required reviewer reference and reason;
- append-only moderation event;
- repeated/conflicting final decisions rejected;
- no unauthenticated moderation route.

#### Phase 5C.2 — Reviewer authorization + protected moderation API

Status: complete

- server-side trusted reviewer configuration;
- Bearer-token authorization;
- hashed in-memory reviewer token matching;
- protected pending moderation queue;
- protected final decision API;
- authenticated reviewer identity injected into audit events;
- client reviewer spoofing rejected;
- stable 401/400/404/409 moderation HTTP errors;
- Phase 5C.1 atomic publication transaction preserved;
- no moderation UI yet;
- no schema migration.

### Phase 5D — Submission web UI

Status: complete

- public Add a Repository form using the existing `POST /api/submissions` contract;
- request body remains URL-only with no free-form community metadata;
- strict same-origin web client response validation;
- explicit success / pending-review state;
- distinct already-indexed and already-pending states;
- invalid repository URL feedback;
- retryable network/server failure handling;
- moderation expectations shown before publication;
- responsive and accessible live-feedback treatment;
- no reviewer credentials, moderation queue, or moderation decisions exposed in the public UI;
- Phase 5E abuse controls remain deferred.

### Phase 5E — Abuse/launch hardening

Status: complete

#### Phase 5E.1 — Public submission rate limiting

Status: complete

- bounded fixed-window limiter for `POST /api/submissions`;
- limit applied before JSON body parsing;
- default 10 attempts per 10 minutes per resolved client IP;
- bounded tracked-client memory;
- stable `429 submission_rate_limited` contract;
- `Retry-After` and rate-limit response headers;
- explicit reverse-proxy trust configuration;
- forwarded IP headers ignored unless proxy trust is configured;
- retryable web-client handling;
- no moderation/publication behavior change.

The current limiter is process-local. Horizontal/multi-instance deployment requires a shared-store or edge limiter.

#### Phase 5E.2 — Submission spam / abuse controls

Status: complete

- repository-level terminal resubmission cooldown;
- default 24-hour cooldown, configurable from 1 minute to 30 days;
- normalized repository identity used instead of submitter identity;
- stable generic `409 submission_resubmission_cooldown` response;
- retry timing exposed without exposing the previous terminal result;
- no immediate retry action in the public UI;
- transaction-safe pending/recent-terminal intake checks;
- partial PostgreSQL lookup index with verified rollback/reapply;
- no accounts, CAPTCHA, behavioral fingerprinting, or model-driven final decisions.

#### Phase 5E.3 — Operational cleanup / retention

Status: complete

- PENDING submissions retained;
- APPROVED/REJECTED submissions retained;
- moderation events retained;
- prepared repository/evidence data retained;
- only old INVALID/DUPLICATE submissions eligible for cleanup;
- candidates require no evidence handoff and no moderation event;
- default 90-day terminal retention;
- minimum 31 days, longer than the maximum 30-day resubmission cooldown;
- dry-run-first CLI with explicit `--apply`;
- bounded cleanup batches, default 100 / maximum 1000;
- transaction-safe deletion with `FOR UPDATE SKIP LOCKED`;
- partial cleanup-candidate index;
- no automatic scheduler and no canonical repository deletion.

#### Phase 5E.4 — Observability + security review

Status: complete

- server-generated request correlation IDs;
- baseline API security headers;
- non-cacheable submission/moderation responses;
- stable malformed/oversized JSON errors;
- safe structured submission/moderation/rate-limit events;
- recursive secret-like log metadata redaction;
- bearer-token non-leak regression coverage;
- HMAC-derived in-memory rate-limit identities instead of raw IP keys;
- production high/critical dependency audit gate;
- weekly npm/GitHub Actions Dependabot monitoring;
- privacy/data-handling documentation;
- security reporting policy;
- end-to-end public submission/protected moderation boundary review;
- explicit residual deployment/production-gate list.

Model output remains advisory for permanent moderation decisions.

## Phase 6 — Historical snapshots

Status: complete

#### Phase 6A — Snapshot persistence foundation

Status: complete

- `repository_snapshots` historical metrics table;
- measured stars/forks/open-issues only;
- actual capture timestamp + UTC daily bucket;
- one snapshot per repository per UTC day;
- append-only first-write-wins retry behavior;
- separate historical rows for distinct-day backfills;
- nonnegative metric constraints;
- repository/capture-time history index;
- bounded recent-history persistence API;
- migration rollback/reapply coverage;
- dedicated PostgreSQL snapshot CI gate.

#### Phase 6B — Snapshot capture + bounded backfill

Status: complete

- accepted authoritative metadata writes create the daily snapshot in the same PostgreSQL transaction;
- no extra GitHub request is introduced for snapshot capture;
- stale metadata writes create no history;
- same-day current metadata may advance while the first daily historical snapshot remains immutable;
- bounded latest-metadata backfill for pre-6A observations;
- oldest observation first;
- default batch 50 / maximum 500;
- backfill includes unlisted canonical repositories;
- backfill performs no provider calls;
- internal `backfill:snapshots` CLI;
- structured backfill batch/item observability;
- ingestion/backfill integration coverage.

#### Phase 6C — Deterministic deltas + trend reads

Status: complete

- required explicit `windowDays` from 1 to 365;
- latest snapshot as the deterministic end point;
- closest snapshot on or before the requested cutoff as baseline;
- requested cutoff + actual covered span returned explicitly;
- signed star/fork/open-issue deltas;
- `no_snapshots` and `window_not_covered` insufficiency states;
- no partial-window extrapolation or fabricated zero delta;
- public `GET /api/repositories/:id/trend` for listed repositories only;
- unlisted internal history remains non-public;
- no persisted quality/trend score.

#### Phase 6D — Scheduled snapshot operations

Status: complete

- scheduler-safe one-run maintenance command;
- provider-free metadata backfill runs before provider refresh;
- listed-only refresh candidate selection;
- candidates require existing refresh eligibility and no current-UTC-day snapshot;
- deterministic oldest-sync-first order;
- refresh default 25 / maximum 100;
- backfill default 100 / maximum 500;
- PostgreSQL advisory lock prevents overlapping maintenance runs;
- overlapping run returns a no-op `already_running` outcome;
- sequential reuse of the existing refresh/ingestion path;
- `retry_later` and `manual_review` halt remaining provider work;
- retry timestamp surfaced in maintenance report;
- unavailable repositories do not block unrelated candidates;
- structured maintenance observability;
- external scheduler ownership rather than an in-process API timer;
- no ranking implementation.

Phase 6 is complete. Phase 7 consumes Phase 6 history but remains a separate ranking phase.

## Phase 7 — Hidden Gems and Rising

Status: in progress

#### Phase 7A — Ranking signal contract

Status: complete

- versioned deterministic signal contract: `ranking-signals-v1`;
- measured/current, measured/evidence, derived/current, and derived/history provenance classes;
- visibility, maintenance, documentation, community, momentum, and context roles;
- explicit zero-vs-missing semantics;
- missing reasons: not collected, unavailable, not applicable, insufficient history;
- Phase 6 historical provenance preserved on ranking observations;
- separate `hidden-gems-signals-v1` and `rising-signals-v1` mode contracts;
- Hidden Gems and Rising primary signals kept distinct;
- open-issue movement remains context only;
- no weights, score, ranking endpoint, or model-assisted signal.

#### Phase 7B — Hidden Gems v1

Status: complete

- versioned deterministic formula: `hidden-gem-v1`;
- consumes `ranking-signals-v1`;
- explicit required-evidence eligibility;
- missing/not-applicable required evidence returns ineligible;
- maintenance freshness: maximum 35 points;
- README evidence: maximum 20 points;
- CONTRIBUTING evidence: maximum 20 points;
- community-readiness evidence: maximum 20 points;
- optional positive 30-day momentum bonus: maximum 5 points;
- low stars add no quality points;
- logarithmic popularity-saturation penalty only:
  - zero through 250 stars;
  - maximum 25 points at 50k+ stars;
- maintenance freshness decays to zero over 365 days;
- negative momentum is not penalized;
- missing momentum history does not make a repository ineligible;
- structured component/penalty/coverage output;
- no public ordering/API and no ranking persistence.

#### Phase 7C — Rising v1

Status: complete

- versioned deterministic formula: `rising-v1`;
- requires 7-day star, 30-day star, and 30-day fork history;
- historical momentum contributes 95/100 possible points;
- maintenance support contributes at most 5 points;
- lifetime stars/forks contribute zero score points;
- 7-day actual span capped at 9 days;
- 30-day actual span capped at 35 days;
- acceptable sparse windows normalized back to requested duration;
- excessive sparse history returns ineligible;
- positive growth uses bounded logarithmic curves;
- zero/negative growth produces zero momentum points;
- score output retains historical provenance and normalized deltas;
- no public ranking API/persistence/model input.

#### Phase 7D — Ranking explanation + public API

Next:
- public named ranking modes;
- stable explanation payload;
- candidate ordering/pagination;
- preserve listed-only discovery boundary.

#### Phase 7E — Benchmark + tuning

Later:
- labeled/manual evaluation set;
- compare formula revisions;
- document every weight/threshold change;
- check popularity dominance and anti-gaming failure modes;
- model assistance only if it demonstrably improves bounded reranking.

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
