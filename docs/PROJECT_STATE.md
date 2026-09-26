# RepoScout Project State

## Objective

Define a versioned, explainable ranking-signal boundary before any Hidden Gems or Rising score is implemented.

## Branch

`main`

Current verified merge: `7d3f5a2600a8ad79446c832148425feef25ec78e`

PR #44: merged

## Completed phase

Phase 7A — Ranking signal contract.

Phase 7 remains in progress.

## Changes

- Added executable ranking signal contract version `ranking-signals-v1`.
- Added source provenance classes:
  - GitHub current facts;
  - GitHub evidence facts;
  - RepoScout deterministic current derivatives;
  - RepoScout deterministic historical derivatives.
- Added explicit signal roles:
  - visibility;
  - maintenance;
  - documentation;
  - community;
  - momentum;
  - context.
- Added deterministic signal extraction from:
  - current stars/forks;
  - GitHub push timestamp;
  - README evidence;
  - contribution/community-file evidence;
  - Phase 6 7-day and 30-day trend results.
- Zero remains an available measured value rather than becoming missing data.
- Missing values retain explicit reason:
  - `not_collected`;
  - `unavailable`;
  - `not_applicable`;
  - `insufficient_history`.
- Historical signal observations retain requested window, actual covered window, baseline day, and latest day.
- Added separate mode contracts:
  - `hidden-gems-signals-v1`;
  - `rising-signals-v1`.
- Hidden Gems primary signals emphasize visibility saturation context, maintenance recency, README evidence, and contribution guidance.
- Rising primary signals are historical momentum only:
  - 7-day star delta;
  - 30-day star delta;
  - 30-day fork delta.
- Raw popularity is supporting context for Rising, not primary momentum.
- 30-day open-issue change remains context only.
- No score, ranking order, endpoint, persisted ranking table, or model assessment was added.

## Verification

- Phase 6 verified on `main@5284df8855c42094494f41e70b69eddfb417caca`.
- Initial Phase 7A head `28401b93260e1c4c0a42cca654942d596ff94dce`: CI run 206 failed TypeScript verification because two new test/array types were narrower/wider than intended.
- Corrected Phase 7A code head `d928615830989ab18acc4255723b3cc0b254ad73`: CI run 207 success.
- Documentation-complete PR head `510db6c98139400d803f340e28ebd742f2fdcab2`: CI run 211 success.
- PR #44 merged as `7d3f5a2600a8ad79446c832148425feef25ec78e`.
- Post-merge `main` CI run 212: success.
- CI passed lint/typecheck/tests/build, production dependency audit, Jev harness, migration apply/rollback/reapply, repository/snapshot/history checks, ingestion/catalog/search/submission regressions, and PostgreSQL connectivity.

## Decisions / risks

- Phase 7A defines permitted deterministic evidence, not formulas or weights.
- Hidden Gems and Rising are separate ranking modes with separate primary/supporting/context signal roles.
- Missing evidence is never automatically converted to zero.
- Sparse Phase 6 history keeps actual-window provenance; later scoring must not silently treat an 8-day observation as exact 7-day data.
- Open-issue change is descriptive context, not a positive/negative quality direction.
- Current stars/forks are measured visibility facts; they are not universal quality measurements.
- Jev/model assessment is not part of the Phase 7A deterministic signal contract.
- Signal contracts are versioned independently from future scoring formulas.

## Phase 7 breakdown

- 7A — ranking signal contract: complete.
- 7B — Hidden Gems v1 deterministic scoring: next.
- 7C — Rising v1 deterministic scoring.
- 7D — explanation/public ranking API.
- 7E — benchmark/evaluation + documented tuning.

## Next phase

Phase 7B — Hidden Gems v1.

Implement the first deterministic Hidden Gems scorer over the versioned 7A signal snapshot, define minimum evidence/eligibility explicitly, prevent raw popularity from dominating, and keep every score component explainable.

Do not implement Rising v1 in the same phase.
