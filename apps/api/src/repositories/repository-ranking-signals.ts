import type {
  RepositoryContributionEvidenceRecord,
} from './repository-contribution-evidence.js';
import type {
  RepositoryMetadataRecord,
} from './repository-metadata.js';
import type {
  RepositoryReadmeRecord,
} from './repository-readme.js';
import type {
  RepositoryTrendResult,
} from './repository-trend.js';
import type { RepositoryRecord } from './repository.js';

export const REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION =
  'ranking-signals-v1' as const;

export type RepositoryRankingMode = 'hidden_gems' | 'rising';

export type RepositoryRankingSignalSource =
  | 'github_current'
  | 'github_evidence'
  | 'reposcout_derived_current'
  | 'reposcout_derived_history';

export type RepositoryRankingSignalRole =
  | 'visibility'
  | 'maintenance'
  | 'documentation'
  | 'community'
  | 'momentum'
  | 'context';

export type RepositoryRankingSignalId =
  | 'visibility.stars_total'
  | 'visibility.forks_total'
  | 'maintenance.days_since_push'
  | 'documentation.readme_present'
  | 'community.contributing_present'
  | 'community.code_of_conduct_present'
  | 'community.issue_template_present'
  | 'community.pull_request_template_present'
  | 'community.security_policy_present'
  | 'momentum.stars_delta_7d'
  | 'momentum.stars_delta_30d'
  | 'momentum.forks_delta_30d'
  | 'context.open_issues_delta_30d';

export type RepositoryRankingSignalDefinition = Readonly<{
  id: RepositoryRankingSignalId;
  source: RepositoryRankingSignalSource;
  role: RepositoryRankingSignalRole;
  valueType: 'number' | 'boolean';
  modes: readonly RepositoryRankingMode[];
  description: string;
}>;

export const REPOSITORY_RANKING_SIGNAL_DEFINITIONS: readonly RepositoryRankingSignalDefinition[] =
  Object.freeze([
    {
      id: 'visibility.stars_total',
      source: 'github_current',
      role: 'visibility',
      valueType: 'number',
      modes: ['hidden_gems', 'rising'],
      description:
        'Current measured GitHub star count. Visibility context, not quality.',
    },
    {
      id: 'visibility.forks_total',
      source: 'github_current',
      role: 'visibility',
      valueType: 'number',
      modes: ['hidden_gems', 'rising'],
      description:
        'Current measured GitHub fork count. Visibility/community context.',
    },
    {
      id: 'maintenance.days_since_push',
      source: 'reposcout_derived_current',
      role: 'maintenance',
      valueType: 'number',
      modes: ['hidden_gems', 'rising'],
      description:
        'Whole UTC days since GitHub pushed_at as of the ranking evaluation time.',
    },
    {
      id: 'documentation.readme_present',
      source: 'github_evidence',
      role: 'documentation',
      valueType: 'boolean',
      modes: ['hidden_gems'],
      description:
        'Whether GitHub exposed a README, including a README too large to ingest.',
    },
    {
      id: 'community.contributing_present',
      source: 'github_evidence',
      role: 'community',
      valueType: 'boolean',
      modes: ['hidden_gems'],
      description: 'Whether GitHub community evidence includes CONTRIBUTING guidance.',
    },
    {
      id: 'community.code_of_conduct_present',
      source: 'github_evidence',
      role: 'community',
      valueType: 'boolean',
      modes: ['hidden_gems'],
      description: 'Whether GitHub community evidence includes a code of conduct.',
    },
    {
      id: 'community.issue_template_present',
      source: 'github_evidence',
      role: 'community',
      valueType: 'boolean',
      modes: ['hidden_gems'],
      description: 'Whether GitHub community evidence includes an issue template.',
    },
    {
      id: 'community.pull_request_template_present',
      source: 'github_evidence',
      role: 'community',
      valueType: 'boolean',
      modes: ['hidden_gems'],
      description:
        'Whether GitHub community evidence includes a pull request template.',
    },
    {
      id: 'community.security_policy_present',
      source: 'github_evidence',
      role: 'community',
      valueType: 'boolean',
      modes: ['hidden_gems'],
      description: 'Whether GitHub repository evidence includes a security policy.',
    },
    {
      id: 'momentum.stars_delta_7d',
      source: 'reposcout_derived_history',
      role: 'momentum',
      valueType: 'number',
      modes: ['hidden_gems', 'rising'],
      description:
        'Signed star-count change across the Phase 6 explicit 7-day trend window.',
    },
    {
      id: 'momentum.stars_delta_30d',
      source: 'reposcout_derived_history',
      role: 'momentum',
      valueType: 'number',
      modes: ['hidden_gems', 'rising'],
      description:
        'Signed star-count change across the Phase 6 explicit 30-day trend window.',
    },
    {
      id: 'momentum.forks_delta_30d',
      source: 'reposcout_derived_history',
      role: 'momentum',
      valueType: 'number',
      modes: ['hidden_gems', 'rising'],
      description:
        'Signed fork-count change across the Phase 6 explicit 30-day trend window.',
    },
    {
      id: 'context.open_issues_delta_30d',
      source: 'reposcout_derived_history',
      role: 'context',
      valueType: 'number',
      modes: ['hidden_gems', 'rising'],
      description:
        'Signed GitHub open_issues_count change over the explicit 30-day trend window. Context only; direction is not inherently good or bad.',
    },
  ]);


