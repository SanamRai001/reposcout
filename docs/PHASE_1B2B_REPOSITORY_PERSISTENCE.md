# Phase 1B.2B — Repository Persistence Layer

## Goal

Add a small, explicit persistence layer around the canonical `repositories` table.

This phase does not call GitHub and does not expose HTTP repository endpoints. It only defines how normalized repository data is stored and read.

## Persistence API

`RepositoryStore` currently owns:

```text
upsert(input)
findByGithubRepositoryId(githubRepositoryId)
findByFullName(fullName)
```

## Canonical upsert

`upsert` is keyed by `github_repository_id`.

On first write:
- RepoScout generates the internal UUID;
- the repository row is inserted.

On later writes for the same GitHub repository ID:
- the internal UUID is preserved;
- mutable repository attributes are refreshed;
- rename/owner-transfer fields update on the same canonical row;
- no duplicate repository row is created.

## Stale-write protection

Repository synchronization may eventually run concurrently.

To stop an older fetch from overwriting newer state, the upsert only updates an existing row when:

```text
incoming.last_synced_at >= stored.last_synced_at
```

If an older write loses that race, the persistence layer returns the current stored repository instead.

This makes the operation safe for retrying and reduces future ingestion race conditions.

## GitHub ID representation

PostgreSQL stores `github_repository_id` as `BIGINT`.

TypeScript exposes it as a decimal string.

Reason:
JavaScript numbers cannot safely represent every 64-bit integer. Treating the value as a string preserves exact external identity and avoids precision loss.

Example:

```text
123456789012345678
```

is persisted as PostgreSQL `BIGINT` but represented as the exact string above in application code.

## Full-name lookup

`findByFullName` returns an array rather than assuming `full_name` is globally unique inside RepoScout.

This preserves the schema rule that mutable repository names are not identity.

Future URL/query normalization can decide how to resolve or surface ambiguous results.

## Parameterization

All persistence queries use PostgreSQL parameters.

No repository value is interpolated into SQL.

## Verification

PostgreSQL integration tests verify:

- repository creation;
- exact large GitHub ID round-trip without precision loss;
- idempotent upsert;
- stable RepoScout UUID across repeated syncs;
- mutable field refresh;
- rename/owner-transfer behavior;
- stale sync protection;
- find-by-GitHub-ID;
- missing repository behavior;
- current full-name lookup;
- invalid GitHub ID rejection before database access.

## Explicitly deferred

This phase does not add:
- GitHub API client;
- GitHub URL parsing;
- repository ingestion service;
- repository HTTP endpoints;
- metrics;
- topics/languages;
- search;
- ranking;
- submissions.

## Next checkpoint

Phase 2A should start repository ingestion with the smallest external boundary:

```text
GitHub repository reference
        ↓
GitHub API client
        ↓
normalized repository data
        ↓
RepositoryStore
```

Keep API transport, normalization, and persistence responsibilities separate.
