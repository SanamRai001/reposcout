import {
  repositoryRankingBenchmark,
  type RepositoryRankingBenchmark,
  type RepositoryRankingBenchmarkCase,
  type RepositoryRankingBenchmarkExpectation,
} from './repository-ranking-benchmark.js';
import { scoreHiddenGemV1 } from '../repositories/repository-hidden-gem-score.js';
import { scoreRisingV1 } from '../repositories/repository-rising-score.js';
import type { RepositoryRankingSignalSnapshot } from '../repositories/repository-ranking-signals.js';

export const REPOSITORY_RANKING_BENCHMARK_RUN_SCHEMA_VERSION =
  'ranking-benchmark-run-v1' as const;

export type BenchmarkScoreResult =
  | Readonly<{
      status: 'eligible';
      formulaVersion: string;
      score: number;
    }>
  | Readonly<{
      status: 'ineligible';
      formulaVersion: string;
    }>;

export type RankingBenchmarkScorer = (
  snapshot: RepositoryRankingSignalSnapshot,
) => BenchmarkScoreResult;

export type RepositoryRankingBenchmarkRun = Readonly<{
  schemaVersion: typeof REPOSITORY_RANKING_BENCHMARK_RUN_SCHEMA_VERSION;
  benchmarkVersion: string;
  formulaVersions: Readonly<{
    hiddenGems: string;
    rising: string;
  }>;
  caseResults: readonly Readonly<{
    caseId: string;
    mode: 'hidden_gems' | 'rising';
    status: 'eligible' | 'ineligible';
    score: number | null;
  }>[];
  expectationResults: readonly Readonly<{
    id: string;
    passed: boolean;
    observed: string;
    rationale: string;
  }>[];
  summary: Readonly<{
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  }>;
  riskProbes: readonly Readonly<{
    id: string;
    mode: 'hidden_gems' | 'rising';
    observed: string;
    rationale: string;
  }>[];
}>;

type RunOptions = Readonly<{
  benchmark?: RepositoryRankingBenchmark;
  hiddenGemScorer?: RankingBenchmarkScorer;
  risingScorer?: RankingBenchmarkScorer;
}>;

function scoreCase(
  benchmarkCase: RepositoryRankingBenchmarkCase,
  hiddenGemScorer: RankingBenchmarkScorer,
  risingScorer: RankingBenchmarkScorer,
): BenchmarkScoreResult {
  return benchmarkCase.mode === 'hidden_gems'
    ? hiddenGemScorer(benchmarkCase.snapshot)
    : risingScorer(benchmarkCase.snapshot);
}

function formatScore(result: BenchmarkScoreResult): string {
  return result.status === 'eligible'
    ? result.score.toFixed(2)
    : 'ineligible';
}

function evaluateExpectation(
  expectation: RepositoryRankingBenchmarkExpectation,
  resultsById: ReadonlyMap<string, BenchmarkScoreResult>,
): Readonly<{
  id: string;
  passed: boolean;
  observed: string;
  rationale: string;
}> {
  if (expectation.kind === 'eligibility') {
    const result = resultsById.get(expectation.caseId);

    if (!result) {
      throw new Error(
        `Benchmark expectation references unknown case ${expectation.caseId}.`,
      );
    }

    return {
      id: expectation.id,
      passed: result.status === expectation.expectedStatus,
      observed: `${expectation.caseId}=${result.status}`,
      rationale: expectation.rationale,
    };
  }

  const better = resultsById.get(expectation.betterCaseId);
  const worse = resultsById.get(expectation.worseCaseId);

  if (!better || !worse) {
    throw new Error(
      `Benchmark expectation ${expectation.id} references an unknown case.`,
    );
  }

  if (better.status !== 'eligible' || worse.status !== 'eligible') {
    return {
      id: expectation.id,
      passed: false,
      observed:
        `${expectation.betterCaseId}=${formatScore(better)}, ` +
        `${expectation.worseCaseId}=${formatScore(worse)}`,
      rationale: expectation.rationale,
    };
  }

  const tolerance = expectation.tolerance ?? 0;
  const passed =
    expectation.relation === 'greater'
      ? better.score > worse.score
      : Math.abs(better.score - worse.score) <= tolerance;

  return {
    id: expectation.id,
    passed,
    observed:
      `${expectation.betterCaseId}=${better.score.toFixed(2)}, ` +
      `${expectation.worseCaseId}=${worse.score.toFixed(2)}`,
    rationale: expectation.rationale,
  };
}