export type RepositoryRankingModeContract = Readonly<{
  mode: RepositoryRankingMode;
  contractVersion: string;
  primarySignals: readonly RepositoryRankingSignalId[];
  supportingSignals: readonly RepositoryRankingSignalId[];
  contextSignals: readonly RepositoryRankingSignalId[];
}>;

export const REPOSITORY_RANKING_MODE_CONTRACTS: Readonly<
  Record<RepositoryRankingMode, RepositoryRankingModeContract>
> = Object.freeze({
  hidden_gems: Object.freeze({
    mode: 'hidden_gems',
    contractVersion: 'hidden-gems-signals-v1',
    primarySignals: Object.freeze([
      'visibility.stars_total',
      'maintenance.days_since_push',
      'documentation.readme_present',
      'community.contributing_present',
    ]),
    supportingSignals: Object.freeze([
      'visibility.forks_total',
      'community.code_of_conduct_present',
      'community.issue_template_present',
      'community.pull_request_template_present',
      'community.security_policy_present',
      'momentum.stars_delta_30d',
      'momentum.forks_delta_30d',
    ]),
    contextSignals: Object.freeze([
      'momentum.stars_delta_7d',
      'context.open_issues_delta_30d',
    ]),
  }),
  rising: Object.freeze({
    mode: 'rising',
    contractVersion: 'rising-signals-v1',
    primarySignals: Object.freeze([
      'momentum.stars_delta_7d',
      'momentum.stars_delta_30d',
      'momentum.forks_delta_30d',
    ]),
    supportingSignals: Object.freeze([
      'maintenance.days_since_push',
      'visibility.stars_total',
      'visibility.forks_total',
    ]),
    contextSignals: Object.freeze([
      'context.open_issues_delta_30d',
    ]),
  }),
});

export type RepositoryRankingSignalMissingReason =
  | 'not_collected'
  | 'unavailable'
  | 'not_applicable'
  | 'insufficient_history';

export type RepositoryRankingTrendProvenance = Readonly<{
  requestedWindowDays: 7 | 30;
  actualWindowDays: number;
  baselineCapturedOn: string;
  latestCapturedOn: string;
}>;

export type RepositoryRankingSignalObservation =
  | Readonly<{
      id: RepositoryRankingSignalId;
      availability: 'available';
      value: number | boolean;
      provenance: RepositoryRankingTrendProvenance | null;
    }>
  | Readonly<{
      id: RepositoryRankingSignalId;
      availability: 'missing';
      reason: RepositoryRankingSignalMissingReason;
      provenance: null;
    }>;

export type RepositoryRankingSignalSnapshot = Readonly<{
  contractVersion: typeof REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION;
  repositoryId: string;
  evaluatedAt: Date;
  signals: Readonly<Record<
    RepositoryRankingSignalId,
    RepositoryRankingSignalObservation
  >>;
}>;

export type BuildRepositoryRankingSignalInput = Readonly<{
  evaluatedAt: Date;
  repository: Pick<
    RepositoryRecord,
    'id' | 'pushedAtGithub'
  >;
  metadata: Pick<
    RepositoryMetadataRecord,
    'stars' | 'forks'
  > | null;
  readme: Pick<RepositoryReadmeRecord, 'status'> | null;
  contributionEvidence: Pick<
    RepositoryContributionEvidenceRecord,
    | 'status'
    | 'contributing'
    | 'codeOfConduct'
    | 'issueTemplate'
    | 'pullRequestTemplate'
    | 'securityPolicy'
  > | null;
  trend7d: RepositoryTrendResult | null;
  trend30d: RepositoryTrendResult | null;
}>;

const DAY_MS = 86_400_000;

function available(
  id: RepositoryRankingSignalId,
  value: number | boolean,
  provenance: RepositoryRankingTrendProvenance | null = null,
): RepositoryRankingSignalObservation {
  return {
    id,
    availability: 'available',
    value,
    provenance,
  };
}

