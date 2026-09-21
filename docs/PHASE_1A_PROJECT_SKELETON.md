# Phase 1A — Project Skeleton

## Scope

Phase 1A establishes a runnable, testable TypeScript foundation without introducing persistence or GitHub ingestion.

## Included

- npm workspaces;
- `apps/web` React/Vite application;
- `apps/api` Express application;
- shared TypeScript baseline;
- ESLint;
- Vitest;
- environment examples and validation;
- structured API logging baseline;
- API health route and 404/error handling;
- GitHub Actions CI;
- initial RepoScout brand tokens and branded foundation screen.

## Explicitly deferred

- PostgreSQL;
- migrations;
- ORM/query builder selection;
- GitHub OAuth;
- GitHub API ingestion;
- repository data model implementation;
- search;
- semantic/AI features.

These belong to later phases and should not leak into this checkpoint.

## Local commands

From the repository root:

```bash
npm install
npm run dev:web
npm run dev:api
```

Verification:

```bash
npm run verify
```

Default local endpoints:

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/health`

## Architecture checkpoint

```text
reposcout/
├── apps/
│   ├── api/
│   └── web/
├── docs/
├── .github/workflows/
├── eslint.config.js
├── package.json
└── tsconfig.base.json
```

No shared package is created yet. Shared packages should only be introduced once two applications actually share stable code or types.

## Next checkpoint

Phase 1B should introduce PostgreSQL and migrations with the smallest canonical repository schema needed for ingestion.
