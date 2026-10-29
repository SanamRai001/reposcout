# RepoScout — Evidence-First Quality Improvement Plan

**Created:** 2026-10-29  
**Baseline:** main at 94eccf7ef03f50b40c602abbbfe2c84ef9865c71  
**Status:** proposed, documentation only; **no implementation, deployment or database changes authorized by this plan.**  
**Companion:** [REPOSCOUT_AUDIT_2026-10-29.md](REPOSCOUT_AUDIT_2026-10-29.md) (RS-01 through RS-15).  
**Project checkpoints:** [PROJECT_STATE.md](PROJECT_STATE.md) remains the single current project status document. Historical [ROADMAP.md](ROADMAP.md) and [DECISIONS.md](DECISIONS.md) stay intact; do not create separate competing state files.

## Non-negotiable constraints

1. Continue with a modular monolith, React/Vite, Express and PostgreSQL unless a measured bottleneck and operating budget justify a change.
2. Canonical identity is GitHub numeric repository ID. A fork is **not** a duplicate of its upstream in the database. Any ranking/grouping policy must be separately explained.
3. No unapproved public deployment, credentialed model use, production SQL, branch merge, destructive migration, force-push, user-data deletion or schema rewrite.
4. Listed-only public visibility, source provenance, moderation audit, API pagination, retry semantics, URL state and no-secret-client contracts must survive every phase.
5. Do one phase per small PR; read current code, tests, Git history and docs/PROJECT_STATE.md before editing. Update PROJECT_STATE.md at meaningful milestones, after reconciling actual HEAD and test evidence.
6. Classify claims as VERIFIED (source/test/real browser/real DB), HYPOTHESIS or UNKNOWN. CI mocks do not prove live data or user value.
7. Prefer open-source building blocks over speculative custom infrastructure. Inspect actual dependency/license before adopting.
8. Benchmark before rewriting. Preserve a failing baseline when fixing a reported bug. Never "optimize" solely because a code path looks O(N).

## Decision framework and measurable end state

**Primary product job:** "Given a concrete development need, find a relevant, viable open-source project and understand why it is worth inspecting."

**Candidate first cohort (decision needed):** backend-leaning developers looking for implementation examples, self-hosted developer tools and libraries. A narrower segment beats an unfocused "all developers" product for evaluation. Test whether the contribution path deserves equal priority; don't assume it does.

**Definition of useful v1 after improvements**
- Search Top-5 is judged against relevant user intents and outperforms baseline lexical UUID ordering; compare with GitHub's own search on the same prompts.
- Every repository result shows a useful purpose, matching evidence, freshness and one clear next action.
- Contribution issue links are labeled by observation freshness and undergo bounded revalidation; stale rows are not silently described as live opportunities.
- Ranking requests stay within an agreed p95 latency/SQL budget on the intended cheap single-VM setup.
- A small group of actual users can finish the primary task without instruction, and their feedback determines the next feature.
- Core flows satisfy agreed accessibility checks and still work without optional semantic/model providers.
- Restorable backups and operational freshness monitoring exist before public promises of always-fresh ranking.

**Proposed (not measured) budget negotiation:** evaluate 100/1,000/10,000 seeded repositories, an Oracle-equivalent low-resource Postgres environment and cold/warm runs; start with p95 search under ~500ms and ranking under ~1s at an agreed test size, then revise based on real infrastructure/user needs. A target is not a pass result until measured.

## Phase Q0 — Reconcile evidence, current hosting and usage

**Goal:** establish a truthful baseline before changing algorithms.

**Inspect:** docs/PROJECT_STATE.md, GitHub main, app/server/bootstrap, migrations, deploy/compose.yaml, OCI deployment guide, CI, database/CLI contracts and pending issues/PRs.

**Tasks**
- Verify actual branch HEAD, checked-in vs deployed commit, CI checks, catalog/listed count, distinct topics/languages/license coverage, oldest/newest observation, percent missing metadata and README/contribution evidence.
- Check GitHub quota/token mode, last successful ingestion/refresh/snapshot/issue scan, scheduler ownership and failure logs; **do not request or print secret values**.
- Test deployments using scripts only with explicit operator authorization; do not assume production host exists because compose/CI exists.
- Collect query plans in a disposable database, not production. Inventory slow queries, read counts, response sizes and current functional endpoints.
- Run low-friction five-task moderated usability pilot: find self-hosted alternative, locate example backend architecture, find maintained small repo, find contribution issue, submit unknown repo.
- Record baseline evidence in docs/PROJECT_STATE.md and a brief dated benchmark appendix only after actual execution.

