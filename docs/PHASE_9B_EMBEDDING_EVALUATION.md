# Phase 9B — Embedding Provider Contract and Offline Retrieval Evaluation

## Goal

Define a provider-neutral embedding boundary and a reproducible offline retrieval evaluator before RepoScout chooses an embedding provider or persists vectors.

Phase 9B answers:

> Can RepoScout validate embedding output, compare semantic retrieval against its lexical baseline, and detect measured retrieval differences without coupling production search to a provider?

It deliberately does **not** answer:

> Which production embedding model should RepoScout adopt?

## Embedding provider contract

Phase 9B adds a provider-neutral interface for batched text embeddings.

Every provider declares:

~~~text
providerName
modelName
~~~

Every returned batch must declare:

~~~text
provider
model
dimensions
vectors[]
~~~

Every vector must retain its input ID.

## Strict validation

RepoScout rejects embedding output when:

- provider provenance does not match the configured provider;
- model provenance does not match the configured model;
- dimensions are non-integer, zero, negative, or above the bounded maximum;
- returned vector count differs from input count;
- an input ID is omitted;
- an unknown ID is returned;
- an ID is returned more than once;
- vector length does not match declared dimensions;
- any vector element is non-finite;
- a zero vector is returned;
- input IDs are duplicated;
- input ID/text or provider/model names are blank.

Maximum supported dimensions in the Phase 9B contract:

~~~text
32768
~~~

This is a validation ceiling, not a recommended production dimension.

## Deterministic CI fixture provider

Phase 9B includes:

~~~text
provider: reposcout-fixture
model:    concept-axes-v1
dimensions: 6
~~~

The fixture maps text onto six deterministic concept axes used by the synthetic benchmark.

It exists only to verify:

- provider contract wiring;
- provenance validation;
- vector validation;
- cosine retrieval;
- ranking behavior;
- evaluation metrics;
- deterministic CI behavior.

It is **not**:

- a production embedding model;
- a claim about real semantic quality;
- a substitute for evaluating a real provider.

## Offline evaluator

Evaluation schema:

~~~text
semantic-retrieval-evaluation-v1
~~~

The evaluator runs both:

1. deterministic lexical token-overlap retrieval;
2. cosine-similarity retrieval from the supplied embedding provider.

Both operate over the same frozen Phase 9A benchmark corpus.

Metrics:

~~~text
top1Accuracy
meanReciprocalRank
recallAt3
~~~

The report also retains:

- benchmark version;
- provider;
- model;
- dimensions;
- per-query top-three repository IDs;
- first relevant rank for lexical retrieval;
- first relevant rank for semantic retrieval;
- semantic-minus-lexical metric deltas.

The evaluator does not emit an adoption decision.

## Important benchmark finding

The frozen:

~~~text
semantic-retrieval-benchmark-v1
~~~

is currently saturated by the deterministic lexical baseline.

On the six Phase 9A benchmark queries:

~~~text
lexical Top-1 accuracy: 1.0
fixture semantic Top-1 accuracy: 1.0

lexical MRR: 1.0
fixture semantic MRR: 1.0
~~~

Therefore the benchmark cannot currently demonstrate that semantic retrieval is better than lexical retrieval.

This is an evaluation limitation, not a reason to weaken lexical search or tune the fixture to manufacture a win.

## Controlled lexical-hard test

The evaluator also has a controlled test case whose wording has no useful exact lexical overlap with the expected monitoring repository but maps to the fixture's monitoring concept.

That test verifies that the evaluation machinery can detect:

~~~text
semantic rank 1
lexical rank > 1
~~~

when a real retrieval difference exists.

This challenge test validates the evaluator, not production model quality.

## CI discovery and correction

Initial Phase 9B head failed CI #293 because the first test incorrectly assumed the fixture semantic retriever would beat lexical on the frozen Phase 9A benchmark.

CI showed:

~~~text
lexical Top-1 = 1.0
semantic Top-1 = 1.0
~~~

The implementation was corrected instead of weakening the lexical baseline or mutating the frozen benchmark to force a preferred result.

Corrected head:

~~~text
ecf2ff35644ae8e9a5399f2387c4ae6a572508e1
~~~

passed CI #294 completely.

## Commands

Run the provider/evaluator verification:

~~~bash
npm run test:semantic-evaluation -w @reposcout/api
~~~

Print the deterministic offline report:

~~~bash
npm run eval:semantic-retrieval -w @reposcout/api
~~~

The CLI is observational.

It does not exit nonzero merely because semantic retrieval fails to beat lexical retrieval.

## Adoption decision

Phase 9B does **not** justify production embedding persistence yet.

Reasons:

1. the only embedding provider currently exercised in CI is a deterministic fixture;
2. the frozen synthetic v1 benchmark is too easy for lexical retrieval;
3. no real embedding provider has been evaluated;
4. no real indexed-repository benchmark has been frozen;
5. cost, latency, consistency, and provider failure behavior have not been measured.

Therefore Phase 9C remains blocked.

## Next checkpoint

Before embedding persistence:

### Phase 9B.1 — retrieval benchmark hardening + real-provider evaluation

Required work:

- add versioned lexical-hard and ambiguous relevance cases without rewriting v1 history;
- freeze representative real repository observations when available;
- keep lexical baseline results beside semantic results;
- plug a real embedding provider into the existing provider-neutral boundary;
- measure retrieval quality, latency, dimensions, and model provenance;
- document cost/rate-limit/provider failure behavior;
- decide whether semantic retrieval provides enough measured value to justify Phase 9C.

Only after that decision should RepoScout add a vector persistence schema.

## What Phase 9B does not do

No:

- pgvector;
- vector database;
- embedding table;
- embedding backfill;
- production embedding credentials;
- semantic HTTP endpoint;
- hybrid public search;
- natural-language filter parser;
- production provider adoption;
- change to `GET /api/repositories/search`.
