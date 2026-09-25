# Phase 5E.1 — Public Submission Rate Limiting

## Goal

Protect RepoScout's unauthenticated public repository-submission endpoint from repeated request abuse without changing submission validation or trusted moderation.

The protected path is:

~~~text
client
  |
resolved client IP
  |
bounded fixed-window limiter
  |
POST /api/submissions
  |
existing Phase 5A intake
  |
existing validation / evidence / moderation workflow
~~~

## Default policy

Production bootstrap configures:

~~~text
10 attempts
per 10 minutes
per resolved client IP
~~~

Environment controls:

~~~text
SUBMISSION_RATE_LIMIT_WINDOW_MS=600000
SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS=10
SUBMISSION_RATE_LIMIT_MAX_CLIENTS=10000
TRUST_PROXY_HOPS=0
~~~

The values are validated at startup.

## Request placement

The submission limiter is mounted before the JSON body parser for `/api/submissions`.

That means an exhausted client receives a 429 before normal request-body parsing or submission-service work.

Only POST requests are counted by this middleware.

## Stable HTTP contract

When a client exceeds the current window, RepoScout returns:

~~~http
HTTP/1.1 429 Too Many Requests
Retry-After: <seconds>
RateLimit-Limit: <configured-attempts>
RateLimit-Remaining: 0
RateLimit-Reset: <seconds>
~~~

Body:

~~~json
{
  "error": "submission_rate_limited",
  "message": "Too many repository submission attempts. Try again after the retry window.",
  "retryAfterSeconds": 60
}
~~~

Allowed requests also receive limit/remaining/reset headers.

The web client preserves `submission_rate_limited` as a retryable submission error.

## Client identity and reverse proxies

RepoScout uses Express's resolved request IP as the limiter key.

By default:

~~~text
TRUST_PROXY_HOPS=0
~~~

So forwarded IP headers are not trusted.

A deployment behind a known reverse proxy may explicitly configure the number of trusted hops.

This is security-sensitive configuration:

- too little trust may cause many users to share the proxy's rate-limit bucket;
- too much trust may allow spoofed forwarded addresses to bypass per-client limits;
- the backend should not be publicly reachable around the trusted proxy when forwarded identity is enabled.

Tests verify both the default untrusted behavior and explicit one-hop proxy behavior.

## Bounded memory

The limiter keeps only a bounded number of active client buckets.

When the tracked-client capacity is full:

1. expired buckets are removed;
2. if capacity is still full, an untracked client is denied until the earliest active bucket resets.

The implementation does not evict active buckets to make room because doing so could let an attacker churn identities to reset its own limit.

## Process-local limitation

The Phase 5E.1 limiter is in memory.

This is deliberate for the current single-process architecture, but it has an important limitation:

~~~text
instance A counter != instance B counter
~~~

If RepoScout is horizontally scaled, a caller could distribute requests across instances.

Before multi-instance deployment, move this control to either:

- a trusted edge/reverse-proxy limiter; or
- a shared rate-limit store.

This phase does not claim distributed abuse protection.

## What rate limiting does not solve

Rate limiting reduces request frequency.

It does not determine whether a submitted repository is useful, spam, malicious, or appropriate for listing.

Trusted moderation remains unchanged.

Phase 5E.2 is responsible for complementary deterministic spam/abuse controls.

## Verification

Tests cover:

- fixed-window attempt exhaustion;
- reset after window expiry;
- independent client buckets;
- bounded tracked-client capacity;
- stable HTTP 429 body;
- Retry-After and rate-limit headers;
- forwarded-address spoof resistance by default;
- explicit trusted proxy hop behavior;
- environment defaults and validation;
- web-client rate-limit error preservation.

GitHub Actions CI run 135 passed on implementation head `a78a135a57c2737f590481f8b5d96c12ae2174dd` before documentation-only commits.

## Status

Complete.

## Next checkpoint

Phase 5E.2 — deterministic submission spam / abuse controls.

Keep final publication authority with trusted reviewers. Do not introduce model-driven automatic approval or rejection as part of abuse filtering.
