import type { OpenAiEmbeddingEvaluationEnvironment } from './openai-embedding-env.js';
import { OpenAiEmbeddingProvider } from './openai-embedding-provider.js';
import { semanticRetrievalBenchmarkV2 } from './repository-semantic-retrieval-benchmark-v2.js';
import {
  runSemanticRetrievalEvaluation,
  type SemanticRetrievalEvaluationReport,
} from './repository-semantic-retrieval-evaluator.js';

export type LiveSemanticRetrievalResult = Readonly<{
  status: 'evaluated';
  benchmarkVersion: string;
  provider: string;
  model: string;
  dimensions: number;
  elapsedMs: number;
  providerRequestLatencyMs: number | null;
  usage: Readonly<{
    promptTokens: number;
    totalTokens: number;
  }> | null;
  report: SemanticRetrievalEvaluationReport;
}>;

export async function runOpenAiSemanticRetrievalEvaluation(
  environment: OpenAiEmbeddingEvaluationEnvironment,
): Promise<LiveSemanticRetrievalResult> {
  const provider = new OpenAiEmbeddingProvider(
    environment.apiKey,
    environment.model,
    environment.dimensions,
    environment.requestTimeoutMs,
  );

  const startedAt = performance.now();
  const report = await runSemanticRetrievalEvaluation(
    provider,
    semanticRetrievalBenchmarkV2,
  );
  const elapsedMs = Math.max(
    0,
    performance.now() - startedAt,
  );

  return {
    status: 'evaluated',
    benchmarkVersion: semanticRetrievalBenchmarkV2.version,
    provider: provider.providerName,
    model: report.embedding.model,
    dimensions: report.embedding.dimensions,
    elapsedMs,
    providerRequestLatencyMs: provider.lastLatencyMs,
    usage: provider.lastUsage,
    report,
  };
}
