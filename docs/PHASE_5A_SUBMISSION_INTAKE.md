# Phase 5A — Community Repository Submission Intake

## Goal

Create RepoScout's first community write path without mixing intake, GitHub analysis, moderation, or approval into one large phase.

Phase 5A accepts a GitHub repository URL, normalizes it, protects against obvious duplicates, and persists a pending submission.

It does **not** decide whether the repository should be approved.

## Endpoint

~~~text
POST /api/submissions
~~~

Request:

~~~json
{
  "repositoryUrl": "https://github.com/owner/repository"
}
~~~

The body must contain exactly one field: `repositoryUrl`.

Phase 5A deliberately does not accept:
- descriptions;
- categories;
- tags;
- reasons;
- ranking claims;
- HTML/Markdown;
- submitter-authored metadata.

This keeps the first public write surface narrow and reduces spam/XSS/trust complexity.

## URL requirements

The submitted value must be a full HTTPS GitHub repository URL.

Accepted examples:

~~~text
https://github.com/Owner/Repository
https://github.com/Owner/Repository.git
~~~

Rejected examples include:
- `owner/repository` shorthand;
- non-GitHub hosts;
- HTTP URLs;
- URLs containing query strings/fragments/credentials;
- paths other than exactly owner/repository.

## Normalized identity

RepoScout normalizes the submitted repository into:

~~~text
normalized_owner
normalized_name
normalized_full_name
submitted_url
~~~

Normalization:
- trims surrounding whitespace;
- removes an optional `.git` suffix;
- lowercases owner/name for duplicate detection;
- emits a canonical URL:
  `https://github.com/{normalized_owner}/{normalized_name}`.

This normalized owner/name is an **intake identity**, not the final canonical external identity.

GitHub repository ID remains the authoritative identity after later GitHub resolution.

## Storage

Phase 5A adds:

~~~text
repository_submissions
~~~

Fields:

~~~text
id
submitted_url
normalized_owner
normalized_name
normalized_full_name
status
created_at
updated_at
~~~

Supported status vocabulary is reserved now for the future moderation workflow:

~~~text
PENDING
APPROVED
REJECTED
DUPLICATE
INVALID
~~~

Phase 5A only creates:

~~~text
PENDING
~~~

## Duplicate protection

### Already indexed

Before creating a submission, RepoScout checks current canonical repositories using case-insensitive `full_name` comparison.

Result:

~~~text
409 repository_already_indexed
~~~

This is an intake convenience check.

Later deterministic GitHub resolution must check canonical GitHub repository ID again because repositories can be renamed/transferred.

### Already pending

The database enforces at most one `PENDING` submission for a normalized full name.

This is enforced with a partial unique index, not only application logic.

Result:

~~~text
409 submission_already_pending
~~~

Concurrent duplicate requests therefore cannot create two pending rows.

## Success response

A created submission returns:

~~~json
{
  "data": {
    "id": "uuid",
    "repository": {
      "owner": "owner",
      "name": "repository",
      "fullName": "owner/repository",
      "githubUrl": "https://github.com/owner/repository"
    },
    "status": "PENDING",
    "createdAt": "..."
  }
}
~~~

HTTP status:

~~~text
201 Created
~~~

## Error contract

### Invalid request

~~~text
400 invalid_submission
~~~

Examples:
- malformed body;
- extra body fields;
- shorthand instead of full URL;
- unsupported GitHub URL shape.

### Already indexed

~~~text
409 repository_already_indexed
~~~

### Already pending

~~~text
409 submission_already_pending
~~~

Database error details are not exposed.

## Security boundary

Phase 5A is **not yet launch-ready as an unrestricted public write endpoint**.

Before broad public exposure, RepoScout still needs:
- abuse/rate limiting;
- deterministic GitHub existence/public-access validation;
- moderation workflow;
- audit events;
- operational retention/cleanup policy.

The small request body and absence of free-form community content reduce risk, but they do not replace abuse controls.

## What Phase 5A deliberately does not do

No:
- GitHub API call during submission;
- repository existence/public-access verification;
- GitHub repository ID resolution;
- metadata ingestion;
- README/content collection;
- Jev/model analysis;
- automatic approval;
- moderation queue read API;
- approve/reject endpoint;
- authentication;
- submitter identity;
- rate limiting;
- audit log;
- web submission form.

These belong to later, separately verifiable phases.

## Verification

Tests cover:
- URL normalization;
- optional `.git` suffix;
- full-URL-only rule;
- non-GitHub URL rejection;
- indexed-repository duplicate detection;
- pending-submission duplicate detection;
- exact HTTP 201/400/409 contracts;
- extra user-controlled body-field rejection;
- PostgreSQL persistence;
- case-insensitive duplicate behavior;
- concurrent duplicate race protection;
- submission schema constraints;
- migration rollback preserving earlier repository/content tables.

## Status

Complete.

The Phase 5A branch passed application verification, migration apply/rollback/reapply, submission schema constraints, repository/content/ingestion/catalog/search regressions, concurrent submission integration, and PostgreSQL connectivity.

## Next checkpoints

### Phase 5B — Deterministic submission validation

Planned:
- resolve the submitted repository through GitHub;
- require public/reachable repository state;
- capture canonical GitHub repository ID;
- re-check duplicate identity using GitHub ID;
- classify deterministic invalid/duplicate outcomes;
- keep model analysis out of authoritative validation.

### Phase 5C — Moderation workflow

Later:
- pending moderation queue;
- approve/reject;
- reason capture;
- append-only moderation events;
- authorization boundary.

### Phase 5D — Submission web UI

Later:
- simple "Add a Repository" form;
- success/duplicate/error states;
- clear moderation expectations.

### Phase 5E — Abuse/launch hardening

Before broad public launch:
- rate limiting;
- spam/abuse controls;
- operational cleanup/retention;
- observability;
- security review.
