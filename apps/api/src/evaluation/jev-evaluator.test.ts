import { describe, expect, it } from 'vitest';

import {
  JEV_EVALUATION_BENCHMARK_VERSION,
  jevEvaluationBenchmark,
} from './jev-evaluation-benchmark.js';
import { evaluateJevRun } from './jev-evaluator.js';
import type { JevEvaluationRun } from './jev-evaluation-result.js';

function perfectRun(): JevEvaluationRun {
  return {
    schemaVersion: '3e1-v1',
    benchmarkVersion: JEV_EVALUATION_BENCHMARK_VERSION,
    provider: 'fixture',
    model: 'perfect-fixture',
    runId: 'run-perfect',
    startedAt: '2026-09-22T15:00:00.000Z',
    completedAt: '2026-09-22T15:00:01.250Z',
    repositoryAssessments: jevEvaluationBenchmark.repositories.map(
      (item) => ({
        caseId: item.id,
        projectType: {
          choice: item.expected.projectType,
          confidence: 0.9,
        },
        tutorialDemo: {
          probability: item.expected.tutorialDemo ? 0.9 : 0.1,
        },
        beginnerSuitability: {
          score: item.expected.beginnerSuitability,
          confidence: 0.8,
        },
      }),
    ),
    relevanceAssessments: jevEvaluationBenchmark.relevance.map(
      (item) => ({
        caseId: item.id,
        score: item.expectedScore,
        confidence: 0.85,
      }),
    ),
  };
}

describe('Jev evaluation benchmark', () => {
  it('keeps benchmark identifiers unique and relevance references valid', () => {
    const repositoryIds = jevEvaluationBenchmark.repositories.map(
      (item) => item.id,
    );
    const relevanceIds = jevEvaluationBenchmark.relevance.map(
      (item) => item.id,
    );

    expect(new Set(repositoryIds).size).toBe(repositoryIds.length);
    expect(new Set(relevanceIds).size).toBe(relevanceIds.length);

    const repositoryIdSet = new Set(repositoryIds);

    for (const item of jevEvaluationBenchmark.relevance) {
      expect(repositoryIdSet.has(item.repositoryCaseId)).toBe(true);
    }
  });
});

describe('evaluateJevRun', () => {
  it('reports transparent metrics for a complete run', () => {
    const report = evaluateJevRun(perfectRun());

    expect(report).toEqual({
      benchmarkVersion: JEV_EVALUATION_BENCHMARK_VERSION,
      provider: 'fixture',
      model: 'perfect-fixture',
      runId: 'run-perfect',
      coverage: {
        repositoryAssessments:
          jevEvaluationBenchmark.repositories.length,
        relevanceAssessments:
          jevEvaluationBenchmark.relevance.length,
      },
      metrics: {
        projectTypeAccuracy: 1,
        tutorialDemoAccuracy: 1,
        tutorialDemoBrierScore: 0.01,
        beginnerSuitabilityMae: 0,
        relevanceMae: 0,
        meanConfidence: 0.85,
      },
      latencyMs: 1250,
    });
  });

  it('measures mistakes without collapsing them into a single quality score', () => {
    const run = perfectRun();
    const firstRepository = run.repositoryAssessments[0]!;
    const firstRelevance = run.relevanceAssessments[0]!;

    const changed: JevEvaluationRun = {
      ...run,
      repositoryAssessments: [
        {
          ...firstRepository,
          projectType: {
            choice: 'application',
            confidence: 0.95,
          },
          tutorialDemo: {
            probability: 0.7,
          },
          beginnerSuitability: {
            score: 5,
            confidence: 0.95,
          },
        },
        ...run.repositoryAssessments.slice(1),
      ],
      relevanceAssessments: [
        {
          ...firstRelevance,
          score: 2,
          confidence: 0.95,
        },
        ...run.relevanceAssessments.slice(1),
      ],
    };

    const report = evaluateJevRun(changed);

    expect(report.metrics.projectTypeAccuracy).toBeCloseTo(5 / 6, 6);
    expect(report.metrics.tutorialDemoAccuracy).toBeCloseTo(5 / 6, 6);
    expect(report.metrics.beginnerSuitabilityMae).toBeCloseTo(2 / 6, 6);
    expect(report.metrics.relevanceMae).toBeCloseTo(3 / 5, 6);
    expect(report.metrics.tutorialDemoBrierScore).toBeGreaterThan(0.01);
  });

  it('rejects incomplete benchmark coverage', () => {
    const run = perfectRun();

    expect(() =>
      evaluateJevRun({
        ...run,
        repositoryAssessments: run.repositoryAssessments.slice(1),
      }),
    ).toThrow(
      'Repository assessment coverage is incomplete for this benchmark.',
    );
  });

  it('rejects invalid probabilities and scores', () => {
    const run = perfectRun();

    expect(() =>
      evaluateJevRun({
        ...run,
        repositoryAssessments: [
          {
            ...run.repositoryAssessments[0]!,
            tutorialDemo: {
              probability: 1.2,
            },
          },
          ...run.repositoryAssessments.slice(1),
        ],
      }),
    ).toThrow(
      'tutorialDemo.probability must be a probability between 0 and 1.',
    );
  });

  it('rejects benchmark version drift', () => {
    const run = perfectRun();

    expect(() =>
      evaluateJevRun({
        ...run,
        benchmarkVersion: 'old-benchmark',
      }),
    ).toThrow(/Benchmark version mismatch/);
  });
});
