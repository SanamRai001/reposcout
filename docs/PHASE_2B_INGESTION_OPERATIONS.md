# Phase 2B — Ingestion Refresh Operations

## Goal

Add operational refresh behavior around the Phase 2A ingestion boundary without exposing ingestion publicly and without prematurely expanding the repository schema.

Phase 2B answers:

- when should a repository be refreshed?
- what should happen when GitHub is unavailable or rate-limited?
- what should happen when a repository returns 404?
- how can maintainers trigger ingestion safely?
- what should be logged for operational visibility?

## Refresh policy

Default refresh interval:

```text
6 hours
```

A repository synchronized more recently than that is skipped unless a maintainer explicitly forces the refresh.

This reduces unnecessary GitHub API usage and creates a clear starting policy before background scheduling exists.

## Refresh outcomes

`RepositoryRefreshService` returns one of:

```text
refreshed
skipped
unavailable
retry_later
manual_review
```

### refreshed

GitHub returned valid repository data and persistence completed successfully.

### skipped

The repository was synchronized inside the refresh window.

No GitHub request is made.

### unavailable

GitHub returned 404.

GitHub intentionally does not reveal whether some inaccessible repositories are deleted, private, or simply unavailable to the supplied credentials.

RepoScout therefore does **not** guess.

Existing canonical repository data is preserved unchanged and the initial retry policy waits 24 hours.

### retry_later

Used for transient GitHub failures.

Initial policy:

- explicit GitHub rate-limit reset time: honor that timestamp;
- rate-limited without reset time: retry after 15 minutes;
- transport/general request failure: retry after 5 minutes.

Phase 2B returns the retry decision but does not introduce a background scheduler yet.

### manual_review

Used for malformed or internally inconsistent GitHub responses.

Automatic retry is not scheduled because repeated ingestion of invalid upstream data could hide a compatibility problem.

## Non-destructive unavailable handling

A 404 never:
- deletes an indexed repository;
- clears its description;
- rewrites owner/name;
- advances `last_synced_at`;
- marks the repository permanently dead.

The last known good record stays intact.

This is important because GitHub 404 can represent multiple states and a temporary permission/configuration issue must not destroy discovery data.

## Observability

Refresh operations emit structured events:

```text
ingestion.refresh_started
ingestion.refresh_skipped
ingestion.refresh_succeeded
ingestion.refresh_failed
ingestion.refresh_unexpected_error
```

Logged metadata may include:
- canonical GitHub repository ID;
- repository full name;
- operational error kind;
- HTTP status;
- retry timestamp;
- whether an existing record was preserved;
- whether the refresh was forced.

Secrets and GitHub tokens are never logged.

## Manual maintainer command

A safe internal command is available:

```bash
npm run ingest:repository -w @reposcout/api -- owner/repository
```

GitHub URLs are also accepted:

```bash
npm run ingest:repository -w @reposcout/api -- https://github.com/owner/repository
```

Force a refresh inside the normal six-hour window:

```bash
npm run ingest:repository -w @reposcout/api -- owner/repository --force
```

The command:
- loads validated server environment;
- uses the same fixed-origin GitHub client as the application;
- uses RepositoryRefreshService;
- writes through RepositoryStore;
- closes the PostgreSQL pool;
- prints a small JSON result.

It is intentionally not exposed as a public HTTP endpoint.

## Exit behavior

The internal command sets:
- exit code 0 for refreshed/skipped;
- exit code 2 for unavailable/retry-later/manual-review outcomes;
- exit code 1 for unexpected operational/application failures.

This makes it suitable for future scripting without pretending transient GitHub conditions are successful ingestion.

## Schema decision

Phase 2B does not add a sync-state table yet.

Reason:
- the current product has no background queue;
- no user-facing repository availability state exists yet;
- structured return values and logs are sufficient to validate operational behavior first.

If scheduler/history requirements become real, sync-attempt history should be modeled explicitly rather than stuffing transient operational state into the canonical `repositories` table.

## Verification

Unit tests cover:
- six-hour refresh eligibility;
- forced refresh;
- GitHub rate-limit retry timestamp;
- transient failure retry delay;
- 404 unavailable decision;
- invalid-response manual review;
- manual CLI parsing.

PostgreSQL integration tests prove:
- a 404 preserves the complete last known repository row;
- `last_synced_at` does not advance on unavailable refresh;
- recently synchronized repositories skip GitHub entirely.

## Explicitly deferred

Phase 2B does not add:
- automatic background retries;
- cron/queue infrastructure;
- sync-attempt history table;
- public ingestion routes;
- community submissions;
- batch crawling;
- repository metrics;
- search/catalog UI.

## Next checkpoint

Phase 2 is complete.

RepoScout will move directly to **Phase 3A: repository catalog/read APIs**.

Background refresh scheduling is intentionally deferred until repository volume, historical snapshots, or production operations demonstrate a concrete need.
