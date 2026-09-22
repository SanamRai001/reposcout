# Phase 3E.2 — Live Jev Adapter + Controlled Smoke Evaluation

## Goal

Connect RepoScout's provider-neutral Phase 3E.1 harness to TypeSafe System One / Jev without introducing any production ranking, moderation, or persistence dependency.

Phase 3E.2 adds:
- exact TypeSafe System One wire mapping;
- server-side evaluation credentials;
- model discovery;
- validated response handling;
- a credential-gated live smoke command;
- offline CI coverage with mocked TypeSafe responses.

## Verified wire contract

RepoScout reviewed the current TypeSafe OpenAPI contract before implementing the adapter.

Relevant operations:

~~~text
GET  /v1/models
POST /v1/systemone
~~~

Authentication:

~~~text
Authorization: Bearer <API_KEY>
~~~

System One request shape:

~~~text
state
model
questions
~~~

Supported question families used by RepoScout:

~~~text
noul
choice
score
~~~

System One response:

~~~text
model
answers
usage
~~~

RepoScout validates these responses at runtime before converting them into evaluation results.

## Benchmark mapping

### Repository project type

RepoScout uses a TypeSafe `choice` question.

Choices:

~~~text
library
application
framework
developer_tool
educational
infrastructure
other
~~~

### Tutorial/demo likelihood

RepoScout uses a TypeSafe `noul` question.

The returned `noul` value is treated as the probability that the repository is primarily a tutorial/demo/educational artifact.

### Beginner suitability

RepoScout uses a TypeSafe `score` question with five ordered rubric levels.

TypeSafe score positions are zero-based:

~~~text
0..4
~~~

RepoScout's benchmark is one-based:

~~~text
1..5
~~~

The adapter therefore converts:

~~~text
RepoScout score = TypeSafe score + 1
~~~

Fractional expected scores are preserved.

### Query relevance

Query relevance also uses a five-level TypeSafe `score` rubric and the same zero-based to one-based conversion.

## Request structure

Repository evaluation sends structured state rather than a prose mega-prompt.

The state contains:

~~~text
repository
description
primary_language
topics
readme_excerpt
contribution_evidence
~~~

For each repository case, RepoScout sends three questions in one System One request:

~~~text
project_type
tutorial_demo
beginner_suitability
~~~

Each query-relevance case uses its own state because the query/repository pair differs.

The current seed benchmark therefore performs:

~~~text
6 repository evaluation calls
5 relevance calls
= 11 System One calls
~~~

## Model provenance

The configured model may be an alias such as:

~~~text
jev-latest
~~~

TypeSafe may return the concrete model actually used.

RepoScout records the resolved response model in the evaluation run.

If different System One calls within the same benchmark resolve to different model names, RepoScout rejects the run instead of silently mixing model provenance.

## Model discovery

Before a live smoke evaluation, RepoScout calls:

~~~text
GET /v1/models
~~~

The configured `TYPESAFE_MODEL` must appear in the authenticated account's model list.

If it is unavailable, the command fails before benchmark evaluation starts.

## Configuration

Live evaluation configuration is deliberately separate from the normal application environment.

Variables:

~~~text
TYPESAFE_API_KEY
TYPESAFE_MODEL=jev-latest
TYPESAFE_REQUEST_TIMEOUT_MS=8000
~~~

`TYPESAFE_API_KEY` is required only by the live evaluation CLI.

The normal RepoScout API server does not require a TypeSafe key to start.

## Live smoke command

After placing the TypeSafe key in the local environment:

~~~bash
npm run eval:jev:live -w @reposcout/api
~~~

The command:

1. validates evaluation configuration;
2. discovers available models;
3. verifies the requested model;
4. runs the Phase 3E.1 seed benchmark;
5. records requested + resolved model provenance;
6. scores the evaluation with the existing transparent metrics;
7. prints the run and metric report as JSON.

The API key is never printed.

## Runtime validation

The TypeSafe client validates:

- HTTPS fixed API origin;
- Bearer authentication boundary;
- JSON response shape;
- known answer discriminators;
- probability bounds;
- choice confidence;
- score confidence;
- score probability maps;
- nonnegative integer token usage;
- model metadata shape;
- expected answer types for each RepoScout question.

HTTP 422 is surfaced as a provider validation error.

HTTP 429 is surfaced as a rate-limit error.

Other non-success responses remain provider request failures.

## CI behavior

CI does not require a TypeSafe secret and does not make live TypeSafe requests.

Tests use mocked HTTP responses to verify:

- model-list request;
- Bearer header;
- fixed endpoint URLs;
- System One request JSON;
- Noul/Choice/Score parsing;
- score-scale conversion;
- resolved model provenance;
- wrong answer-type rejection;
- probability validation;
- provider validation errors;
- unavailable/invalid evaluation config.

This preserves reproducible CI and keeps external provider availability outside the normal product quality gate.

## Production boundaries

Phase 3E.2 still does **not** add:

- a model-assessment database table;
- model output in catalog APIs;
- model output in UI;
- search reranking;
- Hidden Gems influence;
- submission moderation influence;
- background Jev jobs;
- required TypeSafe credentials for application startup.

Jev remains an evaluation-only dependency.

## Live run status

The codebase now supports a controlled live run.

A live smoke evaluation should only be recorded as completed when a valid `TYPESAFE_API_KEY` is supplied and the command actually succeeds.

CI success alone is **not** evidence that Jev itself was evaluated live.

## Next checkpoint

### Phase 3E.3 — Real RepoScout benchmark + adoption decision

After a successful controlled live smoke run:

- build a labeled real-repository benchmark;
- include ambiguous/hard cases;
- repeat evaluations to measure consistency;
- inspect calibration/confidence usefulness;
- capture provider latency and token/cost data;
- compare with deterministic baselines where possible;
- document concrete failure cases;
- decide which tasks, if any, deserve production integration.

No production model-assessment persistence should be introduced before that decision.
