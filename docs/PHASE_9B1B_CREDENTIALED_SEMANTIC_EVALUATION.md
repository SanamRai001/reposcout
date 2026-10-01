# Phase 9B.1B — Credentialed Semantic Retrieval Evaluation

## Goal

Make the hardened real-repository semantic benchmark repeatable and auditable with a real embedding provider before RepoScout adopts vector persistence or changes public search.

Phase 9B.1B remains an **evaluation phase**.

It does not enable semantic retrieval in production.

## Current status

**Operational runner implemented; credentialed benchmark result still pending.**

The repository now contains everything required to run the evaluation through GitHub Actions or locally.

A valid OpenAI API credential is still required before RepoScout can record real provider quality, latency, usage, consistency, or an ADOPT/DEFER decision.

## Benchmark

The runner uses the frozen:

~~~text
semantic-retrieval-benchmark-v2
~~~

It contains:

- six real public repositories with README provenance;
- six lexical-hard natural-language queries;
- four intentionally ambiguous queries;
- a non-saturated deterministic lexical baseline.

The benchmark itself is unchanged by this phase.

## Repeated-run evaluation

The live evaluator can now run the same benchmark repeatedly:

~~~bash
npm run eval:semantic-retrieval:live:batch -w @reposcout/api -- \
  --runs 3 \
  --output-dir artifacts/semantic-evaluation
~~~

Supported runner bounds:

~~~text
1..10 runs
~~~

The GitHub workflow intentionally offers:

~~~text
1 / 3 / 5 runs
~~~

Three runs are the default consistency check.

Each repetition creates a raw result:

~~~text
run-01.json
run-02.json
run-03.json
...
~~~

The runner also creates:

~~~text
summary.json
~~~

## Repeatability summary

The summary records:

### Configuration

- benchmark version;
- provider;
- returned model;
- vector dimensions;
- run count.

Mixed benchmark versions or embedding configurations are rejected.

### Retrieval quality

Lexical metrics remain fixed and are verified not to drift between runs.

Semantic metrics are summarized with:

- minimum;
- maximum;
- mean;
- population standard deviation.

Metrics:

~~~text
Top-1 accuracy
MRR
Recall@3
~~~

The same statistics are calculated for semantic-minus-lexical deltas.

### Ranking consistency

The summary records:

~~~text
exactSemanticMetricsAgreement
semanticTop1AgreementRate
semanticTop3AgreementRate
~~~

These show whether repeated provider calls produce the same retrieval ordering for the frozen query set.

### Latency

The summary records distributions for:

- total evaluation elapsed time;
- provider request latency.

### Usage

When provider usage is available, the summary records:

- prompt tokens per run;
- total tokens per run;
- aggregate prompt tokens;
- aggregate total tokens.

RepoScout intentionally does **not** hard-code a dollar cost because provider pricing can change.

Cost should be calculated from the official provider price at the time the adoption decision is made.

## Manual GitHub Actions workflow

A new workflow is available:

~~~text
Semantic Retrieval Live Evaluation
~~~

Trigger it manually from GitHub Actions.

Inputs:

~~~text
model
dimensions
runs
~~~

Supported model choices:

~~~text
text-embedding-3-small
text-embedding-3-large
~~~

The workflow validates the manual model, dimensions, and run-count inputs before installing dependencies. Inputs enter shell commands through environment variables, rather than directly interpolating free-text workflow values into executable shell lines.

The workflow:

1. checks out the exact commit;
2. uses Node 24;
3. verifies that the repository secret `OPENAI_API_KEY` exists;
4. installs frozen dependencies with `npm ci`;
5. reruns offline provider-adapter tests;
6. reruns repeat-summary tests;
7. executes the credentialed benchmark;
8. publishes `summary.json` in the Actions job summary;
9. uploads raw runs and the summary as a 30-day artifact when available.

If a provider failure interrupts a repeated run, the artifact-upload step still attempts to retain any completed `run-XX.json` files. An incomplete run does not fabricate a `summary.json` or count as a completed evaluation.

No API key is written to the artifact.

## Required repository secret

The workflow expects:

~~~text
OPENAI_API_KEY
~~~

as a GitHub Actions repository secret.

The credential must not be committed to the repository or pasted into documentation.

The normal CI workflow remains credential-free and makes no live OpenAI API request.

## Current provider facts

At this phase checkpoint, the supported evaluation models remain:

~~~text
text-embedding-3-small
text-embedding-3-large
~~~

The provider configuration continues to support shortening embeddings through the `dimensions` parameter.

The live benchmark should normally start with:

~~~text
model: text-embedding-3-small
dimensions: 1536
runs: 3
~~~

A large-model comparison is optional evidence, not required for the first decision.

## Adoption review

The runner does **not** produce an automatic winner.

After a real run, review:

### Retrieval benefit

- semantic Top-1 vs lexical Top-1;
- semantic MRR vs lexical MRR;
- semantic Recall@3 vs lexical Recall@3;
- query-level improvements;
- query-level regressions.

### Stability

- repeat metric agreement;
- Top-1 agreement;
- Top-3 agreement.

### Operations

- request latency;
- total evaluation latency;
- token usage;
- current provider pricing;
- observed rate-limit/error behavior.

### Decision

Record exactly one:

~~~text
ADOPT
DEFER
~~~

with evidence and limitations.

An ADOPT decision permits planning Phase 9C.

A DEFER decision keeps current deterministic discovery unchanged and may trigger benchmark/provider experiments later.

## Safety boundary

Until the adoption decision exists, do not add:

- vector persistence;
- pgvector;
- embedding backfill;
- semantic public API;
- hybrid public search;
- natural-language filter parsing based on embeddings;
- production OpenAI credential requirements.

## Next action

Add `OPENAI_API_KEY` as a GitHub Actions repository secret and run:

~~~text
Actions
→ Semantic Retrieval Live Evaluation
→ Run workflow
~~~

Recommended first run:

~~~text
model: text-embedding-3-small
dimensions: 1536
runs: 3
~~~

Then review the artifact and record the Phase 9B.1B ADOPT/DEFER decision.
