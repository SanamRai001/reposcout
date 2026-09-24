import 'dotenv/config';

import { loadEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { GithubClient } from '../github/github-client.js';
import { RepositoryContributionEvidenceService } from '../github/repository-contribution-evidence-service.js';
import { RepositoryIngestionService } from '../github/repository-ingestion-service.js';
import { RepositoryReadmeService } from '../github/repository-readme-service.js';
import { logger } from '../logger.js';
import { RepositoryContributionEvidenceStore } from '../repositories/repository-contribution-evidence-store.js';
import { RepositoryReadmeStore } from '../repositories/repository-readme-store.js';
import { RepositoryStore } from '../repositories/repository-store.js';
import {
  parseSubmissionEvidenceHandoffBatchLimit,
  RepositorySubmissionEvidenceHandoffOrchestrator,
} from '../submissions/repository-submission-evidence-handoff-orchestrator.js';
import { RepositorySubmissionEvidenceHandoffService } from '../submissions/repository-submission-evidence-handoff-service.js';
import { RepositorySubmissionStore } from '../submissions/repository-submission-store.js';

function parseArgs(args: string[]): number {
  if (args.length > 1) {
    throw new Error(
      'Usage: npm run handoff:submissions -w @reposcout/api -- [limit]',
    );
  }

  return parseSubmissionEvidenceHandoffBatchLimit(args[0]);
}

async function run(): Promise<void> {
  const limit = parseArgs(process.argv.slice(2));
  const environment = loadEnvironment();
  const pool = createDatabasePool(environment.database);

  try {
    const repositoryStore = new RepositoryStore(pool);
    const submissionStore = new RepositorySubmissionStore(pool);
    const readmeStore = new RepositoryReadmeStore(pool);
    const contributionStore =
      new RepositoryContributionEvidenceStore(pool);
    const githubClient = new GithubClient({
      token: environment.github.token,
      requestTimeoutMs: environment.github.requestTimeoutMs,
    });

    const handoffService =
      new RepositorySubmissionEvidenceHandoffService(
        submissionStore,
        new RepositoryIngestionService(
          githubClient,
          repositoryStore,
        ),
        new RepositoryReadmeService(
          githubClient,
          readmeStore,
        ),
        new RepositoryContributionEvidenceService(
          githubClient,
          contributionStore,
        ),
      );

    const orchestrator =
      new RepositorySubmissionEvidenceHandoffOrchestrator(
        submissionStore,
        handoffService,
      );

    logger.info('submission.evidence_handoff_batch_started', {
      limit,
    });

    const report = await orchestrator.runBatch(limit);

    for (const item of report.items) {
      if (item.kind === 'completed') {
        logger.info('submission.evidence_handoff_completed', {
          submissionId: item.submissionId,
          repositoryId: item.repositoryId,
          alreadyCompleted: item.alreadyCompleted,
        });
        continue;
      }

      logger.error('submission.evidence_handoff_incomplete', {
        submissionId: item.submissionId,
        repositoryId: item.repositoryId,
        rateLimited: item.rateLimited,
        stages: item.stages,
      });
    }

    logger.info('submission.evidence_handoff_batch_completed', {
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
  logger.error('submission.evidence_handoff_batch_failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exitCode = 1;
});
