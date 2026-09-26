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


## D-048 — Split repository content foundation into small evidence phases

**Status:** Accepted

Phase 3D is split into:
- 3D.1 bounded README content;
- 3D.2 contribution-document evidence.

README storage and contribution-document discovery introduce different API and validation concerns and should not be shipped as one large change.

## D-049 — README collection is independent from canonical ingestion

**Status:** Accepted

README API failures must not prevent canonical repository identity/state or measured metadata from refreshing.

README content therefore has an independent refresh service/store lifecycle.

Later orchestration may invoke both workflows, but their failure domains remain separate.

## D-050 — Bound stored README bodies to 256 KiB with explicit provenance

**Status:** Accepted

RepoScout stores validated README text only when the decoded UTF-8 body is at most 256 KiB.

For stored content, RepoScout preserves source ref, path, Git blob SHA, byte size, and observation timestamp.

Oversized README files retain provenance/size evidence without storing their body.

## D-051 — Do not publicly expose raw README bodies in Phase 3D.1

**Status:** Accepted

README text is collected as source evidence for future search/classification/model evaluation.

Phase 3D.1 does not add raw README content to catalog APIs or web surfaces.

Any future public snippet/rendering feature requires an explicit sanitization, attribution, and product-policy decision.


## D-052 — Use GitHub community profile for contribution-file presence

**Status:** Accepted

RepoScout uses GitHub's community-profile metrics endpoint for effective CONTRIBUTING, Code of Conduct, issue-template, and pull-request-template evidence instead of recursively searching repository trees.

Returned GitHub API/HTML links are stored as provenance.

These links are treated as GitHub effective community evidence and are not assumed to be repository-local because supported account-level defaults may apply.

## D-053 — Skip community-profile requests for forks

**Status:** Accepted

GitHub documents the community-profile endpoint as unavailable for fork repositories.

RepoScout records `UNSUPPORTED_FORK` instead of making the unsupported call or incorrectly recording all evidence as absent.

## D-054 — Security policy detection uses only supported repository-local paths

**Status:** Accepted

RepoScout probes, in order:
1. `.github/SECURITY.md`
2. `SECURITY.md`
3. `docs/SECURITY.md`

The first existing file wins.

This lookup is bounded and non-recursive.

Repository-local security evidence preserves the default branch/ref, path, blob SHA, and byte size.

## D-055 — Contribution evidence remains internal in Phase 3D.2

**Status:** Accepted

Contribution evidence is collected for future contribution discovery and Jev evaluation but is not exposed in public catalog APIs, repository cards, or ranking during Phase 3D.2.

No contribution-readiness score is created.


## D-056 — Define the Jev evaluation harness before the live adapter

**Status:** Accepted

RepoScout fixes benchmark tasks, labels, result schema, and evaluation metrics before introducing a TypeSafe/Jev HTTP dependency.

This prevents success criteria from being changed after seeing model results.

## D-057 — Phase 3E.1 synthetic labels validate the harness, not Jev

**Status:** Accepted

The initial six repository examples and five relevance examples are synthetic and include explicit rationales.

They exist to verify task definitions, schema handling, orchestration, and metric math.

They must not be cited as evidence that Jev performs well or poorly.

A real RepoScout repository benchmark is required before an adoption decision.

## D-058 — Jev evaluation metrics remain separate

**Status:** Accepted

RepoScout does not create a single composite Jev quality score.

Project-type accuracy, tutorial/demo accuracy and Brier score, beginner-suitability error, relevance error, confidence, and latency remain separate so failure modes stay visible.

## D-059 — Model evaluation results are replayable and provider-neutral

**Status:** Accepted

Evaluation runs record benchmark version, provider, model, run ID, timestamps, and typed assessments.

Scoring can be replayed from a validated JSON result file.

The benchmark/evaluator does not depend on TypeSafe HTTP request details.

## D-060 — Defer the live Jev adapter until the exact current API schema is verified

**Status:** Accepted

