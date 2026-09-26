import {
  scoreHiddenGemV1,
  HIDDEN_GEM_FORMULA_VERSION,
} from '../repositories/repository-hidden-gem-score.js';
import {
  buildRepositoryRankingSignalSnapshot,
  type BuildRepositoryRankingSignalInput,
  type RepositoryRankingSignalSnapshot,
} from '../repositories/repository-ranking-signals.js';
import {
  scoreRisingV1,
  RISING_FORMULA_VERSION,
} from '../repositories/repository-rising-score.js';
import type { RepositoryTrendResult } from '../repositories/repository-trend.js';

export const RANKING_BENCHMARK_VERSION = 'ranking-benchmark-v1' as const;

const EVALUATED_AT = new Date('2026-09-26T12:00:00.000Z');
const LATEST_CAPTURED_ON = '2026-09-26';

type BenchmarkMode = 'hidden_gems' | 'rising';

export type RankingBenchmarkGuardrail = Readonly<{
  id: string;
  mode: BenchmarkMode;
  passed: boolean;
  expected: string;
  observed: string;
  rationale: string;
}>;

export type RankingBenchmarkDiagnostic = Readonly<{
  id: string;
  mode: BenchmarkMode;
  severity: 'info' | 'watch' | 'risk';
  observed: string;
  rationale: string;
}>;

export type RankingBenchmarkReport = Readonly<{
  benchmarkVersion: typeof RANKING_BENCHMARK_VERSION;
  formulaVersions: Readonly<{
    hiddenGems: typeof HIDDEN_GEM_FORMULA_VERSION;
    rising: typeof RISING_FORMULA_VERSION;
  }>;
  guardrails: readonly RankingBenchmarkGuardrail[];
  diagnostics: readonly RankingBenchmarkDiagnostic[];
  summary: Readonly<{
    guardrailsTotal: number;
    guardrailsPassed: number;
    guardrailsFailed: number;
  }>;
}>;

