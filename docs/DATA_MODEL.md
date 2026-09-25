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
is_listed
created_at_github
updated_at_github
pushed_at_github
last_synced_at
created_at
updated_at
```

Do not use `full_name` as the unique identity because repositories can be renamed or transferred. The database enforces uniqueness on `github_repository_id`; `full_name` is a mutable, indexed lookup attribute.

`is_listed` is RepoScout-owned publication state. Canonical rows may exist internally with `is_listed = false` while submission evidence is prepared or retained after rejection. Public catalog/detail/search return only listed repositories.

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

Implemented in Phase 6A as daily append-only measured history.

```text
id
repository_id
captured_on
captured_at
stars
forks
open_issues
created_at
```

Rules:
- `captured_at` is the actual observation timestamp;
- `captured_on` is the UTC calendar date derived from `captured_at`;
- exactly one snapshot may exist per repository per UTC day;
- same-day retries are first-write-wins and do not rewrite historical values;
- distinct-day backfills may be inserted later and remain separate history;
- measured counts are nonnegative;
- repository deletion cascades to its snapshot history.

Indexes:
- unique(`repository_id`, `captured_on`);
- `repository_id` + `captured_at` descending.

Phase 6A intentionally does not store release counts or optional activity aggregates because RepoScout does not yet have a defined authoritative source/semantic contract for those fields.

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

Phase 5B.2B adds durable evidence-handoff state:

~~~text
handoff_repository_id nullable
evidence_handoff_completed_at nullable
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
- duplicate_repository_id links a duplicate submission to the indexed RepoScout repository;
- handoff_repository_id links a successfully prepared VALID submission to the canonical RepoScout repository;
- handoff_repository_id and evidence_handoff_completed_at are both null until the full evidence handoff succeeds;
- evidence handoff completion requires validation_outcome = VALID;
- evidence handoff does not change status from PENDING and is not approval;
- partial ingestion/evidence writes may exist while handoff completion remains null, allowing safe retry.

Phase 5C.1 adds final moderation through a separate append-only event rather than duplicating reviewer/reason fields onto the submission row.

Potential later identity fields may include:

~~~text
submitter_user_id nullable
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

Implemented in Phase 5C.1 as `repository_submission_moderation_events`.

Append-only final-decision audit record:

```text
id
submission_id
decision        APPROVED | REJECTED
reviewer_ref
reason
created_at
```

Rules:
- exactly one final moderation event per submission;
- reviewer reference is explicit even before full user identity exists;
- approval/rejection state and event persistence occur in one transaction;
- approval also flips the handoff repository to `is_listed = true` in that same transaction;
- rejection preserves the handoff repository/evidence internally but leaves it unlisted;
- events are not updated/deleted by Phase 5C.1.

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

### Submission workflow retention — Phase 5E.3

Current MVP policy:

- PENDING submission rows are retained;
- APPROVED and REJECTED submission rows are retained;
- moderation events are retained;
- prepared canonical repository/metadata/README/contribution evidence for moderated submissions is retained;
- INVALID and DUPLICATE submission rows become cleanup candidates only after the configured terminal-retention period;
- cleanup additionally requires null evidence-handoff fields and no moderation event;
- default terminal retention is 90 days;
- configurable minimum is 31 days and maximum is 3650 days;
- cleanup deletes only the submission row, never the canonical repository referenced by a duplicate;
- cleanup is manual and dry-run-first in Phase 5E.3.

The 31-day minimum is deliberate: it keeps retained deterministic terminal state longer than the maximum 30-day repository resubmission cooldown.

Deleted INVALID/DUPLICATE rows have no application-level undo. Recovery depends on database backups.

### Future snapshot retention

Historical snapshots can grow quickly. Retention should eventually use coarser granularity for older data if storage becomes material.

Example future strategy:
- daily snapshots for recent months;
- weekly/monthly aggregates for older periods.

Do not implement snapshot-retention complexity before it is needed.

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
