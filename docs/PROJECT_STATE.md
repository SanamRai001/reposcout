# RepoScout Project State

## Objective

Persist a narrow, measured GitHub issue entity for listed repositories so Phase 8 contribution discovery can use real issue observations without introducing a beginner-friendly score or public recommendation API yet.

## Branch

`feat/phase-8b-contribution-issue-ingestion`

Base: `main@3162aeed98f057e06c92bed5ceab41aa76aef422`

PR: #50

## Completed phase

Phase 8B — GitHub issue ingestion + persistence.

Phase 8 remains in progress.

## Changes

- Added `repository_contribution_issues` persistence for measured GitHub issue observations.
- Stored issue fields include:
  - canonical GitHub issue ID;
  - repository + issue number identity;
  - title + GitHub URL;
  - open/closed state;
  - locked flag;
  - assignee count;
  - comment count;
  - raw label names;
  - GitHub created/updated timestamps;
  - RepoScout observed timestamp.
- Added schema constraints for:
  - globally unique GitHub issue ID;
  - unique issue number within a repository;
  - open/closed state;
  - nonnegative assignee/comment counts;
  - positive issue number and GitHub issue ID;
  - `updated_at_github >= created_at_github`.
- Added repository/state/update lookup index.
- Added stale-safe issue upsert:
  - newer GitHub issue observations replace older state;
  - equal GitHub update time may advance with a newer/equal RepoScout observation;
  - stale observations cannot overwrite newer issue state;
  - a GitHub issue identity cannot silently move to another repository.
- Added strict GitHub issue parsing and bounded issue fetch:
  - one page only;
  - maximum 100 items;
  - `state=all`;
  - most-recently-updated first;
  - pull-request-shaped GitHub issue API items are excluded before issue parsing.
- Added strict validation for issue identity, URLs, counts, dates, state, and labels.
- Reused existing GitHub rate-limit/retry classification.
- Added listed-only issue ingestion:
  - repository must resolve through the public catalog reader;
  - unknown/unlisted repository performs no provider work.
- Added bounded batch operation:
  - default 20 repositories / maximum 50;
  - default 50 issues per repository / maximum 100;
  - sequential provider calls;
  - unavailable repositories may be skipped;
  - `retry_later` and `manual_review` halt remaining provider work;
  - a repository cursor is returned for resumable processing.
- Added CLI:
  - `npm run ingest:contribution-issues -w @reposcout/api -- [repositoryLimit] [issueLimit] [cursorRepositoryId]`.
- Added unit/integration/schema/rollback coverage and a dedicated contribution-issue persistence CI gate.
- No public contribution-discovery endpoint, recommendation score, or model inference was added.

## Verification

- Phase 8A verified on `main@3162aeed98f057e06c92bed5ceab41aa76aef422`.
- Phase 8B code head `2a88c76218f19825e0a6be7f8fb579590df3b770`.
- GitHub Actions CI run 268: success before documentation-only follow-up commits.
- CI run 268 passed application verification, dependency audit, Jev harness, ranking benchmark, migrations apply/rollback/reapply, contribution-issue schema/persistence, repository/snapshot/content/ingestion/catalog/search/submission regressions, and PostgreSQL connectivity.
- Documentation-complete PR head must remain green before merge.

## Decisions / risks

- Phase 8B stores measured GitHub issue facts, not suitability labels.
- GitHub pull requests are excluded because GitHub's issues API can return PR-shaped records.
- Only one bounded issue page is fetched per repository in this phase; RepoScout does not claim complete issue history.
- The ingestion page is ordered by most recently updated issue, so the stored bounded set favors current contribution opportunities.
- Labels are stored as raw measured names; Phase 8A normalization/meaning remains a separate deterministic signal layer.
- `state=all` is intentional so later discovery can distinguish open vs closed rather than treating absence from an open-only fetch as authoritative history.
- Listed-only ingestion reserves recurring provider work for the public catalog and prevents unlisted moderation candidates from leaking into contribution discovery.
- Batch processing is sequential and conservative under provider pressure.
- Issue body text, maintainer response latency, linked PR outcomes, contributor identity, and difficulty are not collected in 8B.
- Those richer signals require explicit privacy/semantics decisions before collection.

## Phase 8 breakdown

- 8A — contribution discovery signal contract: complete.
- 8B — GitHub issue ingestion + persistence: complete.
- 8C — public contribution discovery + filters: next.
- 8D — evidence-based recommendation/explanation + evaluation.

## Next phase

Phase 8C — public contribution discovery + filters.

Expose listed-repository contribution issues through deterministic filters over measured issue state and Phase 8A signals, including entry-hint labels and availability facts.

Do not add a beginner-friendly score or Phase 9 semantic search in 8C.
