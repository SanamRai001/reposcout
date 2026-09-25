# Phase 5E.4 — Launch Observability and Security Review

## Goal

Close Phase 5E with enough application-level observability and security hardening to operate the public submission + protected moderation boundary without collecting unnecessary identity data or leaking credentials.

This phase does not claim that every production deployment gate is complete.

## Security-boundary request telemetry

Requests receive a server-generated UUID request ID:

~~~http
X-Request-Id: <uuid>
~~~

Submission and moderation responses also receive:

~~~http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
~~~

Submission and moderation boundaries are marked:

~~~http
Cache-Control: no-store
~~~

No HSTS header is emitted by the application because TLS termination/topology is deployment-specific. HSTS belongs at the trusted HTTPS edge.

## Stable body-parser failures

The API JSON body limit remains 100 KiB.

Malformed JSON now returns:

~~~text
400 invalid_json
~~~

Oversized JSON now returns:

~~~text
413 request_body_too_large
~~~

These no longer fall through to a generic internal-server-error response.

## Structured event catalog

The existing JSON logger remains the observability surface.

### Generic boundary completion

~~~text
http.security_boundary_completed
~~~

Fields:

- requestId;
- method;
- path;
- statusCode;
- durationMs.

### Public submission

~~~text
submission.intake_accepted
submission.intake_rejected
submission.rate_limit_rejected
~~~

Safe fields include:

- requestId;
- submissionId;
- status;
- stable outcome;
- limit;
- retryAfterSeconds.

The repository URL and request body are not included in these operational events.

### Protected moderation

~~~text
moderation.authentication_failed
moderation.queue_read
moderation.decision_applied
moderation.request_rejected
~~~

Safe fields can include:

- requestId;
- reviewerRef after successful authentication;
- submissionId;
- limit/count;
- decision;
- stable rejection outcome.

Operational events do not contain the bearer credential or moderation reason.

The append-only moderation table remains the authoritative final-decision audit record.

## Log redaction

Logger metadata is recursively sanitized before serialization.

Keys matching credential-like names are redacted, including:

- authorization;
- cookie;
- password;
- secret;
- token;
- API key;
- database URL.

Reserved log fields (`timestamp`, `level`, `event`) are written after metadata and cannot be overridden by caller-provided metadata.

This is defense in depth. Callers should still never intentionally pass secrets to logging functions.

## Rate-limit identity privacy

Phase 5E.1 originally keyed the process-local limiter directly by the resolved request address.

Phase 5E.4 derives the bucket key with:

~~~text
HMAC-SHA256(
  per-process random secret,
  resolved client address
)
~~~

The limiter therefore stores an opaque digest rather than the raw address.

The secret is generated at process startup and is not persisted.

This is compatible with the existing process-local limiter because process restart already resets its counters.

The HTTP tests verify the limiter receives a digest rather than the raw client address.

## Dependency security gate

CI now runs:

~~~bash
npm audit --omit=dev --audit-level=high
~~~

High/critical production dependency advisories fail CI.

CI run 155 passed this new gate on the initial Phase 5E.4 code checkpoint.

CI run 156 also passed after the explicit no-bearer-token-log regression was added.

Dependabot now monitors:

- npm dependencies;
- GitHub Actions dependencies.

It checks weekly and opens bounded update PRs.

## End-to-end public boundary review

### Public submission

Verified boundaries:

- URL-only request contract;
- exact GitHub repository-root normalization;
- no free-form promotional metadata;
- request body bounded to 100 KiB;
- malformed/oversized bodies produce stable client errors;
- rate limit occurs before JSON parsing;
- forwarded addresses are untrusted by default;
- in-memory limiter stores HMAC identities, not raw IP keys;
- stable duplicate/pending/cooldown responses;
- terminal resubmission cooldown;
- deterministic validation;
- GitHub-only provider fetching;
- no automatic publication;
- trusted moderation required.

### Protected moderation

Verified boundaries:

- dedicated reviewer Bearer credential;
- credentials originate from server configuration;
- configured tokens are hashed in memory;
- constant-time hash comparison;
- reviewer identity cannot be supplied by the client;
- decision body accepts only decision + reason;
- publication/status/audit are atomic;
- final event is append-only;
- repeated/conflicting decisions are rejected;
- operational logs never include bearer credentials or moderation reason;
- authenticated responses are non-cacheable.

### Database

Verified boundaries:

- parameterized queries;
- database constraints for submission states;
- at most one pending submission per normalized repository;
- migration apply/rollback/reapply is continuously tested;
- cleanup is bounded and conservative;
- moderation history is excluded from cleanup.

### Browser/security model

RepoScout does not enable a general cross-origin API policy.

Protected moderation uses an explicit Authorization header rather than ambient browser cookies, so it does not rely on cookie-based CSRF protection.

The current API sets baseline response hardening headers.

Frontend CSP and transport HSTS remain deployment/static-host responsibilities.

## Privacy review

The Phase 5E.4 privacy review records:

- no public RepoScout account required;
- no email/name requested for submission;
- no browser fingerprint;
- no raw client IP persisted in the database;
- raw IP not used as stored limiter bucket identity;
- raw IP not included in application security logs;
- request bodies and authorization headers not logged;
- moderation audit identity/reason retained by design;
- old INVALID/DUPLICATE submission retention is bounded;
- application-log retention is deployment-controlled.

See [PRIVACY.md](PRIVACY.md).

## Suggested operational signals

A future log aggregation/alerting layer can derive useful signals without a new application metrics database.

Watch for:

- increased `submission.rate_limit_rejected`;
- spikes in `submission.intake_rejected`;
- repeated `moderation.authentication_failed`;
- unexpected growth in 4xx/5xx boundary completions;
- any `http.unhandled_error`;
- readiness failures;
- unusually high request duration;
- moderation queue counts that remain high;
- cleanup previews that repeatedly show large stale backlogs.

Phase 5E.4 does not choose a monitoring vendor.

## Dependency audit result

The current Phase 5E.4 checkpoint passed the configured high/critical production dependency audit in GitHub Actions.

That result is time-specific. The CI gate and Dependabot are the durable controls.

## Residual risks / deployment gates

Phase 5E is application launch hardening, not a declaration that every broad-public-production requirement is complete.

Still outside Phase 5E:

- database backup policy and tested restore procedure;
- deployment/recovery runbook;
- infrastructure-level rate limiting for horizontal scale;
- infrastructure access-log retention;
- production TLS/HSTS configuration;
- final frontend/static-host CSP;
- accessibility pass;
- Code of Conduct before broader community contribution;
- contribution/issue templates;
- final production hosting configuration.

The process-local submission limiter must be replaced or complemented by a shared/edge limiter before horizontal API scaling.

The protected moderation API does not currently have a separate application-specific rate limiter. Its high-entropy bearer credentials make credential guessing impractical, while body size and general infrastructure controls limit request cost; a production edge rate limit remains recommended.

## Status

Complete once the documentation-complete PR head and post-merge `main` CI are green.

## Next product phase

Phase 6 — Historical snapshots.

Production gates listed above remain independent work and should not be silently considered complete merely because the roadmap advances to Phase 6.
