# Phase 8C — Public Contribution Discovery

## Goal

Expose the measured Phase 8B GitHub issue observations through a public, deterministic contribution-discovery API without introducing a beginner-friendly score or recommendation ranking.

Phase 8C answers:

> Which currently observed open issues match factual contribution-discovery filters?

It deliberately does **not** answer:

> Which issue is best for a beginner?

## Public endpoint

~~~http
GET /api/contributions/issues
~~~

The endpoint is read-only and public.

Its hard boundaries are:

~~~text
listed repository
AND
open stored issue
~~~

Closed issues and unlisted moderation candidates are never returned.

## Filters

All filters are optional and deterministic.

### Availability

~~~text
unassigned=true|false
unlocked=true|false
~~~

These are derived directly from measured issue state.

`unassigned=true` means the stored assignee count is zero.

It does not prove nobody is already discussing or working on the issue.

`unlocked=true` means the stored issue discussion is not locked.

It does not claim that the discussion is welcoming or active.

### Entry-hint labels

~~~text
goodFirstIssue=true|false
helpWanted=true|false
~~~

Label matching uses the Phase 8A normalization semantics.

For example:

~~~text
Good First Issue
good-first-issue
good_first_issue
~~~

all match the normalized hint:

~~~text
good first issue
~~~

These remain maintainer/community hints, not suitability judgments.

### Repository language

~~~text
language=typescript
~~~

The filter matches the repository's measured primary language case-insensitively.

Repositories without measured primary-language metadata cannot satisfy a language filter.

### Recently updated

~~~text
updatedWithinDays=30
~~~

Allowed range:

~~~text
1..3650
~~~

The threshold is derived from the request's explicit discovery evaluation time.

That evaluation time is preserved in pagination cursors so later pages do not drift as wall-clock time advances.

### CONTRIBUTING process evidence

~~~text
contributing=present
contributing=absent
contributing=missing
contributing=not_applicable
~~~

The states preserve the existing evidence contract:

- `present` — contribution evidence was observed and a CONTRIBUTING link exists;
- `absent` — contribution evidence was observed and CONTRIBUTING was absent;
- `missing` — RepoScout has not collected repository contribution evidence;
- `not_applicable` — the existing unsupported-fork evidence state applies.

Observed absence is not collapsed into missing data.

## Response evidence

Each item exposes:

- repository ID;
- repository full name;
- repository GitHub URL;
- measured primary language;
- GitHub issue ID;
- issue number;
- title;
- GitHub issue URL;
- open state;
- locked state;
- assignee count;
- comment count;
- raw labels;
- GitHub creation/update timestamps;
- RepoScout observation timestamp;
- normalized labels;
- Phase 8A signal observations.

The signal contract remains:

~~~text
contribution-signals-v1
~~~

The public response contains no:

~~~text
score
beginnerFriendly
recommendationRank
~~~

## Stable pagination

Default page size:

~~~text
20
~~~

Maximum page size:

~~~text
50
~~~

Ordering is deterministic:

~~~text
updated_at_github DESC
issue UUID ASC
~~~

The opaque cursor is bound to:

- the last issue's GitHub update timestamp;
- the last issue's RepoScout UUID;
- the normalized filter scope;
- the original `evaluatedAt`.

Changing filter scope while reusing a cursor is rejected.

This is especially important for `updatedWithinDays`, because all pages in one traversal use the same temporal reference point.

## Persistence/query boundary

Phase 8C does not duplicate issue data into a recommendation table.

Discovery reads from:

~~~text
repository_contribution_issues
        ↓
repositories
        ↓
repository_metadata
        ↓
repository_contribution_evidence
~~~

The repository join enforces:

~~~text
repositories.is_listed = true
~~~

The issue predicate enforces:

~~~text
repository_contribution_issues.state = 'open'
~~~

A global discovery index supports the primary open/recent traversal:

~~~text
(state, updated_at_github DESC, id)
~~~

## Verification

Coverage verifies:

- public route response shape;
- normalized deterministic filters;
- open-only discovery;
- listed-repository boundary;
- unassigned and unlocked filters;
- good-first-issue and help-wanted label hints;
- repository language filtering;
- recently-updated filtering;
- CONTRIBUTING process-evidence states;
- observed CONTRIBUTING absence vs evidence not collected;
- deterministic pagination;
- cursor/filter-scope binding;
- fixed evaluation time across pages;
- no beginner-friendly score;
- migration apply/rollback/reapply;
- discovery index presence/removal.

Implementation head:

~~~text
2997a65837a9f51009f7ac604e5eac1476254596
~~~

passed GitHub Actions CI #276, including the dedicated contribution-discovery integration gate and all existing regression gates.

## What Phase 8C does not do

No:

- beginner-friendly score;
- issue recommendation ranking;
- issue-body analysis;
- difficulty inference;
- contributor identity analysis;
- maintainer response-latency analysis;
- linked PR outcome analysis;
- Jev/model inference for contribution suitability;
- Phase 9 semantic discovery.

## Next phase

Phase 8D — evidence-based recommendation/explanation + evaluation.

8D should first define and evaluate what the available evidence can support before exposing any suitability or recommendation judgment.
