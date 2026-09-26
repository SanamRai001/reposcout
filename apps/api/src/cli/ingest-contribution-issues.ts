import 'dotenv/config';

import { loadEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { GithubClient } from '../github/github-client.js';
import {
  DEFAULT_CONTRIBUTION_ISSUE_LIMIT,
  DEFAULT_CONTRIBUTION_REPOSITORY_BATCH_LIMIT,
  RepositoryContributionIssueBatchService,
} from '../github/repository-contribution-issue-batch-service.js';
import {
  RepositoryContributionIssueIngestionService,
} from '../github/repository-contribution-issue-ingestion-service.js';
import { logger } from '../logger.js';
import { isRepositoryId } from '../repositories/repository-catalog.js';
import { RepositoryContributionIssueStore } from '../repositories/repository-contribution-issue-store.js';
import { RepositoryStore } from '../repositories/repository-store.js';

function parseOptionalInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
  name: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }

  return parsed;
}

function parseArgs(args: string[]) {
  if (args.length > 3) {
    throw new Error(
      'Usage: npm run ingest:contribution-issues -w @reposcout/api -- [repositoryLimit] [issueLimit] [cursorRepositoryId]',
    );
  }

  const repositoryLimit = parseOptionalInteger(
    args[0],
    DEFAULT_CONTRIBUTION_REPOSITORY_BATCH_LIMIT,
    50,
    'repositoryLimit',
  );
  const issueLimit = parseOptionalInteger(
    args[1],
    DEFAULT_CONTRIBUTION_ISSUE_LIMIT,
    100,
    'issueLimit',
  );
  const cursorRepositoryId = args[2] ?? null;

  if (
    cursorRepositoryId !== null &&
    !isRepositoryId(cursorRepositoryId)
  ) {
    throw new Error('cursorRepositoryId must be a valid repository UUID.');
  }

  return {
    repositoryLimit,
    issueLimit,
    cursorRepositoryId,
  };
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const environment = loadEnvironment();
  const pool = createDatabasePool(environment.database);

  try {
    const repositoryStore = new RepositoryStore(pool);
    const issueStore = new RepositoryContributionIssueStore(pool);
    const githubClient = new GithubClient({
      token: environment.github.token,
      requestTimeoutMs: environment.github.requestTimeoutMs,
    });
    const ingestion = new RepositoryContributionIssueIngestionService(
      repositoryStore,
      githubClient,
      issueStore,
    );
    const batch = new RepositoryContributionIssueBatchService(
      repositoryStore,
      ingestion,
    );

    logger.info('contribution_issues.batch_started', options);
    const report = await batch.run(options);

    logger.info('contribution_issues.batch_completed', {
      status: report.status,
      selected: report.selected,
      processed: report.processed,
      persistedIssues: report.persistedIssues,
      haltedReason: report.haltedReason,
      retryAt: report.retryAt,
      nextCursorRepositoryId: report.nextCursorRepositoryId,
    });

    console.log(JSON.stringify(report, null, 2));

    if (report.status === 'halted') {
      process.exitCode = 2;
    }
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  logger.error('contribution_issues.batch_failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exitCode = 1;
});
