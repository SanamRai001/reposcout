# Phase 7B — Hidden Gems v1

## Goal

Implement the first deterministic Hidden Gems scorer over the Phase 7A ranking-signal contract.

The scorer should reward concrete repository health/readiness evidence while treating popularity as a saturation factor rather than a quality signal.

## Formula version

~~~text
hidden-gem-v1
~~~

Required signal contract:

~~~text
ranking-signals-v1
~~~

## Core principle

Low visibility is not quality.

RepoScout therefore does **not** calculate:

~~~text
lower stars = more Hidden Gem points
~~~

Instead:

~~~text
maintenance/documentation/community evidence
        + small optional momentum bonus
        - bounded popularity saturation
        = hidden-gem-v1
~~~

A repository with almost no stars but no README, no contribution guidance, stale maintenance, and no community-readiness evidence receives no positive quality points simply because it is obscure.

## Required evidence

The scorer requires observed values for:

- current stars;
- days since push;
- README state;
- CONTRIBUTING state;
- code-of-conduct state;
- issue-template state;
- pull-request-template state;
- security-policy state.

Missing values retain their Phase 7A reason and produce:

~~~text
status = ineligible
~~~

rather than becoming zero.

### Unsupported forks

Phase 3D contribution evidence currently marks some forks `UNSUPPORTED_FORK`.

Those community signals are `not_applicable`.

Because Hidden Gems v1 requires that evidence scope, such a repository is currently ineligible.

This is a collection/evidence limitation, not a statement that fork repositories are lower quality.

## Positive components

### Maintenance — maximum 35

Input:

~~~text
maintenance.days_since_push
~~~

Linear freshness curve:

~~~text
points = 35 * clamp(1 - days_since_push / 365, 0, 1)
~~~

Examples:

~~~text
0 days   -> 35
~183     -> ~17.5
365+     -> 0
~~~

There is no hard stale-project exclusion in v1.

### README — maximum 20

~~~text
README present -> 20
README absent  -> 0
~~~

Missing README observation is ineligible rather than treated as absent.

### CONTRIBUTING — maximum 20

~~~text
CONTRIBUTING present -> 20
absent               -> 0
~~~

Again, missing evidence is different from observed absence.

### Community readiness — maximum 20

Five points each for observed presence of:

- code of conduct;
- issue template;
- pull request template;
- security policy.

### Optional momentum — maximum 5

30-day star/fork growth can provide a small bonus:

~~~text
stars delta -> max 3.5
forks delta -> max 1.5
~~~

Positive growth uses a bounded logarithmic curve.

The v1 saturation targets are:

~~~text
+50 stars / 30 days
+10 forks / 30 days
~~~

Larger growth does not increase the component beyond 5 total points.

Negative growth produces zero bonus and no penalty.

Insufficient history also produces zero bonus, but the result records exactly which optional signals were unavailable.

This keeps Hidden Gems usable before every repository has 30+ days of history.

## Popularity saturation

Popularity produces no positive points.

Penalty policy:

~~~text
0..250 stars:
    0 penalty

251..49,999:
    logarithmic penalty from 0 toward 25

50,000+:
    25 penalty
~~~

The formula is bounded and monotonic.

This means a very popular repository can still have strong maintenance/community evidence, but its Hidden Gem score is reduced because it is not hidden.

## Final score

Positive subtotal:

~~~text
maintenance          max 35
README               max 20
CONTRIBUTING         max 20
community readiness  max 20
momentum bonus       max  5
---------------------------
positive subtotal    max 100
~~~

Then:

~~~text
score = clamp(
  positive subtotal - popularity penalty,
  0,
  100
)
~~~

## Explainability

The scorer returns structured component data rather than just a number.

Eligible output includes:

- formula version;
- signal contract version;
- repository ID;
- evaluation timestamp;
- final score;
- positive subtotal;
- component points and maxima;
- popularity penalty details;
- optional momentum coverage.

Ineligible output includes the exact missing signal IDs and Phase 7A missing reasons.

Phase 7D will later translate this structured result into public ranking explanations.

## Determinism

For an identical ranking-signal snapshot:

~~~text
hidden-gem-v1(snapshot)
~~~

always produces the same output.

The scorer does not depend on:

- current wall-clock time beyond the already-fixed `evaluatedAt` in the signal snapshot;
- GitHub;
- PostgreSQL;
- Jev;
- another model provider.

## Verification

Phase 7B coverage verifies:

- versioned score output;
- component bounds;
- low stars do not create positive quality points;
- popularity penalty is monotonic and capped;
- missing required evidence returns ineligible;
- unsupported-fork evidence remains not applicable/ineligible;
- missing 30-day history remains eligible and explicitly reported;
- positive momentum is capped at 5;
- negative momentum is not penalized;
- stale maintenance decays to zero;
- same input produces identical output.

Code head `c44ff0b65910945b61ff7242979a3580b491d871` passed GitHub Actions CI #214.

## What Phase 7B does not do

No:

- Rising scoring;
- public ranking endpoint;
- database candidate ordering;
- ranking cursor/pagination;
- persisted score table;
- Jev/model reranking;
- benchmark/tuning claims.

## Next phase

Phase 7C — Rising v1 deterministic scoring.
