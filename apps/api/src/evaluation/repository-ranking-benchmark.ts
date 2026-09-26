import type {
  RepositoryRankingSignalId,
  RepositoryRankingSignalObservation,
  RepositoryRankingSignalSnapshot,
  RepositoryRankingTrendProvenance,
} from '../repositories/repository-ranking-signals.js';

export const REPOSITORY_RANKING_BENCHMARK_VERSION =
  'ranking-benchmark-v1' as const;

export type RepositoryRankingBenchmarkMode =
  | 'hidden_gems'
  | 'rising';

export type RepositoryRankingBenchmarkCase = Readonly<{
  id: string;
  mode: RepositoryRankingBenchmarkMode;
  snapshot: RepositoryRankingSignalSnapshot;
  rationale: string;
}>;

export type RepositoryRankingBenchmarkExpectation =
  | Readonly<{
      id: string;
      kind: 'eligibility';
      caseId: string;
      expectedStatus: 'eligible' | 'ineligible';
      rationale: string;
    }>
  | Readonly<{
      id: string;
      kind: 'pairwise';
      betterCaseId: string;
      worseCaseId: string;
      relation: 'greater' | 'equal';
      tolerance?: number;
      rationale: string;
    }>;

export type RepositoryRankingBenchmarkRiskProbe = Readonly<{
  id: string;
  mode: RepositoryRankingBenchmarkMode;
  caseId: string;
  compareCaseId?: string;
  rationale: string;
}>;

export type RepositoryRankingBenchmark = Readonly<{
  version: typeof REPOSITORY_RANKING_BENCHMARK_VERSION;
  cases: readonly RepositoryRankingBenchmarkCase[];
  expectations: readonly RepositoryRankingBenchmarkExpectation[];
  riskProbes: readonly RepositoryRankingBenchmarkRiskProbe[];
}>;

const evaluatedAt = new Date('2026-09-26T12:00:00.000Z');

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
  reason:
    | 'not_collected'
    | 'unavailable'
    | 'not_applicable'
    | 'insufficient_history',
): RepositoryRankingSignalObservation {
  return {
    id,
    availability: 'missing',
    reason,
    provenance: null,
  };
}

function trendProvenance(
  requestedWindowDays: 7 | 30,
  actualWindowDays = requestedWindowDays,
): RepositoryRankingTrendProvenance {
  return {
    requestedWindowDays,
    actualWindowDays,
    baselineCapturedOn:
      requestedWindowDays === 7 ? '2026-09-19' : '2026-08-27',
    latestCapturedOn: '2026-09-26',
  };
}

type SnapshotOverrides = Partial<
  Record<RepositoryRankingSignalId, RepositoryRankingSignalObservation>
>;

function rankingSnapshot(
  repositoryId: string,
  overrides: SnapshotOverrides = {},
): RepositoryRankingSignalSnapshot {
  const defaults: Record<
    RepositoryRankingSignalId,
    RepositoryRankingSignalObservation
  > = {
    'visibility.stars_total': available(
      'visibility.stars_total',
      200,
    ),
    'visibility.forks_total': available(
      'visibility.forks_total',
      15,
    ),
    'maintenance.days_since_push': available(
      'maintenance.days_since_push',
      14,
    ),
    'documentation.readme_present': available(
      'documentation.readme_present',
      true,
    ),
    'community.contributing_present': available(
      'community.contributing_present',
      true,
    ),
    'community.code_of_conduct_present': available(
      'community.code_of_conduct_present',
      true,
    ),
    'community.issue_template_present': available(
      'community.issue_template_present',
      true,
    ),
    'community.pull_request_template_present': available(
      'community.pull_request_template_present',
      true,
    ),
    'community.security_policy_present': available(
      'community.security_policy_present',
      true,
    ),
    'momentum.stars_delta_7d': available(
      'momentum.stars_delta_7d',
      10,
      trendProvenance(7),
    ),
    'momentum.stars_delta_30d': available(
      'momentum.stars_delta_30d',
      40,
      trendProvenance(30),
    ),
    'momentum.forks_delta_30d': available(
      'momentum.forks_delta_30d',
      5,
      trendProvenance(30),
    ),
    'context.open_issues_delta_30d': available(
      'context.open_issues_delta_30d',
      0,
      trendProvenance(30),
    ),
  };

  return {
    contractVersion: 'ranking-signals-v1',
    repositoryId,
    evaluatedAt,
    signals: {
      ...defaults,
      ...overrides,
    },
  };
}

