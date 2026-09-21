# Phase 1B.2A — Canonical Repositories Schema

## Goal

Create the smallest durable PostgreSQL schema that can represent an indexed GitHub repository without prematurely mixing in discovery metrics, community metadata, or ingestion logic.

## Canonical identity

RepoScout uses two identifiers:

- `id` — RepoScout internal UUID;
- `github_repository_id` — GitHub's stable numeric repository ID.

`github_repository_id` is unique and is the canonical external identity.

Owner, repository name, full name, and GitHub URL are deliberately mutable because repositories can be renamed or transferred between owners.

## Table

`repositories` currently stores:

```text
id
github_repository_id
owner
name
full_name
github_url
default_branch
description
is_archived
is_fork
created_at_github
updated_at_github
pushed_at_github
last_synced_at
created_at
updated_at
```

## Nullability

Nullable:
- `default_branch`
- `description`
- `pushed_at_github`

These values may legitimately be absent. RepoScout should preserve absence rather than manufacture placeholder values.

## Constraints

Database-enforced:
- primary key on `id`;
- unique `github_repository_id`;
- positive GitHub repository ID;
- non-empty owner;
- non-empty repository name;
- non-empty full name;
- non-empty GitHub URL.

Application validation will still exist later, but it is not a substitute for database integrity.

## Indexes

Initial indexes:
- `full_name` for current-name lookup;
- `last_synced_at` for future refresh scheduling.

`full_name` is intentionally **not unique** and must never replace GitHub repository ID as canonical identity.

## Explicitly excluded

This migration does not add:
- stars;
- forks;
- issue counts;
- release metrics;
- languages;
- topics;
- license;
- categories;
- signals;
- ranking scores;
- community submissions.

Those concerns have different update cadence and ownership and will be modeled separately when their phases arrive.

## Verification

CI verifies the migration against PostgreSQL 18 by:

1. applying migrations;
2. checking exact repository column types/nullability;
3. proving duplicate GitHub IDs are rejected;
4. proving owner/name can change while canonical identity remains;
5. proving invalid IDs/empty names are rejected;
6. rolling the migration back;
7. verifying the table no longer exists;
8. applying the migration again.

## Next checkpoint

Phase 1B.2B will add the repository persistence layer around this schema.

It should own:
- application UUID generation;
- create/upsert behavior by GitHub repository ID;
- find-by-GitHub-ID;
- current full-name lookup;
- rename/transfer-safe updates;
- persistence integration tests.

No GitHub API client belongs in Phase 1B.2B.
