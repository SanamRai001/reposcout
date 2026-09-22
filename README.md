# RepoScout

> **Discover open source worth knowing.**

RepoScout is an open-source repository discovery and intelligence platform designed to help developers find useful GitHub projects that ordinary keyword search, star counts, and generic AI recommendations can miss.

The long-term goal is not to build “ChatGPT for GitHub.” RepoScout aims to maintain structured, explainable repository intelligence that can power discovery, comparisons, hidden-gem detection, contributor discovery, and community curation.

## Why RepoScout?

Great open-source projects are often difficult to discover.

Popular repositories keep getting more visibility, while smaller but actively maintained projects can remain buried. GitHub search is powerful when you already know the right words to search for, but it is less useful when your question looks like:

- “Show me actively maintained TypeScript backends worth studying.”
- “Find a self-hosted alternative that can run on a small VPS.”
- “What are some promising projects that are growing quickly but are not famous yet?”
- “I know React and Node.js. Where can I make a realistic first contribution?”
- “Which repositories like this one are healthier or more actively maintained?”

RepoScout is being designed around those questions.

## Product pillars

### Discover
Find repositories through structured filters, categories, repository signals, and eventually natural-language intent.

### Understand
See useful signals such as activity, releases, contributors, issues, pull requests, maintenance, license, and contribution readiness.

### Surface hidden gems
Avoid ranking only by total stars. RepoScout will explore transparent signals for identifying healthy, useful projects before they become widely known.

### Contribute
Anyone should be able to help improve discovery. A beginner should be able to contribute simply by submitting a repository we are missing.

## Community-first repository submission

A core RepoScout workflow will be:

```text
Paste GitHub repository URL
        ↓
Automatic metadata collection
        ↓
Duplicate and eligibility checks
        ↓
Community/maintainer review
        ↓
Approved repository enters the index
```

Self-submissions will be allowed, but submissions must follow the same quality and safety rules as every other repository.

## MVP

The initial product will stay deliberately small:

1. Repository ingestion and normalization.
2. A curated repository index.
3. Repository intelligence pages based on measurable signals.
4. Discovery through search and filters.
5. Trending and Hidden Gems views.
6. Community repository submission with moderation.

AI chat, social feeds, browser extensions, large-scale GitHub crawling, and complicated gamification are **not** MVP requirements.

## Repository status

**Phase 0 — product/architecture foundation:** complete.

**Phase 1A — application foundation:** complete.

**Phase 1B.1 — persistence infrastructure:** complete.

**Phase 1B.2A — canonical repositories schema:** complete.

**Phase 1B.2B — repository persistence layer:** complete.

**Phase 2A — single-repository GitHub ingestion:** complete.

**Phase 2B — ingestion refresh operations:** complete.

The backend now uses PostgreSQL through node-postgres with explicit migration tooling, validated connection configuration, database-backed readiness checks, and PostgreSQL integration tests. Dependency installs are reproducible through the committed root lockfile.

**Phase 2 — repository ingestion:** complete.

**Phase 3A — repository catalog/read API:** complete.

**Phase 3B — repository catalog web UI:** complete.

RepoScout now has a real browser catalog backed by the Phase 3A PostgreSQL read API.

The next checkpoint is **Phase 3C: the smallest authoritative repository metadata/signals foundation**. A dedicated repository detail page is deferred until it has richer information to show.

RepoScout also plans a later **Jev evaluation spike** after authoritative metadata and repository content exist. Jev is being treated as an optional probabilistic decision/reranking layer—not a source of GitHub facts, not the primary search engine, and not a required dependency for RepoScout to function.

See the `docs/` directory for the product specification, MVP boundaries, architecture, data model, brand guidance, persistence foundation, ranking principles, roadmap, and decisions.

## Contributing

RepoScout is intended to be welcoming to first-time open-source contributors.

You will eventually be able to contribute by:

- submitting a useful repository;
- improving repository metadata;
- fixing categories or tags;
- reporting stale or incorrect information;
- improving documentation;
- working on frontend/backend features;
- improving ranking and repository-analysis logic;
- adding tests.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Guiding principles

- **Useful over popular** — stars are a signal, not the truth.
- **Explainable over magical** — important ranking signals should be understandable.
- **Measured over guessed** — distinguish factual repository metrics from inferred labels.
- **Community-curated, not community-spammed** — submissions require validation and moderation.
- **Beginner-friendly contribution** — useful contribution should not require expert coding.
- **Small first, scalable later** — do not attempt to index all of GitHub in the MVP.
- **No pay-to-rank** — repository visibility should not be secretly purchased.

## License

A license will be selected before the first public implementation release.

---

RepoScout is just getting started. If this idea interests you, star the repository and follow the project as the first version takes shape.