**Acceptance:** a baseline table with source type, date, environment, dataset size, measured counts, CI URLs and unknowns. If real service is absent, explicitly say so.

**Stop / no-go:** do not provision infra or schedule production tasks automatically. If baseline is unmeasured, no architecture migration.

## Phase Q1 — Truth, safety and data freshness before claims

**Addresses:** RS-04, RS-10, RS-11, RS-14.

**Goal:** make current GitHub observations trustworthy enough to surface to users.

**Design**
- Document a per-observation lifecycle: observed_at, last_attempted_at (optional), last_success_at, provider status, stale_after, next_eligible_refresh and failure reason where warranted.
- Define bounded staleness labels, e.g. recent/aging/stale/unavailable; **thresholds are product policy**, reviewed against provider quota. Do not relabel stale as false.
- For issue ingestion, explicitly separate "not returned by limited fetch" from "confirmed closed." Retain existing rows safely; re-check displayed/open candidates within quota; handle deleted/inaccessible issues as unknown/unavailable unless proven.
- Avoid N+1 live GitHub calls per web view; revalidate asynchronously or in a bounded operational command. Use cursor/checkpointing and GitHub conditional requests where supported.
- Ensure retry/backoff respects rate-limit reset; never let a failure overwrite a newer successful observation.
- Add run health report: listed count, metadata freshness percentiles, age of open issue observations, snapshot 7/30d coverage, success/errors, latest completed batches. Keep personally identifying logs minimal.
- Verify real back-up + disposable restore runbook and reviewer-token rotation procedure. For single VM, process-local rate limiter is accepted with a documented limit; only add shared edge limiter when actual topology changes.

**Invariants:** moderation/publication state unaffected; no inferred closure from partial pages; canonical GitHub IDs preserved; older snapshots immutable.

**Tests:** integration cases: issue closed after previously open, issue omitted due cap, upstream rename, stale provider response, retry-after, terminated job/resume, parallel batch where relevant, unlisted repository not visible, new observation wins on tie. Run in disposable PostgreSQL with no production credentials.

**Acceptance:** known-freshness UI copy and enforced policy; reproducible report; no falsely treated omitted issues; restore evidence; nonempty catalog claims supported by live counts.

## Phase Q2 — Indexed, relevant and honest catalog search

**Addresses:** RS-01 and relevant part of RS-08.

**Goal:** make "find a repository" actually rank by user intent while keeping deterministic behavior.

**Implementation plan**
1. Assemble 30–50 representative real-world searches with expected relevant repositories (including zero-result, exact-name, niche long query, typo, multilingual term, OSS learning example, mature stable repo).
2. Baseline current query latency, number of matches and Top-5 judgments; record current arbitrary UUID behavior.
3. Design weighted searchable document preserving owner, full name, name, description and separately maintained topics. Use a generated/stored tsvector where suitable and a matching GIN index. Confirm PostgreSQL generated-column limitations across tables; don't invent denormalized triggers before testing.
4. Add relevance-first ordering with stable tie-breakers (e.g. ts_rank_cd plus GitHub ID/RepoScout UUID as stable key); preserve filter-only semantics and existing URL/query/filter contracts. Cursor must include score/order/version/scope and remain bounded.
5. Measure EXPLAIN (ANALYZE, BUFFERS) for frequent queries using representative data and compare cold/warm p50/p95. Avoid empty full table scans; add indexes only based on usage evidence.
6. Consider pg_trgm for typo tolerance and synonyms for user phrasing only after relevance tests. Keep exact name match obviously prioritized.
7. Preserve a straightforward fallback when search vector/index migration is not yet deployed.

**Acceptance:** all original search integration tests pass; added Top-5 judgments improve over baseline without regressing common exact names; cursor has no skips/duplicates on stable fixtures; query is bounded and has an explainable tie-breaker; no catalog API break without a compatibility plan.

**Reuse:** PostgreSQL full-text / GIN first. If measured latency/quality remain poor at target scale, compare Meilisearch CE (MIT, new data-sync obligations), Typesense (GPL-3.0 core, compatibility obligations) and pgvector only if semantic benchmarks show an incremental benefit. **No external search service in this phase by default.**

## Phase Q3 — Bound and stabilize ranking read performance

