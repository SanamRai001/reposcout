# RepoScout — Product, UX, Architecture, Algorithms & Operations Audit

**Date:** 2026-10-29  
**Baseline:** main at commit 94eccf7ef03f50b40c602abbbfe2c84ef9865c71  
**Audit type:** broad read-only source / documentation inspection plus review of stated product direction. **No local app, real browser, database benchmark, user study, deployment, or live GitHub ingestion was executed during this audit.**  
**Scope:** Product positioning, workflows, UI and accessibility, API/domain boundaries, PostgreSQL, identity/forks, ranking and search algorithms, issue freshness, security, testing, operations and maintainability.  
**Companion plan:** [QUALITY_IMPROVEMENT_PLAN_2026-10-29.md](QUALITY_IMPROVEMENT_PLAN_2026-10-29.md).  
**Severity:** P0 = address before promoting a public product claim or expanding usage when the issue is observed; P1 = high-priority correctness/core-value; P2 = worthwhile after evidence; P3 = optional. Findings marked *risk* require measurement or reproduction before being called a defect.

## Executive assessment

**RepoScout is an evidence-first GitHub repository discovery prototype with a credible modular-monolith foundation.** The implementation includes a React/Vite catalog, ranked discovery, contribution discovery, submission flow, an Express API, PostgreSQL canonical IDs/metadata/history, moderation, deterministic scoring, evaluators, CI and a single-VM OCI deployment recipe. It has not yet demonstrated that real people find more relevant repositories than using GitHub directly. The largest product problem is a mismatch between the stated promise ("find what fits my need and understand why") and current catalog behavior (lexical matching with UUID ordering and GitHub-outbound cards, without a native detail experience).

**Recommendation:** Keep PostgreSQL, a modular monolith, GitHub IDs, transparent measured-versus-derived labels, existing tests and conservative provider boundaries. Prioritize data freshness, candidate relevance, comprehensible repository detail, ranking performance and a small real-user evaluation set. Do not build general AI chat, a graph database, microservices, a crawler of all GitHub or another formula before those fundamentals work.

**Existing strengths worth protecting**
- GitHub numeric repository ID is unique in the repositories table; normalized owner/name is not treated as immutable identity. Repository writes have timestamps/stale-write guards: migrations/1790008200000_create_repositories.ts and repository-store.ts.
- Submission validation, handoff, private pre-approval storage, atomic moderation and audit events separate ingestible data from public listing: repository-submission-store.ts and moderation migration.
- History is observed and insufficient windows are represented explicitly; model inference is not passed off as GitHub fact: repository-snapshot-store.ts, repository-trend.ts and ranking signal contracts.
- URL-backed filters, browser history, abortable requests, responsive layouts, error/empty/loading states and reduced-motion CSS are genuine UI provisions: App.tsx, RankingExplorer.tsx, ContributionExplorer.tsx and styles.css.
- Unit/integration tests, container smoke, and scripted Chromium mock-fixture reviews exist. Those are meaningful engineering safeguards, not proof of live catalog utility.

## Evidence-based findings

### RS-01 — Core search has no relevance ordering [P1; VERIFIED code]
**Where:** [repository-store.ts](../apps/api/src/repositories/repository-store.ts), searchPage around lines 608–750; [DISCOVERY_RANKING.md](DISCOVERY_RANKING.md).  
**Evidence:** PostgreSQL plainto_tsquery matches owner/name/full-name/description, but results are sorted by r.id ASC. The query constructs a tsvector inline; the project explicitly defers a text-search index migration.  
**Why it matters:** Users searching for a capability can see an arbitrary matching repository before the most relevant one. Matching is not equivalent to ranking. Computing the vector during requests can also create scaling risk.  
**Improvement:** Establish a judged query set; add weighted document vectors (repository name/full name first, topics/description where justified), suitable indexed PostgreSQL full-text search, and relevance-first stable pagination. Compare ts_rank_cd / field weights and optional trigram typo fallback against the existing baseline with EXPLAIN ANALYZE and relevance metrics. Preserve scope-bound cursor behavior and missing-data semantics. **Do not adopt Meilisearch/Typesense until PostgreSQL is measured as inadequate.**

