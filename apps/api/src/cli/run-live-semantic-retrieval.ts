import 'dotenv/config';

import { loadOpenAiEmbeddingEvaluationEnvironment } from '../evaluation/openai-embedding-env.js';
import { OpenAiEmbeddingProvider } from '../evaluation/openai-embedding-provider.js';
import { semanticRetrievalBenchmarkV2 } from '../evaluation/repository-semantic-retrieval-benchmark-v2.js';
import { runSemanticRetrievalEvaluation } from '../evaluation/repository-semantic-retrieval-evaluator.js';

async function run(): Promise<void> {
  const environment =
    loadOpenAiEmbeddingEvaluationEnvironment();
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

  console.log(
    JSON.stringify(
      {
        status: 'evaluated',
        benchmarkVersion:
          semanticRetrievalBenchmarkV2.version,
        provider: provider.providerName,
        model: provider.modelName,
        dimensions: environment.dimensions,
        elapsedMs,
        providerRequestLatencyMs:
          provider.lastLatencyMs,
        usage: provider.lastUsage,
        report,
      },
      null,
      2,
    ),
  );
}

run().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      status: 'failed',
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error',
    }),
  );
  process.exitCode = 1;
});
