# Phase 6A — Repository Snapshot Persistence

## Goal

Create the durable historical measurement foundation needed for later momentum/trend work without introducing ranking logic, scheduling infrastructure, or unsupported metrics.

## Data model

Phase 6A adds:

~~~text
repository_snapshots
--------------------
id
repository_id
captured_on
captured_at
stars
forks
open_issues
created_at
~~~

The snapshot contains only facts RepoScout already measures authoritatively from GitHub.

Not included yet:

- release count;
- commit frequency;
- contributor counts;
- model assessments;
- ranking/trend scores.

## Daily UTC bucket

RepoScout stores one snapshot per repository per UTC day.

Example:

~~~text
captured_at = 2026-09-25T23:59:59Z
captured_on = 2026-09-25

captured_at = 2026-09-26T00:00:00Z
captured_on = 2026-09-26
~~~

The database checks that `captured_on` matches the UTC date derived from `captured_at`.

Uniqueness is enforced by:

~~~text
(repository_id, captured_on)
~~~

This gives scheduled capture and backfill a stable idempotency boundary.

## Append-only retry behavior

Snapshot persistence is first-write-wins inside a UTC day.

~~~text
first capture
    |
INSERT
    |
daily snapshot created

same-day retry
    |
unique daily bucket exists
    |
return existing snapshot
    |
do not rewrite history
~~~

A same-day retry may contain newer live metadata, but Phase 6A intentionally does not mutate the already-recorded historical measurement.

If the product later needs intra-day snapshots, that should be an explicit cadence/schema decision rather than silently changing this contract.

## Backfill behavior

Backfills for different UTC days are allowed even when inserted out of chronological order.

The store can therefore contain:

~~~text
Sep 25
Sep 23   <- inserted later as backfill
Sep 24   <- inserted later as backfill
~~~

History reads still return newest capture first.

## Persistence API

`RepositorySnapshotStore.captureDaily(...)`

Returns:

~~~text
created
existing
~~~

`existing` means that repository/day already has a historical measurement.

`RepositorySnapshotStore.listRecent(repositoryId, limit)`

Provides a bounded read foundation for later Phase 6C delta calculations.

The current limit is 1–365 rows.

## Constraints

Database constraints enforce:

- repository foreign key;
- cascade on canonical repository deletion;
- one snapshot per repository/day;
- nonnegative stars;
- nonnegative forks;
- nonnegative open issues;
- UTC bucket/capture timestamp consistency.

A descending repository/capture-time index supports history reads.

## Migration safety

Migration:

`1790731200000_create_repository_snapshots.ts`

Rollback removes only `repository_snapshots`.

The rollback-state regression verifies all prior Phase 5 schema/index state remains intact.

## Verification

Phase 6A integration coverage verifies:

- successful daily capture;
- same-day retry idempotency;
- first-write-wins historical values;
- distinct-day backfills;
- newest-first history reads;
- UTC midnight bucket boundaries;
- metric/input validation;
- repository-delete cascade;
- schema/index existence;
- unique daily database constraint;
- UTC bucket database constraint;
- migration rollback/reapply.

GitHub Actions CI run 173 passed on code head `bc21bcd8248a79564c4dd3b8f9094a3547db4d11` before documentation-only commits.

## Phase 6 structure

Phase 6 is intentionally split:

### 6A — Snapshot persistence foundation

Complete.

### 6B — Snapshot capture + bounded backfill

Next.

Connect authoritative metadata observations to snapshot persistence and add bounded internal capture/backfill execution.

### 6C — Deterministic deltas + trend reads

Compute explainable changes over explicit historical windows.

### 6D — Scheduled snapshot operations

Add scheduled execution, bounded batches, retries, and operational controls.

Phase 7 Hidden Gems/Rising remains separate and must consume this deterministic history rather than being mixed into Phase 6.

## Status

Complete once the documentation-complete PR head and post-merge `main` CI are green.