### RS-02 — Ranking work is proportional to the entire catalog per request [P1; VERIFIED code; latency impact UNMEASURED]
**Where:** [repository-ranking-service.ts](../apps/api/src/repositories/repository-ranking-service.ts), listAllListedRepositories, scoreRepository and rankPage.  
**Evidence:** Each ranked-page call reads all listed repositories (batches of 50); then a sequential loop invokes four reader calls per repository (README, contribution evidence, 7d trend and 30d trend), sorts all eligible items, and only then applies page limit/cursor.  
**Why it matters:** Cost is roughly O(N) candidate scans plus O(N) ranking evaluations and up to 4N read operations, even to show a single first-page result. It will be repeated on load more. This can make ranking slow or DB-heavy at modest catalog sizes.  
**Improvement:** Benchmark with 100 / 1,000 / 10,000 seeded listed repositories; capture p50/p95, SQL count and DB time. First introduce bounded bulk fetching / batch reads; if needed materialize formula-versioned, evaluated-at rankings on a schedule with atomic refresh and stable cursor snapshots. The resulting cache must never publish unlisted repositories.

### RS-03 — Live ranking cursor is not a consistent snapshot [P2; VERIFIED known tradeoff]
**Where:** repository-ranking.ts, repository-ranking-service.ts; DISCOVERY_RANKING.md around the live pagination limitation.  
**Evidence:** Cursor binds mode/formula/evaluatedAt/score/id, but every later page recomputes ranks from potentially changed metadata/history.  
**Why it matters:** A result can move around page boundaries, repeat or disappear during pagination.  
**Improvement:** Accept during early usage with explicit UX caveat; address with versioned materialized rank runs only if observable paging instability or performance justifies it. Test score ties, mid-page refresh, formula version rollover and publication changes.

### RS-04 — Issue discovery can retain stale open observations [P1; VERIFIED design limitation; stale examples NOT REPRODUCED]
**Where:** [github-client.ts](../apps/api/src/github/github-client.ts) fetchRepositoryIssues; repository-contribution-issue-ingestion-service.ts; repository-contribution-discovery-store.ts.  
**Evidence:** Fetches one capped recent-updates page (state=all, at most 100 items), filters out pull requests, and upserts returned issues. The ingestion path has no complete "which previously observed issues are no longer open" reconciliation. Discovery filters for stored i.state = 'open'.  
**Why it matters:** A previously observed open issue may stop appearing within the capped newest window; if it later closes, RepoScout can keep showing the old open state until that issue is fetched again. The UI does say "open when observed," which limits misleading claims but does not solve freshness.  
**Improvement:** Explicit bounded TTL/freshness classification and per-issue refresh for displayed opportunities, last-successful-scan timestamps, periodic revalidation of open candidates, tombstone/reconciliation state only when a complete coverage window is proven; never treat omission from a partial GitHub page as closure. Validate on synthetic closed/updated/out-of-window cases.

### RS-05 — Core "Understand" experience is incomplete [P1; VERIFIED code]
**Where:** [App.tsx](../apps/web/src/App.tsx), RepositoryCard around lines 271–350; repository-routes.ts detail/trend endpoints; PRODUCT.md.  
**Evidence:** Cards show basic metadata and lead directly to GitHub; there is no dedicated native repository detail route in apps/web/src/main.tsx. The backend already has GET /api/repositories/:id and a trend route.  
**Why it matters:** RepoScout pays to ingest evidence, but users cannot easily use it to make a before-click decision or compare alternatives; much of the intended differentiation remains inaccessible.  
**Improvement:** Add a simple shareable /repos/:id or /r/:id detail page with identity, use-case summary sourced from factual metadata, observed-at dates, maintenance/snapshot context, contribution readiness and original GitHub CTA. Defer AI summaries, automatic project grading and complex comparison until need is validated. Ensure listed-only access and no unsafe rendering of README markdown.

### RS-06 — First-task UX is overloaded with equal-weight paths [P1 UX HYPOTHESIS, static evidence]
**Where:** App.tsx around lines 630–890, 890–1070; styles.css and contribution.css.  
**Evidence:** Visitors meet a large introduction, four discovery navigation choices, a multi-field filter form, a submission section and repository cards. Contribution Explorer has another extensive filter form. Some secondary evidence copy uses ~0.65–0.76rem CSS.  
**Why it matters:** A novice may not know what to enter or why "Hidden Gems", "Rising", and "Find contributions" differ. Form complexity and small text increase cognitive load. **Actual visual hierarchy, readability and interaction cost require a browser/user study; this audit did not visually test the running UI.**  
**Improvement:** Lead with one task-oriented search bar ("Find a project for..."), example searches, then progressive disclosure for advanced filters. Make results scannable: one-sentence purpose, match explanation, freshness, language/license, and a single next action. Keep four discovery modes accessible without turning them into equal-weight onboarding tasks. Verify 320px/375px/768px/desktop and keyboard-only flows before design sign-off.

