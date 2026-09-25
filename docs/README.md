# RepoScout Documentation

Start here if you are contributing to the project.

## Product

- [PRODUCT.md](PRODUCT.md) — problem, users, differentiation, principles.
- [MVP_SCOPE.md](MVP_SCOPE.md) — what the first release includes and excludes.
- [ROADMAP.md](ROADMAP.md) — phased delivery plan.
- [BRAND_GUIDE.md](BRAND_GUIDE.md) — visual identity, voice, color, motion, and UI guardrails.

## Engineering

- [ARCHITECTURE.md](ARCHITECTURE.md) — current system direction and production concerns.
- [DATA_MODEL.md](DATA_MODEL.md) — canonical repository, snapshot, submission, and moderation model.
- [DISCOVERY_RANKING.md](DISCOVERY_RANKING.md) — discovery modes, explainability, and scoring constraints.
- [JEV_INTELLIGENCE_ARCHITECTURE.md](JEV_INTELLIGENCE_ARCHITECTURE.md) — Jev decision-layer evaluation, data ownership, fallback, moderation, and reranking boundaries.
- [DECISIONS.md](DECISIONS.md) — project decision log.
- [PHASE_1A_PROJECT_SKELETON.md](PHASE_1A_PROJECT_SKELETON.md) — application foundation checkpoint.
- [PHASE_1B1_PERSISTENCE_FOUNDATION.md](PHASE_1B1_PERSISTENCE_FOUNDATION.md) — PostgreSQL connection, migrations, readiness, and reproducible installs.
- [PHASE_1B2A_REPOSITORIES_SCHEMA.md](PHASE_1B2A_REPOSITORIES_SCHEMA.md) — canonical repository identity schema and migration verification.
- [PHASE_1B2B_REPOSITORY_PERSISTENCE.md](PHASE_1B2B_REPOSITORY_PERSISTENCE.md) — idempotent repository writes, lookup behavior, and stale-sync protection.
- [PHASE_2A_GITHUB_INGESTION.md](PHASE_2A_GITHUB_INGESTION.md) — repository reference parsing, GitHub API validation, and single-repository ingestion.
- [PHASE_2B_INGESTION_OPERATIONS.md](PHASE_2B_INGESTION_OPERATIONS.md) — refresh policy, retry behavior, non-destructive unavailable handling, observability, and internal ingestion CLI.
- [PHASE_3A_REPOSITORY_CATALOG_API.md](PHASE_3A_REPOSITORY_CATALOG_API.md) — bounded catalog pagination and canonical repository list/detail API.
- [PHASE_3B_REPOSITORY_CATALOG_WEB.md](PHASE_3B_REPOSITORY_CATALOG_WEB.md) — first real catalog browsing UI with loading, empty, error, and load-more states.
- [PHASE_3C_REPOSITORY_METADATA.md](PHASE_3C_REPOSITORY_METADATA.md) — authoritative measured GitHub metadata, transactional persistence, and catalog exposure.
- [PHASE_3D1_README_CONTENT_FOUNDATION.md](PHASE_3D1_README_CONTENT_FOUNDATION.md) — bounded README evidence storage, provenance, validation, and independent refresh.
- [PHASE_3D2_CONTRIBUTION_EVIDENCE.md](PHASE_3D2_CONTRIBUTION_EVIDENCE.md) — GitHub community-file evidence, repository-local security provenance, and bounded refresh.
- [PHASE_3E1_JEV_EVALUATION_HARNESS.md](PHASE_3E1_JEV_EVALUATION_HARNESS.md) — provider-neutral Jev benchmark, replayable result schema, and transparent evaluation metrics.
- [PHASE_3E2_LIVE_JEV_ADAPTER.md](PHASE_3E2_LIVE_JEV_ADAPTER.md) — verified TypeSafe wire contract, live Jev provider adapter, and credential-gated smoke evaluation.
- [PHASE_4A_LEXICAL_SEARCH.md](PHASE_4A_LEXICAL_SEARCH.md) — deterministic PostgreSQL lexical search, query-bound cursors, and backend discovery boundaries.
- [PHASE_4B1_SCALAR_SEARCH_FILTERS.md](PHASE_4B1_SCALAR_SEARCH_FILTERS.md) — exact language/license/fork/archive filters and full search-scope cursor binding.
- [PHASE_4B2_TOPIC_STAR_FILTERS.md](PHASE_4B2_TOPIC_STAR_FILTERS.md) — all-topic containment, inclusive star ranges, and expanded cursor scope.
- [PHASE_4B3_FILTER_ONLY_DISCOVERY.md](PHASE_4B3_FILTER_ONLY_DISCOVERY.md) — optional lexical query, filter-only discovery, and nullable-query cursor scope.
- [PHASE_4C_WEB_DISCOVERY_UI.md](PHASE_4C_WEB_DISCOVERY_UI.md) — URL-backed browser discovery, structured controls, and deterministic load-more behavior.
- [PHASE_5A_SUBMISSION_INTAKE.md](PHASE_5A_SUBMISSION_INTAKE.md) — URL-only community submission intake, duplicate protection, persistence, and API boundaries.
- [PHASE_5B1_SUBMISSION_VALIDATION.md](PHASE_5B1_SUBMISSION_VALIDATION.md) — deterministic GitHub validation, canonical-ID duplicate detection, and retryable provider failures.
- [PHASE_5B2A_VALIDATION_ORCHESTRATION.md](PHASE_5B2A_VALIDATION_ORCHESTRATION.md) — bounded internal validation batches, retry observability, and rate-limit stop behavior.
- [PHASE_5B2B_EVIDENCE_HANDOFF.md](PHASE_5B2B_EVIDENCE_HANDOFF.md) — VALID-submission handoff into canonical ingestion, README/contribution evidence, durable completion, and retry boundaries.
- [PHASE_5C1_MODERATION_FOUNDATION.md](PHASE_5C1_MODERATION_FOUNDATION.md) — unlisted pre-approval repositories, atomic moderation/publication, and append-only decision audit.
- [PHASE_5C2_PROTECTED_MODERATION_API.md](PHASE_5C2_PROTECTED_MODERATION_API.md) — trusted reviewer Bearer auth, protected queue/decision routes, and authenticated audit identity.
- [PHASE_5D_SUBMISSION_WEB_UI.md](PHASE_5D_SUBMISSION_WEB_UI.md) — public URL-only Add a Repository UI, submission states, retry behavior, and moderation expectations.
- [PHASE_5E1_SUBMISSION_RATE_LIMITING.md](PHASE_5E1_SUBMISSION_RATE_LIMITING.md) — bounded public submission rate limiting, proxy-safe client identity, and stable 429 behavior.
- [PHASE_5E2_SUBMISSION_ABUSE_CONTROLS.md](PHASE_5E2_SUBMISSION_ABUSE_CONTROLS.md) — repository-level terminal resubmission cooldown, generic public state, and database lookup boundary.
- [PHASE_5E3_SUBMISSION_RETENTION.md](PHASE_5E3_SUBMISSION_RETENTION.md) — conservative workflow retention, dry-run cleanup operations, and audit-preservation boundaries.
- [PHASE_5E4_LAUNCH_SECURITY_OBSERVABILITY.md](PHASE_5E4_LAUNCH_SECURITY_OBSERVABILITY.md) — correlation, safe operational events, dependency security, privacy review, and residual launch risks.
- [PHASE_6A_SNAPSHOT_PERSISTENCE.md](PHASE_6A_SNAPSHOT_PERSISTENCE.md) — daily append-only repository metric history, UTC idempotency buckets, and persistence verification.
- [PRIVACY.md](PRIVACY.md) — application privacy and data-handling behavior.
- [PROJECT_STATE.md](PROJECT_STATE.md) — concise current branch, completed phase, verification, risks/decisions, and next checkpoint.

## Community

- [COMMUNITY_GUIDELINES.md](COMMUNITY_GUIDELINES.md) — repository eligibility, self-submission, moderation, and ranking integrity.
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — how beginners and engineers can contribute.

## Documentation rule

When implementation materially changes a documented product or architectural decision, update the relevant document in the same pull request.
