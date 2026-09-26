# Phase 8B — Contribution Issue Ingestion

## Goal

Persist a narrow measured GitHub issue entity for listed RepoScout repositories.

This phase supplies trustworthy issue observations for later contribution discovery.

It does **not** decide whether an issue is beginner-friendly.

## Persisted entity

Table:

~~~text
repository_contribution_issues
~~~

Measured fields:

- RepoScout issue UUID;
- repository ID;
- GitHub issue ID;
- repository-local issue number;
- title;
- GitHub issue URL;
- open/closed state;
- locked flag;
- assignee count;
- comment count;
- raw label names;
- GitHub created timestamp;
- GitHub updated timestamp;
- RepoScout observed timestamp;
- RepoScout row created/updated timestamps.

## Identity

GitHub issue ID is globally unique.

Issue number is unique within its repository.

A stored GitHub issue identity cannot silently move to another repository.

This protects against malformed provider data or incorrect caller identity reuse.

## Validation

Phase 8B validates:

- repository UUID;
- positive GitHub issue ID;
- positive issue number;
- non-empty title;
- HTTPS `github.com/.../issues/<number>` URL;
- state is `open` or `closed`;
- nonnegative assignee/comment counts;
- valid timestamps;
- GitHub updated timestamp is not before creation timestamp;
- labels are non-empty strings up to 255 characters.

Labels are trimmed, deduplicated, and deterministically sorted for storage.

Their contribution-discovery meaning remains defined by Phase 8A.

## Stale-safe persistence

Upsert authority is GitHub `updated_at`.

A newer provider observation may update the stored issue.

An older provider observation cannot overwrite newer state.

When GitHub timestamps are equal, a newer/equal RepoScout `observed_at` may refresh the row.

This preserves last-known-good issue state under retries and out-of-order operations.

## GitHub issue fetch

Phase 8B adds a strict bounded issue reader.

The provider request is intentionally:

~~~text
one page only
state = all
sort = updated
direction = desc
per_page <= 100
~~~

This favors current/recently-changing issue observations.

RepoScout does not claim complete historical issue coverage in 8B.

## Pull request exclusion

GitHub's issue endpoint can include pull requests.

Items carrying the provider's pull-request marker are excluded before issue parsing.

A pull request is not persisted as a contribution issue.

## Why state=all?

Later contribution discovery needs to distinguish measured open vs closed state.

Fetching open-only would make a disappearing issue ambiguous:

~~~text
closed?
deleted?
not on current page?
never fetched?
~~~

Capturing both states avoids pretending an open-only page is complete history.

## Listed-only boundary

Before provider work, ingestion resolves the repository through:

~~~text
RepositoryCatalogReader.findById
~~~

That reader exposes listed repositories only.

Therefore:

~~~text
unlisted / unknown repository
        ↓
status = not_listed
        ↓
no GitHub issue request
~~~

Recurring provider quota is reserved for the public catalog.

## Batch operation

Defaults:

~~~text
repositories per run = 20
issues per repository = 50
~~~

Maximums:

~~~text
repositories per run = 50
issues per repository = 100
~~~

Repositories are processed sequentially.

### Ingested

Persist issues and advance the resume cursor.

### Not listed

Skip and advance.

### Unavailable

Record/skip and advance.

### Retry later

Stop remaining provider work and expose `retryAt`.

### Manual review

Stop remaining provider work.

The batch report returns:

- selected repository count;
- processed count;
- persisted issue count;
- per-repository results;
- halt reason;
- retry timestamp;
- next repository cursor.

## CLI

From the repository root:

~~~bash
npm run ingest:contribution-issues -w @reposcout/api
~~~

Optional arguments:

~~~bash
npm run ingest:contribution-issues -w @reposcout/api -- \
  [repositoryLimit] [issueLimit] [cursorRepositoryId]
~~~

This is an operational ingestion command, not an API endpoint.

## Observability

Issue ingestion emits structured start/success/failure operational events using the existing application logger and provider retry classification.

No new provider retry algorithm is introduced.

## Privacy / collection boundary

Phase 8B deliberately does not persist:

- issue body text;
- commenter identities;
- assignee identities;
- contributor identities;
- maintainer response histories;
- linked contribution outcomes.

Only aggregate assignee/comment counts are stored.

This keeps the first collection scope narrow while Phase 8 product semantics are still being proven.

## Verification

Coverage includes:

- strict GitHub issue parsing;
- pull request exclusion;
- provider rate-limit propagation;
- listed-only ingestion;
- no provider call for unlisted repository;
- bounded batch limits;
- halt/resume behavior;
- PostgreSQL insert/update;
- stale observation protection;
- cross-repository GitHub issue identity protection;
- schema constraints and indexes;
- latest migration rollback/reapply.

Code head:

~~~text
2a88c76218f19825e0a6be7f8fb579590df3b770
~~~

passed GitHub Actions CI #268 before documentation-only commits.

## What Phase 8B does not do

No:

- public contribution discovery endpoint;
- good-first/help-wanted public filter;
- issue recommendation ranking;
- beginner-friendly score;
- issue-body semantic analysis;
- Jev/model inference;
- Phase 9 semantic search.

## Next phase

Phase 8C — public contribution discovery + deterministic filters.
