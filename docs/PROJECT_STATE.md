# RepoScout Project State

## Objective

Harden the public community-submission boundary for launch while preserving the existing validation, evidence, and protected moderation flow.

## Branch

`feat/phase-5e1-submission-rate-limit`

Base: `main@b2cecbf7ae03a5ab1ca208125ffa69239bbe7843`

PR: #32

## Completed phase

Phase 5E.1 — Public submission rate limiting.

## Changes

- Added a bounded in-memory fixed-window limiter for public repository submissions.
- Applied the limiter to `POST /api/submissions` before JSON body parsing.
- Added stable `429 submission_rate_limited` responses with `Retry-After` and rate-limit headers.
- Added environment-controlled window, attempt, and tracked-client limits.
- Added explicit `TRUST_PROXY_HOPS`; forwarded IP headers are ignored by default.
- Added tests for fixed-window behavior, bounded memory, HTTP 429 behavior, and proxy/IP handling.
- Updated the web submission client to preserve rate-limit errors as retryable.
- No moderation, publication, or persistence transaction was changed.

## Verification

- Phase 5D source checkpoint verified on `main@b2cecbf7ae03a5ab1ca208125ffa69239bbe7843`.
- Phase 5E.1 code head `a78a135a57c2737f590481f8b5d96c12ae2174dd`.
- GitHub Actions CI run 135: success before documentation-only follow-up commits.
- The gate includes lint, TypeScript, unit tests, production build, Jev harness, migration apply/rollback/reapply, persistence/content/ingestion/catalog/search/submission regressions, and PostgreSQL connectivity.
- Documentation-complete PR head must remain green before merge.

## Risks / decisions

- The limiter is process-local and intentionally not a distributed rate limiter.
- Current defaults are 10 submission attempts per 10 minutes per resolved client IP.
- The tracked-client map is bounded at 10,000 entries by default.
- Multi-instance deployment requires an edge/shared-store limiter so limits cannot be bypassed across processes.
- `TRUST_PROXY_HOPS` must stay 0 unless the API is reachable only through the configured number of trusted reverse-proxy hops.
- IP rate limiting can affect users behind shared NAT; limits remain configurable.
- Rate limiting reduces request abuse but does not replace spam detection or moderation.
- Permanent listing decisions remain protected trusted-reviewer actions.

## Next phase

Phase 5E.2 — Submission spam / abuse controls.

Focus next on low-complexity deterministic defenses that complement rate limiting without introducing automated final moderation.

Do not start Phase 6 until Phase 5E is explicitly completed or deferred by decision.