TypeSafe's public API documents the System One endpoint, model discovery, Bearer authentication, and typed decision families.

RepoScout will not guess undocumented request/response details.

Phase 3E.2 will implement the adapter only after validating the exact current OpenAPI contract and a controlled credentialed request.


## D-061 — Implement Jev against the published System One contract

**Status:** Accepted

RepoScout's live adapter follows the current published TypeSafe OpenAPI contract:
- `GET /v1/models`;
- `POST /v1/systemone`;
- Bearer authentication;
- `state`, `model`, and named `questions`;
- Noul, Choice, and Score answers.

RepoScout does not use undocumented payload fields.

## D-062 — Keep TypeSafe credentials out of normal application startup

**Status:** Accepted

`TYPESAFE_API_KEY` is required only by explicit live evaluation tooling.

The normal RepoScout API server, repository ingestion, catalog, and deterministic discovery must continue to function without TypeSafe credentials.

## D-063 — Record the concrete model returned by TypeSafe

**Status:** Accepted

A configured alias such as `jev-latest` may resolve to a concrete model.

Evaluation runs record the resolved response model. If multiple calls in the same benchmark resolve to different model names, the run fails rather than mixing provenance.

## D-064 — Translate TypeSafe zero-based score rubrics at the adapter boundary

**Status:** Accepted

TypeSafe score levels are positional and begin at zero. RepoScout's evaluation benchmark uses a one-to-five scale.

The adapter performs the conversion `reposcout = typesafe + 1` and preserves fractional expected scores.

The benchmark/evaluator itself remains provider-neutral.

## D-065 — Live Jev calls are never part of ordinary CI

**Status:** Accepted

CI tests the TypeSafe adapter with mocked HTTP responses.

Live smoke evaluation is explicit, credential-gated, and non-production so provider availability, quota, latency, or billing cannot destabilize RepoScout's normal quality gate.


## D-066 — Do not block RepoScout product development on Jev provider access

**Status:** Accepted

The Jev harness and verified adapter remain in the codebase, but live evaluation is deferred while TypeSafe access is unavailable.

RepoScout will continue into deterministic search/discovery without waiting for a model credential.

Phase 3E.2B and 3E.3 may resume later without redesigning the current architecture.

## D-067 — Phase 4 deterministic discovery proceeds independently of Jev

**Status:** Accepted

Phase 4 search, filtering, pagination, and deterministic sorting must be complete and useful without Jev.

If Jev is later validated, it may only enhance bounded candidate reranking after deterministic retrieval.


## D-068 — Phase 4A search filters candidates before relevance ranking

**Status:** Accepted

The first discovery endpoint performs PostgreSQL lexical matching but orders matching repositories by stable internal UUID.

Phase 4A does not claim that UUID order represents relevance.

Text relevance ranking is a separate later decision so ranking semantics can be tested and explained independently from basic retrieval.

## D-069 — Search cursors are bound to the normalized query

**Status:** Accepted

Phase 4A search cursors encode the last stable repository UUID together with the normalized query.

A cursor generated for one query is rejected when supplied to another query.

Clients still treat the cursor as opaque.

## D-070 — Defer a dedicated PostgreSQL search index until measurement justifies it

**Status:** Accepted

The initial curated RepoScout index is intentionally small.

Phase 4A computes the PostgreSQL text vector at query time rather than adding a generated vector column or GIN index immediately.

A dedicated search index should be introduced only after realistic repository volume, query plans, and latency show that it is useful.


## D-071 — Phase 4B.1 uses exact scalar filters over authoritative stored fields

**Status:** Accepted

The first structured search filters are:
- primary language;
- SPDX license;
- fork state;
- archived state.

Language and license use exact case-insensitive matching over stored metadata. Fork/archive use exact canonical booleans.

No fuzzy filter interpretation is introduced.

## D-072 — Missing metadata does not satisfy metadata filters

**Status:** Accepted

A repository with unavailable/not-yet-collected language or license metadata is excluded when the corresponding filter is active.

