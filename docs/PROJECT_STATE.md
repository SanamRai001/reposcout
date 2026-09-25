# RepoScout Project State

## Objective

Harden the public community-submission boundary for launch while preserving the existing validation, evidence, and protected moderation flow.

## Branch

`feat/phase-5e2-submission-abuse-guard`

Base: `main@67ca82371447548eff04365256e5b7548573736b`

PR: #33

## Completed phase

Phase 5E.2 — Deterministic repository resubmission abuse guard.

## Changes

- Added a repository-level cooldown after terminal submission outcomes.
- Default cooldown is 24 hours and is configurable from 1 minute to 30 days.
- Immediate resubmission of the same normalized repository no longer creates repeated validation/moderation work.
- Kept the public cooldown response generic so prior INVALID, DUPLICATE, REJECTED, or other terminal state is not disclosed.
- Added stable `409 submission_resubmission_cooldown`, `Retry-After`, and `retryAfterSeconds`.
- Added a dedicated public UI state without an immediate retry action.
- Added a partial PostgreSQL lookup index and verified migration apply/rollback/reapply.
- Preserved self-submission, unauthenticated intake, trusted final moderation, and the existing pending-submission uniqueness boundary.
- Added no submitter identity, account, fingerprint, CAPTCHA, or model-driven moderation decision.

## Verification

- Phase 5E.1 source checkpoint verified on `main@67ca82371447548eff04365256e5b7548573736b`.
- PR #33 code head `a5d5cd7d1e7b85f854baf43d58497b2f8f93b023`.
- GitHub Actions CI run 142: success before documentation-only follow-up commits.
- CI verified lint, TypeScript, unit tests, production build, Jev harness, migration apply/rollback/reapply, persistence/content/ingestion/catalog/search/submission regressions, and PostgreSQL connectivity.
- Documentation-complete PR head must remain green before merge.

## Risks / decisions

- The cooldown is keyed to normalized repository identity, not submitter identity.
- RepoScout intentionally does not permanently blacklist a repository after a terminal result; a later resubmission is allowed after the configured cooldown.
- The generic public response does not reveal whether a prior terminal submission was rejected, invalid, duplicate, or otherwise finalized.
- A 24-hour default reduces queue churn while leaving room for maintainers to correct a repository and try again later.
- IP rate limiting from Phase 5E.1 and repository cooldown serve different abuse boundaries and remain complementary.
- Permanent listing decisions remain protected trusted-reviewer actions.

## Next phase

Phase 5E.3 — Operational cleanup / retention.

Define what terminal submission, evidence, and moderation records must be retained, what may be cleaned up safely, and how cleanup interacts with audit/recovery requirements.

Do not start Phase 6 until Phase 5E is explicitly completed or deferred by decision.
