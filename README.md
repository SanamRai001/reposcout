# RepoScout

> **Discover GitHub repositories worth exploring, studying, self-hosting, and contributing to.**

RepoScout is a **GitHub repository discovery and repository intelligence platform** being built in public to help developers find useful open-source projects beyond the usual popularity-first results.

It is designed for people looking for **beginner-friendly open-source projects, actively maintained repositories, self-hosted tools, underrated GitHub projects, contribution opportunities, and useful repositories by language, topic, license, activity, or size**.

RepoScout does not treat star count as the answer. Stars are one signal among many.

## What can RepoScout help you find?

RepoScout is being designed around questions developers actually ask:

- “What are some actively maintained TypeScript backend repositories worth studying?”
- “Find smaller open-source projects that are useful but not already famous.”
- “Show me self-hosted GitHub projects that could run on modest infrastructure.”
- “I know React and Node.js. Where can I make a realistic first open-source contribution?”
- “Find repositories about this topic that are still actively maintained.”
- “Which projects have useful contribution docs, recent activity, and a healthy development history?”
- “What GitHub repositories match these topics, languages, licenses, or star ranges?”

If you are searching for **GitHub repository discovery**, **open-source project discovery**, **hidden GitHub gems**, or **beginner-friendly repositories to contribute to**, that is the problem RepoScout aims to solve.

## What works today?

RepoScout already has a real repository ingestion, catalog, search, metadata, and submission foundation.

### Repository discovery

The current discovery system supports deterministic PostgreSQL-backed search with:

- keyword search;
- language filtering;
- SPDX license filtering;
- topic filtering;
- minimum and maximum star ranges;
- fork filtering;
- archived-repository filtering;
- filter-only discovery;
- stable, query-bound pagination.

The web app keeps discovery state in the URL, supports browser back/forward restoration, shows active filters, and loads additional results without introducing client-side ranking.

### Repository intelligence

RepoScout can collect and store repository signals including:

- stars;
- forks;
- open issue and pull-request counts;
- primary language;
- SPDX license;
- GitHub topics;
- README evidence;
- contribution-document evidence;
- repository identity and refresh provenance.

README content is handled through a bounded evidence pipeline rather than exposing raw stored content directly.

### Community repository submissions

The backend currently supports:

- repository submission intake;
- deterministic submission validation;
- pending-validation orchestration;
- retryable-failure reporting;
- rate-limit-aware early stopping;
- VALID-submission evidence handoff into canonical repository ingestion;
- measured metadata, README, and contribution-evidence refresh for moderation preparation;
- unlisted pre-approval repository preparation;
- moderation-candidate selection;
- atomic approve/reject persistence;
- append-only moderation audit events;
- approval-controlled publication into discovery;
- trusted reviewer Bearer authorization;
- protected moderation queue and decision endpoints;
- authenticated reviewer attribution in moderation audit events;
- a public Add a Repository web form;
- explicit invalid, duplicate, pending, success, and retryable-error submission states;
- clear validation and moderation expectations before a repository becomes discoverable.

Launch abuse controls remain later work.

## Why RepoScout?

GitHub search is powerful when you already know exactly what to search for.

Discovery becomes harder when the real question is about **quality, maintenance, contribution readiness, usefulness, or fit** rather than a repository name or exact keyword.

Popularity also compounds: popular projects receive more visibility, which produces more stars, which produces even more visibility.

RepoScout is being built around a different idea:

> **Useful repositories should be discoverable because of relevant, explainable signals — not only because they are already famous.**

## Product pillars

### Discover

Find GitHub repositories through search, structured filters, repository signals, categories, and eventually natural-language intent.

### Understand

Inspect measurable repository information such as activity, releases, contributors, issues, pull requests, maintenance signals, license, documentation, and contribution readiness.

### Surface hidden gems

Explore transparent signals for finding healthy and useful repositories before they become widely known.

### Contribute

Make repository discovery community-improvable. A useful contribution should not require being an expert developer.

## What makes RepoScout different?

RepoScout is intentionally **not** trying to become “ChatGPT for GitHub.”

The long-term goal is to maintain structured and explainable repository intelligence that can power:

- repository discovery;
- comparisons;
- hidden-gem detection;
- contribution discovery;
- community curation;
- transparent ranking experiments;
- machine-readable repository intelligence.

AI can become one interface over that data, but it is not the foundation of the product.

## Architecture and stack

RepoScout is a TypeScript monorepo with separate web and API applications.

| Area | Current stack |
| --- | --- |
| Web | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| API | Node.js, Express 5, TypeScript |
| Database | PostgreSQL with node-postgres |
| Migrations | node-pg-migrate |
| Testing | Vitest |
| Tooling | ESLint, npm workspaces |

Repository layout:

```text
reposcout/
├── apps/
│   ├── api/        # ingestion, repository intelligence, discovery, submissions
│   └── web/        # repository catalog and discovery UI
├── docs/           # product, architecture, data model, roadmap, decisions
├── CONTRIBUTING.md
└── README.md
```

## Project status

RepoScout has moved beyond the initial documentation prototype and now has working backend and frontend foundations.

