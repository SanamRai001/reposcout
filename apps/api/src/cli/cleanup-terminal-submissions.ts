import 'dotenv/config';

import { loadEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { logger } from '../logger.js';
import {
  parseSubmissionCleanupBatchLimit,
  RepositorySubmissionCleanupService,
  type RepositorySubmissionCleanupMode,
} from '../submissions/repository-submission-cleanup-service.js';
import { RepositorySubmissionStore } from '../submissions/repository-submission-store.js';

type CleanupArguments = Readonly<{
  mode: RepositorySubmissionCleanupMode;
  limit: number;
}>;

export function parseCleanupArguments(args: string[]): CleanupArguments {
  let mode: RepositorySubmissionCleanupMode = 'preview';
  let limitValue: string | undefined;

  for (const arg of args) {
    if (arg === '--apply') {
      if (mode === 'apply') {
        throw new Error(
          'Usage: npm run cleanup:submissions -w @reposcout/api -- [--apply] [limit]',
        );
      }

      mode = 'apply';
      continue;
    }

    if (arg.startsWith('--') || limitValue !== undefined) {
      throw new Error(
        'Usage: npm run cleanup:submissions -w @reposcout/api -- [--apply] [limit]',
      );
    }

    limitValue = arg;
  }

  return {
    mode,
    limit: parseSubmissionCleanupBatchLimit(limitValue),
  };
}

async function run(): Promise<void> {
  const args = parseCleanupArguments(process.argv.slice(2));
  const environment = loadEnvironment();
  const pool = createDatabasePool(environment.database);

  try {
    const cleanupService = new RepositorySubmissionCleanupService(
      new RepositorySubmissionStore(pool),
      {
        retentionDays: environment.submission.terminalRetentionDays,
      },
    );

    logger.info('submission.cleanup_started', {
      mode: args.mode,
      limit: args.limit,
      retentionDays: environment.submission.terminalRetentionDays,
    });

    const report = await cleanupService.run(args.mode, args.limit);

    logger.info('submission.cleanup_completed', {
      mode: report.mode,
      cutoff: report.cutoff,
      selected: report.selected,
      deleted: report.deleted,
      summary: report.summary,
    });

    console.log(
      JSON.stringify(
        {
          status: report.mode === 'apply' ? 'applied' : 'preview',
          report,
          applyCommand:
            report.mode === 'preview' && report.selected > 0
              ? `npm run cleanup:submissions -w @reposcout/api -- --apply ${args.limit}`
              : null,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

if (process.env.VITEST === undefined) {
  run().catch((error: unknown) => {
    logger.error('submission.cleanup_failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exitCode = 1;
  });
}