**Addresses:** RS-02, RS-03 and performance component of RS-14.

**Goal:** avoid scanning all repositories and four individual reads per candidate on every page request.

**Approach hierarchy**
1. First count SQL calls and request times for current listAllListedRepositories + scoreRepository behavior.
2. Batch README/evidence/history reads for candidate ID sets and use bounded concurrency or bulk SQL. Keep provenance and missingness identical.
3. Avoid repeatedly recomputing the same expensive score for pagination. If batch query performance still fails, store formula-versioned ranked evaluation runs (run ID, evaluatedAt, source watermark, score, explanations, visibility state) refreshed by existing operational scheduler.
4. Atomic publish/swap rank runs only when complete; retain previous good run through failed refresh and expose age/version in API.
5. Use score DESC, stable repository ID ordering; cursor binds run ID, mode and formula version. Explicitly handle an unlisting change after computation at read time (no leaked unlisted record).
6. Implement bounded request timeouts/concurrency controls appropriate to small hardware, prevent user-triggered full rebuilds.

**Trade-offs:** materialization speeds read and gives stable pages, but adds writer/refresh policy, storage and stale results. Prefer bulk reads if targets are met. Preserve current formulas during this phase; do not simultaneously alter scoring weights or response JSON.

**Acceptance:** p50/p95/DB query counts recorded at 100/1,000/10,000 entities; agreed budget met; ranking stable across pages; no unlisted leak; missing history behavior unchanged; adversarial tests cover ties, score changes, cancelled rebuild, stale run and version change.

## Phase Q4 — Redesign around the first user task; add repository detail

**Addresses:** RS-05, RS-06, RS-13.

**Goal:** users can decide "worth opening?" in RepoScout without interpreting raw signal internals.

**UX blueprint**
- Landing: concise purpose, one prominent search, 3 clickable example intents, small link to browse all; keep Hidden Gems, Rising and Find contributions available in secondary navigation.
- Search results: readable title/full name + concise factual description; visible matched fields or "why this match"; last observed; language/license/status. Add expandable advanced filters rather than showing all controls by default.
- Repository detail route: source-safe title, GitHub link, factual description, key metadata/provenance, activity/snapshot data, contribution docs/evidence, explicit limitations and "similar repositories" only if retrieval quality supports them.
- Ranked views: evidence-first explanation with score secondary; do not display "quality 92/100." Clearly distinguish formula score, missing signals and relative cohort.
- Contribution view: task language ("Recent observed GitHub issues"), freshness and open-when-observed label, transparent difficulty limitations, one primary current-GitHub action.
- Submission: keep moderation steps, validation states and helpful already-pending/duplicate messaging but reduce landing-page visual competition.
- Keep no-login browse as first-class; never require a login just to view details.

**Technical architecture:** split giant App.tsx by feature boundary (CatalogPage, SearchForm, Results, SubmissionPanel, RepositoryDetail, shared source/freshness components). Decide whether React Router is justified by multiple real routes; if used, incremental migration with exact deep-link/back-forward parity. Keep a shared backend client contract; avoid duplicating shape guards unnecessarily.

**Accessibility:** visible focus, keyboard-only forms/filters/disclosures, aria-live without chatter, state announcements, consistent headings, 200% zoom, 320px viewport, contrast and minimum readable secondary font size. Automated axe-core/Playwright plus manual NVDA/VoiceOver, keyboard and realistic mobile touch-target tests.

**Evidence:** test paper/low-fi flows before spending time on full polish. Run at least five task sessions with first-time users.

**Acceptance:** every successful catalog result has discoverable details/CTA and source freshness; URL deep links work directly through Caddy SPA fallback; existing filters/back/forward preserved; core tasks achieve pre-agreed success rate and fewer dead ends than baseline; automated accessibility scans report no critical/serious issues, manual keyboard passes.

## Phase Q5 — Evaluate ranking quality, fork diversity and contribution suitability

**Addresses:** RS-07, RS-08, RS-09.

**Goal:** demonstrate that "Hidden Gems," "Rising" and contribution discovery are useful, not just mathematically defined.

