import 'dotenv/config';

import { createApp } from './app.js';
import { loadEnvironment } from './config/env.js';
import {
  createDatabasePool,
  verifyDatabaseConnection,
} from './database/database.js';
import { logger } from './logger.js';

async function bootstrap(): Promise<void> {
  const environment = loadEnvironment();
  const databasePool = createDatabasePool(environment.database);

  await verifyDatabaseConnection(databasePool);

  const app = createApp({
    checkReadiness: () => verifyDatabaseConnection(databasePool),
  });

  const server = app.listen(environment.port, () => {
    logger.info('api.started', {
      nodeEnv: environment.nodeEnv,
      port: environment.port,
    });
  });

  let shuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info('api.shutdown_requested', { signal });

    await new Promise<void>((resolve) => {
      server.close((error) => {
        if (error) {
          logger.error('api.shutdown_failed', { error: error.message });
          process.exitCode = 1;
        }

        resolve();
      });
    });

    await databasePool.end();
    logger.info('api.stopped');
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

bootstrap().catch((error: unknown) => {
  logger.error('api.start_failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exitCode = 1;
});
