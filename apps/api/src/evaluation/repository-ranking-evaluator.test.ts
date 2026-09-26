import { describe, expect, it } from 'vitest';

import {
  repositoryRankingBenchmark,
  REPOSITORY_RANKING_BENCHMARK_VERSION,
} from './repository-ranking-benchmark.js';
import {
  runRepositoryRankingBenchmark,
} from './repository-ranking-evaluator.js';

describe('repository ranking benchmark', () => {
  it('has stable unique case and expectation identifiers', () => {
    const caseIds = repositoryRankingBenchmark.cases.map(
      (benchmarkCase) => benchmarkCase.id,
    );
    const expectationIds = repositoryRankingBenchmark.expectations.map(
      (expectation) => expectation.id,
    );
    const riskIds = repositoryRankingBenchmark.riskProbes.map(
      (probe) => probe.id,
    );

    expect(repositoryRankingBenchmark.version).toBe(
      REPOSITORY_RANKING_BENCHMARK_VERSION,
    );
    expect(new Set(caseIds).size).toBe(caseIds.length);
    expect(new Set(expectationIds).size).toBe(expectationIds.length);
    expect(new Set(riskIds).size).toBe(riskIds.length);
  });

  it('keeps the current v1 formulas green on every gating expectation', () => {
    const run = runRepositoryRankingBenchmark();

    expect(run.formulaVersions).toEqual({
      hiddenGems: 'hidden-gem-v1',
      rising: 'rising-v1',
    });
    expect(run.summary.failed).toBe(0);
    expect(run.summary.passed).toBe(run.summary.total);
    expect(run.summary.passRate).toBe(1);
  });

  it('records popularity invariance and sparse-normalization expectations as passing', () => {
    const run = runRepositoryRankingBenchmark();

    expect(
      run.expectationResults.find(
        (result) =>
          result.id ===
          'rising-lifetime-popularity-does-not-change-score',
      ),
    ).toEqual(
      expect.objectContaining({
        passed: true,
      }),
    );
    expect(
      run.expectationResults.find(
        (result) =>
          result.id ===
          'rising-sparse-normalization-matches-exact-peer',
      ),
    ).toEqual(
      expect.objectContaining({
        passed: true,
      }),
    );
  });

  it('reports known gaming/signal-quality risks without treating them as passed evidence', () => {
    const run = runRepositoryRankingBenchmark();

    expect(run.riskProbes.map((probe) => probe.id)).toEqual([
      'hidden-gems-community-checklist-sensitivity',
      'rising-growth-burst-manipulation-risk',
    ]);
    expect(run.riskProbes[0]?.observed).toContain('delta=');
    expect(run.riskProbes[1]?.observed).toContain(
      'rising-max-burst-risk=100.00',
    );
  });

  it('can evaluate an alternate scorer against the same benchmark', () => {
    const run = runRepositoryRankingBenchmark({
      hiddenGemScorer: (snapshot) => ({
        status: 'eligible',
        formulaVersion: 'fixture-hidden-v2',
        score:
          snapshot.signals['visibility.stars_total'].availability ===
          'available'
            ? Number(
                snapshot.signals['visibility.stars_total'].value,
              )
            : 0,
      }),
    });

    expect(run.formulaVersions.hiddenGems).toBe('fixture-hidden-v2');
    expect(run.summary.failed).toBeGreaterThan(0);
  });

  it('is deterministic for the same benchmark and scorers', () => {
    expect(runRepositoryRankingBenchmark()).toEqual(
      runRepositoryRankingBenchmark(),
    );
  });
});
