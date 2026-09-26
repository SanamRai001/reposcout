import { describe, expect, it } from 'vitest';

import {
  contributionRecommendationBenchmark,
  CONTRIBUTION_RECOMMENDATION_BENCHMARK_VERSION,
} from './repository-contribution-recommendation-benchmark.js';
import {
  runContributionRecommendationBenchmark,
} from './repository-contribution-recommendation-evaluator.js';

describe('contribution recommendation benchmark', () => {
  it('has stable unique case, expectation, and risk identifiers', () => {
    const caseIds = contributionRecommendationBenchmark.cases.map(
      (item) => item.id,
    );
    const expectationIds =
      contributionRecommendationBenchmark.expectations.map(
        (item) => item.id,
      );
    const riskIds =
      contributionRecommendationBenchmark.riskProbes.map(
        (item) => item.id,
      );

    expect(contributionRecommendationBenchmark.version).toBe(
      CONTRIBUTION_RECOMMENDATION_BENCHMARK_VERSION,
    );
    expect(new Set(caseIds).size).toBe(caseIds.length);
    expect(new Set(expectationIds).size).toBe(expectationIds.length);
    expect(new Set(riskIds).size).toBe(riskIds.length);
  });

  it('keeps every v1 gating expectation green', () => {
    const run = runContributionRecommendationBenchmark();

    expect(run.recommendationContractVersion).toBe(
      'contribution-recommendation-v1',
    );
    expect(run.summary.failed).toBe(0);
    expect(run.summary.passed).toBe(run.summary.total);
    expect(run.summary.passRate).toBe(1);
  });

  it('preserves missing-vs-observed process evidence without turning either into a veto', () => {
    const run = runContributionRecommendationBenchmark();
    const missing = run.caseResults.find(
      (item) => item.caseId === 'process-evidence-missing',
    );
    const absent = run.caseResults.find(
      (item) => item.caseId === 'contributing-absent',
    );

    expect(missing).toEqual(
      expect.objectContaining({
        status: 'consider',
        cautionCodes: expect.arrayContaining([
          'contributing_evidence_missing',
        ]),
      }),
    );
    expect(absent).toEqual(
      expect.objectContaining({
        status: 'consider',
        cautionCodes: expect.arrayContaining([
          'contributing_guidance_absent',
        ]),
      }),
    );
  });

  it('documents known evidence limits instead of producing a suitability score', () => {
    const run = runContributionRecommendationBenchmark();

    expect(run.riskProbes.map((item) => item.id)).toEqual([
      'entry-label-is-not-difficulty-ground-truth',
      'freshness-is-not-maintainer-responsiveness',
    ]);
    expect(JSON.stringify(run)).not.toContain('beginnerFriendly');
    expect(JSON.stringify(run)).not.toContain('"score"');
  });

  it('is deterministic for the frozen benchmark', () => {
    expect(runContributionRecommendationBenchmark()).toEqual(
      runContributionRecommendationBenchmark(),
    );
  });
});
