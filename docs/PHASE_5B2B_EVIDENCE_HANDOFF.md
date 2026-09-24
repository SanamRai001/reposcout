# Phase 5B.2B — Submission Evidence Handoff

## Goal

Move already VALID community submissions into RepoScout's existing canonical repository and evidence pipelines without approving them.

Phase 5B.2B connects deterministic submission validation to:
- canonical repository ingestion;
- measured metadata persistence;
- bounded README evidence;
- contribution-document evidence.

A successful handoff prepares the submission for later human moderation.

It does **not** approve the submission.

## Eligibility

Only submissions with:

~~~text
status = PENDING
validation_outcome = VALID
resolved GitHub identity present
evidence handoff incomplete
~~~

are selected.

DUPLICATE, INVALID, unvalidated, already-completed, APPROVED, and REJECTED rows are not handoff candidates.

## Durable handoff state

Phase 5B.2B adds two fields to `repository_submissions`:

~~~text
handoff_repository_id nullable
evidence_handoff_completed_at nullable
~~~

They are either both null or both present.

Completed handoff requires:

~~~text
validation_outcome = VALID
~~~

`handoff_repository_id` references the canonical RepoScout repository created/resolved by ingestion.

The submission itself remains:

~~~text
status = PENDING
validation_outcome = VALID
~~~

until Phase 5C moderation acts.

## Why persist completion?

A VALID submission may remain pending for moderation for some time.

Without durable handoff state, every internal run would re-ingest and re-refresh an already prepared repository indefinitely.

The two-field completion state gives RepoScout:
- idempotent handoff;
- a stable link from submission to canonical repository;
- bounded candidate selection;
- no need for a job/attempt table yet.

## Flow

~~~text
PENDING + VALID submission
        |
bounded handoff candidate selection
        |
RepositorySubmissionEvidenceHandoffService
        |
        +-- canonical repository ingestion
        |      |
        |      +-- repository identity/state
        |      +-- measured metadata
        |
        +-- README evidence refresh
        |
        +-- contribution-document evidence refresh
        |
all required stages successful
        |
record handoff_repository_id
record evidence_handoff_completed_at
        |
submission remains PENDING
        |
Phase 5C moderation later
~~~

## Canonical ingestion reuse

Phase 5B.2B does not create another ingestion implementation.

It reuses `RepositoryIngestionService`, which already:
- fetches through the fixed-origin GitHub client;
- validates repository responses;
- persists canonical identity/state;
- persists measured metadata transactionally;
- remains rename/transfer safe through GitHub repository ID.

## Identity drift protection

Validation may happen before handoff.

Between those two steps:
- a repository may be renamed or transferred;
- an old owner/name path may disappear;
- an old path could eventually refer to a different repository.

Therefore handoff ingestion passes the GitHub repository ID resolved during validation as an expected identity.

After the fresh repository fetch and **before persistence**:

~~~text
fetched GitHub repository ID
        ==
validated GitHub repository ID
~~~

must hold.

If the IDs differ, ingestion throws an identity-mismatch error and nothing from that fetch is persisted.

RepoScout never silently hands a submission to a different repository merely because a GitHub path changed.

## Evidence stages

After canonical ingestion succeeds, RepoScout refreshes:

1. README evidence;
2. contribution-document evidence.

These reuse the existing Phase 3D services and stores.

No new README/content parsing logic is introduced.

## Failure isolation

### Ingestion provider failure

If canonical ingestion fails with a retryable GitHub error:
- no handoff completion is recorded;
- README is skipped;
- contribution evidence is skipped;
- the submission remains eligible for a later handoff run.

### README provider failure

If README refresh fails with a non-rate-limit GitHub provider error:
- canonical repository/metadata may already exist;
- contribution evidence is still attempted;
- handoff remains incomplete;
- the next handoff run safely retries the workflow.

### Contribution provider failure

If contribution evidence refresh fails with a GitHub provider error:
- already-written repository/metadata/README evidence is retained;
- handoff remains incomplete;
- a later run retries safely.

### GitHub rate limiting

A rate-limit response:
- marks the current stage retryable;
- preserves the provider retry timestamp when available;
- skips later GitHub stages for the current submission;
- stops the remaining selected batch.

This avoids consuming unavailable quota.

### Internal failures

Database failures, programming errors, invalid internal state, and identity-mismatch errors are not converted into ordinary retryable provider results.

They fail loudly.

## Partial writes are intentional

The handoff is not one giant database transaction around external HTTP calls.

For example:

~~~text
repository + metadata  ✓
README                  ✗ transient failure
contribution evidence  ✓
handoff completion      ✗ not recorded
~~~

This is valid.

Existing persistence/evidence writes are already idempotent and stale-safe.

A later handoff run can repeat those stages safely.

The durable completion marker is written only when every required stage succeeds in one completed handoff attempt.

## Batch orchestration

Phase 5B.2B adds a bounded internal orchestrator.

Default:

~~~text
10 submissions
~~~

Maximum:

~~~text
50 submissions
~~~

Selection order:

~~~text
validated_at ASC
id ASC
~~~

Only VALID, pending, incomplete submissions are selected.

A rate-limited result stops the rest of the selected batch.

Other incomplete provider outcomes are reported and the batch may continue.

## Internal CLI

Run:

~~~bash
npm run handoff:submissions -w @reposcout/api
~~~

Optional explicit batch limit:

~~~bash
npm run handoff:submissions -w @reposcout/api -- 25
~~~

The command uses the normal server-side PostgreSQL/GitHub configuration.

No public handoff route is added.

## Observability

The CLI emits structured events:

~~~text
submission.evidence_handoff_batch_started
submission.evidence_handoff_completed
submission.evidence_handoff_incomplete
submission.evidence_handoff_batch_completed
submission.evidence_handoff_batch_failed
~~~

Incomplete stage reports preserve:
- stage;
- GitHub error kind;
- message;
- retryAt when available.

Secrets are not logged.

## Database constraints

The database guarantees:
- handoff repository/timestamp are both null or both present;
- completed handoff belongs only to a VALID submission;
- the handoff repository is a real canonical repository foreign key.

A partial index supports oldest-first incomplete VALID handoff selection.

## Verification

Tests cover:
- expected GitHub repository ID verification before ingestion persistence;
- successful three-stage handoff;
- completion-state persistence;
- submission remains PENDING;
- measured metadata handoff;
- README evidence handoff;
- contribution evidence handoff;
- partial README failure remains retryable;
- contribution refresh still runs after isolated README failure;
- rate-limit stage stop behavior;
- batch rate-limit stop behavior;
- already-completed idempotency;
- candidate selection;
- database handoff-shape constraints;
- latest migration rollback preserving Phase 5B.1 validation state.

## Explicitly deferred

Phase 5B.2B does not add:
- automatic approval;
- rejection decisions;
- moderator users/authorization;
- moderation reasons;
- moderation event history;
- public handoff endpoint;
- background workers;
- persistent retry attempts;
- leases;
- Jev/model triage;
- submitter notifications.

## Next checkpoint

Phase 5C should introduce the human moderation workflow on top of fully validated and handed-off submissions:
- moderation queue;
- approve/reject;
- reviewer identity/authorization;
- reason;
- append-only moderation events.

Approval remains a human-controlled product decision.
