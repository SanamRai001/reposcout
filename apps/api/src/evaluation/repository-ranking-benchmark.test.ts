import { describe, expect, it } from 'vitest';

import {
  RANKING_BENCHMARK_VERSION,
  runRankingBenchmark,
} from './repository-ranking-benchmark.js';

describe('repository ranking benchmark', () => {
  it('passes every hard ranking guardrail', () => {
    const report = runRankingBenchmark();

    expect(report.benchmarkVersion).toBe(RANKING_BENCHMARK_VERSION);
    expect(report.formulaVersions).toEqual({
      hiddenGems: 'hidden-gem-v1',
      rising: 'rising-v1',
    });
    expect(report.summary.guardrailsTotal).toBeGreaterThanOrEqual(9);
    expect(report.summary.guardrailsFailed).toBe(0);
    expect(
      report.guardrails.filter((guardrail) => !guardrail.passed),
    ).toEqual([]);
  });

  it('keeps diagnostics visible without pretending they are benchmark passes', () => {
    const report = runRankingBenchmark();
    const shell = report.diagnostics.find(
      (diagnostic) =>
        diagnostic.id === 'hidden-community-file-shell',
    );

    expect(shell).toEqual(
      expect.objectContaining({
        mode: 'hidden_gems',
        severity: 'risk',
      }),
    );
    expect(shell?.observed).toContain('scores 95');
  });

  it('is deterministic across repeated offline runs', () => {
    expect(runRankingBenchmark()).toEqual(runRankingBenchmark());
  });
});
