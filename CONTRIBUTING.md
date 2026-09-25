# Contributing to RepoScout

Thanks for helping make useful open source easier to discover.

You do **not** need to be an experienced developer to contribute.

## Ways to contribute

### Beginner-friendly

- suggest a repository RepoScout is missing;
- improve documentation;
- report incorrect repository information;
- suggest categories/tags;
- identify duplicates or stale listings;
- improve examples and wording.

### Code contributions

As implementation begins, contributions will include:
- frontend;
- backend/API;
- ingestion;
- database;
- search;
- ranking;
- tests;
- accessibility;
- performance;
- security;
- developer tooling.

## Current project stage

RepoScout has a working TypeScript/PostgreSQL application foundation, deterministic discovery, public repository submission, validation/evidence workflows, protected moderation, and launch-hardening controls.

Please still avoid unrelated large rewrites. Align substantial implementation work with the current roadmap phase and existing architecture.

## Adding a repository

RepoScout now has a public URL-only repository submission flow.

A product submission needs only the GitHub repository root URL. RepoScout performs the deterministic validation and evidence collection itself.

Self-submission is allowed, but it follows the same validation, abuse controls, and trusted moderation as any other repository.

Do not add promotional metadata or attempt to bypass moderation.

## Engineering contribution flow

1. Check existing issues/roadmap.
2. For non-trivial work, discuss the approach before writing a large patch.
3. Fork/branch from the current development base.
4. Keep the change focused.
5. Add/update tests when behavior changes.
6. Run the documented quality checks.
7. Open a PR explaining:
   - problem;
   - approach;
   - verification;
   - trade-offs/remaining risks.

## Contribution principles

- prefer small, reviewable PRs;
- do not mix unrelated refactors with feature work;
- preserve existing behavior unless intentionally changed;
- do not add dependencies without a clear reason;
- never commit credentials or tokens;
- report security vulnerabilities through [SECURITY.md](SECURITY.md), not with public exploit details;
- validate external input;
- keep user-facing ranking claims explainable;
- treat accessibility and security as product requirements.

## Architecture changes

Changes that materially affect:
- persistence;
- authentication;
- ingestion;
- search infrastructure;
- ranking definitions;
- background jobs;
- public APIs

should update the relevant documentation and DECISIONS.md.

## Community submissions vs. code PRs

RepoScout should eventually support contribution without Git.

Submitting a repository through the product is a valid community contribution even when it does not produce a code commit.

We may later provide an optional GitHub-native workflow for contributors who specifically want to learn pull requests.

## Code of conduct

A formal CODE_OF_CONDUCT.md will be added before community contribution opens broadly. Until then, communicate respectfully and focus criticism on ideas, code, data, and documented behavior.
