# Jev / Model-Assisted Intelligence Architecture

## Status

**Experimental. Phase 3E.1 evaluation harness implemented; live Jev integration is not yet implemented.**

RepoScout is evaluating Jev, TypeSafe AI's System One model, as a possible decision layer for repository classification, candidate reranking, contribution suitability, and submission analysis.

Jev is **not** a source of repository facts, not the primary search engine, and not a replacement for RepoScout's deterministic ranking/data pipeline.

No production dependency on Jev exists yet.

## Why this may fit RepoScout

RepoScout needs more than text generation.

Many future workflows require constrained judgments such as:

- which use case best describes a repository?
- how likely is this project to be a tutorial/demo rather than reusable software?
- how relevant is this repository to a specific discovery intent?
- how suitable does the repository appear for a beginner contributor?
- should a community submission receive closer human review?

Those are decision/classification problems.

A typed probabilistic decision model may fit these tasks better than asking a general-purpose generative model to emit free-form prose or arbitrary JSON.

## Core rule

RepoScout intelligence must preserve four distinct information classes:

~~~text
GitHub facts
    measured / externally sourced
        |
        +--------------+
        |              |
RepoScout signals   Model assessments
deterministic       probabilistic/inferred
        |              |
        +------+-------+
               |
        community judgment
               |
               v
       discovery / moderation
~~~

These classes must remain distinguishable in storage, APIs, debugging, ranking explanations, and UI copy.

## Jev's intended role

### 1. Repository classification

After RepoScout has collected authoritative repository data/content, Jev may help classify:

- project type;
- primary use case;
- likely audience;
- codebase difficulty;
- documentation quality;
- beginner contribution suitability;
- tutorial/demo likelihood.

These are **inferences**, not GitHub facts.

### 2. Discovery reranking

Jev may rerank a **bounded candidate set** after normal retrieval.

Preferred flow:

~~~text
user query
    |
PostgreSQL lexical search + filters
    |
candidate repositories
    |
objective RepoScout signals
    |
optional Jev relevance assessment
    |
transparent reranking
    |
results
~~~

Jev must not replace initial retrieval.

This protects:
- predictable latency/cost;
- reproducibility;
- graceful degradation;
- explainability;
- search quality when the model is unavailable.

### 3. Community submission analysis

Potential future flow:

~~~text
submitted GitHub URL
        |
deterministic repository checks
        |
metadata/content collection
        |
optional Jev assessment
        |
moderation queue
        |
human decision where required
~~~

Jev may flag uncertainty or risk, but it must not be the sole authority for permanent rejection.

### 4. Hidden Gems / Rising support

Hidden Gems and Rising remain primarily data-driven.

Jev may later provide qualitative support such as:

- whether a repository appears to be reusable software;
- whether the README supports the claimed use case;
- whether the repository resembles a tutorial/demo;
- category/use-case relevance.

It must not create or replace objective activity/momentum metrics.

### 5. Contribution discovery

Jev may later assess qualitative contribution questions such as:

- apparent onboarding difficulty;
- likely beginner suitability;
- project type;
- likely contributor skill requirements.

Those assessments should complement measured evidence such as:
- CONTRIBUTING documentation;
- good-first-issue counts;
- maintainer response history;
- recently merged external PRs.

## Non-goals

Jev must not:

- invent star/fork/issue/release counts;
- determine canonical repository identity;
- replace GitHub-originated data;
- replace PostgreSQL retrieval;
- become a universal repository quality score;
- silently decide moderation outcomes;
- make RepoScout unusable when unavailable;
- hide ranking logic behind an unexplained AI answer.

## Graceful degradation

RepoScout must remain useful without Jev.

Required fallback:

~~~text
Jev available
    |
optional model-assisted assessment/reranking

Jev unavailable
    |
deterministic search + filters + RepoScout signals continue normally
~~~

A model outage must not break:
- repository ingestion;
- catalog reads;
- factual metadata;
- deterministic discovery;
- moderation queue access.

## Data ownership

### GitHub facts

Examples:
- stars;
- forks;
- issues;
- languages;
- topics;
- license;
- releases;
- repository timestamps.

Source: GitHub or another explicitly documented authoritative external source.

### RepoScout deterministic signals

Examples:
- active-within-window;
- release cadence;
- popularity band;
- recent star growth;
- documentation-file presence;
- contribution-signal counts.

Source: deterministic computation over stored facts.

### Model assessments

Examples:
- use-case classification;
- tutorial/demo probability;
- beginner-suitability probability;
- query relevance assessment.

Source: Jev or another explicitly named model.

### Community judgments

Examples:
- approved category;
- curator note;
- moderation outcome;
- corrected classification.

Source: identifiable RepoScout community/moderator action.

## Future assessment storage

A future model-assessment entity should preserve enough provenance to audit/recompute the result.

Conceptual fields:

~~~text
id
repository_id
provider
model
assessment_type
input_version
schema_version
result_json
confidence_json
evaluated_at
expires_at nullable
superseded_by nullable
~~~

Do not create this table until the Phase 3E evaluation proves a real product use.

## Versioning

Every model-assisted result used by discovery or moderation must record:

- provider;
- model/version identifier when available;
- assessment schema version;
- input/data version;
- evaluation timestamp.

If prompts/schemas/model versions change materially, old assessments must remain attributable to the previous version.

## Confidence and thresholds

RepoScout must not treat model output as binary truth.

For any automated action, define explicit thresholds.

Example future pattern:

~~~text
high confidence + low impact
    -> may automate reversible classification

low confidence
    -> human review

high impact moderation decision
    -> human review regardless of confidence
~~~

Thresholds must be evaluated using RepoScout's own labeled repository examples before production use.

## Evaluation before adoption

Phase 3E is an evaluation spike, not immediate production rollout.

Phase 3E.1 now provides a provider-neutral benchmark harness before any live Jev adapter is added.

Evaluate Jev on a labeled repository set for:

- classification accuracy;
- calibration/confidence usefulness;
- ranking relevance;
- tutorial/demo detection;
- beginner-suitability usefulness;
- latency;
- cost;
- failure behavior;
- consistency across repeated evaluations.

A model-assisted feature should only ship when it provides measurable value beyond deterministic logic.

## Security and privacy

MUST:
- never send secrets, GitHub tokens, database credentials, or private moderation data unnecessarily;
- minimize submitted repository content to what the assessment requires;
- treat model output as untrusted external data;
- validate typed responses before persistence/use;
- bound request size and timeout;
- log provider/model/error metadata without logging secret credentials.

## Explainability

If a model assessment affects discovery, RepoScout should be able to distinguish:

~~~text
Measured:
+ 3 releases in 90 days
+ 12 external PRs merged in 30 days

Derived:
+ active maintenance signal

Model-assisted:
~ high relevance to "TypeScript backend to study"
~~~

Do not present model-assisted inference as measured fact.

## Roadmap relationship

Near-term order:

~~~text
Phase 3C
authoritative GitHub metadata/metrics
        |
Phase 3D
repository content foundation
        |
Phase 3E.1
provider-neutral evaluation harness
        |
Phase 3E.2
live Jev adapter + controlled smoke evaluation
        |
Phase 3E.3
real RepoScout evaluation + adoption decision
        |
Phase 4
lexical discovery + filters
        |
optional Jev candidate reranking only if justified
~~~

This preserves RepoScout's original principle:

> AI should improve a real repository intelligence engine, not substitute for one.
