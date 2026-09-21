# Phase 3B — Repository Catalog Web UI

## Goal

Turn the Phase 3A catalog API into the first real RepoScout browsing experience without introducing discovery complexity early.

Phase 3B adds:

- repository cards;
- initial loading state;
- empty state;
- API error + retry state;
- load-more pagination;
- responsive catalog layout;
- local Vite proxying to the API.

It does not add search, filters, ranking, repository detail pages, metrics, or community submission.

## Read flow

```text
React catalog screen
      ↓
same-origin /api/repositories
      ↓
Express catalog API
      ↓
RepositoryStore
      ↓
PostgreSQL
```

The browser never calls GitHub directly.

## Catalog card

Each card renders only facts already provided by Phase 3A:

- owner;
- repository name;
- description;
- archived/fork state;
- default branch;
- RepoScout sync date;
- GitHub repository link.

Star counts, health scores, language badges, ranking labels, and AI summaries remain absent until those data sources are actually implemented.

## Loading

Initial catalog loading uses quiet skeleton cards.

The skeleton:
- does not block the header or page shell;
- follows the Scout Signal surface system;
- respects `prefers-reduced-motion`.

Load-more uses a separate button loading state so already visible repositories remain usable.

## Empty state

A valid empty catalog is not treated as an error.

The UI explains that the catalog is ready but no repositories have been indexed yet.

## Error handling

Initial request failure shows:
- a clear catalog-unavailable state;
- API message when available;
- a retry action.

A load-more failure preserves repositories already on screen and displays an inline error instead of replacing the entire page.

## Pagination

The UI treats `nextCursor` as opaque.

It never:
- decodes the cursor;
- creates its own cursor;
- infers ordering from cursor contents.

The browser simply returns the cursor supplied by the API.

Duplicate repository IDs are defensively ignored while appending later pages.

## API response validation

The web client validates the successful JSON response before exposing it to the React screen.

If the API returns a malformed successful payload, RepoScout shows it as a catalog error rather than rendering partial/untrusted state.

## Local development

Vite proxies:

```text
/api/* → http://127.0.0.1:4000
```

This keeps browser code on the same relative API paths used by a same-origin production deployment while allowing the API and Vite server to run separately during development.

## Brand application

Phase 3B follows `BRAND_GUIDE.md`:

- Scout Ink foundation;
- restrained Scout Mint actions/signals;
- thin borders and layered surfaces;
- data-first repository cards;
- no excessive neon/cyberpunk styling;
- calm motion;
- useful mobile information preserved.

The temporary radar mark remains unchanged because the final logo is explicitly deferred.

## Verification

Unit tests cover the browser catalog client:

- first-page URL;
- pagination query encoding;
- stable API error propagation;
- malformed successful-response rejection.

The standard project gate additionally verifies:
- lint;
- TypeScript;
- unit tests;
- Vite production build;
- all existing backend/database/ingestion/catalog integration gates.

## Explicitly deferred

Phase 3B does not add:

- search;
- filters;
- user-selected sorting;
- repository detail route/page;
- stars/forks/issues/releases;
- languages/topics/categories;
- hidden-gem labels;
- refresh controls;
- public submission;
- client-side caching library;
- router dependency.

## Next checkpoint

Phase 3C should add the **smallest repository detail web view** only if that is needed before metadata enrichment.

Otherwise Phase 3 can move to the first metadata/signals expansion needed to make the catalog meaningfully informative before Phase 4 discovery.
