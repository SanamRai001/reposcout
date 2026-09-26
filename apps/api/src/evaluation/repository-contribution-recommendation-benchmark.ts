import {
  buildContributionDiscoverySignalSnapshot,
  type ContributionDiscoverySignalSnapshot,
} from '../repositories/repository-contribution-signals.js';
import type {
  ContributionRecommendationCautionCode,
  ContributionRecommendationEvidenceCode,
  ContributionRecommendationStatus,
} from '../repositories/repository-contribution-recommendation.js';

export const CONTRIBUTION_RECOMMENDATION_BENCHMARK_VERSION =
  'contribution-recommendation-benchmark-v1' as const;

export type ContributionRecommendationBenchmarkCase = Readonly<{
  id: string;
  snapshot: ContributionDiscoverySignalSnapshot;
  rationale: string;
}>;

export type ContributionRecommendationBenchmarkExpectation =
  Readonly<{
    id: string;
    caseId: string;
    expectedStatus: ContributionRecommendationStatus;
    requiredEvidenceCodes?: readonly ContributionRecommendationEvidenceCode[];
    requiredCautionCodes?: readonly ContributionRecommendationCautionCode[];
    rationale: string;
  }>;

export type ContributionRecommendationBenchmark = Readonly<{
  version: typeof CONTRIBUTION_RECOMMENDATION_BENCHMARK_VERSION;
  cases: readonly ContributionRecommendationBenchmarkCase[];
  expectations: readonly ContributionRecommendationBenchmarkExpectation[];
  riskProbes: readonly Readonly<{
    id: string;
    caseId: string;
    rationale: string;
  }>[];
}>;

const EVALUATED_AT = new Date('2026-09-26T12:00:00.000Z');
const DAY_MS = 86_400_000;

const CONTRIBUTING_PRESENT = {
  status: 'OBSERVED' as const,
  contributing: {
    apiUrl:
      'https://api.github.com/repos/contribution-fixture/project/community',
    htmlUrl:
      'https://github.com/contribution-fixture/project/blob/main/CONTRIBUTING.md',
  },
  codeOfConduct: null,
  issueTemplate: null,
  pullRequestTemplate: null,
};

const CONTRIBUTING_ABSENT = {
  status: 'OBSERVED' as const,
  contributing: null,
  codeOfConduct: null,
  issueTemplate: null,
  pullRequestTemplate: null,
};

type CaseOverrides = Readonly<{
  labels?: readonly string[];
  state?: 'open' | 'closed';
  locked?: boolean;
  assigneeCount?: number;
  daysSinceUpdate?: number;
  repositoryEvidence?:
    | typeof CONTRIBUTING_PRESENT
    | typeof CONTRIBUTING_ABSENT
    | null;
}>;

function benchmarkCase(
  id: string,
  overrides: CaseOverrides,
  rationale: string,
): ContributionRecommendationBenchmarkCase {
  const daysSinceUpdate = overrides.daysSinceUpdate ?? 2;

  return {
    id,
    snapshot: buildContributionDiscoverySignalSnapshot({
      repositoryId: `repository-${id}`,
      evaluatedAt: EVALUATED_AT,
      issue: {
        githubIssueId: `issue-${id}`,
        number: 1,
        title: `Benchmark issue ${id}`,
        state: overrides.state ?? 'open',
        locked: overrides.locked ?? false,
        assigneeCount: overrides.assigneeCount ?? 0,
        commentCount: 2,
        labels: overrides.labels ?? ['good first issue'],
        createdAt: new Date(
          EVALUATED_AT.getTime() - 180 * DAY_MS,
        ),
        updatedAt: new Date(
          EVALUATED_AT.getTime() - daysSinceUpdate * DAY_MS,
        ),
      },
      repositoryEvidence:
        overrides.repositoryEvidence === undefined
          ? CONTRIBUTING_PRESENT
          : overrides.repositoryEvidence,
    }),
    rationale,
  };
}

