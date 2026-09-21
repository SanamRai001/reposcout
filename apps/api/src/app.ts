import express, { type NextFunction, type Request, type Response } from 'express';

import { logger } from './logger.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'reposcout-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.use((request, response) => {
    response.status(404).json({
      error: 'not_found',
      message: `No route matches ${request.method} ${request.path}.`,
    });
  });

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      next: NextFunction,
    ) => {
      void next;

      logger.error('http.unhandled_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      response.status(500).json({
        error: 'internal_server_error',
        message: 'An unexpected error occurred.',
      });
    },
  );

  return app;
}
