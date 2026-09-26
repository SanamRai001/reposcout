import type {
  RepositoryContributionEvidenceRecord,
} from './repository-contribution-evidence.js';

export const CONTRIBUTION_DISCOVERY_SIGNAL_CONTRACT_VERSION =
  'contribution-signals-v1' as const;

export type ContributionDiscoverySignalSource =
  | 'github_issue'
  | 'github_repository_evidence'
  | 'reposcout_derived';

export type ContributionDiscoverySignalRole =
  | 'entry_hint'
  | 'process'
  | 'availability'
  | 'activity'
  | 'discussion';

export type ContributionDiscoverySignalId =
  | 'entry.good_first_issue_label'
  | 'entry.help_wanted_label'
  | 'process.contributing_present'
  | 'process.code_of_conduct_present'
  | 'process.issue_template_present'
  | 'process.pull_request_template_present'
  | 'availability.open'
  | 'availability.unassigned'
  | 'availability.unlocked'
  | 'activity.issue_age_days'
  | 'activity.days_since_update'
  | 'discussion.comment_count';

export type ContributionDiscoverySignalDefinition = Readonly<{
  id: ContributionDiscoverySignalId;
  source: ContributionDiscoverySignalSource;
  role: ContributionDiscoverySignalRole;
  valueType: 'boolean' | 'number';
  description: string;
}>;

export const CONTRIBUTION_DISCOVERY_SIGNAL_DEFINITIONS: readonly ContributionDiscoverySignalDefinition[] =
  Object.freeze([
    {
      id: 'entry.good_first_issue_label',
      source: 'reposcout_derived',
      role: 'entry_hint',
      valueType: 'boolean',
      description:
        'Whether the observed GitHub issue labels include a normalized good-first-issue hint. This is a hint, not proof of beginner suitability.',
    },
    {
      id: 'entry.help_wanted_label',
      source: 'reposcout_derived',
      role: 'entry_hint',
      valueType: 'boolean',
      description:
        'Whether the observed GitHub issue labels include a normalized help-wanted hint. This is a maintainer hint, not proof that contribution is easy or well-scoped.',
    },
    {
      id: 'process.contributing_present',
      source: 'github_repository_evidence',
      role: 'process',
      valueType: 'boolean',
      description:
        'Whether GitHub community evidence exposes CONTRIBUTING guidance for the repository.',
    },
    {
      id: 'process.code_of_conduct_present',
      source: 'github_repository_evidence',
      role: 'process',
      valueType: 'boolean',
      description:
        'Whether GitHub community evidence exposes a code of conduct for the repository.',
    },
    {
      id: 'process.issue_template_present',
      source: 'github_repository_evidence',
      role: 'process',
      valueType: 'boolean',
      description:
        'Whether GitHub community evidence exposes an issue template for the repository.',
    },
    {
      id: 'process.pull_request_template_present',
      source: 'github_repository_evidence',
      role: 'process',
      valueType: 'boolean',
      description:
        'Whether GitHub community evidence exposes a pull request template for the repository.',
    },
    {
      id: 'availability.open',
      source: 'github_issue',
      role: 'availability',
      valueType: 'boolean',
      description:
        'Whether the observed issue is currently open.',
    },
    {
      id: 'availability.unassigned',
      source: 'reposcout_derived',
      role: 'availability',
      valueType: 'boolean',
      description:
        'Whether the observed issue currently has no assignees.',
    },
    {
      id: 'availability.unlocked',
      source: 'reposcout_derived',
      role: 'availability',
      valueType: 'boolean',
      description:
        'Whether the observed issue discussion is not locked.',
    },
    {
      id: 'activity.issue_age_days',
      source: 'reposcout_derived',
      role: 'activity',
      valueType: 'number',
      description:
        'Whole UTC-day age of the issue at the explicit evaluation time.',
    },
    {
      id: 'activity.days_since_update',
      source: 'reposcout_derived',
      role: 'activity',
      valueType: 'number',
      description:
        'Whole UTC days since the issue was last updated at the explicit evaluation time.',
    },
    {
      id: 'discussion.comment_count',
      source: 'github_issue',
      role: 'discussion',
      valueType: 'number',
      description:
        'Measured GitHub issue comment count. Comment volume is context, not a friendliness judgment.',
    },
  ]);

export type ContributionDiscoveryMissingReason =
  | 'not_collected'
  | 'not_applicable';

export type ContributionDiscoverySignalObservation =
  | Readonly<{
      id: ContributionDiscoverySignalId;
      availability: 'available';
      value: boolean | number;
    }>
  | Readonly<{
      id: ContributionDiscoverySignalId;
      availability: 'missing';
      reason: ContributionDiscoveryMissingReason;
    }>;

export type ContributionIssueObservation = Readonly<{
  githubIssueId: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  locked: boolean;
  assigneeCount: number;
  commentCount: number;
  labels: readonly string[];
  createdAt: Date;
  updatedAt: Date;
}>;

export type BuildContributionDiscoverySignalInput = Readonly<{
  repositoryId: string;
  evaluatedAt: Date;
  issue: ContributionIssueObservation;
  repositoryEvidence: Pick<
    RepositoryContributionEvidenceRecord,
    | 'status'
    | 'contributing'
    | 'codeOfConduct'
    | 'issueTemplate'
    | 'pullRequestTemplate'
  > | null;
}>;

export type ContributionDiscoverySignalSnapshot = Readonly<{
  contractVersion:
    typeof CONTRIBUTION_DISCOVERY_SIGNAL_CONTRACT_VERSION;
  repositoryId: string;
  githubIssueId: string;
  issueNumber: number;
  issueTitle: string;
  evaluatedAt: Date;
  normalizedLabels: readonly string[];
  signals: Readonly<
    Record<
      ContributionDiscoverySignalId,
      ContributionDiscoverySignalObservation
    >
  >;
}>;

