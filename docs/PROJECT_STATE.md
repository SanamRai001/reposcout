# RepoScout Project State

## Objective

Implement the first deterministic Hidden Gems score over the versioned Phase 7A ranking-signal contract without mixing in Rising, public ranking APIs, model inference, or benchmark tuning.

## Branch

`feat/phase-7b-hidden-gems-v1`

Base: `main@4b2d36526aad284e02536ea31bff450ce3b3a61e`

PR: #45

## Completed phase

Phase 7B — Hidden Gems v1 deterministic scoring.

Phase 7 remains in progress.

## Changes

- Added versioned scorer `hidden-gem-v1`.
- Scoring consumes `ranking-signals-v1` only.
- Required evidence is explicit:
  - stars;
  - days since push;
  - README observation;
  - CONTRIBUTING observation;
  - code-of-conduct observation;
  - issue-template observation;
  - pull-request-template observation;
  - security-policy observation.
- Missing/not-applicable required evidence returns an explicit `ineligible` result.
- Unsupported fork community evidence therefore makes v1 ineligible because the required evidence scope is unavailable; this is not a quality judgment against forks.
- Positive score components:
  - maintenance freshness: 35 points max;
  - README presence: 20 points max;
  - CONTRIBUTING presence: 20 points max;
  - four community-readiness files: 20 points max;
  - optional 30-day momentum bonus: 5 points max.
- Maintenance contribution decays linearly to zero over 365 days since the last push.
- Low stars never award positive quality points.
- Popularity only subtracts a bounded saturation penalty:
  - no penalty through 250 stars;
  - logarithmic growth after 250;
  - capped at 25 points at 50,000+ stars.
- Positive 30-day star/fork movement can add at most 5 points.
- Negative momentum does not penalize Hidden Gems v1.
- Missing/insufficient 30-day history is allowed and reported as missing optional momentum coverage.
- Results expose component points, maximum points, positive subtotal, popularity penalty, and optional-history coverage.
- No public ordering, endpoint, persistence, Rising formula, or Jev/model signal was added.

## Verification

- Phase 7A verified on `main@4b2d36526aad284e02536ea31bff450ce3b3a61e`.
- Phase 7B code head `c44ff0b65910945b61ff7242979a3580b491d871`.
- GitHub Actions CI run 214: success before documentation-only follow-up commits.
- CI run 214 passed lint/typecheck/tests/build, production dependency audit, Jev harness, migration apply/rollback/reapply, repository/snapshot/history checks, ingestion/catalog/search/submission regressions, and PostgreSQL connectivity.
- Documentation-complete PR head must remain green before merge.

## Decisions / risks

- Hidden Gems v1 is a named ranking mode, not a universal repository quality score.
- Low visibility only avoids a saturation penalty; it does not create positive quality points.
- The formula strongly depends on repository/community-file evidence, so v1 intentionally refuses to score when those required observations are missing.
- Forks with unsupported community evidence are excluded by evidence coverage, not by a negative fork rule.
- Momentum is optional and capped at 5% of positive points so Hidden Gems does not collapse into Rising.
- Negative 30-day momentum is not penalized because stable/mature small repositories can still be valuable.
- The 250-star free band, 50k saturation point, 365-day maintenance horizon, and all component weights are experimental v1 policy choices and must be benchmarked/tuned in Phase 7E.
- Scores are computed in memory and remain recomputable; they are not persisted as canonical repository facts.

## Phase 7 breakdown

- 7A — ranking signal contract: complete.
- 7B — Hidden Gems v1 deterministic scoring: complete.
- 7C — Rising v1 deterministic scoring: next.
- 7D — explanation/public ranking API.
- 7E — benchmark/evaluation + documented tuning.

## Next phase

Phase 7C — Rising v1.

Implement a momentum-first deterministic scorer requiring sufficient historical evidence, preserve sparse-window provenance, and ensure lifetime popularity cannot substitute for measured growth.

Do not expose public ranking order/API yet; that remains Phase 7D.