**Measured benchmark**
- Curate labeled queries and candidate lists by intent/eco-system; include multiple maintainers/sizes, a meaningful maintained fork, unchanged fork, stale project, stable mature library, template, bursty growth and an active but unsupported tiny project.
- Blind-label relevance/usefulness and reasons; use Top-5 precision, nDCG@5/MRR where applicable, novelty, time to first useful result and qualitative mismatch explanations.
- Compare current Hidden Gem score to alternatives: cohort-relative popularity penalty, maturity-aware maintenance window, README presence vs richness (only if cheaply measured), percentile / rate-normalized growth, saturation and anti-gaming checks.
- For Rising, test low-base growth rates vs absolute deltas and guard against star bursts, history sparse cutoff and artificially recreated projects. Do not let a novel score overwrite v1 without a measured win and versioned migration plan.
- For contribution suitability, keep "consider" as evidence, not beginner classification; optional difficulty labels require observed outcomes and human validation.

**Fork relationship proposal**
- Keep repositories.github_repository_id as canonical ID; add optional parent/upstream GitHub ID with observed time only after necessary.
- Search may collapse likely duplicate forks into "fork family" with expand control; maintain independent fork visibility when activity/release or meaningful divergence is observed. Never silently delete them.
- Use bounded GitHub compare/ancestry metadata; branch/tree hashes are version observations, not identity keys. Hashing every repo locally is costly and inappropriate for v1.
- Compare results with family collapsing on/off and let users include forks explicitly.

**Acceptance:** publish score rationale, dataset/card coverage and benchmark deltas; no "better than GitHub" language without controlled evidence; stable score versions, predictable fork handling, no artificial empty results from missing history. If results worsen, revert experiment and leave v1 intact.

**Go/no-go:** If Hidden Gems or Rising cannot demonstrably improve discovery, **remove it from top-level primary navigation** or label it an experiment; do not tune indefinitely.

## Phase Q6 — Operational launch and final polish

**Addresses:** RS-10 through RS-15.

**Goal:** a small reliable public product, not a prototype with excellent mocked screenshots.

**Checklist**
- Direct URLs, full Caddy/container deployment smoke, failed dependencies, 404 separation, 503 readiness, TLS, secure environment settings and proxy hops.
- Observable scheduled refresh run with GitHub quota guard, issue revalidation and daily snapshot generation; realistic first-7/30-day sparse history treatment.
- Off-VM verified backup and disposable restore; migration up/down of new migrations; emergency rollback procedure; no destructive production trials.
- Basic privacy-conserving product metrics (search attempted, zero-results, outbound useful click, filter usage, freshness failures) and opt-out/privacy review.
- Latency/DB load stress under target cheap VM; sanity budgets and alerts. Avoid Redis and microservices without need.
- Cross-browser desktop/mobile smoke, keyboard, screen reader and reduced-motion check.
- Documentation reconcile: README/PROJECT_STATE/ROADMAP/architecture API contract. Archive/supersede old recommendations by links, not duplicate state documents.
- Keep no-login browsing. Review security policy, pinned dependencies, secrets rotation, Caddy edge limitations and source validation.

**Acceptance:** credible repeatable launch checklist with deployment-specific evidence, user-task evidence, CI checks passing, no unlisted disclosures, clean rollback and known residual risks. Shipping remains a separate explicitly authorized action.

## Scope management: add / change / remove / postpone

| Decision | Item | Reason |
| --- | --- | --- |
| KEEP | Express + PostgreSQL modular monolith | Sufficient for foreseeable indexed catalog; less operational complexity |
| KEEP | GitHub ID unique canonical key | Robust across same-repo renames/transfers |
| KEEP | Moderated publication / explanation contracts | Central to safety and trust |
| IMPROVE | Indexed lexical ranking | Highest direct improvement to primary user job |
| IMPROVE | Issue freshness and operational monitoring | Relevance without freshness is misleading |
| ADD | Repository detail page | Exposes value already collected by backend |
| ADD | User-intent evaluation set | Makes algorithms falsifiable |
| CONSIDER | Fork family collapsed view | Solves duplicate-looking results without erasing valuable forks |
| CONSIDER | Materialized ranking run | Only after proving ranking read bottleneck |
| CONSIDER | Meilisearch / Typesense | Only after PostgreSQL baseline fails |
| DEFER | Semantic search / embeddings / LLM classification | No adoption decision without measured offline improvement and cost ceiling |
| DEFER | AI chat, social feed, browser extension, gamification | Not needed for first useful job |
| DEFER | Microservices / Kubernetes / Redis | Adds ops cost without measured demand |
| REMOVE IF FAILING | Equal prominence for all four navigation modes | Navigation should follow observed user value |

## Reuse and licensing due diligence

