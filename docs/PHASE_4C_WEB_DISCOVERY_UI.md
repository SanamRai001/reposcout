# Phase 4C — Web Discovery UI

## Goal

Expose RepoScout's deterministic Phase 4A/4B discovery backend in the browser without adding client-side ranking, hidden heuristics, or model dependence.

Phase 4C adds:
- lexical search controls;
- structured filters;
- filter-only discovery;
- URL-backed discovery scope;
- browser back/forward support;
- discovery loading/empty/error states;
- cursor-aware load more.

## Discovery surface

The browser now exposes the existing backend discovery contract:

~~~text
q
language
license
topic
minStars
maxStars
fork
archived
~~~

Search text is optional when at least one structured filter is active.

Topics are entered as comma-separated values and normalized into repeated `topic` query parameters.

## Apply-on-submit interaction

Discovery is applied when the user submits the form.

RepoScout deliberately does not issue a network request on every keystroke.

This keeps:
- request volume bounded;
- URL/history updates intentional;
- discovery state reproducible;
- incomplete intermediate filters from causing unnecessary API errors.

## Shareable URL state

The browser URL stores only the normalized discovery scope.

Example:

~~~text
/?q=typescript+backend&language=typescript&topic=sdk&minStars=100&fork=false
~~~

The URL does not contain:
- pagination cursors;
- loaded-page count;
- transient loading/error state.

This makes copied URLs stable descriptions of discovery intent rather than snapshots of one pagination session.

## Browser navigation

Applying or clearing discovery uses browser history.

Back/forward navigation:
- rereads the URL;
- restores form controls;
- resets current loaded results;
- runs the matching catalog/discovery request.

## Pagination

The browser keeps the opaque server cursor only in component state.

Load-more requests reuse:
- the active normalized discovery scope;
- the returned opaque cursor;
- the normal page size.

The frontend does not decode or alter the cursor.

Duplicate repository IDs are defensively removed when appending a page.

## No client-side ranking

The UI preserves backend result order exactly.

Phase 4C does not:
- sort by stars;
- sort by recency;
- infer relevance;
- move exact-name matches;
- rerank with Jev;
- create a "best" result.

The interface explicitly tells users that current results use deterministic traversal order rather than relevance ranking.

## Filters

### Language

Free-text exact backend filter.

Example:

~~~text
typescript
~~~

### License

Free-text SPDX filter.

Example:

~~~text
mit
~~~

### Topics

Comma-separated input.

Example:

~~~text
backend, sdk
~~~

The browser:
- trims values;
- lowercases them;
- removes duplicates;
- sorts them before URL serialization.

Backend semantics remain all-topic containment.

### Stars

Minimum and maximum star inputs accept nonnegative whole numbers.

The browser rejects:
- non-numeric values;
- unsafe integers;
- minimum greater than maximum.

### Fork/archive state

Tri-state controls:

~~~text
Any
true
false
~~~

The UI presents those as human-readable choices such as "Not forks" and "Active only".

## Empty states

### Catalog empty

Shown when the unfiltered catalog contains no repositories.

### Discovery empty

Shown when a valid discovery scope returns no matches.

The discovery empty state offers a direct return to the full catalog.

These states remain distinct so "no indexed data" is not confused with "no matches."

## Errors

Initial catalog/discovery errors replace the result region and provide retry.

Load-more errors preserve already loaded repositories.

Form validation errors remain local to the discovery form and do not erase existing results.

## URL/client normalization

The web client includes reusable helpers for:
- normalizing discovery scope;
- reading scope from URL search parameters;
- serializing scope into a stable URL;
- validating discovery API responses.

The discovery response validator checks:
- canonical repository items;
- nullable query;
- language/license;
- topic array;
- nonnegative star bounds;
- nullable fork/archive booleans;
- bounded pagination contract.

## Responsive behavior

Desktop:
- wide search control;
- structured filter grid;
- active-scope chips;
- existing three-column repository cards.

Tablet:
- filter grid collapses to two columns.

Mobile:
- controls stack into one column;
- actions become full-width;
- active scope stacks above chips;
- repository cards remain single-column.

## Explicitly deferred

Phase 4C does not add:
- relevance ranking;
- sort controls;
- autocomplete;
- suggested filter values;
- language/license/topic taxonomy endpoints;
- repository detail page;
- README/content search;
- semantic search;
- Jev reranking;
- saved searches.

## Verification

Phase 4C verification includes:
- catalog client regression tests;
- discovery scope normalization;
- deterministic URL serialization;
- filter-only URL parsing;
- repeated-topic request serialization;
- discovery response validation;
- web TypeScript validation;
- production web build;
- existing API/database/content/search regression gates.

## Status

Complete.

The Phase 4C branch passed web tests, lint, TypeScript validation, production web build, Jev harness regression checks, migration apply/rollback/reapply, repository persistence/content/ingestion/catalog/search integration gates, and PostgreSQL connectivity.

## Next checkpoint

After Phase 4C, the next discovery phase should decide whether to add deterministic sort/relevance behavior or move to the next MVP product loop.

Any ranking/sorting mode must be named and explainable rather than silently changing the meaning of the default results.
