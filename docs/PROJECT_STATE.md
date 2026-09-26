# RepoScout Project State

## Objective

Evaluate semantic repository retrieval against RepoScout's existing lexical baseline before committing to a production embedding provider, vector persistence, or public semantic-search behavior.

## Branch

`main`

Current verified merge:

`e5395afab5d371598de4cbedfab5771032b3c57b`

PR #54: merged.

## Completed phase

Phase 9B — embedding provider contract + offline retrieval evaluation.

Phase 9 remains in progress.

## Changes

- Added a provider-neutral repository embedding contract.
- Added strict validation for:
  - non-empty provider/model provenance;
  - bounded positive integer dimensions;
  - exact one-vector-per-input coverage;
  - input/output ID integrity and uniqueness;
  - exact vector dimensions;
  - finite vector values;
  - non-zero vectors.
- Added deterministic CI-only embedding fixture:
  - provider: `reposcout-fixture`;
  - model: `concept-axes-v1`;
  - dimensions: 6.
- Added versioned offline evaluation schema:
  - `semantic-retrieval-evaluation-v1`.
- Added lexical baseline and semantic cosine retrieval over the same benchmark corpus.
- Added retrieval metrics:
  - Top-1 accuracy;
  - mean reciprocal rank;
  - Recall@3.
- Added per-query evidence:
  - lexical top 3;
  - semantic top 3;
  - first relevant rank for each method.
- Added machine-readable evaluation CLI:
  - `npm run eval:semantic-retrieval -w @reposcout/api`.
- Added dedicated semantic-evaluation CI gate.
- Initial CI #293 correctly exposed an invalid test assumption:
  - the frozen Phase 9A benchmark already gives lexical Top-1 = 1.0;
  - fixture semantic Top-1 = 1.0;
  - the fixture therefore cannot honestly be claimed to beat lexical on v1.
- Corrected the tests/CLI instead of weakening lexical search or rewriting v1 to force a semantic win.
- Added a controlled lexical-hard test proving the evaluator can detect semantic improvement when a retrieval difference actually exists.
- Updated roadmap/README to keep Phase 9C blocked until stronger evaluation justifies persistence.
- No production provider, API key/config, pgvector/vector database, embedding persistence, semantic route, hybrid search, or natural-language filter parser was added.

## Verification

- Phase 9A final project-state checkpoint: `main@91b924261d47cdf628bf3a5ea8fada888d54a6ad`.
- Initial Phase 9B head `730ffbadf66408319987730e2abce2c8d9f20c4f`: CI #293 failed only because the evaluation test incorrectly required semantic > lexical on a saturated benchmark.
- Corrected Phase 9B implementation head `ecf2ff35644ae8e9a5399f2387c4ae6a572508e1`: CI #294 success.
- Phase 9B documentation-complete head `90fb930dd3fad3e93f8207fcbc57b7b8d3fbc6d0`: CI #297 success.
- PR #54 merged with the exact CI-green head as `e5395afab5d371598de4cbedfab5771032b3c57b`.
- CI #294 and #297 passed:
  - application lint/typecheck/unit tests/build;
  - production dependency audit;
  - Jev evaluation harness;
  - repository ranking benchmark;
  - contribution recommendation benchmark;
  - semantic discovery foundation;
  - semantic retrieval evaluation;
  - migration apply/rollback/reapply;
  - repository schema checks;
  - repository persistence;
  - snapshot persistence/trends;
  - repository content evidence;
  - GitHub ingestion;
  - contribution-issue persistence;
  - contribution discovery;
  - catalog;
  - lexical search;
  - submission workflows;
  - PostgreSQL connectivity.

## Evaluation result

The frozen `semantic-retrieval-benchmark-v1` does not currently distinguish semantic retrieval from lexical retrieval at the top of the ranking:

~~~text
lexical Top-1 accuracy = 1.0
fixture semantic Top-1 accuracy = 1.0

lexical MRR = 1.0
fixture semantic MRR = 1.0
~~~

This means the current benchmark is too easy to justify production embedding adoption.

It does **not** mean semantic retrieval has no value.

It means RepoScout needs harder and more representative evidence before paying the architecture/storage/operational cost of vector persistence.

## Decisions / risks

- The deterministic fixture verifies infrastructure only; it is not a production-quality embedding model.
- The Phase 9A v1 benchmark is retained as historical/frozen evaluation input rather than mutated to manufacture a semantic advantage.
- Lexical search remains the production baseline.
- No provider/storage choice is justified by Phase 9B.
- Phase 9C remains blocked.
- A real provider must use the same validation/evaluation boundary and retain provider/model/dimension provenance.
- Before persistence, evaluation should include lexical-hard, ambiguous, and real-repository observations plus latency/cost/failure behavior.
- Evaluation CLI is observational and does not fail because semantic ties or loses to lexical.
- Public `GET /api/repositories/search` behavior remains unchanged.
- No personal/contributor data was added.

## Phase 9 breakdown

- 9A — semantic document + retrieval benchmark foundation: complete.
- 9B — embedding provider contract + offline retrieval evaluation: complete.
- 9B.1 — retrieval benchmark hardening + real-provider evaluation: next.
- 9C — embedding persistence + bounded backfill: blocked until 9B.1 justifies adoption.
- 9D — semantic similarity API: later.
- 9E — hybrid lexical + semantic discovery: later.
- 9F — bounded natural-language query interpretation: later, only if still useful.

## Next phase

Phase 9B.1 — retrieval benchmark hardening + real-provider evaluation.

Add a new versioned lexical-hard/ambiguous benchmark and evaluate a real embedding provider through the existing provider-neutral boundary.

Do not create vector persistence or alter the public search endpoint until that evaluation provides evidence for adoption.
