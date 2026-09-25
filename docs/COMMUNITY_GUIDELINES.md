# Community and Submission Guidelines

RepoScout exists to help useful open-source projects become easier to discover.

## You may submit

- a repository you use;
- a repository you discovered;
- your own repository;
- a small or new repository;
- a repository with few stars.

Popularity is not an eligibility requirement.

## Self-promotion

Self-submission is allowed.

Where relevant, RepoScout may display that a repository was submitted by its maintainer/owner, but self-submission does not reduce or increase its ranking automatically.

## Expected repository characteristics

A submitted project should generally:
- be publicly accessible;
- contain meaningful project content;
- have a clear purpose;
- not be a simple duplicate/fork submitted as an independent project unless it has materially diverged;
- comply with GitHub policies and applicable law;
- not exist primarily for spam, link farming, malware distribution, impersonation, or deceptive promotion.

A repository does not need to be famous, perfect, or enterprise-ready.

## Reasons a submission may be rejected

Examples:
- duplicate of an indexed repository;
- inaccessible/private/deleted repository;
- obvious spam;
- empty/placeholder project;
- malicious/deceptive project;
- repository exists solely to manipulate RepoScout visibility;
- unusable metadata and no clear project purpose;
- content that creates unacceptable safety/legal risk for the platform.

Rejection from RepoScout is not a statement that the developer or repository is “bad.”

## Current submission intake boundary

Phase 5A accepts only a GitHub repository URL.

The intake endpoint:
- normalizes owner/repository casing;
- rejects repositories already present in the current catalog by owner/name;
- rejects duplicate pending submissions;
- stores a pending record for later validation/review.

It does not yet:
- verify GitHub availability/public visibility;
- approve the repository;
- collect submitter-authored metadata;
- run model analysis;
- expose a public moderation queue.

A pending submission means only **received for later validation/review**, not endorsed or approved.

Launch hardening now also applies two deterministic abuse controls:
- per-client public submission rate limiting;
- a repository-level cooldown after a recent terminal submission result.

The cooldown does not permanently blacklist a repository. A corrected or changed repository may be submitted again after the configured cooldown. Public callers are not told whether the previous terminal result was invalid, duplicate, rejected, approved, or another finalized state.

Phase 5B deterministic validation may mark an intake as INVALID or DUPLICATE, or record it as VALID while keeping it PENDING. VALID means the repository resolved as public and was not already publicly listed by canonical GitHub ID; it still does not mean approved.

After evidence handoff, RepoScout may keep a canonical repository/evidence row internally while the submission is still PENDING. That prepared repository remains **unlisted** until human approval.

## Moderation

Initial moderation is maintainer-led.

Phase 5C.1 establishes these rules:
- only PENDING + VALID submissions with completed evidence handoff are eligible for a final decision;
- APPROVED publishes the prepared repository into public discovery;
- REJECTED keeps prepared repository/evidence internally but unlisted;
- every final decision requires a reviewer reference and reason;
- the final decision is append-only/auditable;
- a second conflicting final decision does not rewrite history;
- ordinary repository refresh cannot bypass moderation by publishing an unlisted candidate.

As the community grows, trusted reviewers may receive limited moderation roles.

Phase 5C.2 now protects reviewer-facing moderation APIs with server-configured Bearer credentials mapped to stable reviewer references. Public users cannot read the moderation queue or submit final decisions, and request bodies cannot override the authenticated reviewer identity.

A broader account/role system remains deferred.

### Model-assisted submission analysis

RepoScout may later use Jev or another model to support submission triage after deterministic checks and repository metadata/content collection.

Potential model-assisted signals include:
- project/use-case classification;
- tutorial/demo likelihood;
- possible spam/self-promotion risk;
- beginner contribution suitability;
- whether a submission needs closer human review.

Rules:
- deterministic duplicate/existence/access checks happen first;
- model output is advisory/inferred, not canonical fact;
- model confidence must be preserved when used;
- low-confidence cases should be escalated rather than silently decided;
- a permanent rejection must not rely solely on model output;
- moderators must be able to see the evidence/source class behind automated suggestions;
- RepoScout moderation must continue functioning if the model provider is unavailable.

Model-assisted triage should reduce reviewer effort, not remove human accountability.

## Corrections

Community members should be able to report:
- incorrect category;
- outdated description;
- repository rename/transfer;
- archived project;
- incorrect signal;
- duplicate entry;
- harmful or deceptive listing.

## Ranking integrity

RepoScout should never secretly sell organic ranking position.

If sponsored placements ever exist, they must be clearly separated and labeled.

## Respectful participation

Contributors should:
- discuss projects based on evidence;
- avoid harassment toward maintainers or contributors;
- avoid brigading;
- avoid using RepoScout ratings/signals to attack projects;
- disclose conflicts where relevant during moderation.

## Beginner-friendly culture

RepoScout should treat metadata, documentation, categorization, and repository discovery as real contributions.

A contributor does not need to write production code for their work to matter.
