# Phase 9A — Semantic Document and Retrieval Benchmark Foundation

## Goal

Define exactly what RepoScout is allowed to send into a future semantic-retrieval system before choosing an embedding provider, vector storage strategy, or production ranking behavior.

Phase 9A answers:

> What bounded, versioned repository text represents semantic meaning, and what natural-language retrieval cases should future semantic implementations be evaluated against?

It deliberately does **not** answer:

> Which embedding model or vector database should RepoScout use?

## Semantic document contract

Contract version:

~~~text
repository-semantic-document-v1
~~~

The document is derived only from evidence RepoScout already stores:

- repository identity;
- repository description;
- measured primary language;
- measured GitHub topics;
- bounded README content evidence.

No new GitHub request is introduced.

## Semantic fields

The current field IDs are:

~~~text
identity
description
primary_language
topics
readme_excerpt
~~~

Each field records:

- its field ID;
- its source class;
- whether content is available or missing;
- an explicit missing reason when unavailable;
- whether the available text was truncated.

Source classes:

~~~text
repository
github_metadata
readme_evidence
~~~

## Missing-data semantics

Phase 9A preserves why content is unavailable.

Supported missing reasons:

~~~text
not_provided
not_collected
not_found
too_large
~~~

Examples:

- no GitHub description -> `not_provided`;
- metadata not collected -> `not_collected`;
- observed missing README -> `not_found`;
- README intentionally not stored because of the existing size ceiling -> `too_large`.

These states must not be silently converted into empty factual content.

## README boundary

The semantic README input uses the stored Phase 3D.1 README body only when status is `PRESENT`.

The normalized leading excerpt is capped at:

~~~text
6000 Unicode code points
~~~

The builder does not:

- fetch the README again;
- summarize it;
- call a model;
- recursively crawl linked documentation;
- use a TOO_LARGE README body that RepoScout intentionally refused to store.

The truncation flag remains explicit.

## Deterministic semantic text

Available fields are serialized into a stable labeled form:

~~~text
Repository: ...
Description: ...
Primary language: ...
Topics: ...
README excerpt: ...
~~~

Whitespace is normalized deterministically.

Topics are normalized, deduplicated, and sorted.

The resulting text is intended as a future embedding/query-relevance input, not as a public canonical repository description.

## Provenance

Every document retains:

- repository update timestamp;
- metadata observation timestamp when present;
- README observation timestamp when present;
- README blob SHA when a PRESENT README was observed.

Future embedding persistence must bind the embedding to:

- this document contract version;
- the embedding provider/model version;
- the exact source/document version.

Phase 9A intentionally does not define the persistence schema yet.

## Excluded inputs

Semantic document v1 intentionally excludes:

- stars;
- forks;
- ranking scores;
- Hidden Gems/Rising scores;
- contribution recommendation status;
- beginner-suitability judgments;
- issue-level contribution data;
- contributor identity;
- model-generated summaries.

This keeps semantic meaning separate from popularity and later ranking logic.

## Retrieval benchmark

Benchmark version:

~~~text
semantic-retrieval-benchmark-v1
~~~

The frozen synthetic benchmark currently contains:

~~~text
6 repository cases
6 natural-language query cases
~~~

The queries cover:

- database migration/schema safety;
- self-hosted monitoring;
- accessible React UI primitives;
- workflow automation;
- vector similarity storage;
- beginner React learning.

The queries intentionally use natural-language intent rather than repository-name lookups.

Each query records expected relevant repository IDs and a rationale.

## What the benchmark does not claim

Phase 9A does not produce:

- embedding vectors;
- cosine similarity;
- vector distance;
- ranking scores;
- a production semantic winner;
- model quality claims.

The benchmark is a frozen target for Phase 9B provider/baseline evaluation.

A future semantic implementation should be compared against:

1. the current lexical baseline;
2. candidate embedding retrieval;
3. later hybrid retrieval.

Provider/storage choices should follow measured retrieval behavior rather than preference alone.

## Verification

Phase 9A tests verify:

- contract version;
- deterministic semantic text;
- metadata/topic normalization;
- missing-data semantics;
- README status mapping;
- 6,000-code-point README ceiling;
- Unicode-safe truncation;
- repository/README identity consistency;
- exclusion of popularity and suitability fields;
- benchmark version;
- unique benchmark IDs;
- benchmark reference integrity;
- natural-language query shape;
- absence of premature score/embedding outputs.

Implementation head:

~~~text
88a5afdf881d0e08b4a014bfd24a802f70dd3341
~~~

passed CI #286 completely, including the dedicated semantic-discovery foundation gate and all existing regression gates.

## Phase 9 plan

Phase 9 is now split into small verifiable stages:

~~~text
9A  semantic document + retrieval benchmark foundation
9B  embedding provider contract + offline retrieval evaluation
9C  embedding persistence + bounded backfill, only if 9B justifies adoption
9D  semantic similarity API
9E  hybrid lexical + semantic discovery
9F  bounded natural-language query interpretation, only if still useful
~~~

The order is deliberate.

RepoScout should not add vector persistence before it has a provider-neutral contract and an evaluation showing that semantic retrieval improves the existing deterministic baseline.

## Next phase

Phase 9B — embedding provider contract + offline retrieval evaluation.

Do not add production vector persistence or change the public search endpoint in 9B.
