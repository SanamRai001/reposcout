import 'dotenv/config';

import { loadEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { GithubClient } from '../github/github-client.js';
import { RepositoryIngestionService } from '../github/repository-ingestion-service.js';
import { RepositoryRefreshService } from '../github/repository-refresh-service.js';
import {
  parseSnapshotMaintenanceLimit,
  RepositorySnapshotMaintenanceService,
} from '../github/repository-snapshot-maintenance-service.js';
import { logger } from '../logger.js';
import { RepositorySnapshotBackfillService } from '../repositories/repository-snapshot-backfill-service.js';
import { RepositorySnapshotMaintenanceStore } from '../repositories/repository-snapshot-maintenance-store.js';
import { RepositorySnapshotStore } from '../repositories/repository-snapshot-store.js';
import { RepositoryStore } from '../repositories/repository-store.js';

function parseArgs(args: string[]) {
  if (args.length > 2) {
    throw new Error(
      'Usage: npm run maintain:snapshots -w @reposcout/api -- [refreshLimit] [backfillLimit]',
    );
  }

  return {
    refreshLimit: parseSnapshotMaintenanceLimit('refreshLimit', args[0]),
    backfillLimit: parseSnapshotMaintenanceLimit('backfillLimit', args[1]),
  };
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const environment = loadEnvironment();
  const pool = createDatabasePool(environment.database);

  try {
    const repositoryStore = new RepositoryStore(pool);
    const snapshotStore = new RepositorySnapshotStore(pool);
    const maintenanceStore = new RepositorySnapshotMaintenanceStore(pool);
    const backfillService = new RepositorySnapshotBackfillService(
      snapshotStore,
      snapshotStore,
    );
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
    const maintenanceService = new RepositorySnapshotMaintenanceService(
      maintenanceStore,
      backfillService,
      maintenanceStore,
      refreshService,
    );

    logger.info('snapshot.maintenance_started', options);
    const report = await maintenanceService.run(options);

    if (report.status === 'already_running') {
      logger.info('snapshot.maintenance_skipped', {
        reason: 'already_running',
        startedAt: report.startedAt,
      });
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    for (const item of report.refresh.items) {
      logger.info('snapshot.maintenance_refresh_completed', {
        repositoryId: item.repositoryId,
        fullName: item.fullName,
        status: item.status,
        retryAt: item.retryAt,
      });
    }

    logger.info('snapshot.maintenance_completed', {
      status: report.status,
      startedAt: report.startedAt,
      completedAt: report.completedAt,
      backfillSelected: report.backfill.selected,
      backfillCreated: report.backfill.summary.created,
      refreshSelected: report.refresh.selected,
      refreshProcessed: report.refresh.processed,
      ...report.refresh.summary,
      haltedReason: report.refresh.haltedReason,
      retryAt: report.refresh.retryAt,
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
  logger.error('snapshot.maintenance_failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exitCode = 1;
});