function candidate(
  id: string,
  mode: RepositoryRankingBenchmarkMode,
  repositoryId: string,
  overrides: SnapshotOverrides,
  rationale: string,
): RepositoryRankingBenchmarkCase {
  return {
    id,
    mode,
    snapshot: rankingSnapshot(repositoryId, overrides),
    rationale,
  };
}

const hiddenGemCases: RepositoryRankingBenchmarkCase[] = [
  candidate(
    'hg-small-healthy',
    'hidden_gems',
    '10000000-0000-4000-8000-000000000001',
    {
      'visibility.stars_total': available(
        'visibility.stars_total',
        180,
      ),
      'visibility.forks_total': available(
        'visibility.forks_total',
        12,
      ),
      'maintenance.days_since_push': available(
        'maintenance.days_since_push',
        14,
      ),
      'momentum.stars_delta_30d': available(
        'momentum.stars_delta_30d',
        8,
        trendProvenance(30),
      ),
      'momentum.forks_delta_30d': available(
        'momentum.forks_delta_30d',
        1,
        trendProvenance(30),
      ),
    },
    'Healthy, maintained, well-documented repository with low existing visibility.',
  ),
  candidate(
    'hg-famous-same-evidence',
    'hidden_gems',
    '10000000-0000-4000-8000-000000000002',
    {
      'visibility.stars_total': available(
        'visibility.stars_total',
        50_000,
      ),
      'visibility.forks_total': available(
        'visibility.forks_total',
        12,
      ),
      'maintenance.days_since_push': available(
        'maintenance.days_since_push',
        14,
      ),
      'momentum.stars_delta_30d': available(
        'momentum.stars_delta_30d',
        8,
        trendProvenance(30),
      ),
      'momentum.forks_delta_30d': available(
        'momentum.forks_delta_30d',
        1,
        trendProvenance(30),
      ),
    },
    'Same health evidence as hg-small-healthy but already highly visible.',
  ),
  candidate(
    'hg-obscure-empty',
    'hidden_gems',
    '10000000-0000-4000-8000-000000000003',
    {
      'visibility.stars_total': available(
        'visibility.stars_total',
        5,
      ),
      'visibility.forks_total': available(
        'visibility.forks_total',
        0,
      ),
      'maintenance.days_since_push': available(
        'maintenance.days_since_push',
        500,
      ),
      'documentation.readme_present': available(
        'documentation.readme_present',
        false,
      ),
      'community.contributing_present': available(
        'community.contributing_present',
        false,
      ),
      'community.code_of_conduct_present': available(
        'community.code_of_conduct_present',
        false,
      ),
      'community.issue_template_present': available(
        'community.issue_template_present',
        false,
      ),
      'community.pull_request_template_present': available(
        'community.pull_request_template_present',
        false,
      ),
      'community.security_policy_present': available(
        'community.security_policy_present',
        false,
      ),
      'momentum.stars_delta_30d': missing(
        'momentum.stars_delta_30d',
        'insufficient_history',
      ),
      'momentum.forks_delta_30d': missing(
        'momentum.forks_delta_30d',
        'insufficient_history',
      ),
    },
    'Very low visibility without supporting maintenance or community evidence.',
  ),
  candidate(
    'hg-stable-supported',
    'hidden_gems',
    '10000000-0000-4000-8000-000000000004',
    {
      'visibility.stars_total': available(
        'visibility.stars_total',
        220,
      ),
      'maintenance.days_since_push': available(
        'maintenance.days_since_push',
        180,
      ),
      'momentum.stars_delta_30d': available(
        'momentum.stars_delta_30d',
        0,
        trendProvenance(30),
      ),
      'momentum.forks_delta_30d': available(
        'momentum.forks_delta_30d',
        0,
        trendProvenance(30),
      ),
    },
    'Small mature repository with strong community readiness but little recent growth.',
  ),
  candidate(
    'hg-missing-required-evidence',
    'hidden_gems',
    '10000000-0000-4000-8000-000000000005',
    {
      'documentation.readme_present': missing(
        'documentation.readme_present',
        'not_collected',
      ),
      'community.contributing_present': missing(
        'community.contributing_present',
        'not_collected',
      ),
    },
    'Repository whose required evidence has not been collected.',
  ),
  candidate(
    'hg-history-missing-but-healthy',
    'hidden_gems',
    '10000000-0000-4000-8000-000000000006',
    {
      'momentum.stars_delta_30d': missing(
        'momentum.stars_delta_30d',
        'insufficient_history',
      ),
      'momentum.forks_delta_30d': missing(
        'momentum.forks_delta_30d',
        'insufficient_history',
      ),
    },
    'Healthy repository that should remain Hidden-Gems eligible before 30 days of history exist.',
  ),
  candidate(
    'hg-community-thin',
    'hidden_gems',
    '10000000-0000-4000-8000-000000000007',
    {
      'community.code_of_conduct_present': available(
        'community.code_of_conduct_present',
        false,
      ),
      'community.issue_template_present': available(
        'community.issue_template_present',
        false,
      ),
      'community.pull_request_template_present': available(
        'community.pull_request_template_present',
        false,
      ),
      'community.security_policy_present': available(
        'community.security_policy_present',
        false,
      ),
    },
    'Same base health as the default but without optional community-readiness files.',
  ),
];