const cases = [
  benchmarkCase(
    'good-first-strong',
    {},
    'Fresh open, unassigned, unlocked issue with a good-first-issue hint.',
  ),
  benchmarkCase(
    'help-wanted-strong',
    { labels: ['help-wanted'] },
    'Fresh open, unassigned, unlocked issue with a help-wanted hint.',
  ),
  benchmarkCase(
    'no-entry-hint',
    { labels: ['documentation'] },
    'Availability is favorable but no recognized maintainer entry hint exists.',
  ),
  benchmarkCase(
    'assigned',
    { assigneeCount: 1 },
    'A matching issue already has a GitHub assignee.',
  ),
  benchmarkCase(
    'locked',
    { locked: true },
    'A matching issue has a locked discussion.',
  ),
  benchmarkCase(
    'freshness-boundary',
    { daysSinceUpdate: 90 },
    'Exactly 90 days since update remains inside the v1 freshness horizon.',
  ),
  benchmarkCase(
    'stale',
    { daysSinceUpdate: 91 },
    'Ninety-one days since update falls outside the v1 freshness horizon.',
  ),
  benchmarkCase(
    'process-evidence-missing',
    { repositoryEvidence: null },
    'Missing CONTRIBUTING evidence is a caution but must not masquerade as negative observed evidence.',
  ),
  benchmarkCase(
    'contributing-absent',
    { repositoryEvidence: CONTRIBUTING_ABSENT },
    'Observed CONTRIBUTING absence is a caution but not proof the issue is unsuitable.',
  ),
  benchmarkCase(
    'closed',
    { state: 'closed' },
    'Closed observations must never receive the consider status.',
  ),
] satisfies readonly ContributionRecommendationBenchmarkCase[];

export const contributionRecommendationBenchmark:
  ContributionRecommendationBenchmark = {
    version: CONTRIBUTION_RECOMMENDATION_BENCHMARK_VERSION,
    cases,
    expectations: [
      {
        id: 'good-first-strong-is-consider',
        caseId: 'good-first-strong',
        expectedStatus: 'consider',
        requiredEvidenceCodes: [
          'good_first_issue_hint',
          'issue_unassigned',
          'discussion_unlocked',
          'recently_updated',
        ],
        rationale:
          'The strongest currently measured factual pattern should be surfaced for consideration.',
      },
      {
        id: 'help-wanted-can-enter-consider',
        caseId: 'help-wanted-strong',
        expectedStatus: 'consider',
        requiredEvidenceCodes: ['help_wanted_hint'],
        rationale:
          'A help-wanted hint is an explicit maintainer/community entry hint even when good-first-issue is absent.',
      },
      {
        id: 'no-entry-hint-needs-review',
        caseId: 'no-entry-hint',
        expectedStatus: 'needs_review',
        requiredCautionCodes: ['no_entry_hint'],
        rationale:
          'RepoScout should not invent contribution intent when neither supported entry hint is observed.',
      },
      {
        id: 'assigned-needs-review',
        caseId: 'assigned',
        expectedStatus: 'needs_review',
        requiredCautionCodes: ['issue_assigned'],
        rationale:
          'Assignment is a factual caution against automatically surfacing the issue for consideration.',
      },
      {
        id: 'locked-needs-review',
        caseId: 'locked',
        expectedStatus: 'needs_review',
        requiredCautionCodes: ['discussion_locked'],
        rationale:
          'A locked discussion requires manual review rather than a consider recommendation.',
      },
      {
        id: 'freshness-boundary-is-inclusive',
        caseId: 'freshness-boundary',
        expectedStatus: 'consider',
        requiredEvidenceCodes: ['recently_updated'],
        rationale:
          'The documented 90-day horizon is inclusive and deterministic.',
      },
      {
        id: 'stale-needs-review',
        caseId: 'stale',
        expectedStatus: 'needs_review',
        requiredCautionCodes: ['stale_update'],
        rationale:
          'Older updates require manual review because freshness is only contextual activity evidence.',
      },
      {
        id: 'missing-process-evidence-does-not-become-false',
        caseId: 'process-evidence-missing',
        expectedStatus: 'consider',
        requiredCautionCodes: ['contributing_evidence_missing'],
        rationale:
          'Missing repository process evidence must remain a caution rather than silently becoming observed absence.',
      },
      {
        id: 'observed-contributing-absence-is-not-a-veto',
        caseId: 'contributing-absent',
        expectedStatus: 'consider',
        requiredCautionCodes: ['contributing_guidance_absent'],
        rationale:
          'A missing CONTRIBUTING file alone is not enough evidence to reject an otherwise matching issue.',
      },
      {
        id: 'closed-needs-review',
        caseId: 'closed',
        expectedStatus: 'needs_review',
        requiredCautionCodes: ['issue_closed'],
        rationale:
          'The recommendation helper remains conservative even outside the public open-only discovery boundary.',
      },
    ],
    riskProbes: [
      {
        id: 'entry-label-is-not-difficulty-ground-truth',
        caseId: 'good-first-strong',
        rationale:
          'A good-first-issue label is a maintainer/community hint; issue complexity and required expertise are still unmeasured.',
      },
      {
        id: 'freshness-is-not-maintainer-responsiveness',
        caseId: 'help-wanted-strong',
        rationale:
          'A recent update does not measure maintainer response latency, contributor success, or likely merge outcome.',
      },
    ],
  };
