# Phase 5D — Public Repository Submission Web UI

## Goal

Expose RepoScout's existing public repository-submission intake through the web application without weakening the moderation boundary established in Phase 5C.

Phase 5D adds a small community contribution surface:

~~~text
Public browser
      |
Add a Repository
      |
POST /api/submissions
      |
existing Phase 5A intake
      |
validation + evidence preparation
      |
protected Phase 5C moderation
      |
approval -> public catalog
~~~

The browser cannot approve, reject, inspect the moderation queue, or provide reviewer identity.

## Public request contract

The web client calls:

~~~http
POST /api/submissions
Content-Type: application/json
~~~

with exactly:

~~~json
{
  "repositoryUrl": "https://github.com/owner/repository"
}
~~~

No description, tags, ranking claims, reviewer identity, or other community-controlled metadata is sent.

The API remains the authority for GitHub URL validation and normalization.

## Submission states

The UI gives each existing API outcome a distinct user-facing state.

### Created

A successful `201` response shows the canonical repository identity and explains that the submission is pending validation and moderation.

Success does **not** claim publication.

### Already indexed

`409 repository_already_indexed` is presented as an informational state: the repository is already in RepoScout.

### Already pending

`409 submission_already_pending` tells the user an existing submission is already moving through the workflow.

The web app does not create a second submission or imply that resubmission accelerates review.

### Invalid submission

`400 invalid_submission` is shown as repository-URL feedback.

The form also prevents an empty submission locally, while the API remains authoritative for repository URL rules.

### Retryable failure

Network failures, server failures, and rate-limit-style failures are treated as retryable.

The UI preserves the entered repository URL and offers an explicit retry action.

Unknown non-retryable failures use a separate fallback state.

## Moderation expectations

The public surface explains the workflow in three steps:

1. validate the public GitHub repository and canonical identity;
2. prepare repository facts and contribution evidence;
3. allow a trusted reviewer to make the final listing decision.

This makes the publication boundary visible without exposing moderation capability.

## Security boundary

Phase 5D deliberately does not expose or reference reviewer bearer secrets.

The web application does not call:

~~~text
GET  /api/moderation/submissions
POST /api/moderation/submissions/:id/decision
~~~

It does not contain:
- moderation bearer credentials;
- reviewer references;
- approve/reject controls;
- moderation queue data;
- client-side publication logic.

Reviewer identity remains server-derived as established in Phase 5C.2.

## Web client validation

The submission client validates successful API responses before returning them to React.

It also preserves stable API error codes so the UI can distinguish:
- invalid input;
- already indexed;
- already pending;
- retryable transport/server failure;
- malformed or unknown responses.

The client uses a same-origin relative endpoint and sends only the URL field.

## Accessibility and responsive behavior

The submission surface:
- uses a labeled URL input;
- keeps helper text connected through `aria-describedby`;
- reports result states through an `aria-live` region;
- uses alert semantics for error states;
- disables the input/action during submission;
- keeps the retry action keyboard accessible;
- collapses the two-column layout and input action cleanly on smaller screens;
- inherits RepoScout's reduced-motion behavior.

## Tests

Focused web client tests cover:
- same-origin endpoint and URL-only request body;
- successful pending submission parsing;
- invalid submission error mapping;
- already-indexed state;
- already-pending state;
- retryable server failure;
- retryable network failure;
- malformed successful response rejection.

The normal repository-wide CI remains the release gate.

## Explicitly deferred

Phase 5D does not add:
- public submission rate limiting;
- CAPTCHA or challenge mechanisms;
- spam scoring;
- IP/device reputation;
- submission retention/cleanup policy;
- launch observability;
- automated moderation;
- reviewer web UI;
- user accounts;
- submission-status lookup or notifications.

Those launch-hardening concerns belong to Phase 5E or later product work.

## Status

Complete.

The Phase 5D implementation head `9784734dd78a97ff45b60d8682c59b7875214b54` passed GitHub Actions CI run 129 before documentation-only follow-up commits.

## Next checkpoint

Phase 5E — abuse and launch hardening.

The next phase should protect the unauthenticated public submission boundary for broader exposure without changing the trusted moderation transaction.
