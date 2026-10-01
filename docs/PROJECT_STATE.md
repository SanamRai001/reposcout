# RepoScout Project State

## Product objective
Help visitors discover open-source repositories worth knowing and identify observed public contribution opportunities through factual, explainable signals and community submissions.

## Delivery checkpoint (2026-10-01)
- **A1–A2 / PR #60:** merged into main as `8507a3f4fc076fa96de199f02e87e89a20feac8c`. Explainable Hidden Gems and Rising, deep links, loading/error/empty/pagination, measured evidence; CI #344 and ranking Chromium Review #13 successful.
- **B1 / PR #61:** merged into main as `d9bb7b8ec3dce6afbc024f8af5ff29f81f9ddafd` using a regular merge (B2 ancestry preserved). Typed Phase 8 contribution frontend client, filters, provenance and transport tests; CI #348 successful.
- **B2 / PR #62:** merged into `main` as `02e947470da22e730a62aec3a63eb455b9a292b7`. Contribution Explorer `/contribute` and visible fourth catalog navigation link now ship in repository source. Exact PR head `149324fb34772985682be92462d618bb02534f33` passed normal CI #359 (34 steps), Ranking Chromium #15 and Contribution Chromium #7 (12 cases).
- **Post-merge `main` CI #360:** run `36889528582`, completed successfully, 34 passing steps, zero failures. All PRs #60, #61 and #62 independently confirmed merged.
- No live production deployment or populated public issue inventory is claimed from mocked browser fixtures.

## User-visible capabilities
- Existing catalog, lexical search/filter-only discovery, shareable query scopes and community repository submission.
- Hidden Gems and Rising based on stored deterministic formula evidence, not universal judgments. Rising needs observed historical snapshots.
- Contribution Explorer: URL-backed evidence filters and observed open GitHub issues with source metadata, cautions, limitations, and a direct live GitHub issue link. `consider` is a formula evidence flag, not proof an issue is beginner-friendly.
- All four discoverable paths stay readable at 320px: catalog, Hidden Gems, Rising, Find contributions.
- Production `/contribute` route requires the web host's SPA fallback/rewrite to `index.html`.

## Verification and risk boundaries
- Normal CI: lint, TypeScript, frontend/backend tests, build, security audit, benchmark checks, PostgreSQL migration and persistence/integration gates.
- Chromium smoke suites use mocked API fixtures and save screenshots; they validate UI, not actual freshness or quantity of the live public catalog.
- No B2 backend API/schema/migration change or external model call.
- No automatic prediction of issue difficulty, maintainer responsiveness or contribution success.
- Existing moderation publication and data provenance boundaries must remain intact.

## Separate technical track
- Phase 9A, 9B, 9B.1A complete; 9B.1B credentialed live OpenAI embedding benchmark/adoption decision still pending.
- Phase 9C+ blocked until credible real-provider evaluation justifies adoption. Deterministic public search remains unchanged.
- TypeSafe/Jev experiment is parked indefinitely; do not resume it automatically. Do not paste credentials into chat.

## Next after B2 merge
1. Verify production hosting provides an SPA fallback for `/contribute`, then deploy updated `main` separately when ready.
2. Smoke-check all four discovery paths on the deployed site: catalog, Hidden Gems, Rising, Find contributions. Check filters, initial data and GitHub issue links against live endpoints.
3. Audit actual catalog/issue ingestion coverage and 7/30-day Rising snapshots; empty states are expected when history has not yet accumulated.
4. Prioritize next UX changes from real visitor data. The docs-only checkpoint commit after merge must also pass its own CI.
