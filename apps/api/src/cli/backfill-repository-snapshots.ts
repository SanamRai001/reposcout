import 'dotenv/config';

import { loadEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { logger } from '../logger.js';
import {
  parseSnapshotBackfillBatchLimit,
  RepositorySnapshotBackfillService,
} from '../repositories/repository-snapshot-backfill-service.js';
import { RepositorySnapshotStore } from '../repositories/repository-snapshot-store.js';

function parseArgs(args: string[]): number {
  if (args.length > 1) {
    throw new Error(
      'Usage: npm run backfill:snapshots -w @reposcout/api -- [limit]',
    );
  }

  return parseSnapshotBackfillBatchLimit(args[0]);
}

async function run(): Promise<void> {
  const limit = parseArgs(process.argv.slice(2));
  const environment = loadEnvironment();
  const pool = createDatabasePool(environment.database);

  try {
    const snapshotStore = new RepositorySnapshotStore(pool);
    const service = new RepositorySnapshotBackfillService(
      snapshotStore,
      snapshotStore,
    );

    logger.info('snapshot.backfill_batch_started', {
      limit,
    });

    const report = await service.runBatch(limit);

    for (const item of report.items) {
      logger.info('snapshot.backfill_item_completed', {
        repositoryId: item.repositoryId,
        fullName: item.fullName,
        observedAt: item.observedAt,
        result: item.result,
      });
    }

    logger.info('snapshot.backfill_batch_completed', {
      selected: report.selected,
      processed: report.processed,
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
  logger.error('snapshot.backfill_batch_failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exitCode = 1;
});
