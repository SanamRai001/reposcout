# RepoScout Project State

## Objective

Close the community-submission launch-hardening phase with safe observability, dependency security checks, privacy documentation, and an end-to-end review of the public submission / protected moderation boundary.

## Branch

`main`

Current verified merge: `701c45fe0ae08cc1182af372d8ae1082e478eebe`

PR #35: merged

## Completed phase

Phase 5E.4 — Launch observability + security review.

Phase 5E is now implementation-complete on this branch, pending final PR/main verification.

## Changes

- Added request correlation IDs and baseline API security headers.
- Marked submission/moderation responses `Cache-Control: no-store`.
- Added stable 400 malformed-JSON and 413 oversized-body responses.
- Added safe structured submission, rate-limit, and moderation operational events.
- Added central recursive log redaction for credential-like metadata.
- Prevented caller metadata from overriding reserved log fields.
- Replaced raw in-memory submission rate-limit IP keys with per-process HMAC digests.
- Added an explicit regression proving presented moderation bearer credentials are not logged.
- Added a production dependency security gate: `npm audit --omit=dev --audit-level=high`.
- Enabled weekly Dependabot monitoring for npm and GitHub Actions.
- Added `SECURITY.md`.
- Added `docs/PRIVACY.md`.
- Completed and documented the end-to-end public submission / moderation security review.
- No new monitoring vendor, metrics database, account system, or model-driven moderation authority was introduced.

## Verification

- Phase 5E.3 verified on `main@e943805b9fc60ba820916770c9a23801fb09b430`.
- Initial Phase 5E.4 code head `3509374bcd801afd44fd8141edccf27596a05d77`: CI run 155 success.
- Security regression head `bfc8f6e45b7047a4d93969293a742d0a6717c2a1`: CI run 156 success.
- Documentation-complete PR head `94e665ccb031b188198c29558be3e94875aacde3`: CI run 165 success.
- PR #35 merged as `701c45fe0ae08cc1182af372d8ae1082e478eebe`.
- Post-merge `main` CI run 166: success.
- All Phase 5E.4 verification runs passed the production dependency audit gate.
- CI also passed lint, TypeScript, unit tests, production build, Jev harness, migration apply/rollback/reapply, persistence/content/ingestion/catalog/search/submission/moderation regressions, and PostgreSQL connectivity.

## Security / privacy decisions

- Application logs intentionally exclude raw IPs, request bodies, authorization headers, bearer credentials, user-agent values, and moderation reason text.
- The limiter uses an HMAC digest of the resolved client address with a random per-process key.
- Reviewer references and final moderation reasons remain durable audit data.
- Log retention remains deployment-controlled; RepoScout does not persist operational logs in PostgreSQL.
- HSTS, frontend CSP, infrastructure access-log retention, and horizontal-scale rate limiting remain deployment/edge responsibilities.
- A passing dependency audit is a gate, not a proof that the system is vulnerability-free.

## Residual production gates

Completing Phase 5E does **not** mean broad public production launch is fully complete.

Still outstanding outside Phase 5E:

- database backup + tested restore procedure;
- deployment/recovery runbook;
- infrastructure/edge rate limiting for horizontal scale;
- production TLS/HSTS and final frontend CSP;
- accessibility pass;
- Code of Conduct;
- contribution/issue templates;
- final hosting/log-retention configuration.

## Next product phase

Phase 6 — Historical snapshots.

Do not treat the residual production gates above as completed merely because product development advances to Phase 6.
