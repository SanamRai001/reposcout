# Phase 8A — Contribution Discovery Signal Contract

## Goal

Define the deterministic evidence vocabulary for contribution discovery before collecting GitHub issues or creating any contributor-suitability score.

The contract answers:

> What measured facts may RepoScout show or later use when helping someone find an open-source contribution opportunity?

It deliberately does not answer:

> Is this issue beginner friendly?

## Contract version

~~~text
contribution-signals-v1
~~~

## Signal roles

Phase 8A separates evidence into:

~~~text
entry_hint
process
availability
activity
discussion
~~~

This separation is important because no single signal is enough to describe a healthy contribution opportunity.

## Entry hints

Current label-derived hints:

~~~text
entry.good_first_issue_label
entry.help_wanted_label
~~~

Label normalization is deterministic:

~~~text
Good First Issue
good-first-issue
good_first_issue
~~~

all normalize to:

~~~text
good first issue
~~~

Likewise common hyphen/underscore/spacing variants of `help wanted` normalize consistently.

### What these signals mean

They mean:

> GitHub issue metadata currently contains a recognizable maintainer/community label.

They do **not** prove:

- the issue is easy;
- the issue has enough context;
- the issue is unclaimed;
- maintainers are responsive;
- a first-time contributor will be successful;
- the contribution will be accepted.

## Repository process evidence

RepoScout reuses the existing repository contribution evidence:

~~~text
process.contributing_present
process.code_of_conduct_present
process.issue_template_present
process.pull_request_template_present
~~~

The existing missing-data contract remains important.

### Observed absence

~~~text
availability = available
value = false
~~~

means RepoScout successfully observed the repository evidence and the file/link was absent.

### Not collected

~~~text
availability = missing
reason = not_collected
~~~

means RepoScout does not yet have that evidence.

### Unsupported fork

~~~text
availability = missing
reason = not_applicable
~~~

preserves the existing unsupported-fork evidence boundary.

These states must not be collapsed.

## Issue availability

Measured/derived availability facts:

~~~text
availability.open
availability.unassigned
availability.unlocked
~~~

These are factual context only.

Examples:

- unassigned does not guarantee nobody is already discussing/working on the issue;
- open does not prove maintainers still want the change;
- unlocked does not prove the discussion is welcoming.

## Activity context

~~~text
activity.issue_age_days
activity.days_since_update
~~~

Both are derived from an explicit `evaluatedAt`.

This makes time-derived evidence deterministic and testable.

A very old issue or long-silent issue may later be useful filter/recommendation context, but Phase 8A does not attach a good/bad direction.

## Discussion context

~~~text
discussion.comment_count
~~~

Comment count is measured context.

High discussion volume could mean:

- healthy collaboration;
- unresolved complexity;
- disagreement;
- support activity.

Phase 8A therefore does not treat more or fewer comments as inherently better.

## Issue identity/context

The signal snapshot retains:

- repository ID;
- GitHub issue ID;
- issue number;
- issue title;
- evaluation time;
- normalized labels.

It does not store or analyze issue-body text in this phase.

## Validation

The builder rejects invalid observations such as:

- empty repository/issue identity;
- non-positive issue numbers;
- negative assignee/comment counts;
- invalid dates;
- updated time before created time;
- evaluation time before issue creation;
- empty labels.

Normalized duplicate labels are deduplicated and sorted deterministically.

## No score

The Phase 8A snapshot intentionally contains no:

~~~text
score
beginnerFriendly
recommendationRank
~~~

This is a product boundary, not a missing implementation detail.

The current evidence does not measure:

- issue complexity;
- quality of CONTRIBUTING guidance;
- maintainer response latency;
- PR merge outcomes;
- external contributor success;
- required domain expertise.

A public suitability score before those semantics exist would overclaim what RepoScout knows.

## Verification

Phase 8A tests verify:

- contract version and unique signal identifiers;
- good-first/help-wanted label normalization;
- label hints remain hints with no score;
- observed absence vs missing process evidence;
- unsupported-fork `not_applicable`;
- open/unassigned/unlocked facts;
- comment-count context;
- deterministic issue age/update recency;
- normalized-label deduplication;
- invalid temporal observation rejection;
- empty-label rejection.

Initial code head `44742ad871015f00e3d890cc3e85a232989506cb` failed CI #256 because a test fixture inferred two evidence fields as always non-null.

Corrected code head `cb624fa359ea147bffc3d0ae7fd128974b2065b5` passed CI #257 completely.

## Phase 8 delivery

~~~text
8A  contribution signal contract
8B  GitHub issue ingestion + persistence
8C  public contribution discovery + filters
8D  evidence-based recommendation/explanation + evaluation
~~~

## Next phase

Phase 8B — GitHub issue ingestion + persistence.

Phase 9 semantic discovery remains out of scope.
