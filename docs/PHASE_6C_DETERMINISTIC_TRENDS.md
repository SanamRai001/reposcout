# Phase 6C — Deterministic Deltas and Trend Reads

## Goal

Turn Phase 6 snapshot history into explainable repository change measurements without introducing ranking judgments, model inference, or scheduling.

## Public endpoint

~~~http
GET /api/repositories/:id/trend?windowDays=<1..365>
~~~

`windowDays` is required.

Examples:

~~~text
windowDays=7
windowDays=30
windowDays=90
~~~

RepoScout deliberately does not choose a hidden default window.

## Trend anchors

A trend read uses only persisted `repository_snapshots`.

The endpoint is the latest available historical snapshot.

For a requested window:

~~~text
cutoff_on = latest.captured_on - windowDays
~~~

The baseline is:

~~~text
the closest snapshot whose captured_on <= cutoff_on
~~~

This rule is deterministic and conservative.

## Sparse history

Suppose the latest snapshot is September 30 and a 7-day window is requested.

Requested cutoff:

~~~text
September 23
~~~

If the nearest qualifying historical snapshot is September 22, RepoScout returns:

~~~text
requestedWindowDays = 7
actualWindowDays    = 8
baseline            = September 22
latest              = September 30
~~~

It does not pretend the observation is exactly seven days old.

## Complete result

A complete trend includes:

~~~text
status = complete
repositoryId
requestedWindowDays
cutoffOn
actualWindowDays
baseline
latest
delta
~~~

Delta contains signed measured changes:

~~~text
stars
forks
openIssues
~~~

Example:

~~~json
{
  "stars": 45,
  "forks": 8,
  "openIssues": -5
}
~~~

These numbers are descriptive.

RepoScout does not say that higher stars/forks or lower open issues make a repository universally better.

## Missing history

### No snapshots

~~~text
status = insufficient_history
reason = no_snapshots
~~~

There is no baseline, endpoint, or delta.

### Requested window not covered

If history exists but does not reach the cutoff:

~~~text
status = insufficient_history
reason = window_not_covered
~~~

The response includes:

- requested window;
- requested cutoff;
- oldest available snapshot;
- latest snapshot;
- available historical span.

It does **not** include a fabricated delta for the requested window.

RepoScout does not:

- extrapolate a shorter interval;
- scale a shorter interval to the requested window;
- annualize sparse history;
- synthesize a zero delta;
- substitute current live metadata for missing history.

## Why baseline is on or before the cutoff

Choosing a snapshot after the cutoff would produce less history than the user requested while still looking like a full-window comparison.

Using the closest point on or before the cutoff guarantees that a complete result covers **at least** the requested number of UTC days.

`actualWindowDays` makes any overshoot explicit.

## Public listing boundary

Snapshot persistence is allowed for unlisted canonical repositories because moderation candidates can accumulate internal measured history.

The public trend endpoint does not bypass publication.

Before reading trends, the API resolves the repository through the existing listed catalog boundary.

Therefore an unlisted repository with snapshot history still returns:

~~~text
404 repository_not_found
~~~

## No provider dependency

Trend reads use PostgreSQL only.

They do not:

- call GitHub;
- consume GitHub API quota;
- invoke Jev;
- invoke another model provider.

This means historical reads remain available even when external providers are unavailable.

## No new persisted score

Phase 6C does not add a trend-score table or materialized quality score.

The trend is recomputed from authoritative snapshots.

This preserves RepoScout's principle that derived signals remain explainable and recomputable.

## Verification

Coverage includes:

- explicit window parsing from 1–365 days;
- exact-window signed delta calculation;
- sparse-history baseline selection;
- actual-span reporting;
- negative metric deltas;
- `window_not_covered`;
- `no_snapshots`;
- public ISO timestamp serialization;
- invalid/missing window API behavior;
- listed repository trend access;
- unlisted history non-disclosure.

GitHub Actions CI run 192 passed on code head `847827f59ab53cf1853ccf401eb1878624d43d7e` before documentation-only commits.

## What Phase 6C does not do

It does not implement:

- scheduled GitHub refresh;
- workers/cron;
- trend ranking;
- momentum scoring;
- Hidden Gems;
- Rising;
- model reranking.

## Next checkpoint

Phase 6D — scheduled snapshot operations.