const risingCases: RepositoryRankingBenchmarkCase[] = [
  candidate(
    'rising-small-strong',
    'rising',
    '20000000-0000-4000-8000-000000000001',
    {
      'visibility.stars_total': available(
        'visibility.stars_total',
        120,
      ),
      'visibility.forks_total': available(
        'visibility.forks_total',
        10,
      ),
      'maintenance.days_since_push': available(
        'maintenance.days_since_push',
        2,
      ),
      'momentum.stars_delta_7d': available(
        'momentum.stars_delta_7d',
        20,
        trendProvenance(7),
      ),
      'momentum.stars_delta_30d': available(
        'momentum.stars_delta_30d',
        80,
        trendProvenance(30),
      ),
      'momentum.forks_delta_30d': available(
        'momentum.forks_delta_30d',
        10,
        trendProvenance(30),
      ),
    },
    'Small repository with strong balanced measured momentum.',
  ),
  candidate(
    'rising-huge-same-momentum',
    'rising',
    '20000000-0000-4000-8000-000000000002',
    {
      'visibility.stars_total': available(
        'visibility.stars_total',
        1_000_000,
      ),
      'visibility.forks_total': available(
        'visibility.forks_total',
        100_000,
      ),
      'maintenance.days_since_push': available(
        'maintenance.days_since_push',
        2,
      ),
      'momentum.stars_delta_7d': available(
        'momentum.stars_delta_7d',
        20,
        trendProvenance(7),
      ),
      'momentum.stars_delta_30d': available(
        'momentum.stars_delta_30d',
        80,
        trendProvenance(30),
      ),
      'momentum.forks_delta_30d': available(
        'momentum.forks_delta_30d',
        10,
        trendProvenance(30),
      ),
    },
    'Huge repository with exactly the same measured momentum as rising-small-strong.',
  ),
  candidate(
    'rising-balanced',
    'rising',
    '20000000-0000-4000-8000-000000000003',
    {
      'maintenance.days_since_push': available(
        'maintenance.days_since_push',
        5,
      ),
      'momentum.stars_delta_7d': available(
        'momentum.stars_delta_7d',
        15,
        trendProvenance(7),
      ),
      'momentum.stars_delta_30d': available(
        'momentum.stars_delta_30d',
        80,
        trendProvenance(30),
      ),
      'momentum.forks_delta_30d': available(
        'momentum.forks_delta_30d',
        10,
        trendProvenance(30),
      ),
    },
    'Balanced short- and medium-window growth with fork adoption.',
  ),
  candidate(
    'rising-short-burst',
    'rising',
    '20000000-0000-4000-8000-000000000004',
    {
      'maintenance.days_since_push': available(
        'maintenance.days_since_push',
        1,
      ),
      'momentum.stars_delta_7d': available(
        'momentum.stars_delta_7d',
        25,
        trendProvenance(7),
      ),
      'momentum.stars_delta_30d': available(
        'momentum.stars_delta_30d',
        25,
        trendProvenance(30),
      ),
      'momentum.forks_delta_30d': available(
        'momentum.forks_delta_30d',
        0,
        trendProvenance(30),
      ),
    },
    'Sharp one-week star burst without matching 30-day or fork momentum.',
  ),
  candidate(
    'rising-weak',
    'rising',
    '20000000-0000-4000-8000-000000000005',
    {
      'maintenance.days_since_push': available(
        'maintenance.days_since_push',
        1,
      ),
      'momentum.stars_delta_7d': available(
        'momentum.stars_delta_7d',
        3,
        trendProvenance(7),
      ),
      'momentum.stars_delta_30d': available(
        'momentum.stars_delta_30d',
        10,
        trendProvenance(30),
      ),
      'momentum.forks_delta_30d': available(
        'momentum.forks_delta_30d',
        1,
        trendProvenance(30),
      ),
    },
    'Fresh repository with weak measured momentum.',
  ),
  candidate(
    'rising-missing-history',
    'rising',
    '20000000-0000-4000-8000-000000000006',
    {
      'momentum.stars_delta_7d': missing(
        'momentum.stars_delta_7d',
        'insufficient_history',
      ),
    },
    'Repository without sufficient seven-day history.',
  ),
  candidate(
    'rising-sparse-normalized',
    'rising',
    '20000000-0000-4000-8000-000000000007',
    {
      'maintenance.days_since_push': available(
        'maintenance.days_since_push',
        10,
      ),
      'momentum.stars_delta_7d': available(
        'momentum.stars_delta_7d',
        27,
        trendProvenance(7, 9),
      ),
      'momentum.stars_delta_30d': available(
        'momentum.stars_delta_30d',
        105,
        trendProvenance(30, 35),
      ),
      'momentum.forks_delta_30d': available(
        'momentum.forks_delta_30d',
        18,
        trendProvenance(30, 35),
      ),
    },
    'Allowed sparse observations that normalize to approximately 21 / 90 / 15.43.',
  ),
  candidate(
    'rising-exact-normalized-peer',
    'rising',
    '20000000-0000-4000-8000-000000000008',
    {
      'maintenance.days_since_push': available(
        'maintenance.days_since_push',
        10,
      ),
      'momentum.stars_delta_7d': available(
        'momentum.stars_delta_7d',
        21,
        trendProvenance(7),
      ),
      'momentum.stars_delta_30d': available(
        'momentum.stars_delta_30d',
        90,
        trendProvenance(30),
      ),
      'momentum.forks_delta_30d': available(
        'momentum.forks_delta_30d',
        15.43,
        trendProvenance(30),
      ),
    },
    'Exact-window peer matching the normalized momentum of rising-sparse-normalized.',
  ),
  candidate(
    'rising-too-sparse',
    'rising',
    '20000000-0000-4000-8000-000000000009',
    {
      'momentum.stars_delta_7d': available(
        'momentum.stars_delta_7d',
        30,
        trendProvenance(7, 10),
      ),
    },
    'Seven-day signal whose actual window exceeds the Rising v1 sparse-history boundary.',
  ),
  candidate(
    'rising-missing-maintenance',
    'rising',
    '20000000-0000-4000-8000-000000000010',
    {
      'maintenance.days_since_push': missing(
        'maintenance.days_since_push',
        'unavailable',
      ),
      'momentum.stars_delta_7d': available(
        'momentum.stars_delta_7d',
        20,
        trendProvenance(7),
      ),
      'momentum.stars_delta_30d': available(
        'momentum.stars_delta_30d',
        80,
        trendProvenance(30),
      ),
      'momentum.forks_delta_30d': available(
        'momentum.forks_delta_30d',
        10,
        trendProvenance(30),
      ),
    },
    'Strong momentum with unavailable maintenance context.',
  ),
  candidate(
    'rising-max-burst-risk',
    'rising',
    '20000000-0000-4000-8000-000000000011',
    {
      'maintenance.days_since_push': available(
        'maintenance.days_since_push',
        0,
      ),
      'momentum.stars_delta_7d': available(
        'momentum.stars_delta_7d',
        10_000,
        trendProvenance(7),
      ),
      'momentum.stars_delta_30d': available(
        'momentum.stars_delta_30d',
        100_000,
        trendProvenance(30),
      ),
      'momentum.forks_delta_30d': available(
        'momentum.forks_delta_30d',
        10_000,
        trendProvenance(30),
      ),
    },
    'Synthetic burst demonstrating that current measured growth cannot distinguish organic from manipulated growth.',
  ),
];

