# Phase 6B — Snapshot Capture and Bounded Backfill

## Goal

Connect RepoScout's existing authoritative repository metadata observations to the Phase 6A historical snapshot table without introducing duplicate GitHub requests, and provide a bounded way to backfill the current metadata observations that existed before snapshot history was introduced.

## Automatic capture path

Phase 6B adds snapshot persistence directly to the existing authoritative metadata transaction.

~~~text
GitHub API
   |
validated repository observation
   |
RepositoryIngestionService
   |
RepositoryStore.upsertWithMetadata
   |
BEGIN
   +-- upsert canonical repository
   +-- upsert current repository_metadata
   +-- insert daily repository_snapshots row
COMMIT
~~~

The history write uses the same measured values and `observed_at` timestamp that are accepted into current metadata.

There is no second GitHub fetch.

## Transactional consistency

Repository state, current measured metadata, and the corresponding daily historical observation share one transaction.

If the accepted metadata write succeeds but snapshot persistence fails, the transaction rolls back.

This prevents the normal ingestion path from committing a new current measurement while silently losing its historical observation.

Stale observations remain protected by the existing metadata freshness rules and do not create snapshots.

## Same-day behavior

Phase 6A defined one immutable snapshot per repository per UTC day.

Phase 6B preserves that rule.

Example:

~~~text
10:00 GitHub observation: 100 stars
   -> current metadata = 100
   -> daily snapshot = 100

18:00 GitHub observation: 110 stars
   -> current metadata = 110
   -> daily snapshot remains 100
~~~

The snapshot means "the first accepted measurement captured for this UTC day", while `repository_metadata` remains the latest accepted current measurement.

Phase 6C must account for this explicit historical semantic when computing deltas.

## Backfill boundary

Before Phase 6B, RepoScout already had one latest metadata observation per canonical repository.

Those persisted facts can be safely converted into history.

A row is a backfill candidate when:

- `repository_metadata` exists;
- no snapshot exists for that repository on the UTC date of `metadata.observed_at`.

Selection is:

- oldest metadata observation first;
- deterministic by repository ID as a tie-breaker;
- bounded.

Defaults:

~~~text
default batch = 50
maximum batch = 500
~~~

## Backfill command

From the repository root:

~~~bash
npm run backfill:snapshots -w @reposcout/api
~~~

Custom bounded batch:

~~~bash
npm run backfill:snapshots -w @reposcout/api -- 200
~~~

The command emits structured events:

~~~text
snapshot.backfill_batch_started
snapshot.backfill_item_completed
snapshot.backfill_batch_completed
snapshot.backfill_batch_failed
~~~

It also prints a structured JSON report.

## No provider calls during backfill

Backfill reads from:

~~~text
repositories
repository_metadata
repository_snapshots
~~~

It does not instantiate or call `GithubClient`.

Therefore:

- it cannot consume GitHub rate limit;
- GitHub outage does not prevent backfill;
- it does not guess historical values from current external state.

## What backfill cannot recover

`repository_metadata` is a one-to-one latest-observation table.

If a repository was observed many times before Phase 6A, older overwritten observations are no longer available.

Phase 6B does **not** invent that missing history.

It can backfill only the latest observation RepoScout actually retained.

## Unlisted repositories

Automatic capture and backfill apply to canonical repositories regardless of `is_listed`.

This allows a repository prepared during moderation to accumulate measured history before approval.

This does not publish it.

Public catalog/search remain restricted by the existing `is_listed = true` boundary.

## Verification

Coverage verifies:

- normal GitHub ingestion writes a daily historical snapshot;
- snapshot values match the authoritative observation;
- a later same-day GitHub observation updates current metadata but does not rewrite the first daily snapshot;
- bounded backfill selection;
- oldest-observation-first ordering;
- already-covered observation days are excluded;
- unlisted canonical metadata can be backfilled;
- the backfill service reports created/existing outcomes;
- batch parsing rejects values outside 1–500;
- existing persistence, ingestion, search, content, submission, and moderation behavior remains healthy.

GitHub Actions CI run 181 passed on code head `b53f311257056ddbd3efa15a2b5bd8de057e5438` before documentation-only commits.

## What Phase 6B does not do

It does not add:

- a scheduler;
- bulk forced GitHub refresh;
- periodic worker infrastructure;
- snapshot delta calculations;
- trend labels;
- ranking;
- Hidden Gems / Rising.

Fresh scheduled daily observations belong to Phase 6D.

Trend interpretation belongs to Phase 6C.

## Next checkpoint

Phase 6C — deterministic deltas + trend reads.
