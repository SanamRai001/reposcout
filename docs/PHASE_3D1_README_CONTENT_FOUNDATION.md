# Phase 3D.1 — Bounded README Content Foundation

## Goal

Create the smallest safe repository-content evidence layer needed before contribution-document detection and later Jev evaluation.

Phase 3D.1 is intentionally limited to README evidence.

It does not modify normal repository ingestion, discovery ranking, the public catalog contract, or the web UI.

## Why Phase 3D is split

Repository content introduces different operational and trust concerns from repository metadata:

- extra GitHub API requests;
- potentially large text payloads;
- untrusted Markdown/text;
- content provenance;
- independent refresh cadence;
- model/search input safety.

Phase 3D is therefore split into:

~~~text
Phase 3D.1  bounded README content foundation
Phase 3D.2  contribution-document/evidence detection
~~~

## GitHub source

README collection uses GitHub's repository README REST endpoint:

~~~text
GET /repos/{owner}/{repo}/readme?ref={defaultBranch}
~~~

The request:
- stays on the fixed `https://api.github.com` origin;
- uses the same pinned GitHub API version as repository ingestion;
- reuses the existing server-side token/timeout boundary;
- rejects redirects.

## RepoScout content limit

RepoScout stores README bodies only up to:

~~~text
256 KiB
~~~

This is deliberately below GitHub's own contents API limits.

The goal is to bound:
- database growth;
- later search indexing cost;
- later model input size;
- pathological/unexpected content.

Oversized README files retain provenance and size evidence but not the body.

## Response validation

For README bodies that are small enough to store, RepoScout validates:

- response is a file;
- path is non-empty;
- blob SHA is non-empty;
- byte size is a nonnegative safe integer;
- encoding is Base64;
- Base64 shape is valid;
- decoded byte length matches GitHub's declared byte size;
- decoded content is valid UTF-8;
- content contains no null bytes.

Malformed content is rejected before PostgreSQL.

## Storage

Phase 3D.1 adds:

~~~text
repository_readme_content
~~~

One row exists per canonical repository.

Fields:

~~~text
repository_id
status
source_ref
path
sha
size_bytes
content
observed_at
created_at
updated_at
~~~

Status values:

~~~text
PRESENT
NOT_FOUND
TOO_LARGE
~~~

### PRESENT

Stores:
- default branch/ref;
- README path;
- Git blob SHA;
- byte size;
- validated UTF-8 text.

### TOO_LARGE

Stores:
- default branch/ref;
- README path;
- Git blob SHA;
- byte size.

The body remains null.

### NOT_FOUND

Stores an observation that the README endpoint returned no usable README for that refresh context.

It does **not** manufacture path, SHA, size, or content.

A README endpoint 404 is evidence about that request, not a permanent statement that the repository can never have a README.

## Provenance

Every stored body can be traced to:

~~~text
canonical repository
default branch/ref
README path
Git blob SHA
byte size
observation timestamp
~~~

This provenance is required before content is used for classification, search, or model evaluation.

## Independent refresh lifecycle

README refresh is deliberately independent from canonical repository ingestion.

Reason:

A README request can:
- time out;
- be rate-limited;
- return malformed content;
- exceed the RepoScout size ceiling.

Those failures must not prevent RepoScout from updating canonical repository facts and measured metadata.

Current flow:

~~~text
normal repository ingestion
        |
        +---- remains unchanged

manual/internal README refresh
        |
GitHub README endpoint
        |
validation / size policy
        |
RepositoryReadmeService
        |
RepositoryReadmeStore
        |
PostgreSQL
~~~

Later orchestration may trigger both workflows, but their failure domains should remain separate.

## Stale-write protection

README observations are ordered by `observed_at`.

An older refresh cannot replace newer content/provenance.

This applies to status changes too:

~~~text
newer PRESENT
older NOT_FOUND
    -> newer PRESENT remains authoritative
~~~

## Maintainer command

README evidence can be refreshed manually for an already indexed repository:

~~~text
npm run refresh:readme -w @reposcout/api -- owner/repository
~~~

or with a supported GitHub repository URL.

The command outputs only operational metadata.

It does not print the README body.

## Public exposure

Phase 3D.1 does **not** expose raw README bodies through:

- catalog list API;
- catalog detail API;
- web cards;
- public HTML.

Stored text is evidence for future indexing/classification work, not a new README mirror.

Any later public excerpt/snippet feature must define sanitization, attribution, length, and copyright/product rules separately.

## Verification

Tests cover:

- fixed-origin README URL construction;
- pinned API version/auth headers;
- successful Base64/UTF-8 decoding;
- README endpoint 404 observation;
- oversized README behavior;
- byte-size mismatch rejection;
- service provenance mapping;
- repositories without a default branch;
- PostgreSQL persistence;
- stale-write protection;
- database shape constraints;
- latest migration rollback preserving earlier repository/metadata tables.

## Explicitly deferred

Phase 3D.1 does not add:

- CONTRIBUTING detection;
- CODE_OF_CONDUCT detection;
- SECURITY policy detection;
- issue-template detection;
- README HTML rendering;
- public README API;
- excerpts/snippets;
- search indexing;
- embeddings;
- Jev;
- content summarization;
- conditional requests/ETag optimization;
- background refresh jobs.

## Next checkpoint

Phase 3D.2 should add the smallest **contribution-document evidence** needed for contribution discovery and later Jev evaluation, without downloading arbitrary repository trees.
