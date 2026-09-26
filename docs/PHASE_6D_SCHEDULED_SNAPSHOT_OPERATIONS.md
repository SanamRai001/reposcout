# Phase 6D — Scheduled Snapshot Operations

## Goal

Close Phase 6 with a safe operational path that can be invoked once per UTC day to maintain repository history.

The operation must:

- fill stored metadata history before spending GitHub quota;
- refresh only repositories whose daily history still needs a fresh observation;
- be bounded;
- prevent overlapping runs;
- preserve the existing GitHub retry policy;
- remain separate from ranking.

## Command

From the repository root:

~~~bash
npm run maintain:snapshots -w @reposcout/api
~~~

Optional positional limits:

~~~bash
npm run maintain:snapshots -w @reposcout/api -- 50 200
~~~

The arguments are:

~~~text
refreshLimit backfillLimit
~~~

Defaults:

~~~text
refreshLimit = 25
backfillLimit = 100
~~~

Maximums:

~~~text
refreshLimit = 100
backfillLimit = 500
~~~

## Scheduling model

RepoScout does not start a timer inside the API server.

A deployment scheduler should invoke the one-run command.

Examples of suitable scheduler ownership include:

- cron;
- cPanel cron;
- systemd timers;
- container/platform scheduled jobs;
- other deployment-native job schedulers.

The initial recommended cadence is **once per UTC day**, shortly after the UTC date rolls over.

The exact production schedule remains a deployment configuration, not hardcoded application behavior.

## Why not an in-process timer?

An in-process timer would run once per API process.

With two API instances:

~~~text
API instance A -> timer
API instance B -> timer
~~~

both could attempt the same provider work.

Keeping scheduling outside the HTTP process makes scaling safer and operational ownership clearer.

RepoScout still defends against accidental overlap with a database lock.

## Advisory lock

Before maintenance starts:

~~~text
pg_try_advisory_lock(...)
~~~

If another maintenance process connected to the same PostgreSQL database already holds the lock:

~~~text
status = already_running
~~~

No backfill and no GitHub refresh occurs.

The acquired lock is session-scoped and is released in a `finally` path.

If the database connection dies, PostgreSQL releases the session advisory lock automatically.

## Maintenance order

The run order is deliberate:

~~~text
1. acquire lock
2. stored-metadata backfill
3. select refresh candidates
4. refresh sequentially
5. release lock
~~~

### Why backfill comes first

Phase 6B can turn an already-stored metadata observation into a missing historical snapshot without GitHub.

Doing that first means a repository may no longer require provider work.

## Refresh candidate rules

A scheduled refresh candidate must:

- be a publicly listed canonical repository;
- satisfy the existing repository refresh interval;
- have no snapshot for the run's current UTC day.

Selection order:

~~~text
oldest last_synced_at first
then repository id
~~~

This favors the stalest repositories while keeping selection deterministic.

## Listed-only scheduled refresh

Normal ingestion can create history for unlisted moderation candidates.

The scheduled maintenance operation intentionally spends recurring GitHub quota on listed repositories only.

This does not delete unlisted history and does not change publication state.

## Reusing the existing refresh path

Maintenance does not introduce another GitHub ingestion system.

Each candidate is passed to:

~~~text
RepositoryRefreshService
        |
RepositoryIngestionService
        |
RepositoryStore.upsertWithMetadata
        |
current metadata + daily snapshot transaction
~~~

The existing refresh eligibility, provider parsing, retry classification, and last-known-good preservation remain authoritative.

## Provider-pressure behavior

### Refreshed

Continue to the next candidate.

### Skipped

Continue.

This can happen if state changed between candidate selection and refresh evaluation.

### Unavailable

Record the outcome and continue.

A missing repository should not prevent unrelated repositories from being refreshed.

### Retry later

Stop the remaining provider batch.

The report exposes:

~~~text
retryAt
~~~

Continuing after provider retry pressure could waste quota or repeat a network/provider failure.

### Manual review

Stop the remaining provider batch.

An invalid external response may indicate a provider contract change, so continuing across the whole catalog is intentionally conservative.

## Idempotency

Multiple safety layers make retries safe:

- advisory lock prevents simultaneous runs;
- stored-metadata backfill is idempotent;
- daily snapshot uniqueness prevents duplicate history;
- repositories already covered today are not selected;
- repository ingestion is stale-safe;
- same-day snapshots remain first-write-wins.

A later scheduled run can resume naturally from remaining missing daily snapshots.

## Operational events

The CLI emits structured application events:

~~~text
snapshot.maintenance_started
snapshot.maintenance_skipped
snapshot.maintenance_refresh_completed
snapshot.maintenance_completed
snapshot.maintenance_failed
~~~

The completed event includes bounded counts and any halt/retry information.

The command also prints a JSON report for scheduler/job logs.

## Exit behavior

Normal completed run:

~~~text
exit 0
~~~

Another maintenance run already owns the lock:

~~~text
exit 0
status = already_running
~~~

Provider-pressure/manual-review halt:

~~~text
exit 2
status = halted
~~~

Unexpected application/database failure:

~~~text
exit 1
~~~

This allows deployment schedulers to distinguish a hard failure from a deliberately halted provider batch.

## Verification

Phase 6D tests verify:

- default and maximum limits;
- overlapping run returns a no-op;
- backfill occurs before refresh selection;
- deterministic sequential refresh;
- provider retry pressure halts remaining work;
- advisory lock releases on unexpected failure;
- only stale listed repositories are selected;
- repositories with a current-day snapshot are excluded;
- unlisted repositories are excluded from recurring provider work;
- deterministic oldest-sync ordering;
- hard refresh batch limits;
- real PostgreSQL advisory-lock overlap behavior.

The initial code head failed CI #198 only because of an unused TypeScript import.

Corrected code head `3c52c0321411b0a0625b483ebd03b17371c76263` passed CI #199 completely.

## Phase 6 completion

With Phase 6D complete, RepoScout now has:

~~~text
measured current metadata
        |
daily append-only snapshots
        |
automatic transactional capture
        |
bounded historical backfill
        |
deterministic trend reads
        |
scheduler-safe daily maintenance
~~~

This is the historical-data foundation for later ranking work.

## Next product phase

Phase 7 — Hidden Gems and Rising.

Phase 7 must consume these measured/derived signals without turning snapshot storage itself into a ranking system.