export function runRepositoryRankingBenchmark(
  options: RunOptions = {},
): RepositoryRankingBenchmarkRun {
  const benchmark = options.benchmark ?? repositoryRankingBenchmark;
  const hiddenGemScorer =
    options.hiddenGemScorer ??
    ((snapshot) => scoreHiddenGemV1(snapshot));
  const risingScorer =
    options.risingScorer ??
    ((snapshot) => scoreRisingV1(snapshot));

  const caseResults = benchmark.cases.map((benchmarkCase) => {
    const result = scoreCase(
      benchmarkCase,
      hiddenGemScorer,
      risingScorer,
    );

    return {
      caseId: benchmarkCase.id,
      mode: benchmarkCase.mode,
      status: result.status,
      score: result.status === 'eligible' ? result.score : null,
      formulaVersion: result.formulaVersion,
    };
  });

  const resultsById = new Map<string, BenchmarkScoreResult>();

  for (const result of caseResults) {
    resultsById.set(
      result.caseId,
      result.status === 'eligible'
        ? {
            status: 'eligible',
            formulaVersion: result.formulaVersion,
            score: result.score!,
          }
        : {
            status: 'ineligible',
            formulaVersion: result.formulaVersion,
          },
    );
  }

  const expectationResults = benchmark.expectations.map((expectation) =>
    evaluateExpectation(expectation, resultsById),
  );
  const passed = expectationResults.filter((result) => result.passed).length;
  const total = expectationResults.length;

  const hiddenFormula = caseResults.find(
    (result) => result.mode === 'hidden_gems',
  )?.formulaVersion;
  const risingFormula = caseResults.find(
    (result) => result.mode === 'rising',
  )?.formulaVersion;

  if (!hiddenFormula || !risingFormula) {
    throw new Error('Ranking benchmark must include both ranking modes.');
  }

  const riskProbes = benchmark.riskProbes.map((probe) => {
    const primary = resultsById.get(probe.caseId);

    if (!primary) {
      throw new Error(
        `Risk probe ${probe.id} references unknown case ${probe.caseId}.`,
      );
    }

    let observed = `${probe.caseId}=${formatScore(primary)}`;

    if (probe.compareCaseId) {
      const comparison = resultsById.get(probe.compareCaseId);

      if (!comparison) {
        throw new Error(
          `Risk probe ${probe.id} references unknown comparison case ${probe.compareCaseId}.`,
        );
      }

      observed += `, ${probe.compareCaseId}=${formatScore(comparison)}`;

      if (
        primary.status === 'eligible' &&
        comparison.status === 'eligible'
      ) {
        observed += `, delta=${(
          primary.score - comparison.score
        ).toFixed(2)}`;
      }
    }

    return {
      id: probe.id,
      mode: probe.mode,
      observed,
      rationale: probe.rationale,
    };
  });

  return {
    schemaVersion: REPOSITORY_RANKING_BENCHMARK_RUN_SCHEMA_VERSION,
    benchmarkVersion: benchmark.version,
    formulaVersions: {
      hiddenGems: hiddenFormula,
      rising: risingFormula,
    },
    caseResults: caseResults.map(
      ({ formulaVersion: _formulaVersion, ...result }) => result,
    ),
    expectationResults,
    summary: {
      total,
      passed,
      failed: total - passed,
      passRate: total === 0 ? 1 : passed / total,
    },
    riskProbes,
  };
}
