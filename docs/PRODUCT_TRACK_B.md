# RepoScout Product Track B — Contribution Explorer

## Branch and dependency
- Branch: `feat/contribution-explorer-client-b1`, based on `main@387936acfe45eced56eb33a4092183ea525fbfd1`.
- Product Track A1–A2 is separately complete and ready for human review in PR #60. The B1 API client is independent of A2 UI and **does not require PR #60 to be merged first**.
- This is a transport-only increment. The B2 visitor-facing page should be added after review/merge sequencing is settled.
- Do not revive historical Jev or Phase 9 semantic features as part of this product track.

## Existing backend contract, inspected before changes
- Public `GET /api/contributions/issues`, defined by Phase 8C.
- Returns only stored **open** GitHub issues from the listed curated catalog.
- Optional filters: `unassigned`, `unlocked`, `goodFirstIssue`, `helpWanted` (nullable booleans); `language` (normalized max 64 chars); `updatedWithinDays` (1–3650); `contributing` (`present`, `absent`, `missing`, `not_applicable`).
- Maximum page size 50; opaque cursor is bound to query filters and a fixed evaluation timestamp.
- Response includes repository/issue facts, `contribution-signals-v1` evidence (including source-missing states), and `contribution-recommendation-v1` explanations, cautions and explicit limitations.
- `consider` and `needs_review` are **evidence flags, not guarantees of beginner suitability**. No local scoring or AI prediction should be introduced.

## B1: frontend transport and tests
- Added `apps/web/src/lib/contribution-discovery-client.ts` with typed scope, issue/evidence/recommendation response, normalized parameter encoding, cursor propagation, abort support, HTTP/network error handling and runtime contract guards.
- Added tests for empty results, normalized/filter-bound cursors, signal provenance/missing states, error codes, malformed payloads and canceled requests.
- No API changes, frontend route/UI, migration, provider credentials or production model calls.

## Verification checkpoint
- B1 implementation CI #347 (run `36884147633`) **success**, 34 steps passed, zero failures on `1dc9a6e9ccf9433c40440b69e0f7a0dfa9ee8fab` (lint/typecheck/test/build + API/PostgreSQL integrations). This documentation-only follow-up requires its own CI.
- No unverified claim of production API availability or live issue freshness.
- B1 changes should remain isolated until CI passes; do not merge either PR automatically.

## Exact next phase: B2 Contribution Explorer UI
1. Integrate B1 into A2 navigation after PR #60 lands, preserving search/ranking modes.
2. A shareable contribution view (URL-backed filters), with evidence-first issue cards and links to live GitHub.
3. Explicit open/unassigned/locked status, label hints, last observed timestamp, and guidance availability; never call an issue "easy" without evidence.
4. Filters for language, good first issue/help wanted, unassigned, unlocked, recency and CONTRIBUTING evidence.
5. Loading, empty, network/error, retry, load-more, cursor-change recovery, Back/Forward, keyboard and responsive tests.
6. Use the existing Browser Review workflow patterns with mocked transport; separately verify actual Phase 8 backend contract tests.
