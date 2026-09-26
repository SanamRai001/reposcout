# RepoScout Project State

## Objective

Build semantic repository discovery on top of RepoScout's existing deterministic search without allowing provider/model choices to redefine canonical repository facts or silently replace working lexical discovery.

## Branch

`feat/phase-9a-semantic-document-contract`

Base:

`main@3ec45ac1f07c4eff33b4fb28302a8c04394071d8`

PR #53: open.

## Completed phase

Phase 9A — semantic document + retrieval benchmark foundation.

Phase 9 is in progress.

## Changes

- Added versioned semantic repository document contract:
  - `repository-semantic-document-v1`.
- Semantic input uses only existing stored evidence:
  - repository identity;
  - description;
  - measured primary language;
  - GitHub topics;
  - stored README evidence.
- Added explicit semantic field source classes:
  - repository;
  - GitHub metadata;
  - README evidence.
- Added explicit missing reasons:
  - `not_provided`;
  - `not_collected`;
  - `not_found`;
  - `too_large`.
- README semantic input:
  - uses only existing PRESENT stored README content;
  - normalizes whitespace deterministically;
  - caps the leading excerpt at 6,000 Unicode code points;
  - records truncation explicitly;
  - never fetches/summarizes recursively.
- Added source provenance:
  - repository update timestamp;
  - metadata observation timestamp;
  - README observation timestamp;
  - README SHA when PRESENT.
- Excluded popularity and judgment inputs from semantic text:
  - stars;
  - forks;
  - ranking scores;
  - contribution recommendation;
  - beginner-suitability judgments.
- Added frozen retrieval benchmark:
  - `semantic-retrieval-benchmark-v1`;
  - 6 synthetic repository cases;
  - 6 natural-language intent queries;
  - explicit expected relevant repository IDs + rationale.
- Added dedicated semantic foundation test script and CI gate.
- Updated README/roadmap to reflect completed Phase 8 and the Phase 9A–9F decomposition.
- No embedding provider, vector persistence, semantic API, hybrid ranking, or natural-language filter parser was added.

## Verification

- Phase 8 final project-state checkpoint: `main@3ec45ac1f07c4eff33b4fb28302a8c04394071d8`.
- Phase 9A implementation head `88a5afdf881d0e08b4a014bfd24a802f70dd3341`: CI #286 success.
- CI #286 passed:
  - application lint/typecheck/unit tests/build;
  - production dependency audit;
  - Jev evaluation harness;
  - repository ranking benchmark;
  - contribution recommendation benchmark;
  - semantic discovery foundation;
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

## Decisions / risks

- Semantic representation is versioned independently from any future embedding model.
- Phase 9A does not choose pgvector, an external vector database, or an embedding API.
- Provider/model/dimension provenance must be explicit before any embedding is persisted.
- Semantic documents describe repository meaning; popularity remains separate ranking/context evidence.
- Missing content remains missing with provenance instead of being fabricated as empty factual evidence.
- The README excerpt is a bounded leading sample, not a generated summary and not proof that later sections are irrelevant.
- The current benchmark is synthetic and useful for regression/contract work; it is not proof that any future embedding model is production quality.
- Public `GET /api/repositories/search` behavior is unchanged.
- Existing lexical search remains the production baseline until semantic retrieval demonstrates measured improvement.
- Jev remains optional/deferred and is not required for Phase 9 semantic infrastructure.

## Phase 9 breakdown

- 9A — semantic document + retrieval benchmark foundation: complete.
- 9B — embedding provider contract + offline retrieval evaluation: next.
- 9C — embedding persistence + bounded backfill: later, only if 9B justifies adoption.
- 9D — semantic similarity API: later.
- 9E — hybrid lexical + semantic discovery: later.
- 9F — bounded natural-language query interpretation: later, only if still useful.

## Next phase

Phase 9B — embedding provider contract + offline retrieval evaluation.

Define a provider-neutral embedding interface, strict vector/provenance validation, a deterministic CI fixture provider, and lexical-vs-semantic benchmark evaluation.

Do not add production embedding persistence or change the public search endpoint in 9B.
