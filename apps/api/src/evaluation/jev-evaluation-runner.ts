import { randomUUID } from 'node:crypto';

import {
  jevEvaluationBenchmark,
  type JevEvaluationBenchmark,
} from './jev-evaluation-benchmark.js';
import type { JevEvaluationProvider } from './jev-evaluation-provider.js';
import type { JevEvaluationRun } from './jev-evaluation-result.js';

type RunnerOptions = Readonly<{
  benchmark?: JevEvaluationBenchmark;
  now?: () => Date;
  runIdFactory?: () => string;
}>;

export async function runJevEvaluation(
  provider: JevEvaluationProvider,
  options: RunnerOptions = {},
): Promise<JevEvaluationRun> {
  const benchmark = options.benchmark ?? jevEvaluationBenchmark;
  const now = options.now ?? (() => new Date());
  const runIdFactory = options.runIdFactory ?? randomUUID;

  if (!provider.providerName.trim() || !provider.modelName.trim()) {
    throw new Error('Evaluation provider and model names must be non-empty.');
  }

  const startedAt = now();
  const result = await provider.evaluate(benchmark);
  const completedAt = now();

  return {
    schemaVersion: '3e1-v1',
    benchmarkVersion: benchmark.version,
    provider: provider.providerName,
    model: provider.modelName,
    runId: runIdFactory(),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    repositoryAssessments: result.repositoryAssessments,
    relevanceAssessments: result.relevanceAssessments,
  };
}