RepoScout does not guess missing values or treat missing metadata as a wildcard.

## D-073 — Search cursors bind the complete normalized filter scope

**Status:** Accepted

The opaque lexical-search cursor is bound to the normalized query plus language, license, fork, and archived values.

Changing any scope field invalidates the cursor.

This preserves deterministic pagination as structured filters are composed with lexical retrieval.


## D-074 — Topic filters use normalized all-topic containment

**Status:** Accepted

Clients may repeat `topic` up to 10 times.

RepoScout trims, lowercases, deduplicates, and sorts requested topics before retrieval/cursor creation.

A repository must contain every requested topic.

Phase 4B.2 does not introduce OR-topic or fuzzy topic semantics.

## D-075 — Star filters are inclusive bounds over measured metadata

**Status:** Accepted

`minStars` and `maxStars` are nonnegative safe integers.

Matching uses inclusive bounds.

If both are supplied, `minStars` must be less than or equal to `maxStars`.

Repositories with missing metadata do not satisfy star-range filters.

## D-076 — Keep lexical query required in Phase 4B.2

**Status:** Accepted

Filter-only discovery changes the retrieval contract enough to deserve its own phase.

Phase 4B.2 therefore keeps `q` required while completing topic and numeric metadata filtering.

A later phase may make the query optional after defining empty-query and cursor behavior explicitly.

## D-077 — Search cursors include topic and star filter scope

**Status:** Accepted

Search cursors bind the canonical topic list and min/max star values in addition to the existing query/scalar filter scope.

Changing any of those values invalidates pagination.


## D-078 — Use the existing search endpoint for filter-only discovery

**Status:** Accepted

RepoScout does not create a second structured-discovery endpoint.

`GET /api/repositories/search` now supports either:
- a normalized lexical query;
- one or more structured filters;
- both.

This keeps pagination, response shape, URL semantics, and future sorting on one discovery contract.

## D-079 — Reject empty discovery scope

**Status:** Accepted

A request to `/api/repositories/search` with neither a lexical query nor any structured filter returns `400 invalid_search_scope`.

Unscoped repository traversal remains the responsibility of `GET /api/repositories`.

An explicitly supplied invalid or blank `q` remains invalid and is not silently treated as omitted.

## D-080 — Filter-only cursors bind a null lexical query

**Status:** Accepted

Search cursors now treat the lexical query as nullable.

For filter-only discovery, the cursor records `query = null` together with the complete normalized filter scope and last repository UUID.

A filter-only cursor cannot be reused with a lexical query or changed filters.


## D-081 — Browser URLs describe discovery scope, not pagination state

**Status:** Accepted

Phase 4C stores normalized lexical/filter discovery state in the browser URL.

Opaque pagination cursors remain transient client state and are not placed in shareable URLs.

This keeps copied links stable descriptions of discovery intent rather than one pagination session.

## D-082 — Discovery controls apply on explicit submit

**Status:** Accepted

The Phase 4C browser does not send discovery requests on every keystroke.

Users apply the current lexical/filter form explicitly.

This keeps request volume bounded, browser history intentional, and incomplete filter edits from producing unnecessary API traffic.

## D-083 — Browser back/forward restores discovery state

**Status:** Accepted

Phase 4C listens for browser history navigation and rebuilds the active discovery scope/form from the current URL.

Navigation resets loaded pages and refetches the corresponding deterministic result set.

## D-084 — The web client preserves backend ordering exactly

**Status:** Accepted

Phase 4C does not sort or rerank repository results in the browser.

Stars, activity, exact-name similarity, or model output must not silently alter result order client-side.

Any future sort or relevance mode must be an explicit backend/product contract.


## D-085 — Phase 5 begins with URL-only submission intake

**Status:** Accepted

The first community write endpoint accepts only a full GitHub repository URL.

Phase 5A does not accept submitter-authored descriptions, tags, categories, reasons, or other free-form metadata.

This keeps the initial trust and abuse surface small.

## D-086 — Normalize submission owner/name for intake duplicate checks, not canonical identity

