# Phase 8D — Contribution Recommendation, Explanation, and Evaluation

## Goal

Add a conservative recommendation layer on top of the measured Phase 8A/8C contribution evidence without pretending RepoScout can determine that an issue is objectively beginner friendly.

Phase 8D answers:

> Which observed contribution opportunities have enough currently measured evidence to be worth considering, and why?

It deliberately does **not** answer:

> Is this issue easy, guaranteed to be welcoming, or likely to be accepted?

## Contract version

~~~text
contribution-recommendation-v1
~~~

The recommendation consumes:

~~~text
contribution-signals-v1
~~~

It does not collect new GitHub data.

## Recommendation states

Phase 8D intentionally has only two states:

~~~text
consider
needs_review
~~~

There is no numeric score and no contribution ranking.

### `consider`

An issue receives `consider` only when all of the following measured conditions are true:

- issue is open;
- issue has no GitHub assignees;
- issue discussion is unlocked;
- issue was updated within the last 90 days;
- at least one supported entry hint is present:
  - `good first issue`, or
  - `help wanted`.

The 90-day boundary is inclusive.

`consider` means:

> This observed issue matches RepoScout's conservative discovery criteria and is worth manual inspection.

It does **not** mean:

- beginner friendly;
- easy;
- guaranteed unclaimed;
- maintainers are responsive;
- contribution will be accepted.

### `needs_review`

Any missing core discovery condition results in `needs_review`.

Examples include:

- assigned issue;
- locked discussion;
- no supported entry hint;
- update older than the 90-day horizon;
- closed issue if the helper is evaluated outside the public open-only discovery boundary.

The public Phase 8C discovery endpoint already excludes stored closed issues.

## CONTRIBUTING evidence

Repository CONTRIBUTING evidence remains supporting context, not a veto.

The recommendation explanation preserves:

- `contributing_guidance_present`;
- `contributing_guidance_absent`;
- `contributing_evidence_missing`;
- `contributing_not_applicable`.

This preserves the existing distinction between:

- observed absence;
- evidence not collected;
- unsupported-fork not-applicable state.

A repository without observed CONTRIBUTING guidance can still receive `consider` when the issue-level discovery evidence is otherwise strong.

## Explanation contract

Recommendations expose evidence codes such as:

~~~text
issue_open
issue_unassigned
discussion_unlocked
good_first_issue_hint
help_wanted_hint
recently_updated
contributing_guidance_present
~~~

They also expose caution codes such as:

~~~text
issue_closed
issue_assigned
discussion_locked
no_entry_hint
stale_update
contributing_guidance_absent
contributing_evidence_missing
contributing_not_applicable
~~~

Each explanation includes the exact underlying Phase 8A signal IDs.

## Explicit limitations

Every recommendation carries the same currently unmeasured limitations:

~~~text
issue_complexity_not_measured
maintainer_responsiveness_not_measured
linked_pr_outcomes_not_measured
external_contributor_success_not_measured
required_domain_expertise_not_measured
~~~

These are product boundaries, not hidden implementation gaps.

## Public API

The existing endpoint remains:

~~~http
GET /api/contributions/issues
~~~

Each result still exposes its measured evidence and now also exposes:

~~~json
{
  "recommendation": {
    "contractVersion": "contribution-recommendation-v1",
    "status": "consider",
    "evidence": [],
    "cautions": [],
    "limitations": []
  }
}
~~~

Phase 8D does not change the Phase 8C ordering.

Results remain ordered by:

~~~text
updated_at_github DESC
issue UUID ASC
~~~

There is no recommendation score or recommendation rank.

## Benchmark

Benchmark version:

~~~text
contribution-recommendation-benchmark-v1
~~~

The frozen synthetic benchmark contains:

~~~text
10 cases
10 gating expectations
2 non-gating risk probes
~~~

It covers:

- good-first-issue entry hint;
- help-wanted entry hint;
- missing entry hint;
- assigned issue;
- locked discussion;
- inclusive 90-day freshness boundary;
- stale issue;
- missing CONTRIBUTING evidence;
- observed CONTRIBUTING absence;
- closed issue defense.

The benchmark also explicitly probes the two largest interpretation risks:

1. entry labels are not difficulty ground truth;
2. update freshness is not maintainer responsiveness or contribution success.

## Commands

Run the CI-style benchmark:

~~~bash
npm run test:contribution-recommendation -w @reposcout/api
~~~

Print the benchmark report:

~~~bash
npm run eval:contribution-recommendation -w @reposcout/api
~~~

The CLI exits nonzero when any gating expectation fails.

## CI integration

CI includes:

~~~text
Verify contribution recommendation benchmark
~~~

alongside the existing application, Jev, ranking, migration, persistence, contribution-discovery, search, catalog, and submission gates.

Implementation-complete head:

~~~text
abd3dcaa81ee81138597c9d19c098667e27dd28d
~~~

passed CI #281 completely.

## What Phase 8D does not do

No:

- beginner-friendly truth label;
- numeric suitability score;
- recommendation rank;
- new recommendation ordering;
- issue-body complexity analysis;
- maintainer response-latency measurement;
- linked PR outcome measurement;
- contributor identity/success analysis;
- Jev/model inference for contribution suitability;
- Phase 9 semantic discovery.

## Phase 8 completion

Phase 8 now contains:

~~~text
8A  contribution signal contract
8B  GitHub issue ingestion + persistence
8C  public contribution discovery + filters
8D  recommendation/explanation + evaluation
~~~

Phase 8 is complete once PR #52 is merged and the post-merge `main` CI is green.

## Next phase

Phase 9 — semantic discovery.

Do not start Phase 9 as part of Phase 8D.
