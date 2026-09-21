import 'dotenv/config';

import { createApp } from './app.js';
import { loadEnvironment } from './config/env.js';
import { logger } from './logger.js';

const environment = loadEnvironment();
const app = createApp();

const server = app.listen(environment.port, () => {
  logger.info('api.started', {
    nodeEnv: environment.nodeEnv,
    port: environment.port,
  });
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info('api.shutdown_requested', { signal });

  server.close((error) => {
    if (error) {
      logger.error('api.shutdown_failed', { error: error.message });
      process.exitCode = 1;
      return;
    }

    logger.info('api.stopped');
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
