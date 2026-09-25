# Phase 5E.3 — Submission Retention and Operational Cleanup

## Goal

Define a safe retention boundary for community-submission workflow data and add a bounded operational cleanup path without weakening moderation auditability or deleting prepared repository evidence.

## Retention policy

RepoScout keeps the records that are needed for active work, moderation history, publication history, and review recovery.

Retained in Phase 5E.3:

- `PENDING` submissions;
- `APPROVED` submissions;
- `REJECTED` submissions;
- all `repository_submission_moderation_events`;
- canonical repositories prepared during evidence handoff;
- repository metadata, README evidence, and contribution evidence tied to those repositories.

Eligible for cleanup:

- `INVALID` submissions;
- `DUPLICATE` submissions.

Even those rows are eligible only when:

- their terminal `updated_at` is older than the configured retention cutoff;
- `handoff_repository_id IS NULL`;
- `evidence_handoff_completed_at IS NULL`;
- no moderation event references the submission.

## Retention window

Production default:

~~~ini
SUBMISSION_TERMINAL_RETENTION_DAYS=90
~~~

Allowed range:

- minimum: 31 days;
- maximum: 3650 days.

The minimum is intentionally greater than the maximum 30-day resubmission cooldown from Phase 5E.2.

That guarantees cleanup cannot erase the deterministic terminal record while RepoScout still relies on it to enforce the configured cooldown.

## Cleanup command

Preview is the default:

~~~bash
npm run cleanup:submissions -w @reposcout/api
~~~

Optional preview batch limit:

~~~bash
npm run cleanup:submissions -w @reposcout/api -- 250
~~~

Deletion requires explicit apply mode:

~~~bash
npm run cleanup:submissions -w @reposcout/api -- --apply 250
~~~

Defaults:

- batch size: 100;
- maximum batch size: 1000.

The command prints a structured report containing:

- mode;
- cutoff;
- retention days;
- selected/deleted counts;
- INVALID/DUPLICATE counts;
- selected item IDs/status/timestamps.

## Database safety boundary

Cleanup selection is indexed by:

~~~text
repository_submissions_cleanup_candidates_idx
(updated_at, id)
WHERE status IN ('INVALID', 'DUPLICATE')
  AND handoff_repository_id IS NULL
  AND evidence_handoff_completed_at IS NULL
~~~

Apply mode uses one bounded delete statement.

Candidates are selected with:

~~~sql
FOR UPDATE SKIP LOCKED
~~~

Eligibility is checked again inside the delete statement.

This prevents concurrent cleanup runs from deleting the same row and avoids relying on a stale preview result.

## What cleanup does not delete

### Canonical duplicate target repositories

A DUPLICATE submission may reference an indexed canonical repository through `duplicate_repository_id`.

Deleting the submission does not delete that repository.

### Moderation history

APPROVED/REJECTED submissions and moderation events remain retained.

An additional defensive `NOT EXISTS` moderation-event check also excludes any anomalous INVALID/DUPLICATE row that has audit history.

### Prepared rejected evidence

Phase 5C intentionally keeps rejected repository/evidence data unlisted for audit/review history.

Phase 5E.3 preserves that decision.

## Recovery

Cleanup is irreversible through the application.

If old INVALID/DUPLICATE history must be recovered after an applied cleanup, recovery requires the normal database backup/restore process.

This phase does not pretend to provide a backup system. Backups and deployment recovery remain explicit production gates.

## Why cleanup is not scheduled yet

RepoScout currently does not need a background scheduler solely for retention.

Manual dry-run-first execution provides:

- operator visibility;
- controlled rollout;
- no new worker infrastructure;
- no surprise deletion during early product development.

A scheduled cleanup job can be added later when deployment and observability requirements justify it.

## Verification

Coverage includes:

- 90-day default retention;
- configurable retention validation;
- 31-day minimum;
- batch-limit validation;
- preview mode does not delete;
- apply mode deletes only eligible rows;
- recent terminal rows remain;
- PENDING rows remain;
- rows with moderation events remain;
- canonical duplicate target repositories remain;
- cleanup batch size is enforced;
- cleanup lookup index exists;
- latest migration rollback removes only the cleanup index;
- the Phase 5E.2 cooldown index remains after rollback;
- migration reapply succeeds.

GitHub Actions CI run 149 passed on code head `888e54177e105ef0afdb044eb70b073a7ab4a9f9` before documentation-only commits.

## Status

Complete.

## Next checkpoint

Phase 5E.4 — observability + security review.