**Status:** Accepted

Submission owner and repository names are lowercased and stored as a normalized full name.

This supports case-insensitive intake duplicate checks.

GitHub repository ID remains the canonical external identity and must be resolved/rechecked in Phase 5B because repositories can be renamed or transferred.

## D-087 — Enforce one pending submission per normalized repository in PostgreSQL

**Status:** Accepted

Application duplicate checks are not sufficient for concurrent requests.

A partial unique index enforces one `PENDING` row per normalized full name.

Case/.git variants therefore cannot race into duplicate pending rows.

## D-088 — Already-indexed and already-pending are separate API conflicts

**Status:** Accepted

Phase 5A returns:
- `409 repository_already_indexed` when the canonical catalog already contains the current owner/name;
- `409 submission_already_pending` when an intake record is already pending.

These conflicts remain separate so the UI can explain them accurately.

## D-089 — Submission intake is not launch-ready before abuse controls

**Status:** Accepted

Phase 5A creates the backend write contract but does not claim broad-public readiness.

Rate limiting, spam/abuse controls, deterministic GitHub validation, moderation, and operational review remain required before broad launch.


## D-090 — Preserve submission intake identity separately from GitHub-resolved identity

**Status:** Accepted

Phase 5B.1 does not rewrite the URL/normalized owner/name captured during Phase 5A.

GitHub's resolved repository ID, owner, name, full name, and URL are stored separately so RepoScout can audit what was submitted versus what GitHub authoritatively resolved.

## D-091 — Canonical GitHub repository ID decides deterministic submission duplicates

**Status:** Accepted

Owner/name checks at intake are a convenience only.

After GitHub resolution, RepoScout re-checks the canonical GitHub repository ID against the indexed repository table.

This catches renamed/transferred repositories and records the indexed RepoScout repository UUID on DUPLICATE outcomes.

## D-092 — Token-visible private repositories are invalid community submissions

**Status:** Accepted

GitHub reachability through RepoScout's authenticated server token does not prove public availability.

Phase 5B.1 records a resolved repository with GitHub `private = true` as INVALID.

Public community discovery must not depend on privileged token visibility.

## D-093 — Transient GitHub failures never become deterministic validation outcomes

**Status:** Accepted

Only authoritative not-found/inaccessible or private state becomes INVALID.

Rate limiting, timeout/network errors, GitHub request failures, and malformed external responses leave the submission PENDING and unvalidated so later orchestration can retry safely.

## D-094 — VALID submission validation does not approve the repository

**Status:** Accepted

A successful unique public GitHub resolution records `validation_outcome = VALID` while submission `status` remains PENDING.

Validation establishes factual eligibility only.

Human moderation/approval remains a separate later phase.

## D-095 — Submission validation writes are idempotent and first-writer-safe

**Status:** Accepted

The store only transitions a row while it is PENDING and has no validation outcome.

Concurrent validators cannot overwrite a deterministic outcome. A losing validator reads and returns the already-recorded result.


## D-096 — Submission validation batches are bounded and oldest-first

**Status:** Accepted

Phase 5B.2A selects only PENDING submissions with no validation outcome, ordered by creation time then UUID.

The default batch size is 10 and the maximum is 50.

This keeps manual/internal execution predictable and bounded.

## D-097 — Rate limiting stops the current validation batch

**Status:** Accepted

Transient request/response failures may be reported and the batch may continue, but a GitHub rate-limit response stops the remaining selected work.

RepoScout preserves the provider retry timestamp when available instead of continuing to consume unavailable quota.

## D-098 — Do not add persistent retry or lease state before background workers exist

**Status:** Accepted

Phase 5B.2A reuses the existing submission state and idempotent validation writes.

No job, lease, attempt-count, or retry table is added yet.

Persistent coordination should be introduced only when background/concurrent workers create a concrete operational need.

## D-099 — Validation orchestration never approves submissions

**Status:** Accepted

The orchestration layer may produce VALID, DUPLICATE, INVALID, or retryable operational results.

