# Security Policy

RepoScout treats security as part of product correctness.

## Supported code

Security fixes are targeted at the current `main` branch unless a maintained release policy is introduced later.

## Reporting a vulnerability

Please do **not** publish exploit details, credentials, private tokens, or proof-of-concept attack payloads in a public issue.

Preferred reporting path:

1. Open the repository's **Security** tab.
2. If GitHub shows **Report a vulnerability**, use that private vulnerability-reporting flow.

If private vulnerability reporting is not available, open a minimal public issue stating only that you need a private security contact path. Do not include exploit details in that issue.

Useful private reports include:

- affected endpoint/component;
- security impact;
- reproduction steps;
- required preconditions;
- suggested mitigation if known.

There is currently no bug-bounty program.

## Security boundaries

The current application includes:

- strict GitHub repository URL normalization;
- GitHub-only external repository fetching;
- parameterized PostgreSQL queries;
- explicit request-body size limits;
- stable malformed/oversized JSON handling;
- public submission rate limiting;
- repository resubmission cooldowns;
- protected moderation Bearer credentials;
- constant-time credential-hash comparison;
- server-derived moderation reviewer identity;
- atomic publication + moderation audit transactions;
- structured log redaction;
- opaque HMAC rate-limit identities rather than raw IP bucket keys;
- baseline API security headers;
- non-cacheable submission/moderation responses;
- production dependency vulnerability checks in CI;
- Dependabot dependency monitoring.

## Secrets

Never commit:

- GitHub tokens;
- moderation bearer credentials;
- database passwords/URLs containing credentials;
- provider API keys;
- deployment secrets.

Use environment configuration or the deployment platform's secret store.

The application logger redacts common secret-like metadata keys, but contributors must still avoid intentionally logging sensitive values.

## Dependency security

CI runs:

~~~bash
npm audit --omit=dev --audit-level=high
~~~

High or critical advisories affecting production dependencies block the gate.

Dependabot monitors npm and GitHub Actions dependencies weekly.

A passing dependency audit does not prove the absence of vulnerabilities; application-level review remains necessary.

## Deployment security

The repository cannot guarantee controls owned by hosting infrastructure.

A production deployment should additionally provide:

- HTTPS/TLS;
- correct reverse-proxy trust configuration;
- HSTS at the trusted TLS edge where appropriate;
- web/static-host CSP appropriate to the final frontend deployment;
- infrastructure-level abuse/DoS controls;
- database backups and restore testing;
- restricted production database access;
- secure secret injection/rotation;
- infrastructure log-retention policy.

The current application submission limiter is process-local. A horizontally scaled deployment must use a shared or edge rate limiter.

## Scope notes

Public submission is intentionally unauthenticated.

Final moderation is intentionally protected and remains a trusted human action.

Jev/model output is advisory and is not an authority for permanent publication decisions.
