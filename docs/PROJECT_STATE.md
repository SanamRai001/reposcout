# RepoScout Project State

## Objective

Harden semantic retrieval evaluation with real repository observations and a real-provider adapter while keeping production search deterministic until a credentialed evaluation justifies semantic persistence.

## Branch

`main`

Current verified merge:

`b7baf53b0fe0383ed474618a2dbde1ab80c787f4`

PR #55: merged.

## Completed phase

Phase 9B.1A — hardened retrieval benchmark + real-provider adapter.

Phase 9B.1 remains in progress because the credentialed live provider evaluation has not run.

## Changes

- Added `semantic-retrieval-benchmark-v2`.
- Kept `semantic-retrieval-benchmark-v1` frozen and unchanged.
- V2 freezes six real public repositories observed on 2026-09-26:
  - `immich-app/immich`;
  - `n8n-io/n8n`;
  - `pgvector/pgvector`;
  - `shadcn-ui/ui`;
  - `fastapi/fastapi`;
  - `supabase/supabase`.
- Recorded README ref + exact README blob SHA for every real benchmark repository.
- Added 10 harder natural-language queries:
  - 6 lexical-hard cases;
  - 4 intentionally ambiguous cases with multi-repository relevance where appropriate.
- Added a benchmark gate requiring the lexical v2 baseline to be below perfect Top-1/MRR, proving v2 is materially harder than v1.
- Generalized the semantic evaluator to accept versioned benchmark contracts without rewriting v1.
- Added a credential-isolated OpenAI embedding evaluation adapter behind the existing provider-neutral contract.
- Supported current evaluation models:
  - `text-embedding-3-small`;
  - `text-embedding-3-large`.
- Default live evaluation:
  - model `text-embedding-3-small`;
  - 1536 dimensions;
  - 15-second request timeout.
- Added strict live response validation for:
  - fixed API origin;
  - Bearer authentication;
  - returned model provenance;
  - response index coverage;
  - vector mapping;
  - usage token counts;
  - malformed/incomplete provider responses;
  - unauthorized/rate-limit/validation/server failures.
- Added live telemetry:
  - provider request latency;
  - total evaluation elapsed time;
  - prompt/total token usage.
- Added command:
  - `npm run eval:semantic-retrieval:live -w @reposcout/api`.
- Added evaluation-only env examples:
  - `OPENAI_API_KEY`;
  - `OPENAI_EMBEDDING_MODEL`;
  - `OPENAI_EMBEDDING_DIMENSIONS`;
  - `OPENAI_EMBEDDING_TIMEOUT_MS`.
- Added dedicated CI gates:
  - hardened semantic benchmark;
  - live embedding provider adapter.
- No API credential, vector persistence, pgvector, semantic HTTP route, hybrid public search, or public search change was added.

## Verification

- Phase 9B final checkpoint: `main@dff7022b501c9697acb311683c9dc89dbc631b64`.
- Phase 9B.1A implementation head `1565149a05aa329b203ada17d27860fbee94f269`: CI #301 success.
- Phase 9B.1A documentation-complete head `8504301148e1c1437abec14b5f21929729b63878`: CI #306 success.
- PR #55 merged with the exact CI-green head as `b7baf53b0fe0383ed474618a2dbde1ab80c787f4`.
- CI #301 and #306 passed:
  - application lint/typecheck/unit tests/build;
  - production dependency audit;
  - Jev evaluation harness;
  - repository ranking benchmark;
  - contribution recommendation benchmark;
  - semantic discovery foundation;
  - semantic retrieval evaluation;
  - hardened semantic benchmark;
  - live embedding provider adapter;
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

## Live evaluation status

A credentialed real OpenAI embeddings evaluation has **not** been executed.

Reason:

- no `OPENAI_API_KEY` is available in the repository or this conversation.

Therefore RepoScout does not yet have real measured:

- semantic retrieval quality on v2 from an external embedding model;
- actual provider latency;
- provider usage/cost;
- real-account rate-limit behavior;
- repeat-run consistency.

No ADOPT/DEFER provider decision is claimed yet.

## Decisions / risks

- V2 uses real repository observations and explicit README provenance, but it is still a small curated benchmark rather than broad ground truth.
- Lexical-hard queries are designed to reduce exact-token advantage without intentionally making lexical search fail every case.
- Ambiguous queries permit multiple relevant results instead of forcing false single-winner labels.
- The OpenAI adapter is isolated from normal application startup and does not make an API credential a production requirement.
- Mocked HTTP tests validate protocol and error handling only; they are not provider-quality evidence.
- Official OpenAI embeddings behavior was re-verified before implementing the adapter.
- The live evaluation command is observational and does not change application data.
- Phase 9C remains blocked.
- Public `GET /api/repositories/search` remains unchanged.
- No personal/contributor data was added.

## Phase 9 breakdown

- 9A — semantic document + retrieval benchmark foundation: complete.
- 9B — embedding provider contract + offline retrieval evaluation: complete.
- 9B.1A — hardened real-repository benchmark + real-provider adapter: complete.
- 9B.1B — credentialed real-provider evaluation + adoption decision: next.
- 9C — embedding persistence + bounded backfill: blocked until 9B.1B justifies adoption.
- 9D — semantic similarity API: later.
- 9E — hybrid lexical + semantic discovery: later.
- 9F — bounded natural-language query interpretation: later, only if still useful.

## Next phase

Phase 9B.1B — credentialed real-provider evaluation + adoption decision.

Run the v2 benchmark through the live OpenAI adapter with an evaluation credential, capture retrieval metrics/latency/usage/repeatability, and make an explicit ADOPT or DEFER decision.

Do not create vector persistence or alter the public search endpoint before that decision.
