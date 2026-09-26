# Discovery and Ranking Principles

## Important distinction

RepoScout should not claim to calculate a universal “repository quality score.”

Different users value different things. A stable mature library, a fast-growing experimental tool, and a beginner-friendly project may each be excellent for different reasons.

RepoScout should expose named discovery signals and clearly document how each ranking mode works.

## Base discovery

Phase 4A establishes deterministic lexical candidate retrieval before relevance ranking.

Current discovery foundation:
- Phase 4A matches canonical owner/name/full-name/description text with PostgreSQL `plainto_tsquery`;
- Phase 4B.1 composes exact language, license, fork, and archived filters;
- Phase 4B.2 adds all-topic containment plus inclusive star-range filters;
- Phase 4B.3 allows structured filter-only discovery when no lexical query is supplied;
- an unscoped discovery request with neither query nor filters is rejected;
- missing metadata never satisfies a metadata filter;
- matching repositories remain in stable internal UUID order;
- opaque cursors are bound to the complete normalized search scope;
- no relevance ordering is claimed yet.

Later discovery should combine:
- text relevance;
- explicit filters;
- repository eligibility;
- selected sort/ranking mode.

Text relevance and filters should come before popularity unless the user explicitly chooses popularity.

## Ranking modes

### Most Starred
Simple total stars.

Use case:
- popularity lookup.

### Recently Active
Based on recent meaningful repository activity.

Avoid treating generated commits or bot-only activity as strong evidence if that distinction can be made reliably.

### Rising
Measures recent momentum using historical snapshots.

Potential inputs:
- star growth;
- contributor/activity growth;
- recent releases;
- issue/PR activity.

Requires sufficient snapshot history. Do not fake this before data exists.

### Hidden Gems

Purpose:
surface healthy or promising repositories that have less existing visibility.

A possible normalized model:

```text
hidden_gem =
    activity_signal
  + maintenance_signal
  + community_signal
  + momentum_signal
  + documentation_signal
  - popularity_saturation
```

This is intentionally conceptual. Exact weights must be tested against real data before becoming canonical.

Rules:
- never secretly boost sponsored repos;
- do not equate low stars with quality;
- require a minimum evidence threshold;
- explain key reasons a repository appeared;
- version scoring changes.

### Contribution Friendly

Potential evidence:
- CONTRIBUTING.md;
- good-first-issue/help-wanted issues;
- external PRs merged recently;
- recent maintainer responses;
- code of conduct;
- issue templates;
- contribution documentation.

Avoid labeling a project beginner-friendly solely because it has a `good first issue` label.

## Explainability

A discovery card may show reasons such as:

```text
Why this appeared
✓ matches TypeScript + self-hosted filters
✓ active release in the last 30 days
✓ steady contributor activity
✓ below your 20k-star maximum
```

Avoid vague AI-generated claims that cannot be traced to data.

## Time windows

Metrics must state their window.

Examples:
- stars gained in 7 days;
- releases in 12 months;
- PRs merged in 30 days.

Never compare a lifetime total to a monthly rate as if they are equivalent.

## Missing data

Missing data is not automatically bad data.

Example:
- a project without GitHub Releases may publish packages another way;
- a small mature library may intentionally have few commits;
- issue counts can be disabled.

Rankers should distinguish:
- zero;
- unavailable;
- not applicable;
- not yet collected.

## Anti-gaming considerations

Potential abuse:
- fake stars;
- bot commits;
- label spam;
- repeated self-submissions;
- artificial release churn.

The MVP does not need sophisticated fraud detection, but formulas should avoid over-rewarding metrics that are trivial to manipulate.



## Phase 7A executable signal contract

Phase 7A freezes the first deterministic ranking evidence schema before any formula or weight becomes canonical.

Contract:

~~~text
ranking-signals-v1
~~~

Signal provenance classes:

~~~text
github_current
github_evidence
reposcout_derived_current
reposcout_derived_history
~~~

These remain distinct from model assessments.

### Current signal catalog

#### Visibility

- `visibility.stars_total`
- `visibility.forks_total`

These are measured lifetime/current popularity facts. They are not quality scores.

#### Maintenance

- `maintenance.days_since_push`

This is a deterministic derivative of GitHub `pushed_at` at an explicit evaluation time.

#### Documentation/community evidence

