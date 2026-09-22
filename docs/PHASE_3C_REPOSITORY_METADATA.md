# Phase 3C — Repository Metadata Foundation

## Goal

Add the first authoritative measured repository metadata without introducing ranking, model inference, historical trend calculations, or extra GitHub endpoint fan-out.

Phase 3C collects a small set of current facts from the same GitHub repository response already used by ingestion.

## Measured fields

The first metadata set is:

~~~text
stars
forks
open_issues
primary_language
license_spdx
topics
observed_at
~~~

These values are stored separately from canonical repository identity/state.

## Source

All Phase 3C values come from GitHub's repository REST response:

- `stargazers_count`;
- `forks_count`;
- `open_issues_count`;
- `language`;
- `license.spdx_id`;
- `topics`.

No model or heuristic produces these values.

## GitHub issue-count semantics

GitHub's issue model includes pull requests as issues.

RepoScout therefore preserves the source field internally but labels the catalog value **Open issues/PRs** rather than implying it is an issue-only count.

A later dedicated issues/PR pipeline may separate those counts if product needs justify the extra API calls.

## Storage

Measured metadata lives in a dedicated one-to-one table:

~~~text
repositories
    1
    |
    1
repository_metadata
~~~

`repository_metadata.repository_id` is both the primary key and a foreign key to the canonical repository.

Fields:

~~~text
repository_id
stars
forks
open_issues
primary_language nullable
license_spdx nullable
topics
observed_at
created_at
updated_at
~~~

Counts are nonnegative database values.

Canonical repository identity remains in `repositories`.

## Why a separate table?

Repository identity/state and measured metadata have different concerns:

- identity survives rename/transfer;
- measured counts change frequently;
- historical snapshots will later build from measured values;
- catalog/discovery may evolve independently from canonical persistence.

Keeping them separate preserves the ownership boundary recorded earlier in the project.

## Ingestion transaction

One GitHub repository fetch now produces:

~~~text
validated GitHub repository response
        |
        +-- canonical repository state
        |
        +-- measured repository metadata
                 |
        PostgreSQL transaction
~~~

The repository and metadata write are committed together.

If the transactional write fails, neither side should be partially committed.

## Stale-write protection

Canonical state already rejects older `last_synced_at` values.

Metadata also uses `observed_at`.

An older observation cannot overwrite newer measured metadata.

If an older repository fetch loses the canonical stale-write race, its metadata is not applied either.

## Validation

Before persistence:

- stars/forks/open count must be nonnegative safe integers;
- primary language must be null or non-empty;
- SPDX license must be null or non-empty;
- topics must be non-empty strings;
- topics are deduplicated and sorted for deterministic storage.

Malformed external data fails as `invalid_response`.

## Catalog API

Catalog responses now include:

~~~json
{
  "metadata": {
    "stars": 1250,
    "forks": 210,
    "openIssues": 34,
    "primaryLanguage": "TypeScript",
    "licenseSpdx": "Apache-2.0",
    "topics": ["openai", "sdk", "typescript"],
    "observedAt": "2026-09-21T08:00:00.000Z"
  }
}
~~~

Repositories created before metadata collection or by metadata-free internal fixtures may temporarily return:

~~~json
{
  "metadata": null
}
~~~

Missing metadata is not converted to zero.

## Catalog UI

Repository cards now display measured facts only when metadata exists:

- stars;
- forks;
- open issues/PRs;
- primary language;
- license;
- up to two topics.

Rows without metadata show **Metadata pending**.

These values are informational only. They do not currently affect result ordering.

## Explicitly deferred

Phase 3C does not add:

- release count/history;
- contributor counts;
- good-first-issue counts;
- watchers/subscribers;
- language byte breakdown;
- historical snapshots;
- star velocity;
- maintenance scores;
- Hidden Gems;
- ranking weights;
- Jev/model assessment;
- repository detail page.

Release/history collection is intentionally deferred because it requires additional GitHub endpoints and has a different refresh/cost profile.

## Verification

Tests cover:

- GitHub response metadata validation;
- topic normalization;
- transactional repository + metadata ingestion;
- metadata persistence;
- stale metadata protection;
- database count constraints;
- migration rollback preserving the canonical repository table;
- catalog API metadata exposure;
- browser response validation;
- metadata-aware catalog UI production build.

## Status

Complete.

The Phase 3C branch passed the complete application, migration, schema rollback/reapply, persistence, ingestion, catalog API, web build, and PostgreSQL verification gates.

## Next checkpoint

Phase 3D should establish the smallest repository content foundation needed for later classification and intelligence:

- bounded README collection;
- contribution-document presence;
- content provenance;
- refresh timestamps;
- safe text handling.

No Jev integration should happen until that evidence layer exists.
