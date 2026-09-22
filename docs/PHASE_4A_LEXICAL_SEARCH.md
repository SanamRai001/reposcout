# Phase 4A — Deterministic Lexical Search Foundation

## Goal

Add the first real repository search path without introducing relevance scoring, filters, semantic search, or Jev.

Phase 4A provides deterministic PostgreSQL lexical matching over canonical repository text.

## Endpoint

~~~text
GET /api/repositories/search?q=<query>&limit=<n>&cursor=<opaque>
~~~

Response:

~~~json
{
  "data": [],
  "search": {
    "query": "typescript backend"
  },
  "pagination": {
    "limit": 20,
    "nextCursor": null
  }
}
~~~

No total-count query is executed.

## Searchable fields

Phase 4A searches only canonical repository text:

~~~text
owner
name
full_name
description
~~~

Measured metadata such as topics/language and repository-content evidence are intentionally excluded from this first slice.

Those become later Phase 4 search/filter improvements.

## PostgreSQL semantics

Search uses:

~~~text
to_tsvector('simple', canonical repository text)
@@
plainto_tsquery('simple', normalized query)
~~~

`plainto_tsquery` is used deliberately so punctuation is interpreted as text separators rather than exposing web-search operator syntax.

All search values are parameterized.

## Query normalization

Search input is normalized before persistence:

- required string;
- trim outer whitespace;
- collapse repeated whitespace;
- lowercase;
- minimum 2 characters;
- maximum 120 characters;
- must contain at least one Unicode letter or number.

Invalid input returns:

~~~text
400 invalid_search_query
~~~

## Ordering

Phase 4A does **not** rank results by text relevance yet.

Matching rows are ordered by stable internal UUID:

~~~text
ORDER BY repository.id ASC
~~~

Reasons:
- deterministic output;
- exact keyset pagination;
- no floating-point rank cursor;
- no hidden relevance assumptions before ranking behavior is designed and tested.

Text relevance ranking is a later Phase 4 concern.

## Search cursors

Search pagination uses an opaque cursor containing:

~~~text
repository id
normalized search query
~~~

The API verifies that the cursor query matches the current normalized query.

This prevents a cursor generated for:

~~~text
react frontend
~~~

from being reused with:

~~~text
postgres database
~~~

Clients must continue treating cursors as opaque.

## Indexing

Phase 4A does not add a generated search vector or GIN index.

RepoScout's MVP index is intentionally curated and small.

The initial implementation computes the search vector in the query. Search indexing should be introduced only after:
- realistic repository volume exists;
- query plans are measured;
- latency demonstrates a need.

This avoids premature migration/index complexity.

## Jev boundary

Jev is not involved in Phase 4A.

Search flow:

~~~text
query
  |
normalize
  |
PostgreSQL lexical match
  |
stable deterministic page
  |
response
~~~

If Jev is later validated, it may only operate after deterministic candidate retrieval.

## Public UI

Phase 4A is backend-only.

It does not add:
- search input UI;
- filters;
- sorting controls;
- search snippets;
- highlighted terms.

The catalog browser remains unchanged.

## Verification

Tests cover:

- search-query normalization and bounds;
- query-bound cursor round-trip;
- cursor/query mismatch rejection;
- route normalization;
- invalid-query rejection before persistence;
- PostgreSQL multi-term matching;
- identity/description field matching;
- metadata preservation in search responses;
- stable paginated search without duplicates;
- empty valid search result pages.

## Explicitly deferred

Phase 4A does not add:

- relevance ranking;
- language filter;
- topic filter;
- license filter;
- stars/activity filters;
- archived/fork filters;
- README search;
- contribution-evidence search;
- snippets/highlighting;
- generated search-vector column;
- GIN index;
- semantic search;
- embeddings;
- Jev reranking;
- frontend search UI.

## Status

Complete.

The Phase 4A branch passed application verification, migration rollback/reapply, persistence, repository-content evidence, ingestion, catalog regression, PostgreSQL lexical-search integration, and PostgreSQL connectivity gates.

## Next checkpoint

Phase 4B should add the first explicit structured filters over already-authoritative metadata, likely starting with language, license, topics, fork/archive state, and bounded star ranges.

Filtering must remain deterministic and composable with lexical search.
