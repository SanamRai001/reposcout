# Phase 4B.3 — Filter-Only Repository Discovery

## Goal

Complete the backend structured-discovery contract by allowing the existing repository search endpoint to operate with structured filters even when no lexical query is supplied.

Phase 4B.3 does not create a second discovery endpoint.

It extends:

~~~text
GET /api/repositories/search
~~~

so discovery can be driven by:

~~~text
lexical query
OR
one or more structured filters
~~~

## Request modes

### Lexical discovery

Existing behavior remains valid:

~~~text
/api/repositories/search?q=backend
~~~

### Lexical + structured filters

~~~text
/api/repositories/search?q=backend&language=typescript&topic=sdk&minStars=100
~~~

### Filter-only discovery

New in Phase 4B.3:

~~~text
/api/repositories/search?language=typescript&topic=backend&minStars=100&fork=false
~~~

The normalized response reports query as null while preserving normalized filters.

## Empty discovery scope

The following is intentionally invalid:

~~~text
/api/repositories/search
~~~

because it contains no lexical query and no structured filters.

It returns:

~~~text
400 invalid_search_scope
~~~

The plain catalog endpoint already exists for unscoped repository traversal:

~~~text
GET /api/repositories
~~~

This avoids creating two APIs with identical behavior.

## Query semantics

The query parameter is now optional only when omitted.

~~~text
q omitted  -> query = null
q=backend  -> normalized lexical query
q=         -> invalid_search_query
q=---      -> invalid_search_query
q=a        -> invalid_search_query
~~~

An explicitly supplied invalid query is not silently ignored just because filters are also present.

## Filter semantics

Phase 4B.3 does not change existing filter behavior.

Supported filters remain:

~~~text
language
license
topic (repeatable)
minStars
maxStars
fork
archived
~~~

Existing normalization, missing-metadata behavior, containment rules, star-range rules, and exact boolean matching remain unchanged.

## PostgreSQL retrieval

When a lexical query exists:

~~~text
lexical condition
AND active structured filters
~~~

When the lexical query is absent:

~~~text
active structured filters only
~~~

RepoScout does not manufacture an empty full-text query.

All filter values remain parameterized.

## Ordering

Filter-only discovery preserves the existing deterministic order:

~~~text
ORDER BY repository UUID ASC
~~~

This is traversal order only, not relevance, popularity, star, or model order.

## Cursor scope

Search cursors now bind:

~~~text
query nullable
language
license
topics
minStars
maxStars
fork
archived
last repository UUID
~~~

For filter-only requests, query = null is part of the cursor scope.

A cursor created for filter-only discovery cannot be reused with a lexical query or changed filters.

Clients continue to treat cursors as opaque.

## Why keep one endpoint?

Creating a second filter endpoint would produce competing contracts for pagination, filters, response shape, frontend URLs, and future sorting.

The existing /api/repositories/search endpoint already represents scoped discovery. Phase 4B.3 expands that scope instead of creating a parallel API.

## Verification

Tests cover:
- omitted query normalization to null;
- lexical query behavior unchanged;
- empty query+filter scope rejection;
- explicit invalid/blank query rejection;
- filter-only route propagation;
- PostgreSQL filter-only matching;
- filter-only pagination;
- null-query cursor scope;
- cursor rejection when filters change;
- cursor rejection when switching from filter-only to lexical discovery;
- all existing lexical/filter regression behavior.

## Explicitly deferred

Phase 4B.3 does not add:
- frontend search/filter UI;
- relevance ranking;
- star/popularity sorting;
- activity/date filters;
- category filters;
- topic autocomplete;
- semantic search;
- Jev reranking.

## Status

Complete.

The Phase 4B.3 branch passed application verification, Jev-harness regression checks, migration apply/rollback/reapply, persistence, content evidence, ingestion, catalog, dedicated PostgreSQL discovery/search integration, and PostgreSQL connectivity.

## Next checkpoint

With the backend discovery contract complete, the next phase should expose deterministic search and filters in the web UI with shareable URL state, search loading/empty/error states, filter controls, cursor-aware load more, and no fake relevance claims.

Frontend work should consume the existing deterministic API instead of introducing client-side ranking logic.
