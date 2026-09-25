# Phase 5E.2 — Submission Abuse Controls

## Goal

Reduce repeated public-submission queue churn without adding an account system, invasive submitter tracking, model-driven moderation, or a permanent repository blacklist.

Phase 5E.1 limits how frequently one resolved client IP can submit.

Phase 5E.2 adds a complementary repository-level control:

~~~text
normalized repository
        |
recent PENDING? -------- yes --> existing pending response
        |
        no
        |
recent terminal result?
        |
      yes --------------------> cooldown response
        |
        no
        |
create new PENDING submission
~~~

## Terminal resubmission cooldown

After a submission has left PENDING, the same normalized repository cannot immediately create another pending row.

Production default:

~~~ini
SUBMISSION_RESUBMISSION_COOLDOWN_MS=86400000
~~~

That is 24 hours.

Accepted configuration range:

- minimum: 1 minute;
- maximum: 30 days.

The cooldown is calculated from the most recent terminal row's `updated_at`.

After the cooldown expires, the repository may enter the normal workflow again.

## Why repository identity

RepoScout has no general public account system and does not need one for this control.

The abuse key is:

~~~text
lowercase owner/repository
~~~

This avoids:

- storing a new submitter identity;
- fingerprinting browsers;
- penalizing every repository owned by one GitHub organization;
- requiring login before community contribution.

The existing Phase 5E.1 IP limiter still handles high-frequency request abuse.

## Public privacy boundary

The public API intentionally does not reveal the previous terminal outcome.

A caller receives:

~~~http
HTTP/1.1 409 Conflict
Retry-After: <seconds>
~~~

~~~json
{
  "error": "submission_resubmission_cooldown",
  "message": "This repository was recently processed. Please wait before submitting it again.",
  "retryAfterSeconds": 86400
}
~~~

The same response shape is used regardless of whether the prior submission was invalid, duplicate, rejected, approved, or another terminal state.

The public web UI presents this as **Recently processed** and does not offer an immediate retry button.

## Persistence boundary

Submission creation checks pending and recent-terminal state in one transaction.

The existing partial unique index still guarantees at most one PENDING row per normalized repository.

A new partial lookup index supports terminal cooldown checks:

~~~text
repository_submissions_terminal_full_name_updated_idx
(normalized_full_name, updated_at, id)
WHERE status <> 'PENDING'
~~~

The migration is reversible.

## Retry after a terminal result

The cooldown is not a permanent ban.

This is deliberate because repository state can change:

- a private repository can become public;
- a placeholder can gain real project content;
- a maintainer can correct misleading or incomplete material;
- a previously rejected repository may materially improve.

Once the configured delay expires, intake may create a new PENDING submission and the normal validation/evidence/moderation workflow starts again.

Trusted reviewers still make final listing decisions.

## Explicit non-goals

Phase 5E.2 does not add:

- user accounts or OAuth requirements;
- CAPTCHA;
- browser/device fingerprinting;
- submitter-authored free-form metadata;
- automatic spam scoring;
- Jev/model approval or rejection;
- organization-wide submission penalties;
- permanent repository blacklists.

Those controls would require separate evidence that the added complexity/privacy cost is justified.

## Verification

Coverage includes:

- configured/default cooldown values;
- generic stable HTTP cooldown contract;
- retry timing;
- immediate terminal resubmission rejection;
- resubmission after cooldown expiry;
- rejection → cooldown → later resubmission behavior;
- pending duplicate behavior;
- public web-client cooldown parsing;
- schema index existence;
- latest-migration rollback preserving the earlier moderation schema;
- migration reapply.

GitHub Actions CI run 142 passed on code head `a5d5cd7d1e7b85f854baf43d58497b2f8f93b023` before documentation-only commits.

## Status

Complete.

## Next checkpoint

Phase 5E.3 — operational cleanup / retention.

Define retention around terminal submissions, prepared evidence, and moderation audit records before implementing deletion or cleanup behavior.
