import 'dotenv/config';

import { loadEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { GithubClient } from '../github/github-client.js';
import { RepositoryIngestionService } from '../github/repository-ingestion-service.js';
import { RepositoryRefreshService } from '../github/repository-refresh-service.js';
import { RepositoryStore } from '../repositories/repository-store.js';
import { parseIngestRepositoryCommand } from './ingest-repository-command.js';

function serializeResult(result: Awaited<ReturnType<RepositoryRefreshService['refresh']>>) {
  if (result.status === 'refreshed' || result.status === 'skipped') {
    return {
      status: result.status,
      repository: {
        id: result.repository.id,
        githubRepositoryId: result.repository.githubRepositoryId,
        fullName: result.repository.fullName,
        lastSyncedAt: result.repository.lastSyncedAt.toISOString(),
      },
      ...('nextEligibleAt' in result
        ? { nextEligibleAt: result.nextEligibleAt.toISOString() }
        : {}),
    };
  }

  return {
    status: result.status,
    repository: result.repository
      ? {
          id: result.repository.id,
          githubRepositoryId: result.repository.githubRepositoryId,
          fullName: result.repository.fullName,
          lastSyncedAt: result.repository.lastSyncedAt.toISOString(),
        }
      : null,
    retryAt: result.retryAt?.toISOString() ?? null,
  };
}

async function run(): Promise<void> {
  const command = parseIngestRepositoryCommand(process.argv.slice(2));
  const environment = loadEnvironment();
  const pool = createDatabasePool(environment.database);

  try {
    const repositoryStore = new RepositoryStore(pool);
    const githubClient = new GithubClient({
      token: environment.github.token,
      requestTimeoutMs: environment.github.requestTimeoutMs,
    });
    const ingestionService = new RepositoryIngestionService(
      githubClient,
      repositoryStore,
    );
    const refreshService = new RepositoryRefreshService(
      repositoryStore,
      ingestionService,
    );

    const result = await refreshService.refresh(command.reference, {
      force: command.force,
    });

    console.log(JSON.stringify(serializeResult(result), null, 2));

    if (
      result.status === 'unavailable' ||
      result.status === 'retry_later' ||
      result.status === 'manual_review'
    ) {
      process.exitCode = 2;
    }
  } finally {
    await pool.end();
  }
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