### RS-07 — Ranking weights may reward documentation and size rather than utility [P1 algorithm HYPOTHESIS]
**Where:** repository-hidden-gem-score.ts (maintenance 35, README 20, CONTRIBUTING 20, community readiness 20, momentum 5, up-to-25 popularity penalty); repository-rising-score.ts (7d/30d star and fork deltas).  
**Why it matters:** A polished template with files present can outrank a very useful but minimally documented library. Maintenance based on last push is easy to game and poor for intentionally stable software. Absolute star/fork deltas can favor existing visible projects; a large project and a new niche project are not comparable. Hard thresholds and missing-evidence gates can distort discovery.  
**Improvement:** Keep v1 formulas as explicit experiments, not quality verdicts. Build judged samples and adversarial examples (template, archived gem, security hotfix, mass-star spike, well-maintained mature project, meaningful fork, sparse-history startup). Compare normalized/percentile, growth-rate and cohort-aware variants only when evidence improves relevance and doesn't amplify gaming. Keep score versions immutable and show coverage uncertainty. Do not present a "100-point quality" score.

### RS-08 — No demonstrated improvement over default GitHub discovery [P1 product evidence gap]
**Where:** PRODUCT.md/README.md product promise; evaluation suites in apps/api/src/evaluation.  
**Evidence:** The repository contains deterministic synthetic ranking/semantic benchmarks and Chromium fixture tests, but no observed user-task success, real comparative GitHub query judgments or retention data in the reviewed source.  
**Why it matters:** "Explainable" is valuable but not a competitive moat unless results are more useful. GitHub itself provides repository, topic and activity discovery.  
**Improvement:** Choose a first audience (e.g. backend developers finding self-hosted tools / OSS implementations to study). Run 30–50 intent-labeled queries and 5–8 task-based sessions; blind-judge Top-5 against GitHub baseline. Track success, time-to-first-useful-repo, answer usefulness, stale result rate and user feedback without collecting unnecessary personal data. Kill low-value modes if they fail to help.

### RS-09 — Fork identity and originality need separate semantics [P2; VERIFIED model gap]
**Where:** initial repository migration (github_repository_id UNIQUE; is_fork boolean), github-client.ts and repository-store.ts.  
**Evidence:** Canonical GitHub identity prevents two rows for the *same* GitHub repository, even across rename/transfer. Distinct forks have distinct GitHub IDs. No stored parent/upstream relationship or meaningful-divergence signal was identified in the audited schema.  
**Why it matters:** Ten identical forks can crowd search; suppressing all forks loses valuable maintained forks.  
**Improvement:** Preserve stable GitHub ID uniqueness; store optional upstream GitHub repo ID / fork relationship with source and timestamp, default-collapse related forks or filter unmodified forks, but retain independently maintained forks with meaningful divergence. Consider branch-ahead/behind, independent releases, recent code activity, distinct readme/description as *bounded evidence*. Do **not** use a repository-wide hash as the global identifier: hashes are expensive, branch-specific, unstable and conflate identity with version. Validate renamed repos, transferred repos, fork-before-upstream-rename, disconnected forks and unlisted parents.

### RS-10 — Operational freshness is a runbook, not guaranteed automation [P1 deployment/operational risk]
**Where:** deploy/compose.yaml (postgres, migrate, api, web); docs/OCI_ALWAYS_FREE_DEPLOYMENT.md; maintain-repository-snapshots.ts and ingest-contribution-issues.ts.  
**Evidence:** One-shot maintenance/ingestion CLIs exist; the compose stack does not itself run a scheduler. Deployment docs instruct operators to schedule and back up separately. No evidence of a live configured timer/alerts/backups was obtained.  
**Why it matters:** A healthy HTTP response with a stale or empty catalog is not a useful discovery service.  
**Improvement:** Verify actual production first. Add documented, bounded external scheduling with lock, retry, rate-budget, last-success marker and alert on missed runs. Test restoring backups in a disposable environment. Set SLOs around ingestion age, issue age, snapshot coverage and ranking/query latency. Preserve the Oracle Always Free single-VM model until traffic justifies more.

