# RepoScout Project State

## Objective

Start Phase 8 with a versioned deterministic contribution-discovery evidence contract before ingesting GitHub issues or inventing a beginner-friendly score.

## Branch

`feat/phase-8a-contribution-signal-contract`

Base: `main@9233385a9b8a9cc0375393753a0d6cb5164943b2`

PR: #49

## Completed phase

Phase 8A — Contribution discovery signal contract.

Phase 8 remains in progress.

## Changes

- Added executable contract version:
  - `contribution-signals-v1`.
- Added contribution-discovery signal roles:
  - entry hint;
  - repository process;
  - availability;
  - activity;
  - discussion.
- Added deterministic issue-label normalization:
  - case-insensitive;
  - trims/collapses whitespace;
  - treats hyphen/underscore variants consistently.
- Added explicit entry-hint signals:
  - `entry.good_first_issue_label`;
  - `entry.help_wanted_label`.
- Label hints are explicitly not beginner-suitability judgments.
- Reused existing repository contribution evidence semantics for:
  - CONTRIBUTING;
  - Code of Conduct;
  - issue template;
  - pull request template.
- Preserved the distinction between:
  - observed absence;
  - not collected;
  - not applicable for unsupported fork evidence.
- Added issue availability signals:
  - open;
  - unassigned;
  - unlocked.
- Added deterministic activity/discussion context:
  - issue age in whole days;
  - days since update;
  - comment count.
- Added explicit evaluation timestamp to make time-derived signals reproducible.
- Added validation for invalid issue identity/count/date observations.
- Added unit coverage for normalization, missing-data semantics, process evidence, availability, age/freshness, deduplication, and invalid inputs.
- The signal snapshot deliberately has no:
  - score;
  - beginner-friendly boolean;
  - recommendation rank;
  - model inference.

## Verification

- Phase 7E verified on `main@9233385a9b8a9cc0375393753a0d6cb5164943b2`.
- Initial Phase 8A code head `44742ad871015f00e3d890cc3e85a232989506cb`:
  - CI run 256 failed TypeScript because the test fixture inferred two evidence fields as always non-null.
- Corrected Phase 8A code head `cb624fa359ea147bffc3d0ae7fd128974b2065b5`:
  - CI run 257 success.
- CI run 257 passed application verification, production dependency audit, Jev harness, ranking benchmark, migration apply/rollback/reapply, repository/snapshot/content/ingestion/catalog/search/submission regressions, and PostgreSQL connectivity.
- Documentation-complete PR head must remain green before merge.

## Decisions / risks

- `good first issue` and `help wanted` are maintainer-provided entry hints, not proof that an issue is easy, well-scoped, or actively supported.
- Repository process-file presence remains measured evidence; it does not prove contributor experience quality.
- Issue comment volume is context only.
- An unassigned issue is not automatically available for a newcomer; it is only one availability fact.
- Closed or locked issues remain represented explicitly rather than silently filtered by the signal builder.
- Time-derived signals use an explicit evaluation timestamp.
- Phase 8A performs no network/database/model work.
- The current contract has no issue-body complexity, maintainer-response, merged-PR, or contributor-outcome evidence.
- Those richer signals should be added only when their source/semantics are defined and testable.

## Phase 8 breakdown

- 8A — contribution discovery signal contract: complete.
- 8B — GitHub issue ingestion + persistence: next.
- 8C — public contribution discovery + filters.
- 8D — evidence-based recommendation/explanation + evaluation.

## Next phase

Phase 8B — GitHub issue ingestion + persistence.

Add a narrow measured issue entity, GitHub issue client parsing, bounded ingestion for listed repositories, stale-safe upsert/update semantics, and persistence tests.

Do not add a beginner-friendly score or Phase 9 semantic search in 8B.
