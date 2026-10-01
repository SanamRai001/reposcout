import 'dotenv/config';

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { loadOpenAiEmbeddingEvaluationEnvironment } from '../evaluation/openai-embedding-env.js';
import { runOpenAiSemanticRetrievalEvaluation } from '../evaluation/openai-semantic-retrieval-live.js';
import { summarizeLiveSemanticEvaluations } from '../evaluation/semantic-live-evaluation-summary.js';

type Options = Readonly<{
  runs: number;
  outputDirectory: string;
}>;

function parsePositiveInteger(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
    throw new Error(
      `${name} must be an integer between 1 and 10.`,
    );
  }

  return parsed;
}

function parseOptions(args: readonly string[]): Options {
  let runsValue: string | undefined;
  let outputDirectory = 'artifacts/semantic-evaluation';

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--runs') {
      runsValue = args[index + 1];
      index += 1;
      continue;
    }

    if (argument === '--output-dir') {
      const value = args[index + 1];

      if (!value?.trim()) {
        throw new Error('--output-dir requires a non-empty value.');
      }

      outputDirectory = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    runs: parsePositiveInteger('--runs', runsValue, 3),
    outputDirectory: resolve(outputDirectory),
  };
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const environment =
    loadOpenAiEmbeddingEvaluationEnvironment();

  await mkdir(options.outputDirectory, {
    recursive: true,
  });

  const results = [];

  for (let index = 0; index < options.runs; index += 1) {
    const result =
      await runOpenAiSemanticRetrievalEvaluation(environment);
    results.push(result);

    const fileName = `run-${String(index + 1).padStart(2, '0')}.json`;
    await writeFile(
      resolve(options.outputDirectory, fileName),
      `${JSON.stringify(result, null, 2)}\n`,
      'utf8',
    );
  }

  const summary =
    summarizeLiveSemanticEvaluations(results);
  const summaryPath = resolve(
    options.outputDirectory,
    'summary.json',
  );

  await writeFile(
    summaryPath,
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );

  console.log(
    JSON.stringify(
      {
        status: 'evaluated',
        runs: options.runs,
        outputDirectory: options.outputDirectory,
        summaryPath,
        summary,
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
