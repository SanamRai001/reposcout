# Phase 7D — Public Ranking API

## Goal

Expose the already-verified Hidden Gems and Rising formulas through a public API without changing their weights or introducing hidden model influence.

## Endpoint

~~~http
GET /api/repositories/rankings/:mode
~~~

Modes:

~~~text
hidden_gems
rising
~~~

Optional pagination:

~~~text
?limit=20
?cursor=<opaque>
~~~

Limit uses the existing repository API boundary:

~~~text
default = 20
maximum = 50
~~~

## Candidate set

Only listed repositories are ranking candidates.

The service reuses the existing `RepositoryCatalogReader`, whose public listing boundary was established during moderation work.

Unlisted repositories:
- are not scored;
- do not affect eligible counts;
- never appear in responses.

## Complete curated-catalog evaluation

Phase 7D evaluates the complete current listed catalog before sorting.

This deliberately avoids preselecting by:
- stars;
- repository ID;
- recent activity;
- another proxy.

A proxy preselection could exclude the actual best Hidden Gem or Rising candidate.

This approach is appropriate for RepoScout's current curated dataset.

## Ranking calculation

Each listed repository is evaluated using existing readers:

~~~text
catalog repository + metadata
README evidence
contribution evidence
7-day trend
30-day trend
        |
ranking-signals-v1
        |
hidden-gem-v1 / rising-v1
~~~

Ineligible results are omitted.

No provider requests occur during ranking.

## Ordering

Eligible items use:

~~~text
score descending
repository UUID ascending
~~~

UUID is a deterministic tie-breaker only.

It has no product/ranking significance.

## Cursor

An opaque ranking cursor stores:

~~~text
mode
formulaVersion
evaluatedAt
score
repositoryId
~~~

The parser verifies:
- mode matches the request;
- formula version matches the active formula;
- score is valid;
- repository ID is valid;
- evaluation time is valid.

A Hidden Gems cursor cannot be used for Rising.

A cursor from an old formula version cannot silently page a newer formula.

## Evaluation time

First page:

~~~text
evaluatedAt = service current time
~~~

Later page:

~~~text
evaluatedAt = cursor evaluatedAt
~~~

This keeps time-derived maintenance calculations anchored to the same timestamp during pagination.

## Live-data limitation

Phase 7D does **not** persist a ranking snapshot.

Therefore the cursor does not freeze:
- current repository metadata;
- README/community evidence;
- historical rows added after page one.

If evidence changes between requests, a repository can move relative to the cursor.

This limitation is explicit.

Persisted ranking snapshots should only be added if real usage requires immutable pagination or cheaper ranking reads.

## Response envelope

~~~text
data[]
ranking
pagination
~~~

Ranking metadata:

~~~text
mode
formulaVersion
evaluatedAt
evaluatedCount
eligibleCount
~~~

Pagination:

~~~text
limit
nextCursor
~~~

## Ranked repository item

Each item includes the canonical repository response already used by:

~~~text
GET /api/repositories
GET /api/repositories/:id
~~~

plus:

~~~text
ranking.mode
ranking.formulaVersion
ranking.score
ranking.explanation
~~~

## Hidden Gems explanation

The deterministic explanation exposes:

- score components;
- component maxima;
- positive subtotal;
- popularity saturation penalty;
- optional momentum coverage.

There is no generated prose.

## Rising explanation

The deterministic explanation exposes:

- score components;
- component maxima;
- normalized momentum deltas;
- exact history provenance;
- visibility context;
- maintenance coverage.

Lifetime visibility remains context only.

## Errors

Invalid mode:

~~~text
400 invalid_ranking_mode
~~~

Invalid/cross-mode/stale-formula cursor:

~~~text
400 invalid_ranking_cursor
~~~

Invalid page size:

~~~text
400 invalid_pagination
~~~

## Verification

Phase 7D verifies:

- only supported public modes;
- mode/formula-bound cursor parsing;
- stale formula cursor rejection;
- listed-only candidate evaluation;
- ineligible repository omission;
- score-tie ordering by UUID;
- page continuation without duplicate items;
- reuse of cursor evaluation time;
- Hidden Gems explanation transport;
- Rising history/visibility explanation transport;
- invalid mode errors;
- cross-mode cursor errors.

The PostgreSQL route coverage runs inside the existing repository catalog API CI gate.

Code head `1cbff9f6145bff1877ce0d249b57083d340a7fcc` passed GitHub Actions CI #231.

## Scaling note

The initial implementation deliberately reuses existing readers rather than adding a large joined ranking query.

This means multiple PostgreSQL reads per repository.

Optimize only after measuring:
- listed catalog size;
- ranking endpoint latency;
- database query volume;
- cache usefulness.

Any optimization must preserve the public ranking semantics.

## What Phase 7D does not do

No:
- formula weight tuning;
- benchmark claims;
- persisted ranking materialization;
- model/Jev reranking;
- frontend ranking screen.

## Next phase

Phase 7E — ranking benchmark, evaluation, and tuning.
