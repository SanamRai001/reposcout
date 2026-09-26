# RepoScout Project State

## Objective

Build historical measured repository intelligence in small phases without mixing persistence, capture, deterministic trend math, scheduling, and ranking logic.

## Branch

`feat/phase-6c-deterministic-trends`

Base: `main@e8be23644019fb863e7d8527848965995c4082ab`

PR: #42

## Completed phase

Phase 6C — Deterministic deltas + trend reads.

Phase 6 remains in progress.

## Changes

- Added explicit trend windows from 1 to 365 days.
- Trend reads use only persisted daily repository snapshots.
- The latest historical snapshot is the trend endpoint.
- The requested cutoff is derived from the latest snapshot's UTC day.
- Baseline selection uses the closest snapshot on or before that cutoff.
- Responses expose both requested window and actual covered span.
- Added signed star, fork, and GitHub-style open-issue deltas.
- Added explicit insufficient-history states:
  - `no_snapshots`;
  - `window_not_covered`.
- Insufficient history never fabricates or scales a partial-window delta.
- Added public listed-only trend endpoint:
  - `GET /api/repositories/:id/trend?windowDays=<1..365>`.
- Unlisted canonical repository history remains internal and returns the existing public 404 boundary.
- Added snapshot-level and route-level PostgreSQL integration coverage.

## Verification

- Phase 6B verified on `main@e8be23644019fb863e7d8527848965995c4082ab`.
- Phase 6C code head `847827f59ab53cf1853ccf401eb1878624d43d7e`.
- GitHub Actions CI run 192: success before documentation-only follow-up commits.
- CI verified lint/typecheck/tests/build, production dependency audit, Jev harness, migration apply/rollback/reapply, deterministic snapshot trends, listed-only trend API, existing persistence/content/ingestion/catalog/search/submission regressions, and PostgreSQL connectivity.
- Documentation-complete PR head must remain green before merge.

## Decisions / risks

- Trend math is descriptive, not a quality judgment.
- A requested window may have an actual span larger than requested when history is sparse; that span is always returned explicitly.
- RepoScout does not use a newer-than-cutoff baseline to fake full-window coverage.
- Missing history returns structured insufficiency rather than a synthetic zero or extrapolated delta.
- Open-issue direction is not labeled positive/negative; it is only a signed factual change.
- Trend reads are derived at request time and are not persisted as ranking scores.
- Fresh daily coverage still depends on Phase 6D scheduled operations.

## Phase 6 breakdown

- 6A — snapshot persistence foundation: complete.
- 6B — snapshot capture + bounded backfill: complete.
- 6C — deterministic deltas/trend reads: complete.
- 6D — scheduled operations + retry/backfill orchestration: next.

## Next phase

Phase 6D — Scheduled snapshot operations.

Add bounded scheduled refresh/capture orchestration, preserve GitHub rate-limit and retry behavior, make work selection observable/idempotent, and close Phase 6 without adding ranking logic.

Do not start Phase 7 Hidden Gems/Rising until Phase 6D is complete.
