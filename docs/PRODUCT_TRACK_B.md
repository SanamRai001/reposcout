# RepoScout Product Track B — Contribution Explorer

## Delivery topology (2026-10-01)

- A1–A2: [PR #60](https://github.com/SanamRai001/reposcout/pull/60), ready for review; independent ranking UI.
- **B1 transport:** [PR #61](https://github.com/SanamRai001/reposcout/pull/61), `feat/contribution-explorer-client-b1` from `main@387936acfe45eced56eb33a4092183ea525fbfd1`. CI #347 and final documentation-head CI #348 both successful. PR ready for review, **unmerged**.
- **B2 UI:** [stacked PR #62](https://github.com/SanamRai001/reposcout/pull/62), `feat/contribution-explorer-ui-b2` with base `feat/contribution-explorer-client-b1`; it contains only B2 changes in its PR diff. No changes to existing `App.tsx` or public search/ranking API. Awaiting review and appropriate merge sequence.
- Do not merge PRs silently. First approve/merge #60 and #61 independently, then retarget #62 to updated `main` and reverify. This B2 implementation's standalone route intentionally avoids a conflict with #60.

## Backend contract (inspected before implementation)
Public `GET /api/contributions/issues` is mounted by `apps/api/src/app.ts`; it returns stored open GitHub issues from the listed curated catalog. Optional filters:
- `unassigned`, `unlocked`, `goodFirstIssue`, `helpWanted`: nullable booleans.
- `language`: normalized max 64 chars.
- `updatedWithinDays`: 1–3650.
- `contributing`: `present`, `absent`, `missing`, `not_applicable`.

Bounded page size 1–50, opaque cursor bound to filters and a fixed evaluation timestamp. Each item contains repository/issue facts, `contribution-signals-v1` with explicit missing-source observations, plus `contribution-recommendation-v1` evidence, cautions and limitations. `consider` and `needs_review` are evidence flags, **not suitability or easiness guarantees**. Data is an observed snapshot; the live GitHub issue may have changed.

## Phase B1 — complete, ready for review
- `apps/web/src/lib/contribution-discovery-client.ts`: typed transport, runtime contract validation for open issues and signal/recommendation vocabulary, filter/cursor encoding, abort, safe errors.
- `apps/web/src/lib/contribution-discovery-client.test.ts`: normal, empty, filtered, malformed, missing-source, cursor, error and cancellation cases.
- CI #347 (`36884147633`) passed all 34 verification steps. Documentation-only CI #348 also passed.
- No backend, DB, vendor account or production AI changes.

## Phase B2 — implemented in stacked PR #62
- `/contribute`: dedicated public web page selected by `main.tsx` (no library/router dependency).
- `contribution-navigation.ts` and tests: round-trip seven explicit URL filters, reject malformed shared links instead of silently broadening scope.
- `ContributionExplorer.tsx` and `contribution.css`: accessible Apply/Clear form, Back/Forward restore, issue cards with observed state and timestamps, evidence, cautions and unmeasured factors, and direct GitHub issue links.
- Aborted initial/paginated requests, genuine empty/error/retry, load-more by opaque filter-bound cursor, deduplicated repository/issue IDs, and restart when evaluation snapshot changes or paging fails.
- UI makes no score, guarantee of beginner suitability, or inferred maintainer responsiveness claim.
- `ContributionExplorer.test.tsx`: static rendering and language/caution/missing-signal tests.
- `scripts/review-contribution-browser.mjs` + `.github/workflows/contribution-browser-review.yml`: production Vite preview tested in actual Chromium with mocked Phase 8 transport; screenshot artifact retained.
- Normal CI #351 (run `36885162287`) **success**, 34 steps; Contribution Browser Review #1 (run `36885162356`) **success**, ten tests, screenshot artifact `11175036093`: https://github.com/SanamRai001/reposcout/actions/runs/36885162356/artifacts/11175036093
- Reviewed saved 320, 375, 768, and 1440px captures: filters, cards, evidence disclosure and footer display without visible horizontal clipping. Browser test explicitly checked no document overflow.
- This documentation follow-up is not itself a tested implementation commit; confirm its own final-head checks before marking PR #62 ready.

## Important limitations
- Browser fixtures are controlled synthetic contract examples, **not** a claim that the live public catalog has issue inventory. Real Phase 8 API remains covered by its independent PostgreSQL integration gates.
- The B2 route is directly accessible at `/contribute`. A discovery-page navigation link is intentionally deferred until PR #60 is merged, to avoid editing the same `App.tsx` in two parallel PRs.
- Production SPA hosting must rewrite `/contribute` to the web app's `index.html`; Vite preview's fallback was tested.
- No model calls or secrets introduced. Jev remains parked, and Phase 9B.1B live evaluation remains separate and pending.

## Exact next actions
1. Verify PR #62 final documentation-head checks.
2. Have #60 and #61 reviewed/merged when approved; ensure post-merge CI on `main`.
3. Retarget #62 onto updated main, verify the standalone route and rerun Chromium/CI before merge.
4. Add a small discovery navigation link to `/contribute` in a follow-up (after A2 lands), then consider a richer per-repository issue detail view if useful.
