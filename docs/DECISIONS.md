# Decision Log

Important decisions should be appended here rather than silently changing project direction.

## D-001 — RepoScout is not primarily an AI chat product

**Status:** Accepted

Natural language may become a discovery interface, but the core value is specialized repository data, historical signals, community curation, and explainable discovery.

## D-002 — Start curated, not internet-scale

**Status:** Accepted

The MVP will index a smaller set of useful repositories instead of attempting to crawl all of GitHub.

Reason:
- lower infrastructure cost;
- better data quality;
- simpler moderation;
- faster product validation.

## D-003 — Community repository submission is core

**Status:** Accepted

Users and repository owners can submit projects that RepoScout does not yet contain.

Submissions require validation and moderation.

## D-004 — Self-submission is allowed

**Status:** Accepted

Maintainers may submit their own repositories.

Self-submission does not buy or guarantee favorable ranking.

## D-005 — Total stars will not be the default definition of quality

**Status:** Accepted

Stars remain visible and sortable, but discovery modes can use activity, maintenance, momentum, and contribution signals.

## D-006 — Do not publish a universal quality score

**Status:** Accepted

RepoScout will prefer named, explainable rankings such as Hidden Gems, Rising, Recently Active, or Contribution Friendly.

## D-007 — PostgreSQL is the default persistence choice

**Status:** Proposed/initial

PostgreSQL fits normalized repository data, filters, historical snapshots, full-text search, and later pgvector if semantic search becomes justified.

Revisit only with concrete evidence.

## D-008 — AI must not fabricate repository metrics

**Status:** Accepted

AI may summarize/classify/interpret, but measured facts must originate from traceable data sources.

## D-009 — GitHub repository ID is canonical external identity

**Status:** Accepted

Owner/name can change. GitHub repository ID is used to prevent duplicate records after rename/transfer.

## D-010 — Implementation proceeds in small phases

**Status:** Accepted

Each phase should:
- have a narrow goal;
- preserve working behavior;
- include verification;
- document meaningful architectural changes;
- avoid unrelated refactors/features.