VALID remains PENDING and only becomes eligible for Phase 5B.2B evidence handoff.

Human moderation remains authoritative for approval in Phase 5C.


## D-100 — Evidence handoff completion is separate from approval

**Status:** Accepted

Phase 5B.2B may ingest the repository, refresh measured metadata, and collect evidence for a VALID submission, but it must leave submission status PENDING.

The durable handoff marker means the repository is prepared for moderation. It does not mean RepoScout has approved or endorsed the submission.

Phase 5C human moderation remains authoritative for APPROVED/REJECTED transitions.

## D-101 — Persist only minimal durable handoff state

**Status:** Accepted

RepoScout adds only:
- `handoff_repository_id`;
- `evidence_handoff_completed_at`.

A handoff is either incomplete with both fields null or complete with both fields present.

No persistent attempt count, retry schedule, lease, or job table is introduced before background-worker needs justify it.

## D-102 — Re-verify canonical GitHub repository ID before handoff ingestion persistence

**Status:** Accepted

A submission may be validated at one time and handed off later.

The fresh ingestion fetch must match the GitHub repository ID stored by deterministic validation before any new repository state is persisted.

Owner/name is not sufficient because repositories can be renamed/transferred and paths can change.

## D-103 — Partial evidence writes are allowed; completion requires all stages

**Status:** Accepted

Canonical repository/metadata, README evidence, and contribution evidence are separate idempotent/stale-safe persistence boundaries around external GitHub calls.

Phase 5B.2B does not attempt one transaction across those network operations.

A partial provider failure may therefore leave useful already-written evidence, but `evidence_handoff_completed_at` remains null until every required stage succeeds.

The next handoff run safely retries.

## D-104 — Rate limiting stops later handoff provider work and the selected batch

**Status:** Accepted

When any handoff stage receives a GitHub rate-limit response, RepoScout:
- preserves retryAt when available;
- skips later GitHub stages for that submission;
- stops the remaining selected batch.

Other isolated provider request/response failures remain observable and may allow later independent evidence stages to run.

## D-105 — Submission handoff reuses canonical ingestion and evidence services

**Status:** Accepted

Phase 5B.2B must call the existing RepositoryIngestionService, RepositoryReadmeService, and RepositoryContributionEvidenceService.

Submission workflow code must not create parallel repository normalization, metadata, README, or contribution-evidence logic.


## D-106 — Canonical repository storage is separate from public listing

**Status:** Accepted

Phase 5B evidence preparation needs a canonical repository row before moderation.

RepoScout therefore adds explicit `repositories.is_listed` publication state.

Public catalog, detail, and discovery only expose listed repositories. Internal ingestion/evidence workflows may use unlisted canonical rows.

## D-107 — Submission evidence handoff creates unlisted candidates

**Status:** Accepted

A newly created repository reached through Phase 5B.2B submission handoff starts unlisted.

Evidence-handoff completion means “prepared for moderation,” not “published.”

Existing prepared PENDING + VALID handoffs are backfilled to unlisted by the Phase 5C.1 migration.

## D-108 — Repository refresh never silently changes an existing listing decision

**Status:** Accepted

The initial insertion path may choose listed/unlisted state.

On canonical GitHub-ID conflict, later ingestion refreshes update GitHub-originated fields but preserve `is_listed`.

Human moderation remains the authority for publishing submission-prepared repositories.

## D-109 — Approval status, publication, and audit event are atomic

**Status:** Accepted

APPROVED moderation locks the submission and, in one PostgreSQL transaction:
- verifies PENDING + VALID + completed evidence handoff;
- sets the handoff repository listed;
- sets submission status APPROVED;
- inserts the moderation event.

Publication must not commit without its audit record.

## D-110 — Rejection preserves evidence but keeps the repository unlisted

**Status:** Accepted

REJECTED changes the submission terminal state and writes the audit event.

RepoScout does not delete the canonical/evidence rows created for review, but those rows remain excluded from public discovery.

