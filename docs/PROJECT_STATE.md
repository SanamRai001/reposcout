# RepoScout Project State

## Objective
Expose existing evidence-backed discovery capabilities to RepoScout visitors. Product track A: Hidden Gems and Rising using the established Phase 7D deterministic ranking API, without replacing existing catalog/search or changing backend scoring.

## Branch
- Working branch: `feat/discovery-ranking-client-a1`; draft PR #60 against `main`.
- Branch base: `main@387936acfe45eced56eb33a4092183ea525fbfd1` (merged PR #59, 2026-10-01).
- Jev (TypeSafe) is parked indefinitely; not an active dependency or blocker.

## Completed phase / current checkpoint
- **A1: ranking frontend transport and tests** — implemented, GitHub CI #321 success; documentation-only follow-up CI #322 success.
- **A2: ranking discovery UI** — implementation committed in the same draft PR; CI and responsive browser review pending.

## A2 changes
- Added `repository-ranking-navigation.ts` and tests for explicit URL modes:
  `?view=hidden_gems`, `?view=rising`, with missing/unknown modes falling back to catalog.
- Added responsive navigation in `App.tsx`, with browser history/popstate restoration.
- Existing catalog search and submission form remain available; catalog requests are suspended while ranking views are active.
- Added `RankingExplorer.tsx`: mode-specific headings; real ranking scores and detailed formula components; Hidden Gems popularity adjustment and optional momentum coverage; Rising window/provenance explanations; measured eligibility/evaluation metadata; loading, empty, initial-error/retry and paginated load-more/error/retry states.
- Initial requests and load-more requests are abortable; page results deduplicated by repository ID, and mismatched evaluation/formula pagination rejected.
- Added responsive ranking styles, visible keyboard focus and reduced-motion-compatible transitions.
- Added static presentation tests for both ranking modes and cards, plus URL navigation tests.
- No API/schema/migration/dependency/formula/semantic search change. No API token or production AI call.

## Verification
- Read backend Phase 7D ranking response and score/evidence contracts and current frontend source before implementing.
- A1 PR #60 CI #321 run ID `36878516237`: success (34 successful steps).
- A1 state-only follow-up CI #322 run ID `36878732057`: success.
- A2 GitHub CI: **pending verification** on latest implementation/doc checkpoint; do not claim green before exact-head checks finish.
- Browser interaction/responsive screenshot verification has **not** been run; static rendering tests are not a replacement.
- PR remains a draft and is **not merged**.

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
1. Verify A2 PR #60 CI against final head; address any failures in this branch.
2. Review ranking UI at mobile/tablet/desktop in a real browser, including deep-link and Back/Forward, error/empty states, load-more cursor and keyboard navigation.
3. Decide whether to merge PR #60 only after checks/review. Do not auto-merge.
4. After that, Product track B: Contribution Explorer frontend using the completed Phase 8 API (separate branch).
