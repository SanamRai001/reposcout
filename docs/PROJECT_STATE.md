# RepoScout Project State

## Objective

Close Phase 7 with a reproducible deterministic benchmark for Hidden Gems and Rising, verify the current formulas against explicit ranking invariants, report known failure risks separately, and avoid unsupported weight/threshold tuning.

## Branch

`feat/phase-7e-ranking-benchmark`

Base: `main@af818b7cb098408dc1c07135b16b3c689b19c4a3`

PR: #48

## Completed phase

Phase 7E — Ranking benchmark, evaluation, and documented tuning decision.

Phase 7 — Hidden Gems and Rising is implementation-complete on this branch, pending documentation-complete and merged-state verification.

## Changes

- Added offline deterministic benchmark version:
  - `ranking-benchmark-v1`.
- Benchmark contains 18 controlled synthetic ranking cases:
  - 7 Hidden Gems cases;
  - 11 Rising cases.
- Added 13 gating expectations covering:
  - Hidden Gems popularity saturation;
  - evidence-over-obscurity behavior;
  - mature supported repositories;
  - community evidence monotonicity;
  - required evidence eligibility;
  - optional historical eligibility;
  - Rising lifetime-popularity invariance;
  - sustained-vs-short-burst momentum;
  - strong-vs-weak momentum;
  - required historical eligibility;
  - sparse-history rejection;
  - optional maintenance;
  - sparse-window normalization.
- Added two explicit non-gating risk probes:
  - Hidden Gems community-file checklist sensitivity;
  - Rising artificial star/fork burst sensitivity.
- Added deterministic benchmark evaluator with formula-version provenance.
- Evaluator accepts alternate scorer functions so future formula revisions can be compared against the same benchmark.
- Added CLI:
  - `npm run eval:ranking -w @reposcout/api`.
- Added dedicated CI command:
  - `npm run test:ranking -w @reposcout/api`.
- Added CI step:
  - `Verify ranking benchmark`.
- Current formulas pass all 13 gating expectations.
- No `hidden-gem-v2` or `rising-v2` was created.
- No current weight, threshold, sparse-window tolerance, or saturation target was changed.
- No model/Jev reranking was introduced.

## Verification

- Phase 7D verified on `main@af818b7cb098408dc1c07135b16b3c689b19c4a3`.
- Initial Phase 7E head `8acab841017de6c124e343d2f9994d0efb091e27`:
  - CI run 242 failed lint because an intentionally omitted formula-version binding was unused.
- Follow-up head `a527f8c227f3cbfa694d45606429d800ffc57c1d`:
  - CI run 243 failed TypeScript because the sparse-history fixture helper inferred actual window days too narrowly.
- Corrected Phase 7E code head `f785dbf56cf99ff855470ed336d9d4af17802c87`:
  - CI run 244 success.
- CI run 244 passed:
  - application verification;
  - production dependency audit;
  - Jev harness;
  - dedicated ranking benchmark gate;
  - migration apply/rollback/reapply;
  - repository/snapshot/history checks;
  - ranking catalog API integration;
  - search/submission regressions;
  - PostgreSQL connectivity.
- Documentation-complete PR head must remain green before merge.

## Benchmark conclusion

The controlled benchmark does not justify changing `hidden-gem-v1` or `rising-v1`.

All 13 gating expectations pass.

Changing weights now would be tuning to intuition or to a synthetic fixture set rather than correcting an observed deterministic invariant failure.

The next formula revision should require a frozen dataset of real repository observations with documented human labels or another clearly defined ground truth.

## Known risks retained

### Hidden Gems community checklist sensitivity

Repository/community-file presence is useful evidence but can be created cheaply.

The benchmark reports this score exposure explicitly.

The current formula cannot distinguish a thoughtful contribution process from empty/template files using file-presence signals alone.

This needs richer evidence, not arbitrary lower weights based only on suspicion.

### Rising artificial growth bursts

The current history model measures star/fork count changes.

It cannot determine whether growth is organic, promotional, or manipulated.

A synthetic maximal growth burst can saturate Rising v1.

Anti-abuse protection requires richer provenance/activity/fraud signals; weight changes alone cannot establish authenticity.

## Decisions / risks

- The benchmark is intentionally offline and synthetic so CI is reproducible.
- Synthetic benchmark success is an invariant check, not proof that the formula is optimal in the real world.
- Risk probes are separated from pass/fail expectations so known signal limitations are not falsely presented as successful evidence.
- No model-assisted reranking is justified by this benchmark.
- Future formula changes must:
  1. use the same benchmark;
  2. document which failure they address;
  3. receive a new formula version;
  4. preserve deterministic fallback.
- Real-world benchmark expansion should freeze measured repository observations rather than querying live GitHub during CI.

## Phase 7 breakdown

- 7A — ranking signal contract: complete.
- 7B — Hidden Gems v1 deterministic scoring: complete.
- 7C — Rising v1 deterministic scoring: complete.
- 7D — explanation/public ranking API: complete.
- 7E — benchmark/evaluation + documented tuning: complete.
- Phase 7 — Hidden Gems and Rising: complete.

## Next phase

Phase 8 — Contribution Discovery.

Start with a narrow evidence contract before any "beginner friendly" score:

- contribution signals;
- good-first-issue/help-wanted discovery;
- contributor-friendly filters;
- evidence-based project recommendations;
- avoid equating labels alone with contributor friendliness.

Do not mix Phase 9 semantic search into Phase 8.