### RS-11 — Public submission abuse controls are process-local [P2; VERIFIED scope limitation]
**Where:** repository-submission-rate-limiter.ts and env.ts.  
**Evidence:** In-memory buckets keyed by HMAC-of-IP are appropriate for the current single API instance and reset at restart; protection does not coordinate across replicas.  
**Why it matters:** Rate limits become inconsistent if scaled horizontally or if instances restart frequently.  
**Improvement:** Keep the single-VM design for now, document limitations, use trustworthy proxy hop settings, and move to edge/shared-store rate limits only when adding instances or observing abuse. Add retry/429 and proxy tests. Do not add Redis merely for anticipated scale.

### RS-12 — Maintainability: presentation and process documentation are oversized [P2; VERIFIED]
**Where:** App.tsx (~1,200 lines), styles.css (~1,500 lines), github-client.ts (~1,100 lines), repository-submission-store.ts (~900 lines), ARCHITECTURE.md and DECISIONS.md.  
**Why it matters:** Mixed UI responsibilities, transport, filters, loading and submission states are harder to review and regress. Numerous phase reports risk making the latest decision hard to discover.  
**Improvement:** Refactor by behavior, not arbitrary line count: CatalogPage, SearchForm, SearchResults, SubmissionPanel, shared identity/freshness/evidence components; isolate GitHub transport/normalization per API family; retain direct SQL where transaction semantics matter. Keep docs/PROJECT_STATE.md the single current checkpoint, link to dated audit/decision docs, and mark superseded plans rather than spawning duplicate state files.

### RS-13 — Accessibility and polish have positive groundwork but incomplete evidence [P2; verification gap]
**Where:** styles.css has reduced motion and responsive overrides; UI uses labels, headings, aria-live; review scripts use Chromium mock fixtures.  
**Risk:** Several font sizes are small; no automated WCAG 2.2 AA audit, color-contrast report, keyboard traversal or screen-reader review for live workflows was established by this read-only pass.  
**Improvement:** Test search/filter error handling, results focus changes, pagination, details disclosures, empty state, small viewport text, keyboard order and screen-reader names. Use axe-core + Playwright with manual keyboard/VoiceOver/NVDA review; test 200% and 400% zoom. Avoid claiming accessibility pass from responsive screenshot tests alone.

### RS-14 — Operational/security controls need realistic release gates [P1 verification gap, not an identified exploit]
**Where:** http-security.ts, moderation-reviewer-auth.ts, config/env.ts, .github/workflows/ci.yml, deploy compose and Caddy config.  
**Positive evidence:** strict moderation bearer token validation, constant-time hash comparison, restricted public routes, JSON size cap, headers, no-store on sensitive routes, dependency audit CI and production separation.  
**Outstanding evidence:** actual HTTPS/DNS/proxy config, secret rotation procedure, recovery tests, operational rate/DoS limits for read-heavy rankings, per-endpoint query latency and availability were not observed. Static reviewer bearer credentials are workable for very small trusted operations but make revocation/session UX manual.  
**Improvement:** Document external edge protections, record procedures to rotate reviewer tokens, verify all public queries are bounded, check logged error text for secret leakage, add query/connection timeouts where needed, and conduct real deployment review. Use branch protection/checks and backups; do not migrate to OAuth merely for architectural appearance.

### RS-15 — Content/SEO and discovery feedback are not yet productized [P2]
**Where:** web main.tsx (two route experiences); repository cards link externally; package/scripts contain no site-generation or analytics implementation seen in tree.  
**Why it matters:** Individual repository pages, indexing/discoverability, query learning, and alternatives are critical if the project wants independent organic use.  
**Improvement:** Add detail pages first; then consider canonical URLs, crawlability, privacy-preserving product events, relevant alternative links and sitemap only when content coverage and maintenance are trustworthy. Do not enable unbounded search-engine indexing of thin, stale or duplicate pages.

## Critical cross-cutting observations

### Architecture
The modular-monolith / Postgres shape is appropriate; **do not split it into microservices**. The problem is costly cross-module read orchestration and inconsistent freshness guarantees, not a lack of framework layering. Prefer one public API, measured SQL queries, deterministic workers/CLIs and explicit publication invariants. For the first reliability upgrade, introduce one observation policy: provenance, latest success, staleness state, confidence boundaries, and safe fallback.