export const repositoryRankingBenchmark: RepositoryRankingBenchmark = {
  version: REPOSITORY_RANKING_BENCHMARK_VERSION,
  cases: [...hiddenGemCases, ...risingCases],
  expectations: [
    {
      id: 'hidden-gems-healthy-beats-equally-healthy-famous',
      kind: 'pairwise',
      betterCaseId: 'hg-small-healthy',
      worseCaseId: 'hg-famous-same-evidence',
      relation: 'greater',
      rationale:
        'With identical health evidence, lower visibility should rank higher in Hidden Gems.',
    },
    {
      id: 'hidden-gems-evidence-beats-obscurity-alone',
      kind: 'pairwise',
      betterCaseId: 'hg-small-healthy',
      worseCaseId: 'hg-obscure-empty',
      relation: 'greater',
      rationale:
        'Low stars alone must not outrank concrete maintenance/documentation/community evidence.',
    },
    {
      id: 'hidden-gems-stable-supported-beats-empty',
      kind: 'pairwise',
      betterCaseId: 'hg-stable-supported',
      worseCaseId: 'hg-obscure-empty',
      relation: 'greater',
      rationale:
        'A mature small repository with strong support evidence should beat an unsupported obscure repository.',
    },
    {
      id: 'hidden-gems-community-evidence-is-monotonic',
      kind: 'pairwise',
      betterCaseId: 'hg-small-healthy',
      worseCaseId: 'hg-community-thin',
      relation: 'greater',
      rationale:
        'Additional observed community-readiness evidence must not reduce the Hidden Gems score.',
    },
    {
      id: 'hidden-gems-missing-required-is-ineligible',
      kind: 'eligibility',
      caseId: 'hg-missing-required-evidence',
      expectedStatus: 'ineligible',
      rationale:
        'Required evidence gaps must not be silently converted to zero.',
    },
    {
      id: 'hidden-gems-missing-history-remains-eligible',
      kind: 'eligibility',
      caseId: 'hg-history-missing-but-healthy',
      expectedStatus: 'eligible',
      rationale:
        'Optional momentum history must not block an otherwise evidenced Hidden Gem.',
    },
    {
      id: 'rising-lifetime-popularity-does-not-change-score',
      kind: 'pairwise',
      betterCaseId: 'rising-small-strong',
      worseCaseId: 'rising-huge-same-momentum',
      relation: 'equal',
      tolerance: 0,
      rationale:
        'Same measured momentum must score equally regardless of lifetime popularity.',
    },
    {
      id: 'rising-balanced-beats-short-burst',
      kind: 'pairwise',
      betterCaseId: 'rising-balanced',
      worseCaseId: 'rising-short-burst',
      relation: 'greater',
      rationale:
        'Balanced 7/30-day growth plus fork adoption should beat an isolated one-week star burst.',
    },
    {
      id: 'rising-strong-beats-weak',
      kind: 'pairwise',
      betterCaseId: 'rising-small-strong',
      worseCaseId: 'rising-weak',
      relation: 'greater',
      rationale:
        'Measured momentum strength must dominate the Rising ranking.',
    },
    {
      id: 'rising-missing-history-is-ineligible',
      kind: 'eligibility',
      caseId: 'rising-missing-history',
      expectedStatus: 'ineligible',
      rationale:
        'Rising requires sufficient primary historical evidence.',
    },
    {
      id: 'rising-too-sparse-is-ineligible',
      kind: 'eligibility',
      caseId: 'rising-too-sparse',
      expectedStatus: 'ineligible',
      rationale:
        'Excessively sparse history must not be extrapolated into a Rising score.',
    },
    {
      id: 'rising-missing-maintenance-remains-eligible',
      kind: 'eligibility',
      caseId: 'rising-missing-maintenance',
      expectedStatus: 'eligible',
      rationale:
        'Maintenance is supporting context and cannot substitute for or block sufficient momentum evidence.',
    },
    {
      id: 'rising-sparse-normalization-matches-exact-peer',
      kind: 'pairwise',
      betterCaseId: 'rising-sparse-normalized',
      worseCaseId: 'rising-exact-normalized-peer',
      relation: 'equal',
      tolerance: 0.05,
      rationale:
        'Allowed sparse windows should score approximately like an exact-window peer after normalization.',
    },
  ],
  riskProbes: [
    {
      id: 'hidden-gems-community-checklist-sensitivity',
      mode: 'hidden_gems',
      caseId: 'hg-small-healthy',
      compareCaseId: 'hg-community-thin',
      rationale:
        'Community-file presence can be cheaply created; the benchmark reports its score exposure but does not pretend file presence proves community quality.',
    },
    {
      id: 'rising-growth-burst-manipulation-risk',
      mode: 'rising',
      caseId: 'rising-max-burst-risk',
      rationale:
        'Current historical counts cannot distinguish organic momentum from artificial star/fork bursts; this requires richer anti-abuse evidence rather than arbitrary weight changes.',
    },
  ],
};
