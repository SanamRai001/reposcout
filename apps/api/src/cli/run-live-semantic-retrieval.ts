import 'dotenv/config';

import { loadOpenAiEmbeddingEvaluationEnvironment } from '../evaluation/openai-embedding-env.js';
import { runOpenAiSemanticRetrievalEvaluation } from '../evaluation/openai-semantic-retrieval-live.js';

async function run(): Promise<void> {
  const environment =
    loadOpenAiEmbeddingEvaluationEnvironment();
  const result =
    await runOpenAiSemanticRetrievalEvaluation(environment);

  console.log(JSON.stringify(result, null, 2));
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