### UX / visual direction
The dark Scout Signal brand is coherent and the code visibly contains responsive/reduced-motion support. Yet an attractive interface can still fail when the primary task is unclear. A premium design for this product needs search-first hierarchy, task-led examples, obvious match reasons, useful metadata hierarchy, and "last observed" distinctions. Ranking score meters should be secondary to what the user will learn or use. Verify visually before prescribing a drastic redesign.

### Algorithm design
Keep retrieval separate from scoring:
1. Candidate retrieval: PostgreSQL lexical/structured filters, indexed and relevance ordered.
2. Evidence enrichment: bulk current metadata + bounded history + documented missingness.
3. Optional ranking: explainable, versioned, validated on real judged cases.
4. Publication gate: listed-only, moderated and freshness-aware.
5. Feedback: anonymized utility judgments, not opaque "AI quality" claims.

Avoid universal rank/score claims, unbounded per-result GitHub calls, and search-index operations dependent on a paid model provider. Evaluate embedding retrieval only after offline relevance gain exceeds simpler lexical improvements.

### User-outcome validation
Proposed leading indicators: Top-5 judged relevance, task-completion rate, time to first useful outbound click, unique useful repos per search, zero-results rate and valid open-opportunity freshness. Guardrails: p95 search/ranking latency, DB queries per page, GitHub quota use, age of observations, error rate, spam approval escape rate and accessibility regressions.

## Existing ecosystem — reuse before rebuilding
- [PostgreSQL full-text search](https://www.postgresql.org/docs/current/textsearch.html): first choice for weighted indexed retrieval and deterministic, transactionally consistent search; no new service.
- [Meilisearch Community Edition](https://github.com/meilisearch/meilisearch): MIT-licensed alternative for typo tolerance/faceting if Postgres fails measured requirements; introduces a search index and synchronization responsibilities. Check edition/license conditions.
- [Typesense](https://github.com/typesense/typesense): strong alternate search engine but GPL-3.0 core and separate operational footprint; evaluate licensing and sync cost rather than defaulting to it.
- [ecosyste.ms repos](https://github.com/ecosyste-ms/repos) and [libraries.io](https://github.com/librariesio/libraries.io): study normalization, repository metadata and ecosystem discovery; review dataset terms, provenance, API quotas and AGPL obligations before copying or integrating components.
- [axe-core](https://github.com/dequelabs/axe-core), [Playwright](https://playwright.dev): automated accessibility and E2E checks, augmented by manual keyboard/screen reader testing.
- Existing PostgreSQL + migration tool + tests: reuse first. No blanket switch to Next.js, Redis, vector database or external search engine.

## Proposed priorities
**First:** RS-10 production evidence/freshness baseline; RS-01 query relevance and index; RS-02 ranking performance; RS-04 issue observations freshness.  
**Next:** RS-05 native repository detail; RS-06 measured UX simplification; RS-08 user comparison benchmark.  
**Then:** RS-07 ranking weight redesign only if measurements justify; RS-09 fork grouping, RS-12 refactor, RS-13 accessibility, RS-14 operational hardening; RS-15 discovery/SEO if the product earns traffic.

## Explicit verification boundaries and risks
- **VERIFIED (static source):** exact code paths and contracts described above, not deployed behavior.
- **HYPOTHESIS / risk:** observed user confusion, actual ranking slowness, fork spam prevalence, formula bias impact, current stale issue examples, and production security exposure. Require targeted evidence.
- **UNKNOWN:** current live host/traffic, catalog size, scheduled operations, branch protection, real backups, database query plans, Lighthouse/WCAG outcomes and how often a user finds a truly better repository through RepoScout.
- **Not executed:** local npm test/typecheck/build, production smoke, PostgreSQL EXPLAIN, automated browser tests, human user studies. Existing recorded CI results in docs/PROJECT_STATE.md do not validate this newly written documentation or current production.
- Every optimization must preserve listed-only reads, original GitHub identity, submission/moderation audit, backwards-compatible API responses where practical, URL-bound filters and missing-data provenance.

**Decision required before algorithm overhaul:** choose a narrow initial audience and establish a judged dataset. Without that, changing weights or adopting embeddings amounts to tuning arbitrary numbers.
