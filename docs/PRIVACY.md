# Privacy and Data Handling

RepoScout is built around public open-source repository information and currently does not require a general public user account.

This document describes the data-handling behavior implemented by the project. Hosting providers, reverse proxies, CDNs, and other deployment infrastructure may have their own logs and retention settings and must be configured consistently with this policy.

## Public repository data

RepoScout collects and stores information about public GitHub repositories in order to support discovery, validation, and moderation.

Stored repository information can include:

- GitHub repository ID;
- owner and repository name;
- public GitHub URL;
- description;
- branch and repository state;
- measured metadata such as stars, forks, issues, language, license, and topics;
- README evidence;
- public contribution/community-file evidence;
- synchronization timestamps.

This data originates from public GitHub repository endpoints.

## Community submissions

The public submission form accepts only a GitHub repository URL.

RepoScout stores the normalized repository identity and submission workflow state.

The public intake API does not currently collect:

- a RepoScout user account;
- a name;
- an email address;
- free-form promotional copy;
- a browser/device fingerprint.

Submission records may contain validation and workflow information such as:

- deterministic validation outcome;
- resolved GitHub repository identity;
- duplicate repository reference;
- evidence-handoff state;
- moderation status;
- timestamps.

## Network addresses and rate limiting

RepoScout resolves the request IP address in order to enforce the public submission rate limit.

The application does **not** persist the raw IP address in PostgreSQL.

The Phase 5E.4 limiter also does not store the raw IP address in its in-memory bucket map. A random per-process secret is used to derive an HMAC digest, and the digest is used as the rate-limit key.

The application does not include the raw IP address in its structured security-boundary logs.

The process-local digest and rate-limit state disappear when the API process restarts.

A hosting provider, reverse proxy, firewall, CDN, or platform may independently record network addresses in infrastructure access logs. RepoScout deployment operators are responsible for configuring those logs and their retention appropriately.

## Request observability

Submission and moderation requests receive a random request ID.

Structured application events may include:

- request ID;
- HTTP method;
- request path;
- response status;
- request duration;
- stable submission outcome code;
- submission ID;
- retry delay;
- moderation reviewer reference;
- moderation decision;
- moderation queue count.

The application intentionally does not log:

- authorization headers;
- bearer credentials;
- request bodies;
- moderation reason text;
- raw client IP addresses;
- cookies;
- user-agent strings.

The logger also recursively redacts metadata keys that look like credentials, including tokens, secrets, passwords, authorization values, cookies, API keys, and database URLs.

Request IDs are correlation identifiers for individual requests, not user identities.

## Moderation data

Protected moderation uses server-configured reviewer credentials.

Bearer credentials:

- are supplied through server configuration;
- are hashed in memory for credential comparison;
- are not stored in PostgreSQL;
- are not written to structured application logs.

Moderation audit records retain:

- stable reviewer reference;
- APPROVED or REJECTED decision;
- moderation reason;
- decision timestamp.

These records are deliberately retained as audit history.

## Retention

Current submission-workflow retention is:

- PENDING submissions: retained;
- APPROVED submissions: retained;
- REJECTED submissions: retained;
- moderation audit events: retained;
- prepared repository/evidence records: retained;
- INVALID/DUPLICATE submission rows: cleanup-eligible after the configured terminal retention period.

The default INVALID/DUPLICATE retention period is 90 days, with a minimum of 31 days.

Cleanup is manual and dry-run-first.

Application logs are emitted to the runtime logging surface. Their long-term retention is controlled by the deployment environment; RepoScout does not currently persist application logs in its own database.

## External services

### GitHub

RepoScout requests public repository information from GitHub APIs.

Public submission validation and evidence collection therefore send the repository identity being processed to GitHub as part of normal API requests.

### Jev / model evaluation

Jev is not part of the public submission or final moderation path.

Model output does not make permanent repository publication decisions.

Live Jev evaluation is an explicit internal evaluation workflow and requires separate provider credentials.

## Cookies and sessions

The current RepoScout API does not use browser session cookies for public submission or protected moderation.

Protected moderation uses an explicit Bearer credential rather than cookie authentication.

## Corrections and repository concerns

RepoScout indexes public repository information, but repository data can change.

Until a dedicated correction/removal workflow exists, project maintainers and repository owners can use the repository's GitHub issue/discussion channels for RepoScout to request correction of inaccurate indexed information without posting security-sensitive details.

Security vulnerabilities should follow [../SECURITY.md](../SECURITY.md), not a public issue containing exploit details.

## Deployment responsibility

This document covers application behavior in the repository.

Before broad public deployment, operators should additionally define:

- infrastructure access-log retention;
- backup retention;
- TLS termination;
- HSTS/CSP policy at the serving edge where appropriate;
- database backup and recovery procedures;
- incident-response access to logs.

Those controls are deployment responsibilities and are not implied merely by the application code.
