# Initial Data Model

## Design principles

- GitHub repository ID is the stable external identity.
- Repository rename/owner transfer must not create a second canonical record.
- Raw external data and curated RepoScout data must remain distinguishable.
- Historical metrics belong in snapshots, not repeated columns.
- Derived scores must be reproducible from stored inputs where practical.
- Measured facts, deterministic RepoScout signals, model-assisted assessments, and community judgments must remain distinguishable.
- Persisted model assessments must retain provider/model/schema/input provenance.

## Core entities

### Repository

Canonical indexed project.

Implemented canonical fields as of Phase 1B.2A:

```text
id                       internal UUID
github_repository_id     unique bigint
owner
name
full_name
description
github_url
default_branch
is_fork
is_archived
created_at_github
updated_at_github
pushed_at_github
last_synced_at
created_at
updated_at
```

Do not use `full_name` as the unique identity because repositories can be renamed or transferred. The database enforces uniqueness on `github_repository_id`; `full_name` is a mutable, indexed lookup attribute.

### RepositoryMetadata

Implemented in Phase 3C as a dedicated one-to-one table.

```text
repository_id
stars
forks
open_issues
primary_language nullable
license_spdx nullable
topics
observed_at
created_at
updated_at
```

Phase 3C values come directly from GitHub's repository REST response.

Notes:
- missing metadata is distinct from zero;
- `open_issues` preserves GitHub's `open_issues_count` source semantics, which may include pull requests;
- counts are nonnegative measured values;
- metadata has its own observation timestamp;
- stale observations cannot overwrite newer values.

Future measured fields may include watchers/subscribers, release data, contributor counts, and contribution issue counts when their collection cost and semantics are explicitly defined.

### RepositoryReadmeContent

Implemented in Phase 3D.1 as a dedicated one-to-one content-evidence table.

~~~text
repository_id
status
source_ref nullable
path nullable
sha nullable
size_bytes nullable
content nullable
observed_at
created_at
updated_at
~~~

Status:
- PRESENT — validated UTF-8 README body is stored;
- NOT_FOUND — the README endpoint did not yield a README for the observation;
- TOO_LARGE — path/SHA/size provenance is stored, but body storage is refused.

Rules:
- README bodies are limited to 256 KiB;
- source ref/path/blob SHA/byte size are preserved as provenance;
- stale observations cannot overwrite newer evidence;
- raw README text is not part of the public catalog contract in Phase 3D.1;
- model interpretation belongs in RepositoryModelAssessment, never in this source-content table.

### RepositoryContributionEvidence

Implemented in Phase 3D.2 as a dedicated one-to-one evidence table.

~~~text
repository_id
status

contributing_api_url nullable
contributing_html_url nullable
code_of_conduct_api_url nullable
code_of_conduct_html_url nullable
issue_template_api_url nullable
issue_template_html_url nullable
pull_request_template_api_url nullable
pull_request_template_html_url nullable

security_source_ref nullable
security_path nullable
security_sha nullable
security_size_bytes nullable

community_profile_updated_at nullable
observed_at
created_at
updated_at
~~~

Status:
- OBSERVED — GitHub community profile was successfully observed;
- UNSUPPORTED_FORK — RepoScout intentionally skipped GitHub's unsupported community-profile request for a fork.

Rules:
- community-file links represent GitHub effective evidence and may reflect supported account-level defaults;
- SECURITY evidence is repository-local only and uses fixed supported paths;
- contribution-document bodies are not stored in Phase 3D.2;
- stale observations cannot overwrite newer evidence;
- absence after OBSERVED is different from UNSUPPORTED_FORK;
- model conclusions do not belong in this evidence table.

### RepositorySnapshot

Historical measurements.

```text
id
repository_id
captured_at
stars
forks
open_issues
release_count
optional activity aggregates
```

Indexes:
- unique(repository_id, captured_at bucket) where applicable;
- repository_id + captured_at descending.

### RepositoryLanguage

```text
repository_id
language
bytes
percentage (derived or persisted)
```

### Topic

Controlled or GitHub-originated topic.