- `documentation.readme_present`
- `community.contributing_present`
- `community.code_of_conduct_present`
- `community.issue_template_present`
- `community.pull_request_template_present`
- `community.security_policy_present`

A README that exists but is too large for RepoScout's content-ingestion limit still counts as present.

Unsupported fork community evidence is `not_applicable`, not false.

#### Historical momentum/context

- `momentum.stars_delta_7d`
- `momentum.stars_delta_30d`
- `momentum.forks_delta_30d`
- `context.open_issues_delta_30d`

Historical observations preserve Phase 6 provenance:

~~~text
requestedWindowDays
actualWindowDays
baselineCapturedOn
latestCapturedOn
~~~

Open-issue delta is context only. Its direction is not interpreted as inherently positive or negative.

### Missing evidence

The signal layer distinguishes:

~~~text
available value = 0
~~~

from:

~~~text
missing / not_collected
missing / unavailable
missing / not_applicable
missing / insufficient_history
~~~

This distinction is mandatory for later ranking formulas.

### Hidden Gems signal roles

Contract:

~~~text
hidden-gems-signals-v1
~~~

Primary:
- total stars as visibility/saturation input;
- days since push;
- README presence;
- CONTRIBUTING presence.

Supporting:
- forks;
- code of conduct;
- issue/PR templates;
- security policy;
- 30-day star/fork momentum.

Context:
- 7-day star movement;
- open-issue movement.

No weight is defined in Phase 7A.

### Rising signal roles

Contract:

~~~text
rising-signals-v1
~~~

Primary:
- 7-day star delta;
- 30-day star delta;
- 30-day fork delta.

Supporting:
- days since push;
- total stars;
- total forks.

Context:
- 30-day open-issue movement.

Lifetime popularity is deliberately not primary Rising evidence.

### No score in Phase 7A

The signal snapshot has no `score` field.

Phase 7A does not:
- rank repositories;
- define minimum thresholds;
- choose weights;
- normalize popularity;
- expose a ranking endpoint;
- persist ranking results;
- invoke Jev.

Those choices begin in the mode-specific scoring phases.



## Phase 7B Hidden Gems v1 formula

Formula version:

~~~text
hidden-gem-v1
~~~

The scorer consumes only `ranking-signals-v1`.

### Eligibility

Required observed signals:

~~~text
visibility.stars_total
maintenance.days_since_push
documentation.readme_present
community.contributing_present
community.code_of_conduct_present
community.issue_template_present
community.pull_request_template_present
community.security_policy_present
~~~

If any required signal is missing, unavailable, or not applicable, the result is:

~~~text
status = ineligible
~~~

with explicit signal/reason entries.

This is an evidence-coverage rule, not a negative quality judgment.

### Positive evidence

The v1 positive subtotal is bounded at 100:

~~~text
maintenance freshness        0..35
README presence              0..20
CONTRIBUTING presence        0..20
community readiness          0..20
optional 30-day momentum     0..5
---------------------------------
positive subtotal            0..100
~~~

Community readiness awards 5 points each for observed presence of:

- code of conduct;
- issue template;
- pull request template;
- security policy.

### Maintenance

`maintenance.days_since_push` decays linearly:

~~~text
0 days old      -> 35 points
365+ days old   -> 0 points
~~~

No hard stale-project rejection is introduced in v1.

### Popularity saturation

Low stars do **not** award quality points.

Instead:

~~~text
stars <= 250
    -> penalty 0

250 < stars < 50,000
    -> logarithmically increasing penalty

stars >= 50,000
    -> penalty 25
~~~

Conceptually:

~~~text
score =
    positive evidence
  - popularity saturation
~~~

clamped to 0..100.

This lets a low-visibility repository compete only when it has actual maintenance/documentation/community evidence.

### Optional momentum

30-day momentum can add at most 5 points:

- star growth: max 3.5;
- fork growth: max 1.5.

Each uses a bounded logarithmic positive-growth curve.

Targets at which the v1 bonus saturates:

~~~text
+50 stars / 30d
+10 forks / 30d
~~~

Only positive changes produce a bonus.

Negative movement is not penalized.

Missing/insufficient history produces zero **bonus points**, but the output explicitly reports missing optional momentum coverage rather than claiming the measured delta is zero.

### Formula output

Eligible results expose:

~~~text
formulaVersion
signalContractVersion
repositoryId
evaluatedAt
score
positivePoints
components[]
popularityPenalty
optionalMomentumCoverage
~~~