function dayBeforeLatest(days: number): string {
  const date = new Date('2026-09-26T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function completeTrend(
  repositoryId: string,
  windowDays: 7 | 30,
  input: Readonly<{
    starsDelta: number;
    forksDelta: number;
    actualWindowDays?: number;
  }>,
): RepositoryTrendResult {
  const actualWindowDays = input.actualWindowDays ?? windowDays;
  const baselineOn = dayBeforeLatest(actualWindowDays);

  return {
    status: 'complete',
    repositoryId,
    requestedWindowDays: windowDays,
    cutoffOn: dayBeforeLatest(windowDays),
    actualWindowDays,
    baseline: {
      capturedOn: baselineOn,
      capturedAt: new Date(`${baselineOn}T08:00:00.000Z`),
      stars: 100,
      forks: 10,
      openIssues: 6,
    },
    latest: {
      capturedOn: LATEST_CAPTURED_ON,
      capturedAt: new Date('2026-09-26T08:00:00.000Z'),
      stars: 100 + input.starsDelta,
      forks: 10 + input.forksDelta,
      openIssues: 6,
    },
    delta: {
      stars: input.starsDelta,
      forks: input.forksDelta,
      openIssues: 0,
    },
  };
}

function insufficientTrend(
  repositoryId: string,
  windowDays: 7 | 30,
): RepositoryTrendResult {
  return {
    status: 'insufficient_history',
    reason: 'window_not_covered',
    repositoryId,
    requestedWindowDays: windowDays,
    cutoffOn: dayBeforeLatest(windowDays),
    availableWindowDays: 2,
    oldestAvailable: {
      capturedOn: dayBeforeLatest(2),
      capturedAt: new Date(
        `${dayBeforeLatest(2)}T08:00:00.000Z`,
      ),
      stars: 100,
      forks: 10,
      openIssues: 6,
    },
    latest: {
      capturedOn: LATEST_CAPTURED_ON,
      capturedAt: new Date('2026-09-26T08:00:00.000Z'),
      stars: 101,
      forks: 10,
      openIssues: 6,
    },
  };
}

function communityEvidence(
  present: boolean,
): NonNullable<
  BuildRepositoryRankingSignalInput['contributionEvidence']
> {
  const ref = present
    ? {
        apiUrl: 'https://api.github.com/repos/benchmark/example/community',
        htmlUrl: 'https://github.com/benchmark/example/blob/main/file.md',
      }
    : null;

  return {
    status: 'OBSERVED',
    contributing: ref,
    codeOfConduct: ref,
    issueTemplate: ref,
    pullRequestTemplate: ref,
    securityPolicy: present
      ? {
          sourceRef: 'main',
          path: 'SECURITY.md',
          sha: 'benchmark-security',
          sizeBytes: 100,
        }
      : null,
  };
}

function buildSnapshot(input: Readonly<{
  id: string;
  stars?: number;
  forks?: number;
  daysSincePush?: number | null;
  readmePresent?: boolean | null;
  communityPresent?: boolean | null;
  stars7d?: number | null;
  stars30d?: number | null;
  forks30d?: number | null;
  actual7d?: number;
  actual30d?: number;
}>): RepositoryRankingSignalSnapshot {
  const pushedAtGithub =
    input.daysSincePush === null
      ? null
      : new Date(
          EVALUATED_AT.getTime() -
            (input.daysSincePush ?? 0) * 86_400_000,
        );

  const metadata =
    input.stars === undefined && input.forks === undefined
      ? null
      : {
          stars: input.stars ?? 0,
          forks: input.forks ?? 0,
        };

  const readme =
    input.readmePresent === null
      ? null
      : {
          status: input.readmePresent === false
            ? ('NOT_FOUND' as const)
            : ('PRESENT' as const),
        };

  const contributionEvidence =
    input.communityPresent === null
      ? null
      : communityEvidence(input.communityPresent !== false);

  const trend7d =
    input.stars7d === null
      ? insufficientTrend(input.id, 7)
      : completeTrend(input.id, 7, {
          starsDelta: input.stars7d ?? 0,
          forksDelta: 0,
          actualWindowDays: input.actual7d,
        });

  const trend30d =
    input.stars30d === null || input.forks30d === null
      ? insufficientTrend(input.id, 30)
      : completeTrend(input.id, 30, {
          starsDelta: input.stars30d ?? 0,
          forksDelta: input.forks30d ?? 0,
          actualWindowDays: input.actual30d,
        });

  return buildRepositoryRankingSignalSnapshot({
    evaluatedAt: EVALUATED_AT,
    repository: {
      id: input.id,
      pushedAtGithub,
    },
    metadata,
    readme,
    contributionEvidence,
    trend7d,
    trend30d,
  });
}

function eligibleHidden(
  snapshot: RepositoryRankingSignalSnapshot,
) {
  const result = scoreHiddenGemV1(snapshot);

  if (result.status !== 'eligible') {
    throw new Error('Expected eligible Hidden Gems benchmark case.');
  }

  return result;
}

function eligibleRising(
  snapshot: RepositoryRankingSignalSnapshot,
) {
  const result = scoreRisingV1(snapshot);

  if (result.status !== 'eligible') {
    throw new Error('Expected eligible Rising benchmark case.');
  }

  return result;
}

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

export function runRankingBenchmark(): RankingBenchmarkReport {
  const obscureWeak = eligibleHidden(
    buildSnapshot({
      id: uuid(1),
      stars: 0,
      forks: 0,
      daysSincePush: 730,
      readmePresent: false,
      communityPresent: false,
      stars7d: 0,
      stars30d: 0,
      forks30d: 0,
    }),
  );

  const obscureHealthy = eligibleHidden(
    buildSnapshot({
      id: uuid(2),
      stars: 100,
      forks: 10,
      daysSincePush: 0,
      readmePresent: true,
      communityPresent: true,
      stars7d: 0,
      stars30d: null,
      forks30d: null,
    }),
  );

  const popularHealthy = eligibleHidden(
    buildSnapshot({
      id: uuid(3),
      stars: 50_000,
      forks: 2_000,
      daysSincePush: 0,
      readmePresent: true,
      communityPresent: true,
      stars7d: 0,
      stars30d: null,
      forks30d: null,
    }),
  );

  const missingEvidence = scoreHiddenGemV1(
    buildSnapshot({
      id: uuid(4),
      daysSincePush: 0,
      readmePresent: null,
      communityPresent: null,
      stars7d: 0,
      stars30d: null,
      forks30d: null,
    }),
  );

  const shell = eligibleHidden(
    buildSnapshot({
      id: uuid(5),
      stars: 0,
      forks: 0,
      daysSincePush: 0,
      readmePresent: true,
      communityPresent: true,
      stars7d: 0,
      stars30d: null,
      forks30d: null,
    }),
  );

  const risingSmall = eligibleRising(
    buildSnapshot({
      id: uuid(6),
      stars: 10,
      forks: 1,
      daysSincePush: 0,
      readmePresent: false,
      communityPresent: false,
      stars7d: 25,
      stars30d: 100,
      forks30d: 15,
    }),
  );

  const risingHuge = eligibleRising(
    buildSnapshot({
      id: uuid(7),
      stars: 1_000_000,
      forks: 100_000,
      daysSincePush: 0,
      readmePresent: false,
      communityPresent: false,
      stars7d: 25,
      stars30d: 100,
      forks30d: 15,
    }),
  );

  const risingMissingHistory = scoreRisingV1(
    buildSnapshot({
      id: uuid(8),
      stars: 100,
      forks: 10,
      daysSincePush: 0,
      readmePresent: false,
      communityPresent: false,
      stars7d: null,
      stars30d: 100,
      forks30d: 15,
    }),
  );

  const risingSparse = scoreRisingV1(
    buildSnapshot({
      id: uuid(9),
      stars: 100,
      forks: 10,
      daysSincePush: 0,
      readmePresent: false,
      communityPresent: false,
      stars7d: 40,
      stars30d: 100,
      forks30d: 15,
      actual7d: 10,
    }),
  );

  const risingShortBurst = eligibleRising(
    buildSnapshot({
      id: uuid(10),
      stars: 100,
      forks: 10,
      daysSincePush: 0,
      readmePresent: false,
      communityPresent: false,
      stars7d: 25,
      stars30d: 25,
      forks30d: 0,
    }),
  );

  const risingBroad = eligibleRising(
    buildSnapshot({
      id: uuid(11),
      stars: 100,
      forks: 10,
      daysSincePush: 0,
      readmePresent: false,
      communityPresent: false,
      stars7d: 25,
      stars30d: 100,
      forks30d: 15,
    }),
  );

  const risingFlat = eligibleRising(
    buildSnapshot({
      id: uuid(12),
      stars: 500_000,
      forks: 50_000,
      daysSincePush: 0,
      readmePresent: false,
      communityPresent: false,
      stars7d: 0,
      stars30d: 0,
      forks30d: 0,
    }),
  );

  const guardrails: RankingBenchmarkGuardrail[] = [
    {
      id: 'hidden-obscurity-alone-is-not-quality',
      mode: 'hidden_gems',
      passed: obscureWeak.score === 0,
      expected: 'An obscure stale repository with observed absent evidence scores 0.',
      observed: `score=${obscureWeak.score}`,
      rationale:
        'Hidden Gems must not award quality points simply because a repository has few stars.',
    },
    {
      id: 'hidden-popularity-saturation-is-bounded',
      mode: 'hidden_gems',
      passed:
        obscureHealthy.score > popularHealthy.score &&
        obscureHealthy.score - popularHealthy.score === 25,
      expected:
        'Equal healthy evidence loses at most the 25-point saturation penalty at 50k+ stars.',
      observed:
        `obscure=${obscureHealthy.score}, popular=${popularHealthy.score}, difference=${obscureHealthy.score - popularHealthy.score}`,
      rationale:
        'Popularity should reduce hiddenness without erasing all repository-health evidence.',
    },
    {
      id: 'hidden-missing-required-evidence-stays-ineligible',
      mode: 'hidden_gems',
      passed: missingEvidence.status === 'ineligible',
      expected: 'Missing required evidence is ineligible.',
      observed: `status=${missingEvidence.status}`,
      rationale:
        'Unknown evidence must not silently become a measured false/zero value.',
    },
    {
      id: 'hidden-missing-history-remains-eligible',
      mode: 'hidden_gems',
      passed:
        obscureHealthy.optionalMomentumCoverage.available === 0 &&
        obscureHealthy.optionalMomentumCoverage.expected === 2,
      expected:
        'A well-evidenced repository without 30-day history remains eligible with zero optional momentum coverage.',
      observed:
        `score=${obscureHealthy.score}, momentumCoverage=${obscureHealthy.optionalMomentumCoverage.available}/${obscureHealthy.optionalMomentumCoverage.expected}`,
      rationale:
        'Hidden Gems should not collapse into a momentum-only ranking.',
    },
    {
      id: 'rising-lifetime-popularity-does-not-change-score',
      mode: 'rising',
      passed: risingSmall.score === risingHuge.score,
      expected:
        'Identical momentum produces the same Rising score regardless of lifetime stars/forks.',
      observed:
        `small=${risingSmall.score}, huge=${risingHuge.score}`,
      rationale:
        'Rising must remain a growth ranking rather than a popularity leaderboard.',
    },
    {
      id: 'rising-primary-history-is-required',
      mode: 'rising',
      passed: risingMissingHistory.status === 'ineligible',
      expected: 'Missing 7-day primary history is ineligible.',
      observed: `status=${risingMissingHistory.status}`,
      rationale:
        'Lifetime popularity or maintenance cannot substitute for missing measured growth.',
    },
    {
      id: 'rising-excessive-sparse-history-is-rejected',
      mode: 'rising',
      passed:
        risingSparse.status === 'ineligible' &&
        risingSparse.reasons.some(
          (reason) => reason.code === 'history_window_too_sparse',
        ),
      expected: 'A 10-day actual span for a requested 7-day signal is rejected.',
      observed:
        `status=${risingSparse.status}`,
      rationale:
        'Excessively sparse history should not be extrapolated into a confident Rising score.',
    },
    {
      id: 'rising-short-burst-does-not-match-broad-momentum',
      mode: 'rising',
      passed:
        risingShortBurst.score < risingBroad.score &&
        risingShortBurst.score < 80,
      expected:
        'A one-week star burst with weak 30-day breadth scores below 80 and below broad sustained momentum.',
      observed:
        `shortBurst=${risingShortBurst.score}, broad=${risingBroad.score}`,
      rationale:
        'The 7-day component is intentionally strong, but should not single-handedly create a top-tier Rising score.',
    },
    {
      id: 'rising-flat-popular-repository-stays-low',
      mode: 'rising',
      passed: risingFlat.score <= 5,
      expected:
        'A very popular repository with zero measured growth receives at most the 5-point maintenance support.',
      observed: `score=${risingFlat.score}`,
      rationale:
        'Existing scale must not masquerade as current momentum.',
    },
  ];

  const diagnostics: RankingBenchmarkDiagnostic[] = [
    {
      id: 'hidden-community-file-shell',
      mode: 'hidden_gems',
      severity: shell.score >= 85 ? 'risk' : 'watch',
      observed:
        `A fresh zero-star repository with README + contribution/community files but no 30-day history scores ${shell.score}.`,
      rationale:
        'Binary file presence is easy to satisfy with boilerplate. The current signal set cannot distinguish substantive guidance from checkbox files, so this is an anti-gaming risk rather than evidence for an arbitrary weight change.',
    },
    {
      id: 'hidden-binary-evidence-concentration',
      mode: 'hidden_gems',
      severity: 'watch',
      observed:
        'README + CONTRIBUTING + community-readiness files account for 60 of 100 positive v1 points.',
      rationale:
        'This concentration should be revisited when RepoScout has richer evidence such as documentation quality, release consistency, responsiveness, or contribution outcomes.',
    },
    {
      id: 'rising-short-window-concentration',
      mode: 'rising',
      severity: 'info',
      observed:
        `The 7-day star component can contribute 45/100 points; benchmark short-burst score is ${risingShortBurst.score} versus ${risingBroad.score} for broad momentum.`,
      rationale:
        'The current combined 30-day signals keep the synthetic short-burst case below the hard guardrail, but star-burst gaming remains a monitoring target for real-data evaluation.',
    },
  ];

  const guardrailsPassed = guardrails.filter(
    (guardrail) => guardrail.passed,
  ).length;

  return {
    benchmarkVersion: RANKING_BENCHMARK_VERSION,
    formulaVersions: {
      hiddenGems: HIDDEN_GEM_FORMULA_VERSION,
      rising: RISING_FORMULA_VERSION,
    },
    guardrails,
    diagnostics,
    summary: {
      guardrailsTotal: guardrails.length,
      guardrailsPassed,
      guardrailsFailed: guardrails.length - guardrailsPassed,
    },
  };
}
