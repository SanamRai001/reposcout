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

### RepositoryMetrics

Current normalized metrics, either on Repository for very small MVPs or in a dedicated 1:1 table.

Examples:
```text
stars
forks
open_issues
watchers/subscribers when meaningful
release_count
latest_release_at
contributors_count when reliably collected
good_first_issue_count
help_wanted_issue_count
```

Each metric should document its GitHub/API meaning.

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

```text
id
submitted_url
normalized_owner
normalized_name
resolved_github_repository_id
submitter_user_id nullable
reason nullable
status
duplicate_repository_id nullable
created_at
reviewed_at nullable
reviewed_by nullable
rejection_reason nullable
```

Status:
```text
PENDING
APPROVED
REJECTED
DUPLICATE
INVALID
```

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
