# Phase 5B.1 — Deterministic Submission Validation Core

## Goal

Resolve a Phase 5A pending submission against GitHub and persist an authoritative deterministic validation outcome before any moderation or model analysis occurs.

Phase 5B.1 is deliberately an internal validation core.

It does **not** add a public validation endpoint, automatic approval, evidence collection, or moderation UI.

## Input

Validation starts from an existing Phase 5A submission:

~~~text
status = PENDING
validation_outcome = null
~~~

The original intake fields remain immutable evidence of what was submitted:

~~~text
submitted_url
normalized_owner
normalized_name
normalized_full_name
~~~

They are not rewritten after GitHub resolution.

## Authoritative GitHub resolution

RepoScout resolves the submitted owner/name through the existing fixed-origin GitHub repository client:

~~~text
GET https://api.github.com/repos/{owner}/{repo}
~~~

The same pinned GitHub API version, timeout, token boundary, redirect rejection, and response validation used by canonical ingestion remain in effect.

The normalized GitHub snapshot now also captures GitHub's authoritative `private` boolean.

## Public/reachable requirement

A repository is eligible for community review only when GitHub resolves it as public.

Two cases become deterministic `INVALID`:

~~~text
GitHub 404 / inaccessible
authenticated GitHub response with private = true
~~~

The second rule matters because a server-side GitHub token may be able to see repositories that are not public.

RepoScout must not confuse token visibility with public availability.

## Outcomes

Phase 5B.1 introduces a separate validation outcome:

~~~text
VALID
DUPLICATE
INVALID
~~~

The outer submission status and validation outcome intentionally remain separate.

### VALID

Conditions:
- GitHub repository resolves successfully;
- GitHub says the repository is public;
- canonical GitHub repository ID is not already in RepoScout.

Persisted state:

~~~text
status = PENDING
validation_outcome = VALID
resolved GitHub identity = present
duplicate_repository_id = null
validated_at = present
~~~

A VALID submission is only **ready for later workflow**.

It is not approved.

### DUPLICATE

Conditions:
- GitHub repository resolves successfully;
- repository is public;
- canonical GitHub repository ID already exists in RepoScout.

Persisted state:

~~~text
status = DUPLICATE
validation_outcome = DUPLICATE
resolved GitHub identity = present
duplicate_repository_id = canonical RepoScout repository UUID
validated_at = present
~~~

The GitHub repository ID check catches rename/transfer cases that Phase 5A owner/name intake checks cannot reliably detect.

### INVALID

Conditions:
- GitHub returns not-found/not-publicly-accessible; or
- the authenticated response identifies the repository as private.

Persisted state:

~~~text
status = INVALID
validation_outcome = INVALID
resolved GitHub identity = null
duplicate_repository_id = null
validated_at = present
~~~

## Retryable GitHub failures

These are **not** deterministic repository outcomes:

- rate limiting;
- timeout/network failure;
- GitHub 5xx/other request failure;
- malformed provider response.

RepoScout propagates the failure and leaves the submission unchanged:

~~~text
status = PENDING
validation_outcome = null
validated_at = null
~~~

This prevents temporary provider failures from permanently invalidating legitimate submissions.

## Resolved canonical identity

Successful GitHub resolution stores separately:

~~~text
github_repository_id
resolved_owner
resolved_name
resolved_full_name
resolved_github_url
~~~

These fields describe GitHub's authoritative current identity.

They remain separate from the original intake identity so RepoScout can audit:

~~~text
what the community submitted
vs
what GitHub resolved
~~~

## Database migration

Phase 5B.1 extends `repository_submissions` with:

~~~text
validation_outcome nullable
github_repository_id nullable
resolved_owner nullable
resolved_name nullable
resolved_full_name nullable
resolved_github_url nullable
duplicate_repository_id nullable
validated_at nullable
~~~

Database constraints enforce valid state combinations.

The latest migration rollback removes these validation fields while preserving the Phase 5A submission table and all earlier repository/content tables.

## Race safety and idempotency

Validation writes only transition rows matching:

~~~text
status = PENDING
validation_outcome IS NULL
~~~

If another worker records the outcome first, the losing worker reads and returns the already-persisted result.

Once a deterministic validation outcome exists, future validation calls return that record without another GitHub request.

This prepares the core for later worker/orchestration code without creating the worker yet.

## Canonical duplicate identity

Phase 5A performs a convenient owner/name duplicate check at intake.

Phase 5B.1 performs the authoritative duplicate check:

~~~text
resolved GitHub repository ID
        |
RepositoryStore.findByGithubRepositoryId
        |
existing internal repository?
        |
yes -> DUPLICATE
no  -> VALID
~~~

GitHub repository ID remains the canonical external identity.

## Model boundary

No model is involved in deterministic submission validation.

Jev or another future model must not decide:
- whether a repository exists;
- whether it is public;
- canonical GitHub identity;
- whether canonical identity is already indexed.

Those are authoritative GitHub/database facts.

## Public API boundary

Phase 5B.1 adds no new public route.

The existing Phase 5A intake response remains unchanged.

The validation service is internal infrastructure for later orchestration and moderation phases.

## Explicitly deferred

Phase 5B.1 does not add:

- public/manual validation HTTP endpoint;
- background validation queue;
- automatic repository ingestion;
- README refresh for submissions;
- contribution-evidence refresh for submissions;
- approval;
- rejection by moderator;
- moderation queue;
- audit events;
- submitter identity;
- rate limiting;
- Jev/model triage;
- web submission UI.

## Verification

Tests cover:

- successful public unique resolution;
- preservation of resolved canonical identity;
- duplicate detection by GitHub repository ID;
- renamed/transferred duplicate scenario;
- GitHub 404 -> INVALID;
- token-visible private repository -> INVALID;
- rate limit leaves submission unchanged;
- already-validated idempotency;
- validation state database constraints;
- validation migration rollback preserving Phase 5A intake;
- existing Phase 5A intake regressions.

## Status

Complete.

The Phase 5B.1 branch passed application verification, Jev regression checks, migration apply/rollback/reapply, submission validation schema constraints, canonical ingestion/catalog/search regressions, private-repository handling, combined submission workflow integration, and PostgreSQL connectivity.

## Next checkpoint

### Phase 5B.2 — Validation orchestration and evidence handoff

Next:
- provide a safe internal mechanism to execute validation for pending submissions;
- define which VALID submissions proceed to metadata/content evidence collection;
- keep validation failures retryable and observable;
- avoid automatic approval.

Moderation remains Phase 5C.
