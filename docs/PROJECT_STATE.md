# RepoScout Project State

## Objective

Deliver the first complete community repository loop from public submission through the existing validation, evidence, and protected moderation pipeline.

## Branch

`feat/phase-5d-submission-web-ui`

Base: `main@ff3cac7bf9ab46e3876715b994ff52c66c961e98`

PR: #31

## Completed phase

Phase 5D — Public Add a Repository web UI.

## Changes

- Added a strict same-origin web client for `POST /api/submissions`.
- Added focused submission-client tests.
- Added the public repository URL form to the existing RepoScout discovery surface.
- Added success, already-indexed, already-pending, invalid, retryable, and fallback error states.
- Added explicit validation/evidence/moderation expectations.
- Kept reviewer credentials, moderation queue access, reviewer identity, and approve/reject actions out of the public web bundle.
- Preserved existing discovery/catalog behavior and brand system.
- Added Phase 5D documentation and roadmap/status updates.

## Verification

- Phase 5C.2 source checkpoint verified on `main@ff3cac7bf9ab46e3876715b994ff52c66c961e98`.
- PR #30 verified merged.
- Phase 5D implementation head `9784734dd78a97ff45b60d8682c59b7875214b54`.
- GitHub Actions CI run 129: success.
- CI includes lint, TypeScript, Vitest, production build, Jev harness, migrations/rollback/reapply, persistence/content/ingestion/catalog/search/submission workflow regressions, and PostgreSQL connectivity.
- Documentation-only commits after the implementation gate must remain green before PR #31 is merged.

## Risks / decisions

- Public submission remains intentionally unauthenticated; Phase 5E must add launch-appropriate abuse controls before broad exposure.
- Submission success means accepted for processing, not approved or published.
- The public UI has no submission-status lookup or notification mechanism yet.
- No moderation capability is exposed to public clients.
- Permanent moderation remains a trusted reviewer decision through the existing Phase 5C transaction.
- No Jev/model output is used to make the final moderation decision.

## Next phase

Phase 5E — Abuse / launch hardening:
- rate limiting;
- spam/abuse controls;
- operational cleanup/retention;
- observability;
- security review.

Do not start Phase 6 until Phase 5E is explicitly completed or deferred by decision.
