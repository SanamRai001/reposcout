# RepoScout Project State

## Objective

Expose measured contribution opportunities from listed repositories through deterministic public filters while preserving the Phase 8A evidence semantics and avoiding an unsupported beginner-friendly score.

## Branch

`main`

Current verified merge:

`cf32cbbf94a30ac5fab3adc87a60a9a2bf43896e`

PR #51: merged.

## Completed phase

Phase 8C — public contribution discovery + filters.

Phase 8 remains in progress.

## Changes

- Added public read-only endpoint:
  - `GET /api/contributions/issues`.
- Discovery is hard-bounded to:
  - listed repositories only;
  - stored open issues only.
- Added deterministic factual filters:
  - `unassigned=true|false`;
  - `unlocked=true|false`;
  - `goodFirstIssue=true|false`;
  - `helpWanted=true|false`;
  - `language=<primary language>`;
  - `updatedWithinDays=1..3650`;
  - `contributing=present|absent|missing|not_applicable`.
- Reused Phase 8A label normalization so common spacing/hyphen/underscore variants resolve to the same entry-hint labels.
- Preserved contribution-process missing-data semantics:
  - observed CONTRIBUTING absence remains different from evidence not collected;
  - unsupported-fork evidence remains `not_applicable`.
- Added public Phase 8A signal evidence for each result:
  - entry hints;
  - repository process evidence;
  - open/unassigned/unlocked availability facts;
  - issue age/update recency;
  - comment-count context.
- Added stable keyset pagination ordered by:
  - GitHub issue update timestamp descending;
  - RepoScout issue UUID ascending.
- Contribution-discovery cursors are bound to:
  - normalized filter scope;
  - last result position;
  - original evaluation timestamp.
- Recency filters therefore remain deterministic across later pages instead of drifting with wall-clock time.
- Added global open/recent contribution discovery index:
  - `repository_contribution_issues_discovery_updated_idx`.
- Added route/unit, PostgreSQL integration, schema, rollback, and dedicated CI coverage.
- No beginner-friendly score, recommendation rank, issue-body analysis, or Phase 9 semantic search was added.

## Verification

- Phase 8A verified on `main@3162aeed98f057e06c92bed5ceab41aa76aef422`.
- Phase 8B merge: `8a0ad13812a783bab3f5287e1e69b2bbeb3562e9`.
- Phase 8B final project-state checkpoint: `main@d21c29ecbea6f167340443a13da48fc04e739449`.
- Phase 8C implementation/test head `2997a65837a9f51009f7ac604e5eac1476254596`: CI #276 success.
- Phase 8C documentation-complete PR head `dfd560dbc71c1618eb709f6b83567c71f9ff7138`: CI #277 success.
- PR #51 merged as `cf32cbbf94a30ac5fab3adc87a60a9a2bf43896e`.
- Post-merge `main` CI #278: success.
- CI passed:
  - application build/typecheck/test verification;
  - production dependency audit;
  - Jev evaluation harness;
  - ranking benchmark;
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

- Phase 8C exposes evidence, not suitability judgments.
- `good first issue` and `help wanted` remain label hints only.
- Unassigned does not prove nobody is already working on an issue.
- Open does not prove maintainers still want a contribution.
- Recently updated is contextual activity evidence, not a quality direction.
- Repository process evidence distinguishes observed absence, missing collection, and unsupported-fork applicability.
- The discovery surface is limited to the bounded issue observations collected by Phase 8B; RepoScout still does not claim complete GitHub issue history.
- Keyset pagination uses stored GitHub update time plus issue UUID for stable ordering.
- The cursor preserves one evaluation timestamp so time-derived evidence and recency filters stay internally consistent across pages.
- Phase 8C does not collect additional personal/contributor identity data.
- Issue complexity, maintainer response latency, linked PR outcomes, and external-contributor success remain unmeasured.
- Phase 8D must evaluate whether current evidence is sufficient before introducing recommendation semantics.

## Phase 8 breakdown

- 8A — contribution discovery signal contract: complete.
- 8B — GitHub issue ingestion + persistence: complete.
- 8C — public contribution discovery + filters: complete.
- 8D — evidence-based recommendation/explanation + evaluation: next.

## Next phase

Phase 8D — evidence-based recommendation/explanation + evaluation.

Define the recommendation contract and evaluation methodology before adding any public suitability judgment.

Do not start Phase 9 semantic search as part of 8D.
