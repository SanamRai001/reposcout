# Phase 7C — Rising v1

## Goal

Implement a deterministic Rising ranking whose score is driven by measured historical growth rather than lifetime popularity.

## Formula version

~~~text
rising-v1
~~~

Signal contract:

~~~text
ranking-signals-v1
~~~

## Required history

Rising v1 requires:

- 7-day star delta;
- 30-day star delta;
- 30-day fork delta.

If any primary historical signal is missing or insufficient:

~~~text
status = ineligible
~~~

Lifetime stars or recent maintenance cannot replace missing momentum history.

## Sparse history

Phase 6 preserves requested and actual window lengths.

Rising v1 accepts limited sparse overshoot:

~~~text
7-day request:
  actual <= 9 days

30-day request:
  actual <= 35 days
~~~

Accepted sparse observations are normalized:

~~~text
normalized_delta =
  raw_delta * requested_days / actual_days
~~~

Example:

~~~text
27 stars over 9 actual days
requested window = 7

normalized = 27 * 7 / 9
           = 21 stars / normalized 7d
~~~

If sparse history exceeds the bound, scoring stops with:

~~~text
history_window_too_sparse
~~~

## Score composition

~~~text
7-day stars       max 45
30-day stars      max 35
30-day forks      max 15
maintenance       max  5
------------------------
total             max 100
~~~

Historical momentum controls 95% of the possible score.

## Momentum curves

Only positive normalized movement earns points.

Each component uses a bounded logarithmic curve.

v1 targets:

~~~text
+25 stars / normalized 7d    -> full 45
+100 stars / normalized 30d  -> full 35
+15 forks / normalized 30d   -> full 15
~~~

Values beyond a target do not exceed that component maximum.

Zero/negative movement earns zero momentum points.

## Maintenance support

Maintenance can add at most five points.

Its freshness support decays linearly to zero over 90 days since push.

Missing maintenance evidence gives zero maintenance points but does not invalidate sufficient historical momentum.

## Lifetime popularity

Current stars/forks are included only in:

~~~text
visibilityContext
~~~

They contribute zero score points.

This is intentional.

A repository with 500k lifetime stars and no recent growth should not outrank a smaller repository merely because it is famous.

## Explainability

Eligible results expose:

- formula version;
- signal contract version;
- final score;
- component points/maxima;
- normalized deltas;
- raw historical provenance;
- visibility context;
- maintenance coverage.

Ineligible results expose:
- missing primary historical signal + reason; or
- sparse-window signal + requested/actual/max span.

## Determinism

The scorer:
- does not call GitHub;
- does not query PostgreSQL;
- does not invoke Jev/model providers;
- does not use wall-clock time beyond the fixed ranking snapshot;
- does not persist scores.

Identical input produces identical output.

## Verification

Phase 7C tests verify:

- versioned score output;
- 95-point momentum dominance;
- all primary history required;
- excessive 7-day sparse history rejected;
- excessive 30-day sparse history rejected;
- allowed sparse history normalized correctly;
- lifetime stars/forks do not alter score;
- zero/negative growth earns zero momentum points;
- component caps;
- optional maintenance behavior;
- deterministic output.

Code head `9aa7c3aa1d727bf4f5fa099cb70066a2bfb37061` passed GitHub Actions CI #223.

## What Phase 7C does not do

No:
- public ranking endpoint;
- database candidate ordering;
- ranking pagination/cursor;
- persisted ranking table;
- formula benchmark claims;
- Jev/model reranking.

## Next phase

Phase 7D — ranking explanation + public API.