- **Postgres FTS + GIN and optionally pg_trgm:** best first-principles solution; integrated transactionally with existing schema. [PostgreSQL docs](https://www.postgresql.org/docs/current/textsearch.html).
- **axe-core + Playwright:** accessibility checks/E2E; licenses and pinned versions must be verified during integration. [axe](https://github.com/dequelabs/axe-core), [Playwright](https://github.com/microsoft/playwright).
- **React Router or existing tiny route switch:** keep route code as-is until detail route adds real complexity; React Router is a candidate, not a requirement.
- **TanStack Query:** candidate for deduplicated API cache, retries and abort control; adopting it creates migration and cache invalidation duties. Only if it simplifies current duplicated React query lifecycle.
- **Meilisearch CE:** MIT Community Edition, but separate index/worker and edition limits. [source](https://github.com/meilisearch/meilisearch).
- **Typesense:** GPL-3.0 core; consider copyleft and deployment obligations. [source](https://github.com/typesense/typesense).
- **ecosyste.ms / libraries.io:** study data coverage/source semantics. Their service/content licenses, API terms and attribution require separate review; do not scrape, import or transplant code blindly.
- **Optional Postgres-backed job queue:** only if actual scheduler/CLI retries become hard to operate; examine pg-boss or graphile-worker licensing and migration cost before adding anything.
- Existing modules: prefer extending snapshot/CLI/repository stores to inventing parallel infrastructures.

## Phase execution template (for separate implementation PRs)

For each phase:
1. **EXPLORE (read only):** fetch main, inspect worktree/branch/stashes, current code/callers/test schemas and PROJECT_STATE; explain what already works and what is unknown.
2. **PLAN (read only):** choose narrowly scoped behavior, data/contracts/migrations, known risks, rollback and precise acceptance criteria.
3. **IMPLEMENT:** smallest changes on isolated branch, preserve existing contracts, cover edge cases, avoid production writes.
4. **VERIFY:** focused unit/integration on disposable DB, deterministic baseline and regression checks, browser smoke where UI changed; only claim what ran.
5. **DOCUMENT:** update one PROJECT_STATE checkpoint, relevant decisions/API docs, expected commands and remaining known gaps.
6. **REVIEW / PR:** docs+source diff, no unrelated changes, CI evidence, rollback; **no silent merge or deploy**.

**Suggested Windows PowerShell smoke commands** (only in checked-out repo with dependencies and appropriate *disposable* DB configured):
~~~powershell
git status --short --branch
git log -1 --oneline
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
# Database integration tests require a disposable PostgreSQL DATABASE_URL:
npm run test:search -w @reposcout/api
npm run test:ranking -w @reposcout/api
npm run test:contribution-discovery -w @reposcout/api
~~~
Do not run migration, integration or cleanup commands against production. The API's standard npm test excludes PostgreSQL integration files; invoke targeted DB scripts explicitly. Heavy tests are optional until environment confirmation.

## Product experiments that must precede feature expansion

| Experiment | Baseline | Desired evidence | Decision |
| --- | --- | --- | --- |
| Actual search tasks | UUID-order current search vs GitHub | Blind Top-5 usefulness + task success | Improve/postpone new modalities |
| Ranking usefulness | Hidden Gems/Rising v1 | Human meaningful discoveries and repeat choice | Keep/promote/de-emphasize |
| Contribution discovery | Observed filtered issues | Open-link freshness + perceived suitability | Maintain or narrow use case |
| Repository detail | GitHub outbound card only | Decision quality before outbound click | Roll out or simplify |
| Fork grouping | All distinct GitHub IDs | Better diversity without hiding maintained forks | Default-collapse or user filter |
| Infrastructure | Current ranking on single VM | p95, SQL count and refresh workload | Bulk read vs materialize vs defer |

## Dependency ordering

Q0 measured baseline → Q1 observation correctness / operations baseline → Q2 relevance search and Q3 ranking performance (can use separate branches but coordinate shared store/schema) → Q4 repository detail/UX → Q5 audited algorithms/fork grouping → Q6 launch validation.

If the current deployed catalog is empty, **do not** spend time perfecting rankings before fixing sample data coverage. If ranking p95 is fine at relevant scale, avoid materialization. If no visitors use a discovery mode, reconsider its navigation prominence instead of adding more features.

**Immediate next safe task after this docs PR:** Q0 baseline, *read-only*. Do not translate the full plan into simultaneous implementation branches.