function missing(
  id: RepositoryRankingSignalId,
  reason: RepositoryRankingSignalMissingReason,
): RepositoryRankingSignalObservation {
  return {
    id,
    availability: 'missing',
    reason,
    provenance: null,
  };
}

function trendSignal(
  id: RepositoryRankingSignalId,
  trend: RepositoryTrendResult | null,
  expectedWindowDays: 7 | 30,
  metric: 'stars' | 'forks' | 'openIssues',
): RepositoryRankingSignalObservation {
  if (trend === null) {
    return missing(id, 'not_collected');
  }

  if (trend.requestedWindowDays !== expectedWindowDays) {
    throw new Error(
      `${id} requires a ${expectedWindowDays}-day trend result.`,
    );
  }

  if (trend.status !== 'complete') {
    return missing(id, 'insufficient_history');
  }

  return available(id, trend.delta[metric], {
    requestedWindowDays: expectedWindowDays,
    actualWindowDays: trend.actualWindowDays,
    baselineCapturedOn: trend.baseline.capturedOn,
    latestCapturedOn: trend.latest.capturedOn,
  });
}

function contributionPresence(
  id: RepositoryRankingSignalId,
  evidence: BuildRepositoryRankingSignalInput['contributionEvidence'],
  field:
    | 'contributing'
    | 'codeOfConduct'
    | 'issueTemplate'
    | 'pullRequestTemplate'
    | 'securityPolicy',
): RepositoryRankingSignalObservation {
  if (evidence === null) {
    return missing(id, 'not_collected');
  }

  if (evidence.status === 'UNSUPPORTED_FORK') {
    return missing(id, 'not_applicable');
  }

  return available(id, evidence[field] !== null);
}

export function buildRepositoryRankingSignalSnapshot(
  input: BuildRepositoryRankingSignalInput,
): RepositoryRankingSignalSnapshot {
  if (
    !(input.evaluatedAt instanceof Date) ||
    Number.isNaN(input.evaluatedAt.getTime())
  ) {
    throw new Error('evaluatedAt must be a valid date.');
  }

  const daysSincePush =
    input.repository.pushedAtGithub === null
      ? missing('maintenance.days_since_push', 'unavailable')
      : available(
          'maintenance.days_since_push',
          Math.max(
            0,
            Math.floor(
              (input.evaluatedAt.getTime() -
                input.repository.pushedAtGithub.getTime()) /
                DAY_MS,
            ),
          ),
        );

  const readmePresence =
    input.readme === null
      ? missing('documentation.readme_present', 'not_collected')
      : available(
          'documentation.readme_present',
          input.readme.status !== 'NOT_FOUND',
        );

  const signals: Record<
    RepositoryRankingSignalId,
    RepositoryRankingSignalObservation
  > = {
    'visibility.stars_total':
      input.metadata === null
        ? missing('visibility.stars_total', 'not_collected')
        : available('visibility.stars_total', input.metadata.stars),
    'visibility.forks_total':
      input.metadata === null
        ? missing('visibility.forks_total', 'not_collected')
        : available('visibility.forks_total', input.metadata.forks),
    'maintenance.days_since_push': daysSincePush,
    'documentation.readme_present': readmePresence,
    'community.contributing_present': contributionPresence(
      'community.contributing_present',
      input.contributionEvidence,
      'contributing',
    ),
    'community.code_of_conduct_present': contributionPresence(
      'community.code_of_conduct_present',
      input.contributionEvidence,
      'codeOfConduct',
    ),
    'community.issue_template_present': contributionPresence(
      'community.issue_template_present',
      input.contributionEvidence,
      'issueTemplate',
    ),
    'community.pull_request_template_present': contributionPresence(
      'community.pull_request_template_present',
      input.contributionEvidence,
      'pullRequestTemplate',
    ),
    'community.security_policy_present': contributionPresence(
      'community.security_policy_present',
      input.contributionEvidence,
      'securityPolicy',
    ),
    'momentum.stars_delta_7d': trendSignal(
      'momentum.stars_delta_7d',
      input.trend7d,
      7,
      'stars',
    ),
    'momentum.stars_delta_30d': trendSignal(
      'momentum.stars_delta_30d',
      input.trend30d,
      30,
      'stars',
    ),
    'momentum.forks_delta_30d': trendSignal(
      'momentum.forks_delta_30d',
      input.trend30d,
      30,
      'forks',
    ),
    'context.open_issues_delta_30d': trendSignal(
      'context.open_issues_delta_30d',
      input.trend30d,
      30,
      'openIssues',
    ),
  };

  return {
    contractVersion: REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION,
    repositoryId: input.repository.id,
    evaluatedAt: input.evaluatedAt,
    signals,
  };
}
