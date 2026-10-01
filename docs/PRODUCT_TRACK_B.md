# RepoScout Product Track B — Contribution Explorer

## Integrated delivery (2026-10-01)
- A1–A2 Hidden Gems and Rising: PR #60 merged into main as `8507a3f4fc076fa96de199f02e87e89a20feac8c`. Final PR CI #344 and ranking Chromium #13 passed.
- B1 Contribution Discovery transport: PR #61 merged **with a merge commit**, preserving B2 ancestry, as `d9bb7b8ec3dce6afbc024f8af5ff29f81f9ddafd`. CI #347 and #348 passed.
- B2 Contribution Explorer: PR #62 retargeted to `main`. Implements standalone `/contribute`, integrates a visible catalog "Find contributions" link, and uses a 320px-accessible four-choice navigation. Await exact integrated-branch checks before merging.
- The integration branch should include the up-to-date merged `main` tree as a true merge parent. Do not drop A2/B1 files or repeat old commits as a squash.

## Existing public backend
- `GET /api/contributions/issues` returns **stored observations of open GitHub issues**, not current-live GitHub search.
- Nullable filters: `unassigned`, `unlocked`, `goodFirstIssue`, `helpWanted`, `language`, `updatedWithinDays`, `contributing`.
- Filter-bound opaque pagination (max 50), fixed `evaluatedAt`; response contract `contribution-signals-v1`, `contribution-recommendation-v1`.
- Recommendation statuses `consider` and `needs_review` are evidence flags, not assertions of ease/suitability. Missing evidence is distinct from observed absence.

## B1 functionality
- `apps/web/src/lib/contribution-discovery-client.ts`: runtime response validation; safe normalization, filter echo, error and abort handling.
- `apps/web/src/lib/contribution-discovery-client.test.ts`: transport and validation coverage; no provider token or application backend changes.

## B2 functionality
- `/contribute`: public standalone contribution discovery experience.
- Seven query-backed filters with strict shared-URL parsing and browser Back/Forward handling.
- Evidence-first cards: issue details, original GitHub link, labels, observed updates, guidance availability, cautions, and unmeasured limitations.
- Loading, true empty, error/retry, cursor pagination, deduplication, stale-cursor restart and abortable requests.
- `RouteSwitch` returns between catalog and contribution page on `popstate`.
- The catalog's discovery navigation links to `/contribute`; at narrow widths all four discovery links use a readable two-column grid rather than clipping/hidden scrolling.
- Responsiveness, keyboard access, React/unit tests and Chromium workflow screenshots are included.
- Existing ranked discovery, search, filters and community submission remain.
- No DB/API/schema, scoring formula, payment, secrets or third-party AI changes.

## Verification record
- B2 baseline CI #354: success (34 steps); Chromium Review #4: success (11 cases).
- B2 prior documentation-head CI #355 and Chromium Review #5: success.
- Latest integrated branch includes merged A2/B1 plus catalog-to-contribution discovery navigation and its additional compact-screen browser check. Verify its own exact-head CI and Chromium workflow *after* the main-tree merge and before PR #62 merge.
- Browser fixtures are deterministic mocked Phase 8 responses. Real API/PostgreSQL gates are independently included in normal CI; the browser fixture alone is not live production-data verification.

## Operations and deferred follow-up
- Deploy only after merge and post-merge CI. SPA web hosting must rewrite `/contribute` to `index.html`; Vite preview supports this fallback.
- Populate/refresh curated repository and issue observations to expose real visitor data. Rising likewise requires 7/30-day snapshots; honest empty states are supported.
- Jev remains parked. Phase 9B.1B real embedding evaluation is still pending credentials/evidence and is not part of B2.
- After product integration, consider repository-level issue views and stronger ingestion/snapshot operations only when verified by user need.
