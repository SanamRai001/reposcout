# RepoScout Documentation

Start here if you are contributing to the project.

## Product

- [PRODUCT.md](PRODUCT.md) — problem, users, differentiation, principles.
- [MVP_SCOPE.md](MVP_SCOPE.md) — what the first release includes and excludes.
- [ROADMAP.md](ROADMAP.md) — phased delivery plan.
- [BRAND_GUIDE.md](BRAND_GUIDE.md) — visual identity, voice, color, motion, and UI guardrails.

## Engineering

- [ARCHITECTURE.md](ARCHITECTURE.md) — current system direction and production concerns.
- [DATA_MODEL.md](DATA_MODEL.md) — canonical repository, snapshot, submission, and moderation model.
- [DISCOVERY_RANKING.md](DISCOVERY_RANKING.md) — discovery modes, explainability, and scoring constraints.
- [DECISIONS.md](DECISIONS.md) — project decision log.
- [PHASE_1A_PROJECT_SKELETON.md](PHASE_1A_PROJECT_SKELETON.md) — application foundation checkpoint.
- [PHASE_1B1_PERSISTENCE_FOUNDATION.md](PHASE_1B1_PERSISTENCE_FOUNDATION.md) — PostgreSQL connection, migrations, readiness, and reproducible installs.
- [PHASE_1B2A_REPOSITORIES_SCHEMA.md](PHASE_1B2A_REPOSITORIES_SCHEMA.md) — canonical repository identity schema and migration verification.
- [PHASE_1B2B_REPOSITORY_PERSISTENCE.md](PHASE_1B2B_REPOSITORY_PERSISTENCE.md) — idempotent repository writes, lookup behavior, and stale-sync protection.
- [PHASE_2A_GITHUB_INGESTION.md](PHASE_2A_GITHUB_INGESTION.md) — repository reference parsing, GitHub API validation, and single-repository ingestion.
- [PHASE_2B_INGESTION_OPERATIONS.md](PHASE_2B_INGESTION_OPERATIONS.md) — refresh policy, retry behavior, non-destructive unavailable handling, observability, and internal ingestion CLI.

## Community

- [COMMUNITY_GUIDELINES.md](COMMUNITY_GUIDELINES.md) — repository eligibility, self-submission, moderation, and ranking integrity.
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — how beginners and engineers can contribute.

## Documentation rule

When implementation materially changes a documented product or architectural decision, update the relevant document in the same pull request.
