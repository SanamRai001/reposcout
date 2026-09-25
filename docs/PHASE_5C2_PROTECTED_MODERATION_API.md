# Phase 5C.2 — Reviewer Authorization + Protected Moderation API

## Goal

Expose the existing Phase 5C.1 moderation/publication transaction through a protected backend API without introducing a full user-account system.

Phase 5C.2 adds:
- trusted reviewer identity;
- Bearer-token authorization;
- protected pending moderation queue;
- protected final approve/reject decision API;
- stable moderation HTTP errors;
- authenticated reviewer attribution in the append-only moderation event.

The existing Phase 5C.1 transaction remains the only publication boundary.

## Reviewer configuration

Trusted reviewers are configured server-side through:

~~~text
MODERATION_REVIEWERS_JSON
~~~

Format:

~~~json
{
  "maintainer:your-handle": "long-random-bearer-secret"
}
~~~

Rules:
- configuration is optional at application startup;
- no configured reviewer means moderation routes remain mounted but no caller can authenticate;
- maximum 20 configured reviewers;
- reviewer references are 1-200 characters;
- tokens are 32-512 non-whitespace characters;
- secrets are never returned by APIs or logged by moderation code.

The authenticator hashes configured tokens in memory using SHA-256 and compares candidate hashes with constant-time equality.

This is intentionally an initial maintainer/trusted-reviewer boundary, not a general user authentication system.

## HTTP API

Base path:

~~~text
/api/moderation
~~~

### Pending queue

~~~http
GET /api/moderation/submissions?limit=20
Authorization: Bearer <reviewer-token>
~~~

Default limit:

~~~text
20
~~~

Maximum limit:

~~~text
50
~~~

The queue reuses the existing Phase 5C.1 bounded oldest-first moderation-candidate selection.

Response includes:
- submission ID;
- current status;
- VALID validation outcome;
- resolved GitHub repository identity;
- handoff repository ID;
- validation timestamp;
- evidence-handoff timestamp;
- submission timestamps;
- authenticated reviewer reference.

It does not expose README bodies, secrets, or internal provider credentials.

### Final decision

~~~http
POST /api/moderation/submissions/{submissionId}/decision
Authorization: Bearer <reviewer-token>
Content-Type: application/json
~~~

Body:

~~~json
{
  "decision": "APPROVED",
  "reason": "Useful public repository with sufficient evidence."
}
~~~

or:

~~~json
{
  "decision": "REJECTED",
  "reason": "Placeholder repository without enough useful project content."
}
~~~

The body may contain **only**:
- `decision`;
- `reason`.

The client cannot provide `reviewerRef`.

The reviewer reference is derived exclusively from the authenticated Bearer credential and passed into the existing moderation service.

## Publication boundary

The protected route does not publish repositories directly.

It calls:

~~~text
RepositorySubmissionModerationService
        |
RepositorySubmissionStore.moderate()
        |
existing Phase 5C.1 PostgreSQL transaction
~~~

For APPROVED:
1. lock submission;
2. verify PENDING + VALID + evidence handoff complete;
3. list/publish handoff repository;
4. set submission APPROVED;
5. append moderation event;
6. commit atomically.

For REJECTED:
1. lock submission;
2. verify eligibility;
3. keep repository unlisted;
4. set submission REJECTED;
5. append moderation event;
6. commit atomically.

The HTTP layer cannot bypass or partially reproduce this transaction.

## Stable HTTP errors

### Authentication

~~~text
401 moderation_unauthorized
~~~

Returned for:
- missing Authorization header;
- malformed Bearer header;
- unknown token.

The response includes:

~~~text
WWW-Authenticate: Bearer
~~~

### Invalid request

~~~text
400 invalid_submission_id
400 invalid_moderation_request
~~~

Examples:
- malformed UUID;
- invalid decision;
- blank/oversized reason;
- invalid queue limit;
- extra body fields such as client-supplied `reviewerRef`.

### Submission state

~~~text
404 moderation_submission_not_found
409 moderation_submission_not_eligible
409 moderation_submission_already_decided
~~~

The already-decided response includes the existing final decision.

## Security properties

Phase 5C.2 ensures:
- public users cannot read the moderation queue;
- public users cannot approve/reject;
- reviewer identity cannot be spoofed through request JSON;
- bearer secrets are not persisted in PostgreSQL;
- bearer secrets are not written into moderation events;
- only stable reviewer references enter the audit log;
- route authorization and domain moderation remain separate responsibilities;
- approval still requires the existing atomic publication transaction.

## No schema migration

Phase 5C.2 adds no database table or column.

Existing Phase 5C.1 tables already contain:
- repository listing state;
- submission terminal status;
- append-only moderation events;
- reviewer reference;
- decision reason.

## Verification

Tests cover:
- reviewer environment parsing;
- missing configuration defaults;
- malformed reviewer configuration;
- bearer-token authentication;
- unknown/malformed credentials;
- protected queue authorization;
- queue limit behavior;
- authenticated reviewer injection;
- client reviewer spoofing rejection;
- stable moderation HTTP error mapping;
- PostgreSQL-backed protected approval;
- public invisibility before approval;
- publication after approval;
- append-only audit reviewer attribution;
- existing submission/moderation regression suite.

## Explicitly deferred

Phase 5C.2 does not add:
- reviewer web UI;
- general user accounts;
- OAuth/session authentication;
- role-management UI;
- reviewer invitation workflow;
- token rotation API;
- abuse/rate limiting;
- CSRF/session behavior;
- public moderation history;
- model-assisted moderation.

Those require separate product/security decisions.

## Next checkpoint

Phase 5D can now build the public submission web UI without exposing moderation capabilities.

Phase 5E remains responsible for launch hardening such as:
- public submission rate limits;
- spam/abuse controls;
- moderation operational safeguards;
- observability;
- security review.
