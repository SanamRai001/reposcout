# RepoScout Project State

## Objective
Expose existing evidence-backed discovery capabilities to RepoScout visitors. Product track A: Hidden Gems and Rising using the established Phase 7D deterministic ranking API, without replacing existing catalog/search or changing backend scoring.

## Branch
- Working branch: `feat/discovery-ranking-client-a1`; PR #60 against `main` (awaiting final review/merge).
- Branch base: `main@387936acfe45eced56eb33a4092183ea525fbfd1` (merged PR #59, 2026-10-01).
- Jev (TypeSafe) is parked indefinitely; not an active dependency or blocker.

## Completed phase / current checkpoint
- **A1: ranking frontend transport and tests** — implemented, GitHub CI #321 success; documentation-only follow-up CI #322 success.
- **A2: ranking discovery UI + browser verification** — implemented, Chromium-reviewed and passing all nine browser cases on `36e820c05876d5bb2efcd528a618f93380aff2a0`. CI #342 passed. Awaiting PR review/merge.

## A2 changes
- Added `repository-ranking-navigation.ts` and tests for explicit URL modes:
  `?view=hidden_gems`, `?view=rising`, with missing/unknown modes falling back to catalog.
- Added responsive navigation in `App.tsx`, with browser history/popstate restoration.
- Existing catalog search and submission form remain available; catalog requests are suspended while ranking views are active.
- Added `RankingExplorer.tsx`: mode-specific headings; real ranking scores and detailed formula components; Hidden Gems popularity adjustment and optional momentum coverage; Rising window/provenance explanations; measured eligibility/evaluation metadata; loading, empty, initial-error/retry and paginated load-more/error/retry states.
- Initial requests and load-more requests are abortable; page results deduplicated by repository ID, and mismatched evaluation/formula pagination rejected.
- Added responsive ranking styles, visible keyboard focus and reduced-motion-compatible transitions.
- Added static presentation tests for both ranking modes and cards, plus URL navigation tests.
- Added a standalone Chromium smoke review and `.github/workflows/ranking-browser-review.yml` serving the production Vite bundle with mocked HTTP fixtures. It saves screenshots on GitHub Actions.
- Browser review covers deep-link/Back/Forward, 320/375/768/1440px render/no document overflow, tab-label visibility, keyboard-operable evidence disclosure, real empty/error/retry, paginated cursor/deduplication, and stale-cursor restart.
- Fixed the 320px partially clipped navigation by presenting all three fully readable tabs over two rows; fixed nested route interception in the browser fixture.
- No API/schema/migration/dependency/formula/semantic search change. No API token or production AI call.

## Verification
- Read backend Phase 7D ranking response and score/evidence contracts and current frontend source before implementing.
- A1 PR #60 CI #321 run ID `36878516237`: success (34 successful steps).
- A1 state-only follow-up CI #322 run ID `36878732057`: success.
- A2 CI #328 and #329 passed prior checkpoints; final verified implementation CI #342 (run `36882822998`) **success**, 34 successful steps, zero failures, at commit `36e820c05876d5bb2efcd528a618f93380aff2a0`.
- Chromium Browser Review #11 (run `36882823109`): **success**, nine browser cases at that same commit, no failures. Screenshot artifact ID `11171389781`: https://github.com/SanamRai001/reposcout/actions/runs/36882823109/artifacts/11171389781
- Manually inspected generated 320px, 375px, 768px and 1440px PNGs. Ranking cards, explanation details and submission form remain readable; narrow nav fix shows all tabs. No visible clipping in reviewed captures.
- Browser fixtures are mocked, not claims of live production catalog availability. Real backend ranking endpoint has independent PostgreSQL integration tests.
- This project-state update is documentation-only and lands after the tested code checkpoint; confirm its resulting PR checks separately.
- PR #60 is unmerged pending review; do not auto-merge.

## Risks / decisions
- Ranking scores are explicit, formula-specific discovery signals, not universal repository quality.
- Rising needs real historical snapshot windows. A freshly seeded catalog can produce an honest zero-eligible empty view.
- Cursor evaluation time is fixed by backend; source repository evidence is not an immutable snapshot. Data refresh can move results between pages.
- Ranking service makes several database reads per listed repository; profile latency with real catalog volume.
- No synthetic repo values are presented as live data.
- Existing search/filters and moderation publication boundaries are unchanged.

## Parallel technical track (unchanged)
- Phase 9A, 9B, 9B.1A complete.
- Phase 9B.1B real OpenAI embedding benchmark and ADOPT/DEFER decision remain pending.
- Phase 9C onward blocked/deferred until evidence justifies adoption; deterministic public search stays unchanged.
- To evaluate later: GitHub Actions repository secret `OPENAI_API_KEY`; manual `Semantic Retrieval Live Evaluation` with `text-embedding-3-small`, 1536 dimensions, three runs. Never put credential text in chat. Jev is not to be resumed automatically.

## Exact next phase
1. Confirm documentation-only follow-up CI remains green, then mark PR #60 ready for human review (without auto-merging).
2. Review the PR and screenshot artifact, then merge A1–A2 when explicitly approved.
3. After merge, start Product track B — Contribution Explorer frontend using the completed Phase 8 API, on a fresh branch from updated `main`.
4. Independently, Phase 9B.1B's credentialed benchmark remains pending; do not restart Jev.