Unlisted retained evidence does not count as an already-indexed repository for later intake/validation.

## D-111 — Do not expose moderation HTTP actions before reviewer authorization exists

**Status:** Accepted

Phase 5C.1 intentionally stops at persistence/domain behavior.

An unauthenticated approve/reject endpoint would create a publication vulnerability.

Reviewer identity, authorization, and protected moderation routes belong to Phase 5C.2.


## D-112 — Moderation reviewer identity comes from server-side credentials

**Status:** Accepted

Phase 5C.2 configures trusted reviewer references and bearer secrets through server environment.

Moderation requests cannot provide their own reviewer reference.

The authenticated reviewer reference is the value written into the append-only moderation event.

## D-113 — Keep the initial moderation auth boundary independent from general user accounts

**Status:** Accepted

RepoScout does not introduce a user/account/OAuth system solely to unlock maintainer-led moderation.

The first protected moderation API uses dedicated trusted reviewer credentials.

A broader account/role model may replace this boundary later if product requirements justify it.

## D-114 — Protected HTTP moderation must reuse the Phase 5C.1 transaction

**Status:** Accepted

The moderation route does not update repository listing state or submission status directly.

It delegates to the existing moderation service/store transaction so approval publication, terminal submission state, and audit-event persistence remain atomic.

## D-115 — Bearer secrets are not moderation audit identities

**Status:** Accepted

Configured bearer secrets are authentication material only.

Secrets are hashed in memory by the authenticator and are never returned by moderation APIs or stored in moderation events.

Audit records store only stable reviewer references.


## D-116 — Rate-limit public submission attempts before request-body processing

**Status:** Accepted

Phase 5E.1 applies the public submission limiter to `POST /api/submissions` before the JSON body parser.

This keeps repeated rejected attempts from consuming normal submission parsing/service work and ensures invalid submission bodies do not bypass attempt accounting.

The limiter does not alter the Phase 5A submission service or Phase 5C moderation transaction.

## D-117 — Forwarded client IPs are untrusted unless reverse-proxy hops are explicitly configured

**Status:** Accepted

RepoScout defaults `TRUST_PROXY_HOPS` to 0.

Client-controlled `X-Forwarded-For` data therefore cannot change the rate-limit identity in the default configuration.

A deployment may set a positive hop count only when the API is reachable through the corresponding trusted reverse-proxy topology. Incorrect proxy trust can allow spoofed client identity or cause unrelated users to share one rate-limit bucket.

## D-118 — The initial submission limiter is bounded and process-local

**Status:** Accepted

Phase 5E.1 uses a bounded in-memory fixed-window limiter because RepoScout currently has no shared cache/rate-limit datastore and should not add distributed infrastructure solely for the first launch-hardening slice.

The default tracked-client map is bounded to prevent unbounded memory growth.

This limiter is not sufficient for horizontal/multi-instance deployment because each process has independent counters. Before scaling the API across multiple processes/instances, RepoScout must move this control to a shared store or trusted edge/reverse-proxy limiter.

Rate limiting is an abuse-reduction control, not a replacement for deterministic spam checks or trusted moderation.


## D-119 — Cool down the repository identity after a terminal submission result

**Status:** Accepted

Phase 5E.2 prevents the same normalized repository from immediately creating a new PENDING submission after a recent terminal result.

The default cooldown is 24 hours and is configurable between 1 minute and 30 days.

This control limits repeated validation/evidence/moderation work for the same repository while still allowing a maintainer or community member to try again after time has passed.

## D-120 — Repository cooldown is not submitter tracking or a permanent blacklist

**Status:** Accepted

The cooldown key is the normalized GitHub repository identity.

RepoScout does not add a user account, submitter ID, organization-wide penalty, behavioral fingerprint, or extra network identity for this control.

A terminal result does not permanently ban a repository. Once the cooldown expires, intake may create another submission and the normal deterministic validation and trusted moderation workflow runs again.

## D-121 — Public cooldown responses do not disclose the previous terminal outcome

