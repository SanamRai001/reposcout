import 'dotenv/config';

import { evaluateJevRun } from '../evaluation/jev-evaluator.js';
import { runJevEvaluation } from '../evaluation/jev-evaluation-runner.js';
import { TypeSafeJevEvaluationProvider } from '../evaluation/typesafe-jev-evaluation-provider.js';
import { loadTypeSafeEvaluationEnvironment } from '../evaluation/typesafe-evaluation-env.js';
import { TypeSafeSystemOneClient } from '../evaluation/typesafe-system-one-client.js';

async function run(): Promise<void> {
  const environment = loadTypeSafeEvaluationEnvironment();
  const client = new TypeSafeSystemOneClient(
    environment.apiKey,
    environment.requestTimeoutMs,
  );

  const models = await client.listModels();
  const selected = models.find(
    (model) => model.name === environment.model,
  );

  if (!selected) {
    throw new Error(
      `Configured TypeSafe model "${environment.model}" is not available to this account.`,
    );
  }

  const provider = new TypeSafeJevEvaluationProvider(
    environment.model,
    client,
  );
  const evaluationRun = await runJevEvaluation(provider);
  const report = evaluateJevRun(evaluationRun);

  console.log(
    JSON.stringify(
      {
        status: 'evaluated',
        requestedModel: environment.model,
        resolvedModel: evaluationRun.model,
        report,
        run: evaluationRun,
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
      error: error instanceof Error ? error.message : 'Unknown error',
    }),
  );
  process.exitCode = 1;
});
