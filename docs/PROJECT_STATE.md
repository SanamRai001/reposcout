# RepoScout Project State

## Objective

Harden the public community-submission boundary for launch while preserving validation, evidence, auditability, and trusted moderation.

## Branch

`main`

Current verified merge: `0966550f2bfc5507f7010041c9776b3c0bcd4671`

PR #34: merged

## Completed phase

Phase 5E.3 — Operational cleanup / retention.

## Changes

- Defined a conservative retention boundary for community-submission workflow data.
- PENDING, APPROVED, REJECTED, moderation events, and prepared repository/evidence data are retained.
- Only old INVALID/DUPLICATE submission rows are cleanup candidates.
- Candidates must have no evidence handoff and no moderation event.
- Default terminal retention is 90 days.
- Minimum retention is 31 days, intentionally longer than the maximum 30-day resubmission cooldown.
- Added a dry-run-first cleanup CLI; deletion requires explicit `--apply`.
- Cleanup runs in bounded batches: default 100, maximum 1000.
- Deletion rechecks eligibility with `FOR UPDATE SKIP LOCKED`.
- Added a partial PostgreSQL cleanup-candidate index with rollback/reapply verification.
- Cleanup never deletes canonical repositories referenced by duplicate submissions.

## Verification

- Phase 5E.2 verified on `main@c4603ccfbf36821a7e52430cc8666580e0fa809b`.
- Phase 5E.3 code head `888e54177e105ef0afdb044eb70b073a7ab4a9f9`: CI run 149 success.
- Documentation-complete PR head `4455be23306c0f0511578daeff96bede9b22638e`: CI run 152 success.
- PR #34 merged as `0966550f2bfc5507f7010041c9776b3c0bcd4671`.
- Post-merge `main` CI run 153: success.
- CI verified lint, TypeScript, unit tests, production build, Jev harness, migration apply/rollback/reapply, cleanup integration, existing submission/moderation regressions, and PostgreSQL connectivity.

## Risks / decisions

- Cleanup is intentionally manual, not scheduled.
- INVALID/DUPLICATE records are retained long enough to outlive the resubmission cooldown.
- Moderation audit history is not eligible for cleanup in this phase.
- REJECTED evidence remains retained and unlisted, preserving the Phase 5C audit/review contract.
- Cleanup is irreversible at application level; recovery of deleted terminal rows requires a database backup/restore path.
- Broad backup/deployment-runbook work remains a production gate, not silently implemented here.

## Next phase

Phase 5E.4 — Observability + security review.

Focus on launch-facing metrics/logging, abuse/limiter observability without secret leakage, dependency/security checks, privacy documentation, and an end-to-end public-boundary review.

Do not start Phase 6 until Phase 5E is explicitly completed or deferred by decision.
