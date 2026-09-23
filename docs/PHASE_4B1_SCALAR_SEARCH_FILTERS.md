# Phase 4B.1 — Scalar Repository Search Filters

## Goal

Add the first structured filters on top of Phase 4A deterministic lexical search without changing ranking semantics or introducing new data sources.

Phase 4B.1 adds exact scalar filtering for:

~~~text
language
license
fork
archived
~~~

The lexical query remains required in this sub-phase.

## Endpoint

Phase 4B.1 extends:

~~~text
GET /api/repositories/search
~~~

Example:

~~~text
/api/repositories/search
  ?q=backend
  &language=typescript
  &license=mit
  &fork=false
  &archived=false
~~~

## Filter semantics

### language

Source:

~~~text
repository_metadata.primary_language
~~~

Matching:
- exact;
- case-insensitive;
- normalized to lowercase for the request scope.

A repository with missing metadata does not satisfy a language filter.

### license

Source:

~~~text
repository_metadata.license_spdx
~~~

Matching:
- exact;
- case-insensitive;
- normalized to lowercase.

A repository with no captured/detected SPDX value does not satisfy a license filter.

### fork

Source:

~~~text
repositories.is_fork
~~~

Accepted values:

~~~text
true
false
~~~

Matching is exact.

### archived

Source:

~~~text
repositories.is_archived
~~~

Accepted values:

~~~text
true
false
~~~

Matching is exact.

## Validation

Language/license:
- optional;
- 1–64 characters when supplied;
- whitespace trimmed/collapsed;
- lowercased;
- must contain at least one Unicode letter or number.

Fork/archive:
- optional;
- only boolean text values are accepted;
- input is case-insensitive.

Invalid filters return:

~~~text
400 invalid_search_filter
~~~

## Response

The normalized search scope is echoed:

~~~json
{
  "search": {
    "query": "backend",
    "filters": {
      "language": "typescript",
      "license": "mit",
      "fork": false,
      "archived": false
    }
  }
}
~~~

Repository records continue using the normal catalog response.

## SQL composition

The search query remains parameterized.

Conceptually:

~~~text
lexical match
AND lower(primary_language) = language
AND lower(license_spdx) = license
AND is_fork = fork
AND is_archived = archived
~~~

Only supplied filters add conditions.

No user filter value is interpolated into SQL text.

## Cursor scope

Phase 4A bound a cursor to the normalized lexical query.

Phase 4B.1 expands that rule.

The opaque cursor is now bound to:

~~~text
query
language
license
fork
archived
last repository UUID
~~~

Changing any one of these values invalidates the cursor.

This prevents pagination from silently crossing discovery scopes.

## Ordering

Filtering does not change ordering.

Matching rows remain:

~~~text
ORDER BY repository UUID ASC
~~~

This remains deterministic traversal order, not relevance rank.

## Missing data

Missing metadata is not interpreted as a match.

For example:

~~~text
language=typescript
~~~

requires known `primary_language = TypeScript`.

A repository whose metadata has not yet been collected is excluded from that filtered result instead of being guessed.

## Verification

Tests cover:
- language/license normalization;
- boolean filter validation;
- route filter propagation;
- invalid-filter rejection before persistence;
- exact PostgreSQL language/license matching;
- fork/archive filtering;
- missing-metadata exclusion;
- full-scope cursor binding;
- cursor rejection when one filter changes;
- existing unfiltered lexical search behavior.

## Explicitly deferred

Phase 4B.1 does not add:
- topic filters;
- star min/max ranges;
- activity/date filters;
- filter-only discovery without a lexical query;
- relevance sorting;
- popularity sorting;
- frontend filter controls;
- Jev reranking.

## Next checkpoint

Phase 4B.2 should add collection/numeric filters and complete the backend discovery filter surface:

- topics;
- minimum/maximum stars;
- filter-only discovery when no lexical query is supplied, if the API contract remains clean;
- cursor binding across those additional scope fields.

The search/discovery engine must remain deterministic and independent of Jev.
