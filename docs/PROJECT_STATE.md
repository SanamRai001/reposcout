# RepoScout Project State

## Objective

Expose the deterministic Hidden Gems and Rising scorers through a public listed-only ranking API with stable explanation payloads and scope-bound pagination, without tuning formulas or persisting ranking state.

## Branch

`main`

Current verified merge: `051847a79bd4b75d0f8d20cf1239ae3df96c632c`

PR #47: merged

## Completed phase

Phase 7D — Ranking explanation + public API.

Phase 7 remains in progress.

## Changes

- Added public ranking endpoint:
  - `GET /api/repositories/rankings/hidden_gems`;
  - `GET /api/repositories/rankings/rising`.
- Ranking candidates come only from the existing listed repository catalog.
- Unlisted moderation candidates are neither evaluated nor exposed.
- The current curated MVP evaluates the complete listed catalog before ordering; no partial preselection can hide a better-ranked repository.
- Ineligible repositories are omitted from public ranking results.
- Eligible ordering is deterministic:
  1. score descending;
  2. repository UUID ascending.
- Added opaque ranking cursors bound to:
  - ranking mode;
  - active formula version;
  - evaluation timestamp;
  - last score;
  - last repository ID.
- Cross-mode and stale-formula cursors are rejected.
- Cursor continuation reuses the original evaluation timestamp.
- Ranked repositories use the same canonical public repository serializer as the catalog/detail API.
- Hidden Gems explanations expose:
  - component points/maxima;
  - positive subtotal;
  - popularity saturation penalty;
  - optional momentum coverage.
- Rising explanations expose:
  - component points/maxima;
  - normalized momentum deltas;
  - exact history coverage;
  - lifetime visibility context;
  - maintenance coverage.
- Formula versions remain frozen:
  - `hidden-gem-v1`;
  - `rising-v1`.
- No ranking score table, model/Jev influence, or formula tuning was added.
- Added route/cursor unit tests and PostgreSQL ranking API integration coverage.
- Ranking route integration is part of the existing catalog API CI gate.

## Verification

- Phase 7C verified on `main@79009e3edc9042234fdbab5fa3ec265c1b334e7e`.
- Phase 7D code head `1cbff9f6145bff1877ce0d249b57083d340a7fcc`: CI run 231 success.
- Documentation-complete PR head `d06e24ca572a7683ca2047f2dd5ce5a165aba990`: CI run 239 success.
- PR #47 merged as `051847a79bd4b75d0f8d20cf1239ae3df96c632c`.
- Post-merge `main` CI run 240: success.
- CI passed lint/typecheck/tests/build, dependency audit, Jev harness, migration apply/rollback/reapply, repository/snapshot/history checks, ranking catalog API integration, search/submission regressions, and PostgreSQL connectivity.

## Decisions / risks

- Public ranking remains deterministic and model-free.
- Ranking evaluates only public/listed repositories.
- The current service reuses existing catalog/evidence/trend readers instead of adding duplicate ranking SQL.
- This creates more database reads than a future bulk ranking read path, but preserves established publication/history semantics for the curated MVP.
- Ranking pages are deterministic for the evidence state they evaluate, but they are not immutable database snapshots.
- The cursor fixes ranking mode, formula version, evaluation time, score boundary, and UUID tie-breaker.
- If repository metadata/evidence changes between page requests, live ranks may move because Phase 7D intentionally persists no ranking snapshot.
- Persisted/materialized ranking snapshots should only be introduced later if usage/performance/product requirements justify them.
- Ineligible repositories are omitted rather than publicly exposing internal evidence gaps.
- Explanation payloads are structured facts/components, not generated prose.
- Formula tuning remains strictly deferred to Phase 7E.

## Phase 7 breakdown

- 7A — ranking signal contract: complete.
- 7B — Hidden Gems v1 deterministic scoring: complete.
- 7C — Rising v1 deterministic scoring: complete.
- 7D — explanation/public ranking API: complete.
- 7E — benchmark/evaluation + documented tuning: next.

## Next phase

Phase 7E — ranking benchmark, evaluation, and tuning.

Build a reproducible labeled/manual evaluation set for Hidden Gems and Rising, measure popularity dominance and ranking failure cases, compare formula revisions, and document every threshold/weight change.

Do not add model-assisted reranking unless deterministic benchmarks first show a specific gap and a bounded experiment demonstrates improvement.