Ineligible results expose:

~~~text
formulaVersion
signalContractVersion
repositoryId
evaluatedAt
reasons[]
~~~

### Important limitation

The v1 numbers are experimental policy choices.

Phase 7B verifies deterministic semantics and explainability, not that the chosen weights are optimal.

Phase 7E must evaluate/tune:

- 365-day maintenance horizon;
- 250-star no-penalty band;
- 50k saturation point;
- 35/20/20/20/5 component weights;
- momentum targets;
- behavior across ecosystems/languages.



## Phase 7C Rising v1 formula

Formula version:

~~~text
rising-v1
~~~

The scorer consumes only `ranking-signals-v1`.

### Eligibility

Required historical signals:

~~~text
momentum.stars_delta_7d
momentum.stars_delta_30d
momentum.forks_delta_30d
~~~

Any missing/insufficient primary signal makes the result ineligible.

### Sparse-history boundary

Phase 6 may return actual spans longer than the requested window.

Rising v1 accepts only bounded overshoot:

~~~text
7-day request  -> maximum actual span 9 days
30-day request -> maximum actual span 35 days
~~~

If the actual span stays within the bound:

~~~text
normalized_delta =
  measured_delta * requested_days / actual_days
~~~

This prevents an 8/9-day or 31–35-day observation from being scored as if its full raw delta occurred inside exactly 7/30 days.

Larger overshoot is ineligible.

### Score weights

~~~text
7-day star momentum     max 45
30-day star momentum    max 35
30-day fork momentum    max 15
maintenance support     max  5
------------------------------
total                   max 100
~~~

Measured historical momentum therefore controls 95% of the score.

### Momentum targets

Positive normalized momentum uses bounded logarithmic curves.

v1 saturation targets:

~~~text
+25 stars / 7d
+100 stars / 30d
+15 forks / 30d
~~~

Reaching or exceeding a target saturates that component.

Zero/negative movement receives zero points for that component.

### Maintenance

Maintenance is supporting evidence only.

~~~text
fresh push -> up to 5 points
90+ days   -> 0 points
~~~

Missing maintenance evidence does not make historically sufficient Rising evidence ineligible.

### Lifetime popularity

Current total stars/forks contribute:

~~~text
0 score points
~~~

They are returned only as visibility context.

A repository cannot rank as Rising because it is already popular.

### Output

Eligible output includes:

- formula/signal versions;
- score;
- component points/maxima;
- normalized deltas;
- exact historical provenance;
- lifetime visibility context;
- maintenance coverage.

Ineligible output exposes missing primary signals or excessive sparse-window coverage.

### Important limitation

All weights/targets/tolerances are experimental v1 policy.

Phase 7E must evaluate:
- 45/35/15/5 weights;
- +25/+100/+15 saturation targets;
- 9-day and 35-day sparse-window limits;
- behavior across small vs large ecosystems;
- anti-gaming sensitivity to star/fork bursts.

## Versioning

Each derived ranking should have an internal version:

```text
hidden-gem-v1
rising-v1
contribution-friendly-v1
```

When formulas change, results should be attributable to the ranking version.

## Model-assisted intelligence

Model systems may assist with:
- query interpretation;
- README/content classification;
- use-case/category suggestions;
- bounded candidate reranking;
- beginner-suitability assessment;
- submission triage support.

RepoScout is evaluating Jev as a possible decision layer for these tasks.

Rules:
- retrieval happens before model reranking;
- model output is probabilistic inference, not repository fact;
- measured facts come from traceable repository/API data;
- deterministic signals remain independently computable;
- model-assisted signals must be clearly distinguishable in explanations;
- model/provider unavailability must fall back to deterministic discovery;
- high-impact moderation decisions require human review;
- no universal quality score may be produced from model output.

Preferred discovery flow:

~~~text
query
  |
lexical search + filters
  |
bounded candidate set
  |
deterministic RepoScout signals
  |
optional model-assisted relevance assessment
  |
transparent reranking
~~~

Hidden Gems and Rising remain primarily driven by measured/historical data. A model may provide qualitative context, but must not replace activity, momentum, or popularity-saturation inputs.

Before any model-assisted ranking ships, evaluate it on a labeled RepoScout repository/query set and version the assessment schema/model combination.

See [JEV_INTELLIGENCE_ARCHITECTURE.md](JEV_INTELLIGENCE_ARCHITECTURE.md).
