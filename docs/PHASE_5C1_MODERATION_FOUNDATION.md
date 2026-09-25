# Phase 5C.1 — Moderation Foundation

## Status

Implementation verified on the feature branch.

Phase 5C.1 adds the persistence and publication boundary required before any reviewer-facing moderation API is exposed.

## Problem discovered

Phase 5B.2B deliberately ingests a VALID submission into canonical repository storage before moderation so RepoScout can collect:

- measured metadata;
- README evidence;
- contribution-document evidence.

However, the public catalog/search also read from canonical repository storage.

Without a separate publication state, a PENDING submission prepared for moderation could become publicly discoverable before a human approved it.

Phase 5C.1 fixes that boundary.

## Canonical storage is not public listing

Repositories now have:

~~~text
is_listed boolean
~~~

Meaning:

~~~text
canonical repository row
        |
        +-- is_listed = false
        |      internal evidence/preparation only
        |
        +-- is_listed = true
               public catalog/search/detail
~~~

Existing repositories remain listed by default.

The migration also backfills already-prepared PENDING + VALID submission repositories to unlisted.

## Evidence handoff behavior

Submission evidence handoff now creates a new canonical repository with:

~~~text
initialListing = unlisted
~~~

This does **not** mean the repository is rejected.

It means:

> RepoScout has enough canonical/evidence data to review the candidate, but it is not published yet.

Normal direct/manual ingestion still creates new repositories as listed by default.

## Listing ownership

Repository refresh may update GitHub-originated state such as:

- owner/name;
- description;
- branch;
- archive/fork state;
- timestamps;
- measured metadata.

Refresh does **not** change existing listing state.

Therefore an unlisted moderation candidate cannot accidentally become public because a later normal refresh runs.

Publication is owned by moderation.

## Public read boundary

The following repository reads include only listed repositories:

- catalog list;
- repository detail;
- lexical search;
- structured/filter-only discovery;
- submission intake already-indexed check;
- deterministic validation duplicate-by-GitHub-ID check.

Internal ingestion/evidence lookup can still resolve unlisted canonical rows.

## Duplicate semantics

“Already indexed” now means publicly listed.

This distinction is necessary because a rejected candidate may retain its canonical/evidence rows internally.

An unlisted row must not permanently block a later resubmission.

## Moderation eligibility

A submission is eligible for final moderation only when all are true:

~~~text
status = PENDING
validation_outcome = VALID
handoff_repository_id IS NOT NULL
evidence_handoff_completed_at IS NOT NULL
~~~

Moderation candidates are ordered oldest-first by evidence-handoff completion time, then stable submission ID.

## Decisions

Supported final decisions:

~~~text
APPROVED
REJECTED
~~~

Reviewer input also requires:

~~~text
reviewer_ref
reason
~~~

Application validation:

- reviewer_ref is trimmed, 1–200 characters;
- reason is trimmed/whitespace-normalized, 1–2000 characters;
- decision must be APPROVED or REJECTED.

The database independently constrains decision/reviewer/reason shape.

## Atomic approval

Approval is one PostgreSQL transaction:

~~~text
lock submission
      |
verify moderation eligibility
      |
publish handoff repository
is_listed = true
      |
submission.status = APPROVED
      |
insert append-only moderation event
      |
COMMIT
~~~

If any step fails, none of the approval/publication state commits.

A repository therefore cannot be published by this workflow without its moderation audit event.

## Rejection

Rejection runs through the same locked final-decision transaction, except it does not publish the repository.

Result:

~~~text
submission.status = REJECTED
repository stays is_listed = false
moderation event is persisted
evidence remains internally available
~~~

Evidence is retained rather than deleted because it may be useful for:

- audit/debugging;
- future resubmission review;
- understanding why a decision was made.

## Append-only moderation event

Phase 5C.1 adds:

~~~text
repository_submission_moderation_events

id
submission_id
decision
reviewer_ref
reason
created_at
~~~

There is exactly one final moderation event per submission.

The phase does not add update/delete operations for moderation events.

A second or conflicting final moderation attempt returns an already-moderated outcome instead of mutating history.

## Concurrency

Moderation locks the submission row with:

~~~sql
SELECT ... FOR UPDATE
~~~

This prevents two reviewers/processes from racing different final decisions through the application transaction.

The unique moderation-event index provides an additional database invariant.

## Migration compatibility

The previous validation-shape constraint required:

~~~text
VALID => status = PENDING
~~~

Phase 5C.1 updates it to allow a deterministically VALID submission to become:

~~~text
PENDING
APPROVED
REJECTED
~~~

DUPLICATE and INVALID validation semantics remain unchanged.

The migration rollback:

- removes moderation events;
- removes listing state;
- converts VALID APPROVED/REJECTED rows back to PENDING before restoring the previous validation constraint;
- preserves Phase 5B validation and evidence-handoff fields.

## Verified behavior

Integration coverage proves:

- pre-approval handoff repositories are absent from public detail/catalog/search;
- internal canonical lookup still resolves them;
- ordinary repository refresh preserves unlisted state;
- listed-only duplicate checks ignore hidden evidence rows;
- moderation queue selects only fully prepared PENDING + VALID submissions;
- approval publishes the repository;
- approval persists exactly one audit event;
- conflicting second moderation is rejected;
- rejection keeps the repository hidden;
- rejected hidden evidence does not prevent a later submission;
- incomplete/unvalidated submissions cannot be moderated;
- migration apply/rollback/reapply succeeds.

## Explicitly deferred

Phase 5C.1 does **not** expose moderation actions through HTTP.

Deferred:

- reviewer authentication;
- reviewer authorization/roles;
- protected moderation queue API;
- approve/reject HTTP endpoint;
- moderation UI;
- public reviewer identity/profile;
- notifications;
- model-assisted moderation.

This is deliberate: an unauthenticated approval endpoint would be unsafe.

## Next checkpoint

### Phase 5C.2 — Reviewer authorization + protected moderation API

Next:

- establish the smallest trusted reviewer identity mechanism;
- authorize moderation operations;
- expose a protected pending queue;
- expose protected approve/reject actions;
- map moderation domain errors to stable HTTP responses;
- preserve the Phase 5C.1 transaction as the only publication path.

No public submission UI changes are required yet.
