# RepoScout Project State

## Product objective
Help visitors discover open-source repositories worth knowing and identify observed public contribution opportunities through factual, explainable signals and community submissions.

## Delivery checkpoint (2026-10-01)
- **A1–A2 / PR #60:** merged into main as `8507a3f4fc076fa96de199f02e87e89a20feac8c`. Explainable Hidden Gems and Rising, deep links, loading/error/empty/pagination, measured evidence; CI #344 and ranking Chromium Review #13 successful.
- **B1 / PR #61:** merged into main as `d9bb7b8ec3dce6afbc024f8af5ff29f81f9ddafd` using a regular merge (B2 ancestry preserved). Typed Phase 8 contribution frontend client, filters, provenance and transport tests; CI #348 successful.
- **B2 / PR #62:** integrated `/contribute` visitor UI and visible catalog navigation on `feat/contribution-explorer-ui-b2`; retargeted to main. Verify post-integration CI + Chromium at the exact branch head before merge; then verify post-merge main.
- B2's underlying standalone implementation CI #354 and Chromium #4 passed all 11 cases; previous docs-only CI #355/Chromium #5 also passed. The integrated four-link navigation introduces one extra 320px browser review.
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

## Next after B2 verification
1. Merge PR #62 only with green exact-head CI and contribution Chromium checks.
2. Verify GitHub main post-merge CI and confirm all four paths and `/contribute` through the production SPA rewrite after deployment.
3. Assess live data collection/snapshot coverage and prioritize follow-up UX from real visitor feedback.
