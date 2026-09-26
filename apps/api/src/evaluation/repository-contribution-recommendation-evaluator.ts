import {
  contributionRecommendationBenchmark,
  type ContributionRecommendationBenchmark,
} from './repository-contribution-recommendation-benchmark.js';
import {
  buildContributionRecommendation,
  CONTRIBUTION_RECOMMENDATION_CONTRACT_VERSION,
} from '../repositories/repository-contribution-recommendation.js';

export const CONTRIBUTION_RECOMMENDATION_BENCHMARK_RUN_SCHEMA_VERSION =
  'contribution-recommendation-benchmark-run-v1' as const;

export type ContributionRecommendationBenchmarkRun = Readonly<{
  schemaVersion:
    typeof CONTRIBUTION_RECOMMENDATION_BENCHMARK_RUN_SCHEMA_VERSION;
  benchmarkVersion: string;
  recommendationContractVersion:
    typeof CONTRIBUTION_RECOMMENDATION_CONTRACT_VERSION;
  caseResults: readonly Readonly<{
    caseId: string;
    status: 'consider' | 'needs_review';
    evidenceCodes: readonly string[];
    cautionCodes: readonly string[];
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
    observed: string;
    rationale: string;
  }>[];
}>;

export function runContributionRecommendationBenchmark(
  benchmark: ContributionRecommendationBenchmark =
    contributionRecommendationBenchmark,
): ContributionRecommendationBenchmarkRun {
  const caseResults = benchmark.cases.map((benchmarkCase) => {
    const recommendation = buildContributionRecommendation(
      benchmarkCase.snapshot,
    );

    return {
      caseId: benchmarkCase.id,
      status: recommendation.status,
      evidenceCodes: recommendation.evidence.map((item) => item.code),
      cautionCodes: recommendation.cautions.map((item) => item.code),
    };
  });

  const resultsById = new Map(
    caseResults.map((result) => [result.caseId, result]),
  );

  const expectationResults = benchmark.expectations.map(
    (expectation) => {
      const result = resultsById.get(expectation.caseId);

      if (!result) {
        throw new Error(
          `Contribution recommendation benchmark expectation references unknown case ${expectation.caseId}.`,
        );
      }

      const missingEvidence = (
        expectation.requiredEvidenceCodes ?? []
      ).filter((code) => !result.evidenceCodes.includes(code));
      const missingCautions = (
        expectation.requiredCautionCodes ?? []
      ).filter((code) => !result.cautionCodes.includes(code));
      const passed =
        result.status === expectation.expectedStatus &&
        missingEvidence.length === 0 &&
        missingCautions.length === 0;

      return {
        id: expectation.id,
        passed,
        observed:
          `${expectation.caseId}: status=${result.status}, ` +
          `evidence=[${result.evidenceCodes.join(',')}], ` +
          `cautions=[${result.cautionCodes.join(',')}]`,
        rationale: expectation.rationale,
      };
    },
  );

  const passed = expectationResults.filter(
    (result) => result.passed,
  ).length;
  const total = expectationResults.length;

  const riskProbes = benchmark.riskProbes.map((probe) => {
    const result = resultsById.get(probe.caseId);

    if (!result) {
      throw new Error(
        `Contribution recommendation risk probe references unknown case ${probe.caseId}.`,
      );
    }

    return {
      id: probe.id,
      observed:
        `${probe.caseId}: status=${result.status}, ` +
        `evidence=[${result.evidenceCodes.join(',')}], ` +
        `cautions=[${result.cautionCodes.join(',')}]`,
      rationale: probe.rationale,
    };
  });

  return {
    schemaVersion:
      CONTRIBUTION_RECOMMENDATION_BENCHMARK_RUN_SCHEMA_VERSION,
    benchmarkVersion: benchmark.version,
    recommendationContractVersion:
      CONTRIBUTION_RECOMMENDATION_CONTRACT_VERSION,
    caseResults,
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
