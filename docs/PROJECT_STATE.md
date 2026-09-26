# RepoScout Project State

## Objective

Help users triage measured open-source contribution opportunities with deterministic recommendation explanations while preserving evidence provenance and avoiding unsupported beginner-suitability claims.

## Branch

`main`

Current verified merge:

`9f71bfd73e1bbf020dfece0985a0eed20e7295ce`

PR #52: merged.

## Completed phase

Phase 8D — evidence-based contribution recommendation/explanation + evaluation.

Phase 8 is complete.

## Changes

- Added versioned recommendation contract:
  - `contribution-recommendation-v1`.
- Added two conservative recommendation states:
  - `consider`;
  - `needs_review`.
- `consider` requires all currently measured core conditions:
  - open;
  - unassigned;
  - unlocked;
  - updated within the inclusive 90-day horizon;
  - at least one recognized entry hint (`good first issue` or `help wanted`).
- Added explicit evidence and caution explanations tied back to Phase 8A signal IDs.
- Preserved repository process-evidence semantics:
  - CONTRIBUTING present;
  - observed absent;
  - missing/not collected;
  - unsupported-fork not applicable.
- CONTRIBUTING evidence is supporting context, not an automatic recommendation veto.
- Added explicit limitation codes for evidence RepoScout still does not measure:
  - issue complexity;
  - maintainer responsiveness;
  - linked PR outcomes;
  - external contributor success;
  - required domain expertise.
- Exposed the recommendation explanation alongside each existing `GET /api/contributions/issues` result.
- Preserved the Phase 8C ordering and cursor behavior; recommendation does not rerank results.
- Added frozen synthetic benchmark:
  - `contribution-recommendation-benchmark-v1`;
  - 10 cases;
  - 10 gating expectations;
  - 2 non-gating risk probes.
- Added benchmark CLI and dedicated CI gate.
- Added no numeric contribution score, beginner-friendly truth label, issue-body inference, or Phase 9 semantic search.

## Verification

- Phase 8A verified on `main@3162aeed98f057e06c92bed5ceab41aa76aef422`.
- Phase 8B merge: `8a0ad13812a783bab3f5287e1e69b2bbeb3562e9`.
- Phase 8B final project-state checkpoint: `main@d21c29ecbea6f167340443a13da48fc04e739449`.
- Phase 8C merged in PR #51 as `cf32cbbf94a30ac5fab3adc87a60a9a2bf43896e`.
- Phase 8C final project-state checkpoint: `main@8ed28ddc4fa6d231b554eaabe2d13eee37f34c43`.
- Phase 8D implementation-complete head `abd3dcaa81ee81138597c9d19c098667e27dd28d`: CI #281 success.
- Phase 8D documentation-complete head `dab2c4e785e67816f55b7102440de994ff4e58e6`: CI #282 success.
- PR #52 merged with the exact verified head as `9f71bfd73e1bbf020dfece0985a0eed20e7295ce`.
- The current GitHub connector exposes PR-triggered workflow runs but not the push-triggered post-merge run for direct commit lookup; no separate post-merge CI result is claimed here.
- CI #281 and #282 passed:
  - application lint/typecheck/unit tests/build;
  - production dependency audit;
  - Jev evaluation harness;
  - repository ranking benchmark;
  - contribution recommendation benchmark;
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

- `consider` means the issue matches the bounded v1 discovery policy and is worth manual inspection; it is not a beginner-friendly claim.
- `good first issue` and `help wanted` remain maintainer/community hints, not difficulty ground truth.
- Unassigned does not prove nobody is already working on an issue.
- Recently updated does not measure maintainer response latency.
- CONTRIBUTING-file presence does not establish contribution-process quality; absence does not prove a repository is unsuitable.
- Recommendation v1 deliberately does not inspect issue-body text.
- RepoScout still does not measure linked PR acceptance, external contributor success, or required domain expertise.
- No personal/contributor identity data was added.
- The public list remains update-ordered, not recommendation-ranked.
- Any future stronger suitability claim needs richer evidence and a separately versioned evaluation contract.

## Phase 8 breakdown

- 8A — contribution discovery signal contract: complete.
- 8B — GitHub issue ingestion + persistence: complete.
- 8C — public contribution discovery + filters: complete.
- 8D — evidence-based recommendation/explanation + evaluation: complete.

## Next phase

Phase 9 — semantic discovery.

Do not start Phase 9 as part of Phase 8D.
