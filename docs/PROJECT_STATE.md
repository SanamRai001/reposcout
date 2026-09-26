# RepoScout Project State

## Objective

Complete historical repository intelligence through deterministic daily capture, backfill, trend reads, and scheduler-safe operations while keeping ranking as a separate later phase.

## Branch

`feat/phase-6d-snapshot-operations`

Base: `main@87bf7f567f4ed37947e2a72cd4a68a6937d06177`

PR: #43

## Completed phase

Phase 6D — Scheduled snapshot operations.

Phase 6 — Historical snapshots is now implementation-complete on this branch, pending documentation-complete and merged-state verification.

## Changes

- Added a scheduler-safe one-run snapshot maintenance operation.
- Maintenance order is:
  1. provider-free stored-metadata backfill;
  2. bounded refresh-candidate selection;
  3. sequential refresh through the existing refresh/ingestion pipeline.
- Added PostgreSQL advisory locking so overlapping maintenance invocations cannot run concurrently.
- An overlapping invocation returns `already_running` and performs no backfill or GitHub work.
- Refresh candidates are:
  - publicly listed canonical repositories;
  - older than the existing refresh eligibility interval;
  - missing a snapshot for the current UTC day.
- Candidate order is oldest `last_synced_at` first with deterministic repository-ID tie behavior.
- Refresh default batch is 25; maximum is 100.
- Backfill default batch is 100; maximum is 500.
- Existing Phase 6B backfill can satisfy historical gaps before any provider work occurs.
- Repositories already represented by today's UTC snapshot are excluded from provider refresh by this maintenance operation.
- `retry_later` halts the remaining provider batch and exposes `retryAt`.
- `manual_review` halts the remaining provider batch.
- `unavailable` repositories are recorded while unrelated candidates may continue.
- Added structured maintenance start/item/completion/failure events.
- Added `maintain:snapshots` CLI intended for an external once-daily scheduler.
- No in-process timer is embedded in the API server.

## Verification

- Phase 6C verified on `main@87bf7f567f4ed37947e2a72cd4a68a6937d06177`.
- Initial Phase 6D code head `9ea71248c59f140ad9e5703f95b481d2ef053a42`: CI run 198 found one unused import during lint.
- Corrected Phase 6D code head `3c52c0321411b0a0625b483ebd03b17371c76263`: CI run 199 success.
- CI run 199 verified lint/typecheck/tests/build, production dependency audit, Jev harness, migration apply/rollback/reapply, snapshot maintenance selection + advisory locking, existing snapshot/trend persistence, ingestion/catalog/search/submission regressions, and PostgreSQL connectivity.
- Documentation-complete PR head must remain green before merge.

## Decisions / risks

- Scheduling is deployment-owned; RepoScout exposes one safe maintenance run rather than starting timers inside every API process.
- The recommended cadence is once per UTC day because repository snapshots are daily buckets.
- The advisory lock protects overlapping processes connected to the same PostgreSQL database.
- It does not coordinate across different databases.
- The maintenance runner intentionally refreshes listed repositories only; unlisted moderation candidates may still gain history through normal ingestion/handoff, but scheduled GitHub quota is reserved for public catalog history.
- A GitHub provider-pressure result stops the remaining refresh batch instead of hammering the provider.
- Fine-grained retry timestamps are surfaced in the report but are not persisted as a scheduler state machine.
- Running the operation once daily naturally keeps retries conservative relative to the existing retry policy.
- Phase 6 does not contain a repository quality or momentum ranking.

## Phase 6 breakdown

- 6A — snapshot persistence foundation: complete.
- 6B — snapshot capture + bounded backfill: complete.
- 6C — deterministic deltas/trend reads: complete.
- 6D — scheduled operations + retry/backfill orchestration: complete.
- Phase 6 — Historical snapshots: complete.

## Next product phase

Phase 7 — Hidden Gems and Rising.

Phase 7 may consume measured metadata and Phase 6 trend history, but ranking must remain explainable, must not let raw popularity dominate Hidden Gems, and must not rewrite canonical measured history.

Residual broad-production gates documented in Phase 5E.4 remain separate work.
