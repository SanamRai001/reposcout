# RepoScout Project State

## Objective

Build historical measured repository intelligence in small phases without mixing storage, capture operations, trend math, scheduling, and ranking logic.

## Branch

`feat/phase-6b-snapshot-capture`

Base: `main@61be280be77dd14de456b3ff25040b3e8defde5e`

PR: #41

## Completed phase

Phase 6B — Snapshot capture + bounded backfill.

Phase 6 remains in progress.

## Changes

- Connected accepted authoritative metadata writes to daily snapshot persistence.
- Repository + metadata + same-day snapshot persistence now occurs in one PostgreSQL transaction.
- Normal GitHub ingestion/refresh therefore creates history without issuing any extra provider request.
- Existing Phase 6A first-write-wins daily semantics remain unchanged.
- Same-day refresh can update current metadata while preserving the first historical snapshot for that UTC day.
- Stale metadata writes do not create snapshots.
- Added bounded backfill selection over existing `repository_metadata`.
- Backfill captures only the latest stored metadata observation when its UTC day is not already represented in history.
- Backfill is oldest-observation-first, default 50 rows, maximum 500.
- Backfill includes unlisted canonical repositories so pre-publication history can survive later approval.
- Added an internal `backfill:snapshots` CLI with structured operational events.
- Backfill performs zero GitHub/provider requests.

## Verification

- Phase 6A verified on `main@61be280be77dd14de456b3ff25040b3e8defde5e`.
- Phase 6B code head `b53f311257056ddbd3efa15a2b5bd8de057e5438`.
- GitHub Actions CI run 181: success before documentation-only follow-up commits.
- CI verified lint/typecheck/tests/build, production dependency audit, Jev harness, migration apply/rollback/reapply, repository persistence, automatic ingestion snapshot capture, snapshot persistence/backfill integration, content/ingestion/catalog/search/submission regressions, and PostgreSQL connectivity.
- Documentation-complete PR head must remain green before merge.

## Decisions / risks

- Snapshot capture is coupled to accepted authoritative metadata persistence, not to browser reads or ranking code.
- No second GitHub fetch is performed solely to write a snapshot.
- The transaction may fail as a unit if snapshot persistence fails, preventing metadata/history divergence.
- Backfill can recover the latest stored metadata observation only; observations that were never historically stored cannot be reconstructed.
- Unlisted repository history remains internal and does not affect public listing state.
- Scheduled fresh daily refresh/capture is still Phase 6D.
- No delta/trend interpretation exists yet.

## Phase 6 breakdown

- 6A — snapshot persistence foundation: complete.
- 6B — snapshot capture + bounded backfill: complete.
- 6C — deterministic deltas/trend reads: next.
- 6D — scheduled operations + retry/backfill orchestration.

## Next phase

Phase 6C — Deterministic deltas + trend reads.

Add explicit-window star/fork/open-issue change calculations over snapshot history, define missing-history semantics, and expose deterministic trend reads without producing a universal quality score.

Do not start Phase 7 ranking work before Phase 6 is complete.