**Status:** Accepted

The public intake response uses one generic `submission_resubmission_cooldown` state.

It does not reveal whether the preceding submission was INVALID, DUPLICATE, REJECTED, APPROVED, or otherwise terminal.

The response may expose only the remaining retry delay needed to make the public UI actionable.

This abuse control does not change final moderation authority.


## D-122 — Moderated submission history is retained in the MVP

**Status:** Accepted

Phase 5E.3 does not delete PENDING, APPROVED, or REJECTED submission rows.

It also does not delete moderation events or the canonical repository/evidence rows prepared for moderation.

This preserves the existing audit, publication, rejection-evidence, and recovery contracts.

## D-123 — Only old deterministic INVALID/DUPLICATE submission rows are cleanup candidates

**Status:** Accepted

Cleanup may delete only submission rows whose status is INVALID or DUPLICATE, whose evidence handoff fields are null, and which have no moderation event.

The default retention period is 90 days.

The configurable minimum is 31 days so cleanup cannot undercut the maximum 30-day repository resubmission cooldown.

Deleting a duplicate submission never deletes the canonical repository it referenced.

## D-124 — Submission cleanup is dry-run-first, bounded, and manually applied

**Status:** Accepted

The operational cleanup command previews candidates by default.

Deletion requires an explicit `--apply` flag.

Each run is bounded to at most 1000 rows and deletion rechecks eligibility while locking selected candidates with `FOR UPDATE SKIP LOCKED`.

RepoScout does not schedule automatic cleanup in Phase 5E.3. Automated scheduling should be introduced only with deployment/observability requirements that justify it.

Application-level cleanup is irreversible; recovery of pruned terminal rows depends on normal database backup/restore operations.


## D-125 — Operational observability must not become identity collection

**Status:** Accepted

Phase 5E.4 uses structured application logs as the first launch observability surface.

Submission/moderation events may carry request IDs, stable workflow outcomes, submission IDs, reviewer references, decisions, counts, status codes, and durations.

They must not intentionally include raw client IP addresses, authorization headers, bearer tokens, request bodies, cookies, user-agent strings, or moderation reason text.

Request IDs are per-request correlation values, not durable user identities.

## D-126 — Store opaque HMAC rate-limit identities instead of raw client addresses

**Status:** Accepted

The process-local submission limiter resolves the client address as before, but Phase 5E.4 derives the stored bucket key with HMAC-SHA256 and a random per-process secret.

The raw address is therefore not the limiter map key.

The secret is not persisted. Process restart rotates it and already resets process-local rate-limit state.

This does not change the existing horizontal-scale limitation: multiple API instances still require a shared/edge limiter.

## D-127 — High/critical production dependency advisories fail CI

**Status:** Accepted

CI runs:

`npm audit --omit=dev --audit-level=high`

High or critical advisories affecting the installed production dependency graph fail the gate.

Dependabot monitors npm and GitHub Actions dependencies weekly.

This control complements application review; it does not establish that the dependency graph is risk-free.

## D-128 — Transport and browser policy that depends on deployment stays at the trusted edge

**Status:** Accepted

The API sets deployment-independent response hardening headers and non-cacheable sensitive responses.

RepoScout does not hardcode HSTS because TLS termination/topology is deployment-specific.

The final frontend CSP also depends on the actual static-host asset/origin configuration.

Production HTTPS/TLS, HSTS, CSP, infrastructure access logging, and horizontally scalable rate limiting must be configured and verified at deployment time.


## D-129 — Historical snapshots contain measured facts, not ranking output

**Status:** Accepted

Phase 6A stores only authoritative repository measurements that RepoScout already collects from GitHub: stars, forks, and GitHub-style open issue count.

Release counts, contributor/activity aggregates, model assessments, and ranking scores are not added until their collection source and semantics are explicitly defined.

Snapshot history is input to later deterministic trend/ranking work, not the ranking result itself.

## D-130 — Use one immutable snapshot per repository per UTC day

**Status:** Accepted

