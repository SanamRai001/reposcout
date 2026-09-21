# Discovery and Ranking Principles

## Important distinction

RepoScout should not claim to calculate a universal “repository quality score.”

Different users value different things. A stable mature library, a fast-growing experimental tool, and a beginner-friendly project may each be excellent for different reasons.

RepoScout should expose named discovery signals and clearly document how each ranking mode works.

## Base discovery

Search should combine:
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

## Versioning

Each derived ranking should have an internal version:

```text
hidden-gem-v1
rising-v1
contribution-friendly-v1
```

When formulas change, results should be attributable to the ranking version.

## AI usage

AI can assist with:
- query interpretation;
- README summarization;
- use-case/category suggestions;
- semantic retrieval.

AI should not fabricate repository health facts.

Measured facts should come from traceable repository/API data.