const DAY_MS = 86_400_000;

function available(
  id: ContributionDiscoverySignalId,
  value: boolean | number,
): ContributionDiscoverySignalObservation {
  return {
    id,
    availability: 'available',
    value,
  };
}

function missing(
  id: ContributionDiscoverySignalId,
  reason: ContributionDiscoveryMissingReason,
): ContributionDiscoverySignalObservation {
  return {
    id,
    availability: 'missing',
    reason,
  };
}

export function normalizeContributionIssueLabel(label: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!normalized) {
    throw new Error('Contribution issue labels must be non-empty.');
  }

  return normalized;
}

function processSignal(
  id: ContributionDiscoverySignalId,
  evidence: BuildContributionDiscoverySignalInput['repositoryEvidence'],
  field:
    | 'contributing'
    | 'codeOfConduct'
    | 'issueTemplate'
    | 'pullRequestTemplate',
): ContributionDiscoverySignalObservation {
  if (evidence === null) {
    return missing(id, 'not_collected');
  }

  if (evidence.status === 'UNSUPPORTED_FORK') {
    return missing(id, 'not_applicable');
  }

  return available(id, evidence[field] !== null);
}

function assertValidDate(name: string, value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${name} must be a valid date.`);
  }
}

function wholeDaysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / DAY_MS);
}

export function buildContributionDiscoverySignalSnapshot(
  input: BuildContributionDiscoverySignalInput,
): ContributionDiscoverySignalSnapshot {
  if (!input.repositoryId.trim()) {
    throw new Error('repositoryId must be non-empty.');
  }

  if (!input.issue.githubIssueId.trim()) {
    throw new Error('githubIssueId must be non-empty.');
  }

  if (
    !Number.isInteger(input.issue.number) ||
    input.issue.number < 1
  ) {
    throw new Error('issue number must be a positive integer.');
  }

  if (!input.issue.title.trim()) {
    throw new Error('issue title must be non-empty.');
  }

  if (
    !Number.isInteger(input.issue.assigneeCount) ||
    input.issue.assigneeCount < 0
  ) {
    throw new Error(
      'issue assigneeCount must be a nonnegative integer.',
    );
  }

  if (
    !Number.isInteger(input.issue.commentCount) ||
    input.issue.commentCount < 0
  ) {
    throw new Error(
      'issue commentCount must be a nonnegative integer.',
    );
  }

  assertValidDate('evaluatedAt', input.evaluatedAt);
  assertValidDate('issue.createdAt', input.issue.createdAt);
  assertValidDate('issue.updatedAt', input.issue.updatedAt);

  if (input.issue.updatedAt < input.issue.createdAt) {
    throw new Error(
      'issue.updatedAt must not be earlier than issue.createdAt.',
    );
  }

  if (input.evaluatedAt < input.issue.createdAt) {
    throw new Error(
      'evaluatedAt must not be earlier than issue.createdAt.',
    );
  }

  const normalizedLabels = [
    ...new Set(
      input.issue.labels.map((label) =>
        normalizeContributionIssueLabel(label),
      ),
    ),
  ].sort((left, right) => left.localeCompare(right));

  const hasGoodFirstIssue = normalizedLabels.includes(
    'good first issue',
  );
  const hasHelpWanted = normalizedLabels.includes('help wanted');

  const signals: Record<
    ContributionDiscoverySignalId,
    ContributionDiscoverySignalObservation
  > = {
    'entry.good_first_issue_label': available(
      'entry.good_first_issue_label',
      hasGoodFirstIssue,
    ),
    'entry.help_wanted_label': available(
      'entry.help_wanted_label',
      hasHelpWanted,
    ),
    'process.contributing_present': processSignal(
      'process.contributing_present',
      input.repositoryEvidence,
      'contributing',
    ),
    'process.code_of_conduct_present': processSignal(
      'process.code_of_conduct_present',
      input.repositoryEvidence,
      'codeOfConduct',
    ),
    'process.issue_template_present': processSignal(
      'process.issue_template_present',
      input.repositoryEvidence,
      'issueTemplate',
    ),
    'process.pull_request_template_present': processSignal(
      'process.pull_request_template_present',
      input.repositoryEvidence,
      'pullRequestTemplate',
    ),
    'availability.open': available(
      'availability.open',
      input.issue.state === 'open',
    ),
    'availability.unassigned': available(
      'availability.unassigned',
      input.issue.assigneeCount === 0,
    ),
    'availability.unlocked': available(
      'availability.unlocked',
      !input.issue.locked,
    ),
    'activity.issue_age_days': available(
      'activity.issue_age_days',
      wholeDaysBetween(input.issue.createdAt, input.evaluatedAt),
    ),
    'activity.days_since_update': available(
      'activity.days_since_update',
      Math.max(
        0,
        wholeDaysBetween(input.issue.updatedAt, input.evaluatedAt),
      ),
    ),
    'discussion.comment_count': available(
      'discussion.comment_count',
      input.issue.commentCount,
    ),
  };

  return {
    contractVersion:
      CONTRIBUTION_DISCOVERY_SIGNAL_CONTRACT_VERSION,
    repositoryId: input.repositoryId,
    githubIssueId: input.issue.githubIssueId,
    issueNumber: input.issue.number,
    issueTitle: input.issue.title,
    evaluatedAt: input.evaluatedAt,
    normalizedLabels,
    signals,
  };
}