### RepositoryTopic

Many-to-many repository/topic mapping.

### Category

RepoScout-controlled navigation taxonomy.

Examples:
- developer-tools;
- backend;
- databases;
- AI;
- automation;
- self-hosted;
- security.

Categories should remain broad enough to browse.

### RepositoryCategory

Stores:
- repository_id;
- category_id;
- source: manual | community | automated;
- confidence if automated;
- reviewed_at if human-reviewed.

### RepositorySignal

For detected boolean/structured signals.

Examples:
- has_contributing_guide;
- has_code_of_conduct;
- has_ci;
- has_container_config;
- has_good_first_issues;
- has_recent_release.

Each signal should store:
- value;
- source;
- observed_at;
- optional evidence metadata.

### RepositoryModelAssessment

**Future / not implemented.**

Stores model-assisted probabilistic assessments separately from canonical repository facts.

Conceptual fields:

~~~text
id
repository_id
provider
model
assessment_type
input_version
schema_version
result_json
confidence_json
evaluated_at
expires_at nullable
superseded_by nullable
~~~

Potential assessment types:
- use_case_classification;
- tutorial_demo_probability;
- beginner_suitability;
- query_relevance;
- submission_triage.

Rules:
- GitHub metrics do not belong here;
- this entity is not canonical repository truth;
- each assessment must be attributable to a specific provider/model/schema/input version;
- model output must be validated before persistence;
- do not create this table until the Jev evaluation phase proves a real product need.

### Submission

Community request to add a repository.

Phase 5A implements the intake subset:

```text
id
submitted_url
normalized_owner
normalized_name
normalized_full_name
status
created_at
updated_at
```

Status vocabulary:

```text
PENDING
APPROVED
REJECTED
DUPLICATE
INVALID
```

Phase 5A creates only `PENDING`.

Phase 5B.1 adds deterministic validation fields:

~~~text
validation_outcome nullable   VALID | DUPLICATE | INVALID
github_repository_id nullable
resolved_owner nullable
resolved_name nullable
resolved_full_name nullable
resolved_github_url nullable
duplicate_repository_id nullable
validated_at nullable
~~~

Rules:
- submitted URL is normalized to `https://github.com/{owner}/{repository}`;
- normalized owner/name are lowercase intake identifiers;
- at most one `PENDING` row may exist for a normalized full name;
- intake identity is preserved after validation;
- resolved GitHub identity is stored separately from intake identity;
- canonical GitHub repository ID is authoritative for duplicate detection;
- VALID remains status PENDING until a later workflow/moderator acts;
- DUPLICATE and INVALID are deterministic terminal validation states;
- transient GitHub failures do not set a validation outcome;
- duplicate_repository_id links a duplicate submission to the indexed RepoScout repository.

Future moderation fields may include:

~~~text
submitter_user_id nullable
reason nullable
reviewed_at nullable
reviewed_by nullable
rejection_reason nullable
~~~

### User

Keep user data minimal.

Potential fields:
```text
id
github_user_id
github_login
avatar_url
role
created_at
```

Do not copy unnecessary GitHub profile information.

### ModerationEvent

Append-only audit record.

```text
id
submission_id
actor_user_id
action
reason
created_at
```

## Future entities, not MVP requirements

- Collection;
- CollectionItem;
- SavedRepository;
- ContributorProfile;
- RepositoryComparison;
- SearchFeedback;
- semantic embeddings;
- reputation/badges.

## Data retention

Historical snapshots can grow quickly. Retention should eventually use coarser granularity for older data if storage becomes material.

Example future strategy:
- daily snapshots for recent months;
- weekly/monthly aggregates for older periods.

Do not implement retention complexity before it is needed.

## Constraints that should exist at the database level

MUST:
- unique GitHub repository ID;
- unique GitHub user ID when users exist;
- foreign keys for submissions/moderation;
- valid submission status enum/check;
- timestamps;
- indexes on commonly filtered repository attributes;
- indexes supporting repository snapshot history.

Application-level duplicate checks are not a replacement for database uniqueness.
