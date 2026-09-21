# Phase 3A — Repository Catalog Read API

## Goal

Expose the smallest useful read surface over RepoScout's canonical repository data.

Phase 3A adds only:

```text
GET /api/repositories
GET /api/repositories/:id
```

The phase does not add search, ranking, filters, metrics, repository refresh-on-read, or frontend catalog UI.

## List endpoint

```http
GET /api/repositories
GET /api/repositories?limit=20
GET /api/repositories?limit=20&cursor=<opaque>
```

Response:

```json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "nextCursor": null
  }
}
```

Rules:

- default page size: 20;
- minimum page size: 1;
- maximum page size: 50;
- invalid limits return HTTP 400;
- malformed cursors return HTTP 400;
- an empty page returns an empty array and no cursor.

## Pagination model

Phase 3A uses opaque keyset pagination.

The cursor currently contains only the stable internal repository UUID and is encoded as base64url JSON.

Database traversal is:

```sql
ORDER BY id ASC
```

and subsequent pages continue with:

```sql
WHERE id > cursor_id
ORDER BY id ASC
```

The ordering is intentionally an internal deterministic traversal order.

Clients must not interpret catalog order as:
- newest;
- most popular;
- best;
- trending;
- most active.

Those semantic sorts belong to later discovery phases.

### Why not timestamp pagination?

PostgreSQL timestamps may retain microsecond precision while JavaScript `Date` retains milliseconds.

Using a timestamp copied through JavaScript as a keyset boundary could therefore create edge cases where rows sharing the truncated timestamp boundary are skipped.

A UUID-only traversal is less expressive, but exact and safe for the MVP catalog.

## Detail endpoint

```http
GET /api/repositories/:id
```

The path parameter is RepoScout's stable internal UUID.

Responses:

- HTTP 200 with canonical repository data;
- HTTP 400 for malformed UUIDs;
- HTTP 404 for a valid UUID that does not exist.

## Repository response

Phase 3A exposes canonical fields already owned by the repository persistence layer:

- RepoScout repository ID;
- GitHub repository ID;
- owner;
- name;
- full name;
- GitHub URL;
- default branch;
- description;
- archived/fork state;
- GitHub creation/update/push timestamps;
- last successful RepoScout synchronization time;
- RepoScout row creation/update timestamps.

Date values are serialized as ISO 8601 strings.

No derived metrics or AI-generated fields are returned.

## Read path

```text
HTTP request
    ↓
Express repository router
    ↓
RepositoryCatalogReader
    ↓
RepositoryStore
    ↓
PostgreSQL
```

Catalog reads never call GitHub.

This keeps:
- page latency independent from GitHub;
- GitHub tokens off browser-facing flows;
- rate-limit usage controlled by ingestion;
- catalog output based on the last known canonical state.

## API envelopes

List:

```json
{
  "data": [/* repositories */],
  "pagination": {
    "limit": 20,
    "nextCursor": "..."
  }
}
```

Detail:

```json
{
  "data": {
    "id": "..."
  }
}
```

Errors retain RepoScout's existing structured form, for example:

```json
{
  "error": "repository_not_found",
  "message": "Repository was not found."
}
```

## Verification

Unit tests cover:

- default/bounded page limits;
- opaque cursor round-trip;
- invalid cursor rejection;
- stable date serialization;
- list response;
- next cursor behavior;
- invalid pagination;
- detail success;
- detail not found;
- malformed repository ID rejection.

PostgreSQL integration tests cover the complete path:

```text
Express
  ↓
RepositoryStore
  ↓
PostgreSQL
```

and verify:

- multiple pages traverse all records without duplicates;
- detail returns the canonical persisted repository;
- an empty catalog returns a valid empty response.

## Explicitly deferred

Phase 3A does not add:

- text search;
- filters;
- user-selectable sort;
- GitHub refresh-on-read;
- stars/forks/issues/releases;
- categories/topics/languages;
- repository health signals;
- frontend catalog UI;
- caching infrastructure;
- total-count queries.

Avoiding total counts is intentional: the first read API does not need an extra aggregate query for every catalog request.

## Status

Complete.

The Phase 3A branch passed the complete application, migration, persistence, ingestion, catalog, and PostgreSQL CI gates.

## Next checkpoint

Phase 3B should build the smallest **catalog web UI** against this API, including:

- loading state;
- empty state;
- API error state;
- repository cards/list;
- pagination interaction.

Metadata/signals expansion should remain separate from the first read UI.