The first snapshot cadence bucket is a UTC calendar day.

The database stores both the actual `captured_at` timestamp and its derived `captured_on` UTC date, and enforces that the two agree.

A unique `(repository_id, captured_on)` constraint prevents duplicate daily history.

## D-131 — Same-day snapshot capture is first-write-wins

**Status:** Accepted

If a capture is retried for a repository/day that already has a snapshot, the existing snapshot is returned and historical values are not rewritten.

This keeps daily history append-only and makes retries safe.

Different-day backfills remain independent rows and may be inserted out of chronological order.

## D-132 — Do not introduce snapshot retention/coarsening before storage evidence requires it

**Status:** Accepted

Phase 6A keeps daily snapshots without automatic aggregation/deletion.

Weekly/monthly coarsening may be introduced later if measured storage growth justifies the added complexity.


## D-133 — Capture history in the same transaction as accepted metadata persistence

**Status:** Accepted

When `RepositoryStore.upsertWithMetadata` accepts a metadata observation, RepoScout also attempts the Phase 6A daily snapshot inside the same PostgreSQL transaction.

Repository canonical state, current metadata, and the corresponding historical daily observation therefore cannot partially commit through this path.

The existing daily unique constraint preserves first-write-wins history when multiple accepted observations occur on the same UTC day.

## D-134 — Snapshot capture must not add a duplicate GitHub fetch

**Status:** Accepted

Phase 6B reuses the authoritative observation already produced by the existing ingestion/refresh pipeline.

Writing historical state does not perform another provider call.

This preserves the established GitHub rate-limit/retry behavior and keeps snapshot storage independent from provider availability after the observation has already been fetched.

## D-135 — Backfill only what RepoScout actually persisted

**Status:** Accepted

The Phase 6B backfill command reads the latest `repository_metadata` observation and creates its daily snapshot only when that UTC day is missing.

It does not fabricate older history and does not call GitHub to infer past values.

Historical observations that were never stored cannot be reconstructed accurately and remain missing.

## D-136 — Unlisted canonical repository observations may have internal snapshot history

**Status:** Accepted

Backfill and automatic metadata capture are not filtered by public listing state.

An unlisted moderation candidate may therefore accumulate measured history before approval.

Snapshot history does not publish the repository and does not change `is_listed`; public discovery remains governed by the existing publication boundary.


## D-137 — Trend windows must be explicit

**Status:** Accepted

The public trend read requires `windowDays` and accepts integer windows from 1 through 365 days.

RepoScout does not silently choose a default comparison period because different windows answer different questions and later ranking logic must be able to state exactly which historical horizon it uses.

## D-138 — A trend baseline is the closest snapshot on or before the requested cutoff

**Status:** Accepted

For a requested window, RepoScout anchors the end at the latest historical snapshot and derives a UTC cutoff day.

The baseline is the newest snapshot whose `captured_on` is less than or equal to that cutoff.

When history is sparse, the actual covered span may therefore be larger than the requested window. The response must expose `actualWindowDays` so consumers never mistake sparse coverage for an exact interval.

RepoScout does not select a newer-than-cutoff baseline merely to return a delta.

## D-139 — Missing history returns insufficiency, not an invented trend

**Status:** Accepted

If no snapshots exist, the result is `no_snapshots`.

If snapshots exist but none reach the requested cutoff, the result is `window_not_covered` with the oldest/latest available points and the actual available span.

RepoScout does not extrapolate, annualize, scale, synthesize zero, or otherwise manufacture a full-window delta from insufficient history.

## D-140 — Snapshot deltas are descriptive signals, not quality scores

**Status:** Accepted

Phase 6C exposes signed changes in stars, forks, and GitHub-style open issue count.

A positive or negative value is not labeled good or bad. In particular, open-issue movement has context-dependent meaning.

Trend reads remain derived/recomputable and are not persisted as a universal repository score.

Public trend access follows the existing listing boundary; internal history for unlisted repositories is not exposed by the public catalog API.
