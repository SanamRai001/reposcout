import { describe, expect, it, vi } from 'vitest';

import {
  jevEvaluationBenchmark,
} from './jev-evaluation-benchmark.js';
import type { JevEvaluationProvider } from './jev-evaluation-provider.js';
import { runJevEvaluation } from './jev-evaluation-runner.js';

describe('runJevEvaluation', () => {
  it('records provider/model/benchmark provenance around one provider run', async () => {
    const evaluate = vi.fn<JevEvaluationProvider['evaluate']>().mockResolvedValue({
      repositoryAssessments: [],
      relevanceAssessments: [],
    });
    const provider: JevEvaluationProvider = {
      providerName: 'fixture-provider',
      modelName: 'fixture-model',
      evaluate,
    };
    const times = [
      new Date('2026-09-22T15:00:00.000Z'),
      new Date('2026-09-22T15:00:01.500Z'),
    ];

    const run = await runJevEvaluation(provider, {
      now: () => times.shift()!,
      runIdFactory: () => 'run-123',
    });

    expect(evaluate).toHaveBeenCalledWith(jevEvaluationBenchmark);
    expect(run).toEqual({
      schemaVersion: '3e1-v1',
      benchmarkVersion: jevEvaluationBenchmark.version,
      provider: 'fixture-provider',
      model: 'fixture-model',
      runId: 'run-123',
      startedAt: '2026-09-22T15:00:00.000Z',
      completedAt: '2026-09-22T15:00:01.500Z',
      repositoryAssessments: [],
      relevanceAssessments: [],
    });
  });

  it('records provider-resolved model provenance when available', async () => {
    const evaluate = vi.fn<JevEvaluationProvider['evaluate']>().mockResolvedValue({
      repositoryAssessments: [],
      relevanceAssessments: [],
      resolvedModelName: 'jev-1.13.0',
    });
    const provider: JevEvaluationProvider = {
      providerName: 'typesafe-system-one',
      modelName: 'jev-latest',
      evaluate,
    };
    const times = [
      new Date('2026-09-22T15:00:00.000Z'),
      new Date('2026-09-22T15:00:01.000Z'),
    ];

    const run = await runJevEvaluation(provider, {
      now: () => times.shift()!,
      runIdFactory: () => 'run-resolved',
    });

    expect(run.model).toBe('jev-1.13.0');
  });

  it('rejects unnamed provider metadata before evaluation', async () => {
    const evaluate = vi.fn<JevEvaluationProvider['evaluate']>();
    const provider: JevEvaluationProvider = {
      providerName: '',
      modelName: 'fixture-model',
      evaluate,
    };

    await expect(runJevEvaluation(provider)).rejects.toThrow(
      'Evaluation provider and model names must be non-empty.',
    );
    expect(evaluate).not.toHaveBeenCalled();
  });
});
