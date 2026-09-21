# MVP Scope

## Goal

Build the smallest version of RepoScout that proves this statement:

> A curated repository-intelligence index can help people discover useful open-source projects better than browsing by stars alone.

## Included in MVP

### 1. Repository index

Start with a curated dataset rather than crawling all of GitHub.

Initial target:
- hundreds first;
- then low thousands if ingestion and moderation remain reliable.

Each indexed repository must have a stable GitHub identifier and normalized metadata.

### 2. GitHub ingestion

Given a public GitHub repository URL, collect supported metadata such as:
- repository ID;
- owner/name;
- description;
- homepage;
- default branch;
- stars;
- forks;
- watchers/subscribers when useful;
- topics;
- primary language and language breakdown;
- license;
- creation/update/push timestamps;
- issue and pull-request counts where available;
- releases;
- contributors or contributor summaries where API limits allow;
- contribution files such as CONTRIBUTING.md;
- beginner-friendly issue labels;
- archived/fork/template state.

### 3. Repository detail page

Show:
- identity and description;
- repository metadata;
- activity signals;
- contribution signals;
- categories/tags;
- source links;
- when RepoScout last refreshed the data.

Do not present inferred labels as objective facts.

### 4. Discovery

Provide:
- text search;
- category/topic browsing;
- language filtering;
- activity filtering;
- star-range filtering;
- license filtering;
- sorting by selected transparent metrics.

### 5. Hidden Gems

Provide an experimental Hidden Gems view using an explicitly documented score.

The score must not be presented as a universal quality score.

### 6. Trending / momentum

Track periodic repository snapshots so recent changes can eventually be measured instead of relying only on current totals.

### 7. Community repository submission

A visitor can paste a GitHub repository URL.

Flow:
```text
URL
 ↓
normalize
 ↓
duplicate check
 ↓
GitHub fetch
 ↓
eligibility validation
 ↓
pending submission
 ↓
review
 ↓
approved / rejected
```

### 8. Moderation

At minimum:
- pending queue;
- approve;
- reject with reason;
- duplicate detection;
- basic spam/rate protection;
- audit timestamps.

## Explicitly excluded from MVP

- conversational AI assistant;
- browser extension;
- VS Code extension;
- mobile app;
- social feed;
- comments on repository pages;
- follower system;
- creator monetization;
- paid ranking;
- organization dashboards;
- automatic indexing of all GitHub;
- advanced reputation/gamification;
- complex recommendation personalization;
- scraping GitHub outside supported/legal mechanisms.

## Authentication

Default direction:
- browsing requires no account;
- submission may initially allow GitHub-authenticated users only if abuse risk is high;
- moderation requires authorized accounts.

Final auth choice is an implementation decision, not a prerequisite for documentation.

## Definition of done

The MVP is useful when:

- a curated repository can be ingested reliably;
- its data is normalized and refreshable;
- users can find it through discovery;
- the repository page explains its measurable signals;
- users can submit a missing repository;
- moderators can safely review submissions;
- duplicate repositories cannot enter the canonical index;
- ranking formulas are documented;
- no secret credential is exposed client-side.
