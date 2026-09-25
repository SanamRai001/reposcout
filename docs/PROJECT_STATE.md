# RepoScout Project State

## Objective

Build historical measured repository intelligence in small phases without mixing storage, capture operations, trend math, and ranking logic.

## Branch

`main`

Current verified merge: `a52b2d4dd847022e14d659eb6ec72be0035b8b2c`

PR #40: merged

## Completed phase

Phase 6A — Repository snapshot persistence foundation.

Phase 6 remains in progress.

## Changes

- Added `repository_snapshots` as the first historical metrics table.
- Snapshot facts are limited to currently authoritative measured metadata:
  - stars;
  - forks;
  - GitHub-style open issue count.
- Added explicit `captured_at` provenance and a UTC `captured_on` daily bucket.
- Enforced one snapshot per repository per UTC day.
- Snapshot capture is append-only / first-write-wins within a day.
- Same-day retries return the existing snapshot rather than rewriting historical values.
- Backfills for distinct UTC days remain independent historical rows.
- Added a repository + descending capture-time history index.
- Snapshot rows cascade only when their canonical repository is deleted.
- Added a bounded recent-history read method for later delta/trend phases.
- Added a dedicated snapshot PostgreSQL CI gate.

## Verification

- Phase 5E.4 verified on `main@6952d6323a5db0b51d8e293fe5bbee89306fe75b`.
- Phase 6A code head `bc21bcd8248a79564c4dd3b8f9094a3547db4d11`: CI run 173 success.
- Documentation-complete PR head `9d8c9225bf4b91e95cc0045d4bc06ccc1049b422`: CI run 177 success.
- PR #40 merged as `a52b2d4dd847022e14d659eb6ec72be0035b8b2c`.
- Post-merge `main` CI run 178: success.
- CI verified application lint/typecheck/tests/build, production dependency audit, Jev harness, migration apply/rollback/reapply, snapshot schema, snapshot persistence, existing persistence/content/ingestion/catalog/search/submission regressions, and PostgreSQL connectivity.

## Decisions / risks

- Historical snapshots store measured GitHub facts, not model inference or ranking scores.
- The MVP snapshot cadence unit is one UTC day per repository.
- Same-day capture is first-write-wins to keep history append-only and retries idempotent.
- No release/activity aggregate is stored until RepoScout has a defined authoritative collection source and semantics.
- No automatic capture or scheduler exists in 6A.
- Snapshot retention/coarsening remains deferred until real storage pressure exists.

## Phase 6 breakdown

- 6A — snapshot persistence foundation: complete.
- 6B — snapshot capture + bounded backfill: next.
- 6C — deterministic deltas/trend reads.
- 6D — scheduled operations + retry/backfill orchestration.

## Next phase

Phase 6B — Snapshot capture + bounded backfill.

Connect authoritative repository metadata observations to snapshot persistence, add an internal bounded capture/backfill operation, and preserve provider/rate-limit safety.

Do not start Phase 7 ranking work before Phase 6 is complete.
