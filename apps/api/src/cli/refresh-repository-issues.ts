import 'dotenv/config';

import { loadEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { GithubClient } from '../github/github-client.js';
import {
  parseIssueBatchLimit,
  RepositoryIssueBatchService,
} from '../github/repository-issue-batch-service.js';
import { RepositoryIssueIngestionService } from '../github/repository-issue-ingestion-service.js';
import { logger } from '../logger.js';
import {
  isRepositoryId,
  type RepositoryCursor,
} from '../repositories/repository-catalog.js';
import { RepositoryIssueStore } from '../repositories/repository-issue-store.js';
import { RepositoryStore } from '../repositories/repository-store.js';

function parseCursor(value: string | undefined): RepositoryCursor | null {
  if (value === undefined) {
    return null;
  }

  if (!isRepositoryId(value)) {
    throw new Error('cursor must be a valid repository UUID.');
  }

  return { id: value };
}

function parseArgs(args: string[]) {
  if (args.length > 3) {
    throw new Error(
      'Usage: npm run refresh:issues -w @reposcout/api -- [repositoryLimit] [issuesPerRepositoryLimit] [cursor]',
    );
  }

  return {
    repositoryLimit: parseIssueBatchLimit(
      'repositoryLimit',
      args[0],
    ),
    issuesPerRepositoryLimit: parseIssueBatchLimit(
      'issuesPerRepositoryLimit',
      args[1],
    ),
    cursor: parseCursor(args[2]),
  };
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const environment = loadEnvironment();
  const pool = createDatabasePool(environment.database);

  try {
    const repositoryStore = new RepositoryStore(pool);
    const issueStore = new RepositoryIssueStore(pool);
    const githubClient = new GithubClient({
      token: environment.github.token,
      requestTimeoutMs: environment.github.requestTimeoutMs,
    });
    const ingestion = new RepositoryIssueIngestionService(
      githubClient,
      issueStore,
    );
    const batch = new RepositoryIssueBatchService(
      repositoryStore,
      ingestion,
    );

    logger.info('issues.refresh_batch_started', options);
    const report = await batch.run(options);

    logger.info('issues.refresh_batch_completed', {
      status: report.status,
      selected: report.selected,
      processed: report.processed,
      refreshedRepositories: report.refreshedRepositories,
      storedIssues: report.storedIssues,
      excludedPullRequests: report.excludedPullRequests,
      haltedReason: report.haltedReason,
      retryAt: report.retryAt,
      nextCursor: report.nextCursor?.id ?? null,
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
  logger.error('issues.refresh_batch_failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exitCode = 1;
});
