import type {
  JevEvaluationBenchmark,
} from './jev-evaluation-benchmark.js';
import type {
  JevRelevanceAssessment,
  JevRepositoryAssessment,
} from './jev-evaluation-result.js';

export type JevProviderEvaluation = Readonly<{
  repositoryAssessments: readonly JevRepositoryAssessment[];
  relevanceAssessments: readonly JevRelevanceAssessment[];
  resolvedModelName?: string;
}>;

export interface JevEvaluationProvider {
  readonly providerName: string;
  readonly modelName: string;

  evaluate(
    benchmark: JevEvaluationBenchmark,
  ): Promise<JevProviderEvaluation>;
}
