# Phase 7A — Ranking Signal Contract

## Goal

Define the deterministic evidence vocabulary for RepoScout ranking before implementing any scoring formula.

Phase 7A answers:

> What factual or deterministic signals may Hidden Gems and Rising use, and how is missing/provenance represented?

It deliberately does **not** answer:

> What weight should each signal receive?

## Contract versions

Base signal schema:

~~~text
ranking-signals-v1
~~~

Mode role maps:

~~~text
hidden-gems-signals-v1
rising-signals-v1
~~~

Scoring versions will be separate in later phases.

## Why separate the signal contract from scoring?

Without a stable signal boundary, a formula change could silently redefine what a field means.

RepoScout instead separates:

~~~text
measured facts/evidence
        |
deterministic signal snapshot
        |
versioned scoring formula
        |
explanation
~~~

This makes later ranking changes auditable.

## Provenance classes

### github_current

Current measured GitHub facts.

Examples:
- total stars;
- total forks.

### github_evidence

Observed repository/community evidence.

Examples:
- README exists;
- CONTRIBUTING exists;
- issue template exists.

### reposcout_derived_current

Deterministic computation over current facts.

Example:
- whole days since `pushed_at`.

### reposcout_derived_history

Deterministic computation from Phase 6 historical snapshots.

Examples:
- 7-day star delta;
- 30-day fork delta.

Model output is not part of this contract.

## Signal roles

Signals have semantic roles:

~~~text
visibility
maintenance
documentation
community
momentum
context
~~~

A role describes what the signal means. It does not assign a positive/negative score direction.

## Signal catalog

### Visibility

~~~text
visibility.stars_total
visibility.forks_total
~~~

Stars/forks are visibility/popularity facts, not universal quality.

### Maintenance

~~~text
maintenance.days_since_push
~~~

Derived from GitHub `pushed_at` and the explicit ranking evaluation timestamp.

### Documentation

~~~text
documentation.readme_present
~~~

`PRESENT` and `TOO_LARGE` both mean the README exists.

`NOT_FOUND` means the measured value is false.

No README observation means the signal is missing, not false.

### Community evidence

~~~text
community.contributing_present
community.code_of_conduct_present
community.issue_template_present
community.pull_request_template_present
community.security_policy_present
~~~

For contribution evidence marked `UNSUPPORTED_FORK`, these are `not_applicable` rather than false.

### Momentum

~~~text
momentum.stars_delta_7d
momentum.stars_delta_30d
momentum.forks_delta_30d
~~~

These reuse the Phase 6 trend contract.

### Context

~~~text
context.open_issues_delta_30d
~~~

This is descriptive context only.

A decrease is not automatically good; an increase is not automatically bad.

## Missing-data contract

Available zero:

~~~json
{
  "availability": "available",
  "value": 0
}
~~~

is different from:

~~~json
{
  "availability": "missing",
  "reason": "not_collected"
}
~~~

Supported missing reasons:

~~~text
not_collected
unavailable
not_applicable
insufficient_history
~~~

Later scorers must define explicit minimum-evidence behavior rather than silently converting missing signals to zero.

## Historical provenance

A complete historical ranking signal preserves:

~~~text
requestedWindowDays
actualWindowDays
baselineCapturedOn
latestCapturedOn
~~~

Example:

~~~text
requested = 7 days
actual    = 8 days
~~~

The 7-day signal still records that the source comparison actually spans eight UTC days because Phase 6 selected the closest baseline on or before the cutoff.

Later scoring may normalize or reject sparse overshoot, but it may not hide it.

## Hidden Gems role map

Contract:

~~~text
hidden-gems-signals-v1
~~~

### Primary

- `visibility.stars_total`
- `maintenance.days_since_push`
- `documentation.readme_present`
- `community.contributing_present`

### Supporting

- `visibility.forks_total`
- `community.code_of_conduct_present`
- `community.issue_template_present`
- `community.pull_request_template_present`
- `community.security_policy_present`
- `momentum.stars_delta_30d`
- `momentum.forks_delta_30d`

### Context

- `momentum.stars_delta_7d`
- `context.open_issues_delta_30d`

This is a role contract, not a weight table.

## Rising role map

Contract:

~~~text
rising-signals-v1
~~~

### Primary

- `momentum.stars_delta_7d`
- `momentum.stars_delta_30d`
- `momentum.forks_delta_30d`

### Supporting

- `maintenance.days_since_push`
- `visibility.stars_total`
- `visibility.forks_total`

### Context

- `context.open_issues_delta_30d`

Raw popularity is deliberately not primary evidence for Rising.

## Tests

Phase 7A verifies:

- contract version;
- unique signal identifiers;
- every mode contract references a known signal;
- Hidden Gems/Rising primary roles remain distinct;
- measured zero remains available;
- missing metadata/evidence remains missing;
- too-large README still counts as present;
- unsupported-fork community evidence is not applicable;
- insufficient trend history does not become zero momentum;
- sparse trend actual-window provenance is retained;
- mismatched historical windows fail loudly;
- missing push timestamp becomes unavailable;
- open-issue movement remains context only;
- no score field is produced.

Initial Phase 7A CI #206 exposed strict TypeScript typing issues in the new test/helper and frozen signal arrays.

Corrected code head `d928615830989ab18acc4255723b3cc0b254ad73` passed CI #207.

## What Phase 7A does not do

No:
- Hidden Gem formula;
- Rising formula;
- weights;
- minimum star threshold;
- popularity normalization curve;
- ranking persistence;
- ranking endpoint;
- public ordering;
- Jev/model-assisted signal.

## Next phase

Phase 7B — Hidden Gems v1 deterministic scoring.
