import express, { type NextFunction, type Request, type Response } from 'express';

import {
  createHttpSecurityMiddleware,
  responseRequestId,
} from './http-security.js';
import { logger } from './logger.js';
import type { RepositoryCatalogReader } from './repositories/repository-catalog.js';
import type { RepositoryTrendReader } from './repositories/repository-trend.js';
import type { RepositoryRankingReader } from './repositories/repository-ranking.js';
import { createRepositoryRouter } from './repositories/repository-routes.js';
import type { RepositorySubmissionService } from './submissions/repository-submission-service.js';
import { createRepositorySubmissionRouter } from './submissions/repository-submission-routes.js';
import {
  createRepositorySubmissionRateLimitMiddleware,
  type RepositorySubmissionRateLimiter,
} from './submissions/repository-submission-rate-limiter.js';
import {
  createRepositoryModerationRouter,
  type RepositoryModerationRouterDependencies,
} from './submissions/repository-moderation-routes.js';

export type AppDependencies = Readonly<{
  checkReadiness?: () => Promise<void>;
  repositoryCatalog?: RepositoryCatalogReader;
  repositoryTrend?: RepositoryTrendReader;
  repositoryRanking?: RepositoryRankingReader;
  repositorySubmissionService?: RepositorySubmissionService;
  repositorySubmissionRateLimiter?: RepositorySubmissionRateLimiter;
  repositoryModeration?: RepositoryModerationRouterDependencies;
  trustProxyHops?: number;
}>;

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const checkReadiness = dependencies.checkReadiness ?? (async () => undefined);

  app.disable('x-powered-by');
  app.set('trust proxy', dependencies.trustProxyHops ?? 0);
  app.use(createHttpSecurityMiddleware());

  if (dependencies.repositorySubmissionRateLimiter) {
    app.use(
      '/api/submissions',
      createRepositorySubmissionRateLimitMiddleware(
        dependencies.repositorySubmissionRateLimiter,
      ),
    );
  }

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'reposcout-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', async (_request, response) => {
    try {
      await checkReadiness();

      response.status(200).json({
        status: 'ready',
        service: 'reposcout-api',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('health.readiness_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      response.status(503).json({
        status: 'unavailable',
        service: 'reposcout-api',
      });
    }
  });

  if (dependencies.repositoryCatalog) {
    app.use(
      '/api/repositories',
      createRepositoryRouter(
        dependencies.repositoryCatalog,
        dependencies.repositoryTrend,
        dependencies.repositoryRanking,
      ),
    );
  }

  if (dependencies.repositorySubmissionService) {
    app.use(
      '/api/submissions',
      createRepositorySubmissionRouter(
        dependencies.repositorySubmissionService,
      ),
    );
  }

  if (dependencies.repositoryModeration) {
    app.use(
      '/api/moderation',
      createRepositoryModerationRouter(
        dependencies.repositoryModeration,
      ),
    );
  }

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

      const bodyError =
        typeof error === 'object' && error !== null
          ? (error as { status?: unknown; type?: unknown })
          : null;

      if (
        bodyError?.status === 400 &&
        bodyError.type === 'entity.parse.failed'
      ) {
        logger.info('http.invalid_json_rejected', {
          requestId: responseRequestId(response),
        });
        response.status(400).json({
          error: 'invalid_json',
          message: 'Request body must contain valid JSON.',
        });
        return;
      }

      if (
        bodyError?.status === 413 &&
        bodyError.type === 'entity.too.large'
      ) {
        logger.info('http.request_body_too_large_rejected', {
          requestId: responseRequestId(response),
        });
        response.status(413).json({
          error: 'request_body_too_large',
          message: 'Request body exceeds the 100kb limit.',
        });
        return;
      }

      logger.error('http.unhandled_error', {
        requestId: responseRequestId(response),
        method: _request.method,
        path: _request.path,
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
