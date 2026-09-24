import 'dotenv/config';

import { loadEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { GithubClient } from '../github/github-client.js';
import { logger } from '../logger.js';
import { RepositoryStore } from '../repositories/repository-store.js';
import { RepositorySubmissionStore } from '../submissions/repository-submission-store.js';
import {
  RepositorySubmissionValidationOrchestrator,
  parseSubmissionValidationBatchLimit,
} from '../submissions/repository-submission-validation-orchestrator.js';
import { RepositorySubmissionValidationService } from '../submissions/repository-submission-validation-service.js';

function parseArgs(args: string[]): number {
  if (args.length > 1) {
    throw new Error(
      'Usage: npm run validate:submissions -w @reposcout/api -- [limit]',
    );
  }

  return parseSubmissionValidationBatchLimit(args[0]);
}

async function run(): Promise<void> {
  const limit = parseArgs(process.argv.slice(2));
  const environment = loadEnvironment();
  const pool = createDatabasePool(environment.database);

  try {
    const repositoryStore = new RepositoryStore(pool);
    const submissionStore = new RepositorySubmissionStore(pool);
    const githubClient = new GithubClient({
      token: environment.github.token,
      requestTimeoutMs: environment.github.requestTimeoutMs,
    });
    const validationService = new RepositorySubmissionValidationService(
      githubClient,
      repositoryStore,
      submissionStore,
    );
    const orchestrator = new RepositorySubmissionValidationOrchestrator(
      submissionStore,
      validationService,
    );

    logger.info('submission.validation_batch_started', {
      limit,
    });

    const report = await orchestrator.runBatch(limit);

    for (const item of report.items) {
      if (item.kind === 'validated') {
        logger.info('submission.validation_completed', {
          submissionId: item.submissionId,
          status: item.status,
          validationOutcome: item.validationOutcome,
        });
        continue;
      }

      logger.error('submission.validation_retryable_failure', {
        submissionId: item.submissionId,
        errorKind: item.errorKind,
        message: item.message,
        retryAt: item.retryAt,
      });
    }

    logger.info('submission.validation_batch_completed', {
      selected: report.selected,
      processed: report.processed,
      remainingSelected: report.remainingSelected,
      stoppedEarly: report.stoppedEarly,
      ...report.summary,
    });

    console.log(
      JSON.stringify(
        {
          status: 'completed',
          report,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  logger.error('submission.validation_batch_failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exitCode = 1;
});
