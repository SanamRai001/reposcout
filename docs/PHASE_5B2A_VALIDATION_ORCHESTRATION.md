# Phase 5B.2A — Submission Validation Orchestration

## Goal

Add a safe internal execution path for deterministic validation of pending repository submissions.

Phase 5B.2A orchestrates the Phase 5B.1 validation core.

It does **not** ingest VALID repositories, collect README/contribution evidence, approve submissions, or expose a public validation endpoint.

## Candidate selection

The submission store selects only:

- status = PENDING
- validation_outcome IS NULL

Candidates are ordered by:

- created_at ASC
- id ASC

Batch limits:

- default: 10
- maximum: 50

VALID submissions from earlier runs are not selected again. DUPLICATE and INVALID submissions are not selected.

## Orchestration flow

~~~text
maintainer/internal trigger
        |
select oldest pending/unvalidated submissions
        |
RepositorySubmissionValidationOrchestrator
        |
        +-- validate submission 1
        +-- validate submission 2
        +-- ...
        |
deterministic outcome or retryable failure
        |
structured batch report
~~~

The orchestrator calls the existing Phase 5B.1 validation service and does not duplicate GitHub validation logic.

## Deterministic outcomes

Successful validation results remain separate:

- VALID
- DUPLICATE
- INVALID

VALID still means factually eligible for later workflow. It does not mean approved.

## Retryable provider failures

The Phase 5B.1 validator already leaves submissions unchanged for transient GitHub failures.

The orchestrator records these retryable kinds:

- rate_limited
- request_failed
- invalid_response

Each retryable item includes:

- submissionId
- errorKind
- message
- retryAt (nullable)

No retry loop runs inside the batch.

The submission remains PENDING with no validation outcome so a later run can retry safely.

## Rate-limit behavior

When GitHub returns a rate-limited failure, the orchestrator:

1. records the current submission as retryable;
2. preserves GitHub retryAt when available;
3. stops processing the rest of the selected batch.

This avoids wasting additional API calls after GitHub has already indicated quota is unavailable.

The report includes:

- stoppedEarly = true
- remainingSelected = N

Unprocessed submissions remain untouched.

## Other transient failures

For isolated request_failed or invalid_response errors, the orchestrator records the retryable failure and continues to the next selected submission.

## Unexpected failures

Unexpected errors such as database failures, programmer errors, or invalid internal state are not converted into retryable submission outcomes.

They fail the batch loudly.

## Concurrency safety

Phase 5B.1 validation writes are already first-writer-safe and idempotent.

If two internal runners accidentally select the same pending submission:

- both may perform a GitHub request;
- only one deterministic validation write can win;
- the other validator reads the already-recorded outcome.

Phase 5B.2A does not add persistent leases or a worker queue yet.

## Internal CLI

Run a bounded batch:

~~~bash
npm run validate:submissions -w @reposcout/api
~~~

Explicit limit:

~~~bash
npm run validate:submissions -w @reposcout/api -- 25
~~~

The command uses the normal server-side PostgreSQL and GitHub configuration.

No public route is added.

## Observability

The CLI emits structured events:

- submission.validation_batch_started
- submission.validation_completed
- submission.validation_retryable_failure
- submission.validation_batch_completed
- submission.validation_batch_failed

The final report includes:

- selected
- processed
- remainingSelected
- stoppedEarly
- valid
- duplicate
- invalid
- retryable

Secrets are never logged.

## Database changes

None.

Phase 5B.2A reuses the existing repository_submissions table and Phase 5B.1 validation state.

No retry, lease, or job table is introduced.

## Verification

Tests cover:

- default and explicit batch limits;
- invalid batch limits;
- deterministic outcome summary;
- isolated retryable failure continuation;
- rate-limit early stop;
- retry timestamp preservation;
- unexpected-error propagation;
- PostgreSQL selection of only pending/unvalidated submissions;
- selection limit enforcement.

The existing submission CI gate now includes orchestration integration coverage.

## Explicitly deferred

Phase 5B.2A does not add:

- automatic repository ingestion;
- metadata handoff;
- README refresh;
- contribution-evidence refresh;
- persistent retry scheduling;
- job leases;
- background workers;
- automatic approval;
- moderation;
- public validation HTTP endpoint;
- submitter notifications;
- Jev/model triage.

## Status

Complete.

The Phase 5B.2A branch passed application verification, migration rollback/reapply, repository persistence/content/ingestion/catalog/search regressions, the expanded submission integration gate, orchestration unit coverage, and PostgreSQL connectivity.

## Next checkpoint

### Phase 5B.2B — Evidence handoff for VALID submissions

Next:

- take already VALID submissions;
- ingest authoritative repository state/metadata through the existing ingestion pipeline;
- refresh bounded README evidence;
- refresh contribution-document evidence;
- keep each evidence failure observable and retryable;
- preserve the submission as PENDING;
- do **not** automatically approve the repository.

Only after evidence handoff is reliable should Phase 5C build the moderation workflow.
