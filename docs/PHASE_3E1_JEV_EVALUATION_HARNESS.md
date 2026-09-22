# Phase 3E.1 — Jev Evaluation Harness

## Goal

Create a reproducible evaluation harness before adding a live Jev dependency.

Phase 3E.1 answers:

> How will RepoScout measure whether Jev is useful?

It does **not** answer:

> Is Jev already good enough for production?

No live Jev request is made in this phase.

## Why the harness comes first

RepoScout should not integrate a model and then invent success criteria afterward.

The evaluation harness is defined first so:
- labels exist before live results;
- metrics are stable before model selection;
- provider results can be replayed;
- failures are auditable;
- later model changes can be compared against the same benchmark version.

## Provider boundary

Phase 3E.1 adds a provider-neutral interface:

~~~text
JevEvaluationProvider
        |
        v
runJevEvaluation()
        |
        v
JevEvaluationRun
        |
        v
evaluateJevRun()
        |
        v
transparent metric report
~~~

The future TypeSafe/Jev adapter will implement this provider boundary.

Benchmark and scoring code do not depend on TypeSafe HTTP details.

## Seed benchmark

The first benchmark is deliberately small and synthetic.

Version:

~~~text
3e1-v1
~~~

It contains:
- 6 labeled repository cases;
- 5 query-to-repository relevance cases.

Repository cases represent:
- a typed SDK/library;
- a beginner tutorial;
- a self-hosted application;
- Kubernetes/infrastructure software;
- a React component library;
- a developer CLI tool.

The synthetic seed benchmark exists to verify:
- task definitions;
- result schema;
- evaluator math;
- provider orchestration.

It is **not** evidence of Jev quality.

A real RepoScout repository benchmark must follow before any production decision.

## Evaluated tasks

### Project type

Choice among:

~~~text
library
application
framework
developer_tool
educational
infrastructure
other
~~~

Metric:

~~~text
accuracy
~~~

### Tutorial/demo likelihood

Expected label:

~~~text
true / false
~~~

Provider result:

~~~text
probability 0..1
~~~

Metrics:
- thresholded accuracy at 0.5;
- Brier score.

The Brier score is retained because a calibrated probability is more useful than only a hard yes/no answer.

### Beginner suitability

Expected and predicted range:

~~~text
1..5
~~~

Metric:

~~~text
mean absolute error
~~~

The seed labels are intentionally approximate and include rationales.

This signal must not later be presented as objective repository fact.

### Query relevance

Expected and predicted range:

~~~text
1..5
~~~

Metric:

~~~text
mean absolute error
~~~

The query/repository cases are bounded reranking examples, not retrieval tests.

## Confidence

Where the provider exposes confidence for Choice/Score-style decisions, the run format preserves it.

The harness reports mean confidence but does not reward high confidence.

High confidence on wrong answers should remain visibly wrong.

## No composite quality score

Phase 3E.1 intentionally does **not** collapse metrics into one number.

A run report keeps separate:

~~~text
projectTypeAccuracy
tutorialDemoAccuracy
tutorialDemoBrierScore
beginnerSuitabilityMae
relevanceMae
meanConfidence
latencyMs
~~~

This prevents a weighted score from hiding important failure modes.

## Evaluation run provenance

Every run records:

~~~text
schemaVersion
benchmarkVersion
provider
model
runId
startedAt
completedAt
repositoryAssessments
relevanceAssessments
~~~

This makes results attributable and replayable.

## Runtime validation

Provider-result JSON is treated as untrusted external data.

Before scoring, RepoScout validates:
- top-level object shape;
- schema version;
- benchmark version;
- required strings;
- assessment arrays;
- unique case IDs;
- complete benchmark coverage;
- project-type vocabulary;
- probability bounds;
- score bounds;
- timestamp ordering.

Malformed provider output fails instead of being partially scored.

## Commands

Print the benchmark:

~~~bash
npm run eval:jev:benchmark -w @reposcout/api
~~~

Score a replayed result:

~~~bash
npm run eval:jev -w @reposcout/api -- ./path/to/evaluation-run.json
~~~

Run harness tests:

~~~bash
npm run test:evaluation -w @reposcout/api
~~~

## Live Jev API status

TypeSafe's current public API documentation exposes:
- Bearer API authentication;
- `GET /v1/models`;
- `POST /v1/systemone`;
- typed question families including yes/no, choice, and score.

Phase 3E.1 deliberately does not hard-code the live request/response mapping yet.

The adapter should be built only after its exact schema is validated against the current OpenAPI contract and a controlled credentialed request.

## Security

Phase 3E.1:
- requires no Jev API key;
- adds no model secret environment variable;
- makes no external model calls in CI;
- creates no model-assessment database table;
- does not send README or repository evidence to any third party.

## Explicitly deferred

Phase 3E.1 does not add:
- TypeSafe HTTP adapter;
- API key configuration;
- live Jev requests;
- model-result persistence;
- production ranking influence;
- moderation influence;
- real-repository benchmark labels;
- repeated-run consistency measurement;
- cost accounting from live usage;
- production thresholds.

## Status

Complete.

The Phase 3E.1 branch passed application verification, the dedicated Jev evaluation-harness gate, migration rollback/reapply, persistence, repository-content evidence, ingestion, catalog, and PostgreSQL regression checks.

## Next checkpoints

### Phase 3E.2 — Live Jev adapter + controlled smoke evaluation

Next:
- verify the exact current OpenAPI request/response contract;
- add server-side Jev credential configuration;
- implement the provider adapter;
- validate typed provider responses;
- run a small controlled benchmark;
- capture latency and provider/model provenance;
- keep all results non-production.

### Phase 3E.3 — Real RepoScout evaluation and adoption decision

Later:
- create a labeled set of real indexed repositories;
- include difficult/ambiguous examples;
- repeat runs for consistency;
- evaluate calibration, latency, and cost;
- compare against deterministic baselines where possible;
- document failure cases;
- decide which Jev tasks, if any, should enter the production roadmap.

No production model-assessment persistence should be added before that decision.
