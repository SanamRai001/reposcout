# Phase 4B.2 — Topic and Star-Range Search Filters

## Goal

Extend deterministic repository discovery with collection and numeric filters while preserving the Phase 4A/4B.1 search contract.

Phase 4B.2 adds:

~~~text
topic
minStars
maxStars
~~~

The lexical query remains required.

## Endpoint

Phase 4B.2 extends:

~~~text
GET /api/repositories/search
~~~

Example:

~~~text
/api/repositories/search
  ?q=backend+sdk
  &topic=typescript
  &topic=backend
  &minStars=100
  &maxStars=5000
~~~

Existing filters continue to compose:

~~~text
language
license
fork
archived
~~~

## Topic semantics

Source:

~~~text
repository_metadata.topics
~~~

Clients may repeat the `topic` query parameter.

Example:

~~~text
topic=backend&topic=sdk
~~~

Normalization:
- trim whitespace;
- collapse repeated whitespace;
- lowercase;
- deduplicate;
- sort into canonical order;
- maximum 10 supplied topic parameters;
- each value uses the existing 1–64 character bounded text-filter rule.

Matching is **all-topic containment**.

A repository must contain every normalized requested topic.

Conceptually:

~~~text
repository topics contains [backend, sdk]
~~~

A repository with only `backend` does not satisfy that request.

## Star-range semantics

Source:

~~~text
repository_metadata.stars
~~~

Filters:

~~~text
minStars
maxStars
~~~

Rules:
- optional;
- decimal digits only;
- nonnegative safe integers;
- bounds are inclusive;
- when both are present, `minStars <= maxStars`.

Examples:

~~~text
minStars=100
stars >= 100
~~~

~~~text
maxStars=5000
stars <= 5000
~~~

~~~text
minStars=100&maxStars=5000
100 <= stars <= 5000
~~~

## Missing metadata

Topic and star filters require measured metadata.

A repository whose metadata has not yet been collected does not satisfy:
- topic filters;
- minimum-star filters;
- maximum-star filters.

RepoScout does not guess missing topics or stars.

## Response

The normalized discovery scope is echoed:

~~~json
{
  "search": {
    "query": "backend sdk",
    "filters": {
      "language": null,
      "license": null,
      "topics": ["backend", "typescript"],
      "minStars": 100,
      "maxStars": 5000,
      "fork": false,
      "archived": false
    }
  }
}
~~~

## Cursor scope

The opaque search cursor now binds:

~~~text
query
language
license
topics
minStars
maxStars
fork
archived
last repository UUID
~~~

Topic arrays are normalized, deduplicated, and sorted before cursor creation.

Changing a topic or star bound invalidates the cursor.

This prevents pagination from crossing discovery scopes.

## PostgreSQL composition

Topic matching uses array containment over authoritative stored metadata.

Star comparisons use the measured bigint star count.

All user values remain parameterized.

Conceptually:

~~~text
lexical match
AND topics contains every requested topic
AND stars >= minStars
AND stars <= maxStars
AND existing Phase 4B.1 filters
~~~

Only supplied filters add predicates.

## Ordering

Phase 4B.2 does not change ordering.

Results remain:

~~~text
ORDER BY repository UUID ASC
~~~

This is deterministic traversal order, not relevance or popularity ranking.

Star bounds filter the candidate set; they do not sort by stars.

## Query requirement

Phase 4B.2 deliberately keeps `q` required.

Filter-only discovery would make the endpoint support a meaningfully different retrieval mode and requires:
- optional-query cursor semantics;
- empty-query validation rules;
- clearer frontend URL behavior.

That is deferred to a dedicated later phase rather than being hidden inside this filter change.

## Verification

Tests cover:
- repeated topic normalization;
- topic deduplication/sorting;
- maximum topic count;
- nonnegative star parsing;
- invalid star ranges;
- route propagation/response echo;
- all-topic PostgreSQL containment;
- inclusive star ranges;
- missing metadata exclusion;
- cursor invalidation when topic scope changes;
- cursor invalidation when star scope changes;
- existing scalar/unfiltered search regressions.

## Explicitly deferred

Phase 4B.2 does not add:
- filter-only discovery without `q`;
- OR-topic matching;
- topic autocomplete;
- fuzzy topic matching;
- star sorting;
- relevance sorting;
- activity/date filters;
- frontend search/filter controls;
- Jev reranking.

## Next checkpoint

Phase 4B.3 should decide and implement clean filter-only discovery, if we still want it, without changing the deterministic filter semantics established here.

After the backend discovery contract is complete, the next product-facing step should expose search and filters in the web UI.
