# Phase 9B.1A — Hardened Retrieval Benchmark + Real Provider Adapter

## Goal

Strengthen semantic retrieval evaluation with a versioned real-repository benchmark and a credential-isolated real embedding provider adapter, without introducing vector persistence or changing public search.

This phase answers:

> Can RepoScout evaluate a real embedding provider against a harder, provenance-bound benchmark through the existing provider-neutral contract?

It does not claim that a live provider quality run has occurred unless a valid API credential is supplied and the live command succeeds.

## Benchmark v2

Version:

~~~text
semantic-retrieval-benchmark-v2
~~~

The v1 benchmark remains frozen and unchanged.

V2 freezes six real public repositories observed on 2026-09-26:

~~~text
immich-app/immich
n8n-io/n8n
pgvector/pgvector
shadcn-ui/ui
fastapi/fastapi
supabase/supabase
~~~

Each repository source records:

- repository full name;
- README ref;
- exact README blob SHA.

The corpus uses bounded frozen text rather than making live GitHub calls during evaluation.

## Query design

V2 contains:

~~~text
10 total queries
6 lexical-hard queries
4 ambiguous queries
~~~

Lexical-hard cases deliberately express repository intent through paraphrase/synonyms rather than repository names.

Ambiguous cases allow multiple relevant repository IDs when the user wording legitimately spans more than one project.

The benchmark verifies that the deterministic lexical baseline is no longer saturated:

~~~text
lexical Top-1 < 1.0
lexical MRR < 1.0
~~~

This is an evaluation-quality gate, not a requirement that any semantic provider must win.

## Evaluator compatibility

The semantic evaluator now accepts any versioned benchmark matching the shared repository/query shape.

This preserves:

- v1 historical results;
- v2 hardened evaluation;
- future versioned benchmark additions.

No existing public search behavior is changed.

## Real provider adapter

Phase 9B.1A adds a real OpenAI embeddings adapter behind the existing RepoScout provider-neutral contract.

The adapter uses:

~~~text
POST https://api.openai.com/v1/embeddings
~~~

Supported evaluation models:

~~~text
text-embedding-3-small
text-embedding-3-large
~~~

Default live-evaluation configuration:

~~~text
model: text-embedding-3-small
dimensions: 1536
timeout: 15000 ms
~~~

The adapter is implemented with the platform fetch API; no OpenAI SDK dependency is added.

## Provider validation

The live adapter preserves and validates:

- requested provider/model identity;
- returned model provenance;
- output index coverage;
- one vector per input;
- vector dimensions;
- finite vector values;
- non-zero vectors through the shared provider contract;
- usage token counts;
- request latency.

Stable error classes distinguish:

~~~text
request_failed
rate_limited
unauthorized
validation_error
invalid_response
~~~

## Credential isolation

OpenAI credentials are not part of normal application startup.

They are loaded only by the live evaluation command.

Evaluation-only environment variables:

~~~text
OPENAI_API_KEY
OPENAI_EMBEDDING_MODEL
OPENAI_EMBEDDING_DIMENSIONS
OPENAI_EMBEDDING_TIMEOUT_MS
~~~

No API key is committed.

## Live evaluation command

Run:

~~~bash
npm run eval:semantic-retrieval:live -w @reposcout/api
~~~

The command evaluates `semantic-retrieval-benchmark-v2` and prints:

- benchmark version;
- provider;
- model;
- dimensions;
- total evaluation elapsed time;
- provider request latency;
- provider token usage;
- lexical metrics;
- semantic metrics;
- metric deltas;
- per-query result evidence.

## CI behavior

CI does **not** call the live provider.

CI verifies the adapter with mocked HTTP responses, including:

- fixed endpoint;
- Bearer authentication;
- request body shape;
- response index-to-input mapping;
- usage parsing;
- model provenance drift;
- malformed/incomplete responses;
- 401/403 handling;
- 429 handling;
- provider validation failures;
- generic server failures.

This verifies protocol and safety behavior only.

It is not evidence of real provider retrieval quality.

## Verification

PR #55 implementation head:

~~~text
1565149a05aa329b203ada17d27860fbee94f269
~~~

passed CI #301 completely.

New gates passed:

~~~text
Verify hardened semantic benchmark
Verify live embedding provider adapter
~~~

All existing application, migration, persistence, discovery, ranking, contribution, submission, and PostgreSQL gates also passed.

## Live evaluation status

Credentialed real-provider evaluation has **not** been executed in this phase.

Reason:

~~~text
No OPENAI_API_KEY is available in the repository or conversation.
~~~

RepoScout therefore does not yet have measured:

- real OpenAI semantic retrieval metrics on v2;
- provider latency from an actual request;
- provider token usage from an actual request;
- cost evidence;
- rate-limit behavior from a real account;
- repeat-run consistency.

No adoption decision is made.

## Phase boundary

Phase 9B.1 is split into:

~~~text
9B.1A  hardened benchmark + real provider adapter   COMPLETE
9B.1B  credentialed real-provider evaluation       NEXT
~~~

Phase 9C remains blocked until 9B.1B produces enough evidence for an explicit adopt/defer decision.

## What this phase does not do

No:

- embedding persistence;
- pgvector/vector database;
- embedding backfill;
- semantic public API;
- hybrid public search;
- natural-language filter parser;
- provider adoption;
- production API-key requirement;
- change to GET /api/repositories/search.
