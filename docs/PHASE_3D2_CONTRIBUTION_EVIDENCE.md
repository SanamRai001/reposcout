# Phase 3D.2 — Contribution-Document Evidence

## Goal

Add the smallest trustworthy contribution-readiness evidence layer needed before Jev evaluation and later contribution discovery.

Phase 3D.2 detects:
- CONTRIBUTING guidance;
- Code of Conduct;
- issue templates;
- pull request templates;
- repository-local SECURITY policy.

It does **not** download arbitrary repository trees or store the bodies of these files.

## Why use GitHub's community profile

GitHub already resolves supported community health files for public repositories through its community profile metrics endpoint.

RepoScout therefore uses:

~~~text
GET /repos/{owner}/{repo}/community/profile
~~~

for:
- CONTRIBUTING;
- Code of Conduct file;
- issue template;
- pull request template.

This is preferable to guessing filenames and recursively scanning repository contents.

## Effective community evidence

Community-profile evidence is treated as **GitHub effective community evidence**.

That distinction matters because GitHub may apply supported account-level default community health files when a repository does not define its own.

RepoScout stores the API URL and GitHub HTML URL returned by GitHub as provenance.

It does not claim those linked files are necessarily local to the repository.

## Fork behavior

GitHub documents the community-profile endpoint as unavailable for forks.

RepoScout therefore does not call it for repositories already known to be forks.

Instead it stores:

~~~text
status = UNSUPPORTED_FORK
~~~

This is different from:

~~~text
status = OBSERVED
all evidence = null
~~~

The first means RepoScout deliberately did not make the unsupported community-profile request.

The second means GitHub successfully returned a profile observation with no detected supported files.

## Security policy evidence

The community-profile response does not provide SECURITY.md evidence.

RepoScout therefore probes only GitHub's supported repository-local security policy locations, in precedence order:

~~~text
.github/SECURITY.md
SECURITY.md
docs/SECURITY.md
~~~

The first existing file wins.

This is a bounded maximum of three fixed GitHub Contents API requests.

There is no directory listing and no recursive tree crawl.

## Security provenance

For a detected repository-local security policy, RepoScout stores:

~~~text
source default branch/ref
path
Git blob SHA
byte size
~~~

RepoScout does not store the security policy body in Phase 3D.2.

Account-level inherited default SECURITY files are not represented as repository-local security evidence.

## Storage

Phase 3D.2 adds:

~~~text
repository_contribution_evidence
~~~

One row exists per canonical repository.

Fields include:

~~~text
repository_id
status

contributing_api_url
contributing_html_url

code_of_conduct_api_url
code_of_conduct_html_url

issue_template_api_url
issue_template_html_url

pull_request_template_api_url
pull_request_template_html_url

security_source_ref
security_path
security_sha
security_size_bytes

community_profile_updated_at
observed_at
created_at
updated_at
~~~

Presence is represented by non-null provenance fields.

RepoScout does not duplicate these as independent boolean database columns.

## Status

~~~text
OBSERVED
UNSUPPORTED_FORK
~~~

### OBSERVED

GitHub community-profile evidence was successfully fetched.

Any individual evidence type may still be absent.

### UNSUPPORTED_FORK

The repository is a fork and RepoScout intentionally skipped GitHub's unsupported community-profile endpoint.

No contribution-file evidence may be stored with this status.

## Validation

RepoScout validates community-profile links before persistence:

- API URLs must use HTTPS and `api.github.com`;
- HTML URLs must use HTTPS and `github.com`;
- evidence URL pairs must be complete;
- security source ref/path/SHA must be non-empty;
- security byte size must be a nonnegative safe integer.

The database also enforces:
- valid status values;
- complete URL pairs;
- all-or-nothing security provenance;
- empty evidence for `UNSUPPORTED_FORK`;
- nonnegative security file size.

## Refresh lifecycle

Contribution evidence is refreshed independently from:
- canonical repository ingestion;
- measured metadata;
- README content refresh.

Current flow:

~~~text
maintainer/internal trigger
        |
RepositoryContributionEvidenceService
        |
        +-- GitHub community profile
        |
        +-- bounded SECURITY.md probes
        |
RepositoryContributionEvidenceStore
        |
PostgreSQL
~~~

A failure in this evidence workflow does not erase existing evidence and does not block canonical repository refresh.

## Stale-write protection

Rows are ordered by `observed_at`.

An older evidence observation cannot replace a newer one.

This prevents delayed API responses or retried jobs from rolling contribution evidence backward.

## Maintainer command

For an already indexed repository:

~~~text
npm run refresh:contribution-evidence -w @reposcout/api -- owner/repository
~~~

The command prints only evidence presence/provenance.

It does not download or print contribution-document bodies.

## Public exposure

Phase 3D.2 does not add contribution evidence to:
- catalog list API;
- catalog detail API;
- repository cards;
- public ranking.

The data remains internal evidence until its usefulness and semantics are reviewed.

## Explicitly deferred

Phase 3D.2 does not add:

- contribution-document bodies;
- SUPPORT.md;
- arbitrary file search;
- repository tree crawling;
- issue-label counts;
- good-first-issue counts;
- maintainer response metrics;
- external-PR merge history;
- contribution readiness score;
- repository detail UI;
- Jev/model assessment.

## Verification

Tests cover:

- community-profile normalization;
- trusted provenance URL validation;
- fixed security-path precedence;
- no recursive security lookup;
- fork endpoint avoidance;
- service evidence mapping;
- PostgreSQL persistence;
- stale observation protection;
- unsupported-fork storage rules;
- schema constraints;
- latest migration rollback preserving earlier repository/content tables.

## Next checkpoint

With Phase 3D.1 README evidence and Phase 3D.2 contribution-document evidence complete, the next planned phase is **Phase 3E — Jev evaluation spike**.

Phase 3E should evaluate model usefulness before any production model-assessment table or ranking dependency is introduced.
