# RepoScout Project State

## Objective
Make RepoScout's existing evidence-backed discovery capabilities accessible in the web product, beginning with Hidden Gems and Rising. Preserve the existing deterministic catalog and search behavior while the separate semantic evaluation remains pending.

## Branch and base
- Working branch: `feat/discovery-ranking-client-a1`
- Branched from `main@387936acfe45eced56eb33a4092183ea525fbfd1` (merged PR #59, 2026-10-01).
- PR #59 parked Jev indefinitely. Jev is not a blocker or an active next phase.

## Completed phase
Product track **A1 — ranking frontend transport and tests**: implemented and branch CI verified in PR #60.

The established backend Phase 7D endpoint is reused without API or database changes:
`GET /api/repositories/rankings/:mode` with `hidden_gems` or `rising`, bounded `limit`, opaque `cursor`, ranking evaluation metadata, and mode-specific explanation evidence.

## Changes in A1
- Exported the existing web catalog item validator for reuse; catalog behavior unchanged.
- Added `apps/web/src/lib/repository-ranking-client.ts`:
  - typed modes, ranked items, score explanations, evidence and pagination;
  - same-origin request and safe parameter encoding;
  - mode/formula alignment and runtime validation of returned evidence;
  - HTTP code/status, malformed-response and network-error handling;
  - AbortSignal propagation and a client-side page-size guard.
- Added `apps/web/src/lib/repository-ranking-client.test.ts` for both modes, explanations, pagination, request headers/encoding, abort, API/network failures and malformed payloads.
- The existing `App.tsx` and user-visible discovery experience are intentionally unchanged.

## Verification
- Inspected the actual `apps/api/src/repositories/repository-ranking.ts`, `repository-routes.ts`, score modules, and PostgreSQL ranking route test before writing the client.
- Existing main checkpoint: PR #58 post-merge CI #36872757729 passed. PR #59 changed documentation only.
- No local full test run: GitHub host resolution is unavailable from the execution container. PR #60 CI #321 (run ID 36878516237) completed successfully against implementation checkpoint `651c0ccd7c716820125ad06e0b228f8e30b54001`: 34 successful steps, including application lint/typecheck/unit tests/build and database integration checks.
- This state-only documentation update follows that verified implementation commit; verify its resulting PR checks independently.

## Risks and decisions
- Ranking scores are formula-specific discovery evidence, not universal repository-quality ratings.
- Rising requires historical snapshots; a new/under-observed catalog can legitimately return an empty ranking.
- Ranking cursor freezes evaluation time, not repository metadata; content refresh between pages can change ordering.
- Current Phase 7D scores the entire listed curated catalog and performs multiple database reads per repository; profile latency as the catalog grows.
- No API ranking formula changes, search replacement, vector persistence, credentials, or production AI calls in A1.
- Historical Jev integration stays parked.

## Parallel technical track
- Phase 9A, 9B, 9B.1A: complete.
- Phase 9B.1B: manual workflow and repeated runner merged, **credentialed live evaluation and ADOPT/DEFER decision pending**.
- Phase 9C onward: blocked/deferred until evidence justifies adoption; public lexical search stays unchanged.
- Benchmark next action (independent of product work): configure `OPENAI_API_KEY` as a GitHub Actions repository secret (do not paste in chat), run `Semantic Retrieval Live Evaluation` with `text-embedding-3-small` / 1536 dimensions / 3 runs, and evaluate the artifacts.

## Exact next phase
**A2 — Hidden Gems and Rising web experience.** After A1 CI passes, add an explicit mode selector and URL-backed state, consume this client, provide loading/empty/error/retry/load-more, explain scores accessibly with evidence and eligibility context, and test the UI. Review the layout before merging. Do not expand into Phase B contribution discovery or resume Jev automatically.
