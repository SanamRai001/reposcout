import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { evaluateJevRun } from '../evaluation/jev-evaluator.js';
import { parseJevEvaluationRun } from '../evaluation/jev-evaluation-result.js';

function parsePathArgument(args: string[]): string {
  if (args.length !== 1 || !args[0]) {
    throw new Error(
      'Usage: npm run eval:jev -w @reposcout/api -- <evaluation-run.json>',
    );
  }

  return resolve(args[0]);
}

async function run(): Promise<void> {
  const filePath = parsePathArgument(process.argv.slice(2));
  const raw = await readFile(filePath, 'utf8');
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Evaluation run file must contain valid JSON.');
  }

  const report = evaluateJevRun(parseJevEvaluationRun(value));

  console.log(
    JSON.stringify(
      {
        status: 'evaluated',
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
      error: error instanceof Error ? error.message : 'Unknown error',
    }),
  );
  process.exitCode = 1;
});
