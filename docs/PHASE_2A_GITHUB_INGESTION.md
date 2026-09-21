# Phase 2A — GitHub Repository Ingestion Boundary

## Goal

Build the smallest safe boundary that can accept a GitHub repository reference, fetch one public repository from GitHub, validate and normalize the response, and persist it through the existing canonical repository store.

This phase does not expose ingestion as a public HTTP endpoint and does not crawl GitHub.

## Flow

```text
owner/repository OR https://github.com/owner/repository
                    ↓
       repository reference parser
                    ↓
             GitHub REST client
                    ↓
         response validation
                    ↓
       normalized repository snapshot
                    ↓
      RepositoryIngestionService
                    ↓
            RepositoryStore
                    ↓
               PostgreSQL
```

## Repository references

Accepted examples:

```text
openai/openai-node
https://github.com/openai/openai-node
https://github.com/openai/openai-node/
https://github.com/openai/openai-node.git
```

The parser rejects:
- non-GitHub hosts;
- non-HTTPS GitHub URLs;
- extra path segments;
- query strings/fragments;
- credentials/ports;
- malformed owner/repository names.

The parser returns only owner and repository name. It never turns user input into an arbitrary fetch URL.

## SSRF boundary

The GitHub client constructs requests from a fixed origin:

```text
https://api.github.com
```

Only owner and repository path segments are encoded into that URL.

Redirects are rejected.

This means repository input cannot instruct RepoScout to fetch an arbitrary host.

## REST API version

RepoScout explicitly sends:

```text
X-GitHub-Api-Version: 2026-03-10
Accept: application/vnd.github+json
User-Agent: RepoScout
```

The API version is pinned so GitHub API behavior does not silently move with the default version.

## Authentication

`GITHUB_TOKEN` is optional for public repository requests in this phase.

It is strongly recommended outside local/testing use because authenticated GitHub API access provides a more practical rate-limit budget.

The token:
- is server-side only;
- is never placed in repository URLs;
- must never be logged;
- is sent only to the fixed GitHub API origin.

## Timeouts

GitHub requests are bounded by `GITHUB_REQUEST_TIMEOUT_MS`.

Default:

```text
8000 ms
```

Allowed range:

```text
500–60000 ms
```

## Error model

The GitHub client exposes stable error kinds:

```text
not_found
rate_limited
request_failed
invalid_response
```

### not_found

Used for HTTP 404.

This covers repositories that do not exist or are not publicly accessible to the configured credentials.

### rate_limited

Used for:
- HTTP 429;
- HTTP 403 when GitHub reports zero rate-limit remaining.

When GitHub supplies `X-RateLimit-Reset`, RepoScout parses it into a retry timestamp.

### request_failed

Used for transport failures and non-special HTTP failures.

### invalid_response

Used when GitHub returns JSON that does not match the repository fields RepoScout requires.

Invalid external data is never persisted.

## External data validation

Phase 2A validates only fields required by the current repository table:

- repository ID;
- owner login;
- name;
- full name;
- GitHub HTML URL;
- default branch;
- description;
- archived/fork flags;
- created/updated/pushed timestamps.

Owner/name/full-name consistency is checked.

The GitHub HTML URL must resolve to HTTPS on `github.com`.

## GitHub repository IDs

GitHub's JSON repository ID is validated as a positive safe integer before converting it to the TypeScript decimal-string representation used by persistence.

If the REST API begins returning IDs outside JavaScript safe-integer precision, RepoScout fails validation rather than silently corrupting identity. A lossless JSON-number parser can be introduced if that situation becomes real.

## Ingestion timestamp

`last_synced_at` records when RepoScout performed the fetch, not GitHub's repository `updated_at`.

This timestamp is supplied by the ingestion service and is then used by persistence stale-write protection.

## Verification

Unit tests cover:
- repository reference parsing;
- non-GitHub URL rejection;
- fixed GitHub API URL construction;
- pinned GitHub headers;
- authenticated and unauthenticated requests;
- 404 mapping;
- rate-limit mapping;
- malformed response rejection;
- unsafe numeric ID rejection;
- fetch-to-persistence orchestration;
- no persistence after fetch failure.

A PostgreSQL integration test additionally proves:

```text
mocked GitHub HTTP response
        ↓
GithubClient
        ↓
RepositoryIngestionService
        ↓
RepositoryStore
        ↓
PostgreSQL
```

It also verifies a GitHub rename/owner transfer refreshes the same canonical RepoScout row.

## Explicitly deferred

Phase 2A does not add:
- public ingestion HTTP routes;
- user submissions;
- background jobs;
- bulk crawling;
- automatic retries;
- ETag/conditional requests;
- stars/forks/issues;
- topics/languages/license;
- README fetching;
- release fetching;
- contribution signals.

## Next checkpoint

Phase 2B should add **refresh orchestration and GitHub operational behavior** in another small phase.

Likely responsibilities:
- conditional refresh policy;
- rate-limit-aware retry decisions;
- deleted/private transition handling;
- ingestion logging/observability;
- a safe internal command or service entry point for manually ingesting a repository.

Do not expose anonymous public ingestion until submission moderation/rate-limit controls exist.
