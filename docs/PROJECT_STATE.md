# RepoScout Project State

## Objective

Implement the first deterministic Rising score over the Phase 7A ranking-signal contract using measured historical momentum as the dominant evidence, without exposing public ranking APIs or starting benchmark tuning.

## Branch

`feat/phase-7c-rising-v1`

Base: `main@7867c2b2beb2c1bd5a994321e3b2b0731e82595f`

PR: #46

## Completed phase

Phase 7C — Rising v1 deterministic scoring.

Phase 7 remains in progress.

## Changes

- Added versioned scorer `rising-v1`.
- Scoring consumes `ranking-signals-v1` only.
- Historical momentum supplies 95 of 100 possible points:
  - 7-day star momentum: 45 max;
  - 30-day star momentum: 35 max;
  - 30-day fork momentum: 15 max.
- Maintenance is optional support only, maximum 5 points.
- All three historical momentum signals are required.
- Missing/insufficient primary history returns explicit `ineligible`.
- Sparse history is bounded:
  - requested 7-day history may span at most 9 actual days;
  - requested 30-day history may span at most 35 actual days.
- Allowed sparse observations are normalized back to their requested 7/30-day equivalent before scoring.
- Positive normalized momentum uses bounded logarithmic curves.
- Saturation targets:
  - +25 stars / normalized 7d;
  - +100 stars / normalized 30d;
  - +15 forks / normalized 30d.
- Zero/negative movement receives zero momentum points.
- Lifetime stars/forks contribute zero score points and are returned only as visibility context.
- Maintenance freshness decays to zero over 90 days since push.
- Missing maintenance evidence gives zero support without invalidating sufficient historical momentum.
- Results expose exact historical provenance and normalized deltas.
- No public ordering, endpoint, persistence, Hidden Gems change, Jev/model signal, or benchmark tuning was added.

## Verification

- Phase 7B verified on `main@7867c2b2beb2c1bd5a994321e3b2b0731e82595f`.
- Phase 7C code head `9aa7c3aa1d727bf4f5fa099cb70066a2bfb37061`.
- GitHub Actions CI run 223: success before documentation-only follow-up commits.
- CI run 223 passed lint/typecheck/tests/build, production dependency audit, Jev harness, migration apply/rollback/reapply, repository/snapshot/history checks, ingestion/catalog/search/submission regressions, and PostgreSQL connectivity.
- Documentation-complete PR head must remain green before merge.

## Decisions / risks

- Rising v1 is a momentum ranking, not a popularity ranking.
- Lifetime stars/forks are context only and contribute zero score points.
- Sufficient 7-day and 30-day historical evidence is mandatory.
- Limited sparse-history overshoot is normalized rather than treated as exact coverage.
- Excessively sparse windows are ineligible instead of extrapolated.
- Positive momentum is rewarded; zero/negative momentum receives no momentum points.
- Maintenance contributes at most 5%, so it cannot substitute for growth.
- All targets, window tolerances, and weights are experimental v1 policy choices and must be evaluated/tuned in Phase 7E.
- Scores are recomputable derived output and are not persisted as canonical repository facts.

## Phase 7 breakdown

- 7A — ranking signal contract: complete.
- 7B — Hidden Gems v1 deterministic scoring: complete.
- 7C — Rising v1 deterministic scoring: complete.
- 7D — explanation/public ranking API: next.
- 7E — benchmark/evaluation + documented tuning.

## Next phase

Phase 7D — ranking explanation + public API.

Expose named Hidden Gems and Rising ranking modes over listed repositories with stable explanation payloads, deterministic ordering/pagination, and no hidden model influence.

Do not tune the formulas in 7D; benchmark/tuning remains Phase 7E.