| Area | Status |
| --- | --- |
| Product and architecture foundation | Complete |
| PostgreSQL persistence | Complete |
| GitHub repository ingestion | Complete |
| Repository catalog API | Complete |
| Repository catalog UI | Complete |
| Repository metadata collection | Complete |
| README evidence | Complete |
| Contribution-document evidence | Complete |
| Deterministic discovery API | Complete |
| Discovery web UI | Complete |
| Community submission intake | Complete |
| Submission validation foundation | Complete |
| Moderation persistence/publication boundary | Complete |
| Reviewer authorization / protected moderation API | Complete |
| Submission UI | Complete |
| Public submission rate limiting | Complete |
| Repository resubmission abuse guard | Complete |
| Abuse controls / launch hardening | Complete |
| Historical snapshot persistence | Complete |
| Advanced ranking / hidden-gem scoring | Planned |

<details>
<summary><strong>Detailed implementation phases</strong></summary>

### Foundation

- Phase 0 — product and architecture foundation: complete.
- Phase 1A — application foundation: complete.
- Phase 1B.1 — persistence infrastructure: complete.
- Phase 1B.2A — canonical repositories schema: complete.
- Phase 1B.2B — repository persistence layer: complete.

### Repository ingestion and catalog

- Phase 2A — single-repository GitHub ingestion: complete.
- Phase 2B — ingestion refresh operations: complete.
- Phase 2 — repository ingestion: complete.
- Phase 3A — repository catalog/read API: complete.
- Phase 3B — repository catalog web UI: complete.
- Phase 3C — authoritative repository metadata foundation: complete.
- Phase 3D.1 — bounded README content foundation: complete.
- Phase 3D.2 — contribution-document evidence: complete.

### Evaluation and discovery

- Phase 3E.1 — Jev evaluation harness: complete.
- Phase 3E.2A — verified live Jev adapter: complete.
- Phase 3E.2B / 3E.3 — deferred while provider access is unavailable.
- Phase 4A — deterministic lexical search API: complete.
- Phase 4B.1 — scalar search filters: complete.
- Phase 4B.2 — topic and star-range filters: complete.
- Phase 4B.3 — filter-only discovery: complete.
- Phase 4C — web discovery UI: complete.
- Phase 4 — deterministic discovery: complete.

### Community submissions

- Phase 5A — community submission intake: complete.
- Phase 5B.1 — deterministic submission validation: complete.
- Phase 5B.2A — validation orchestration: complete.
- Phase 5B.2B — evidence handoff: complete.
- Phase 5B — deterministic submission validation + evidence preparation: complete.
- Phase 5C.1 — moderation persistence + publication boundary: complete.
- Phase 5C.2 — reviewer authorization + protected moderation API: complete.
- Phase 5C — moderation workflow: complete.
- Phase 5D — public repository submission UI: complete.
- Phase 5E.1 — public submission rate limiting: complete.
- Phase 5E.2 — deterministic repository resubmission abuse guard: complete.
- Phase 5E.3 — operational cleanup / retention: complete.
- Phase 5E.4 — observability + security review: complete.
- Phase 5E — application launch hardening: complete.
- Phase 6A — repository snapshot persistence: complete.
- Phase 6B — snapshot capture + bounded backfill: complete.
- Phase 6C — deterministic deltas + trend reads: complete.
- Phase 6D — scheduled snapshot operations: complete.
- Phase 6 — historical snapshots: complete.
- Phase 7A — ranking signal contract: complete.
- Phase 7B — Hidden Gems v1 deterministic scoring: complete.
- Phase 7C — Rising v1: next.
- Phase 7 — Hidden Gems and Rising: in progress.

</details>

## Community-first repository submission

The intended contribution flow is:

```text
Paste GitHub repository URL
        ↓
Automatic metadata collection
        ↓
Duplicate and eligibility checks
        ↓
Validation and moderation
        ↓
Approved repository enters the index
```

Self-submissions are part of the product direction, but they should follow the same validation and quality rules as every other repository.

## MVP direction

RepoScout deliberately starts smaller than “index all of GitHub.”

The core product is centered on:

1. repository ingestion and normalization;
2. a curated repository index;
3. measurable repository intelligence;
4. search and structured discovery;
5. transparent hidden-gem and ranking experiments;
6. community repository submission and moderation.

Large-scale crawling, social feeds, complicated gamification, and AI chat are not required for the core product to be useful.

## Contributing

RepoScout is intended to become welcoming to first-time open-source contributors.

Useful contributions can include:

- suggesting a repository RepoScout is missing;
- improving documentation;
- reporting incorrect repository information;
- fixing categories or metadata;
- improving frontend or backend features;
- adding tests;
- improving accessibility, performance, or security;
- improving search, ranking, and repository-analysis logic.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a substantial pull request.

Security concerns should follow [SECURITY.md](SECURITY.md). Application data handling is documented in [docs/PRIVACY.md](docs/PRIVACY.md).

## Guiding principles

- **Useful over popular** — stars are a signal, not the truth.
- **Explainable over magical** — important ranking signals should be understandable.
- **Measured over guessed** — distinguish factual repository metrics from inferred labels.
- **Community-curated, not community-spammed** — submissions require validation and moderation.
- **Beginner-friendly contribution** — useful contribution should not require expert coding.
- **Small first, scalable later** — prove the discovery model before attempting GitHub-scale indexing.
- **No pay-to-rank** — repository visibility should not be secretly purchased.

## Documentation

The `docs/` directory contains the product specification, MVP boundaries, architecture, data model, brand guidance, persistence foundation, ranking principles, roadmap, and recorded decisions.

## License

RepoScout is open source and licensed under the [MIT License](LICENSE).

You are free to use, modify, distribute, and build on RepoScout under the terms of the MIT License.

---

If RepoScout solves a problem you care about, **star the repository**, follow its development, suggest a repository, or contribute to the project.
