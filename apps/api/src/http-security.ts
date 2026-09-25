import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { logger } from './logger.js';

const OBSERVED_PREFIXES = ['/api/submissions', '/api/moderation'] as const;

function isObservedBoundary(path: string): boolean {
  return OBSERVED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function responseRequestId(response: Response): string | null {
  const value = response.locals.requestId;
  return typeof value === 'string' ? value : null;
}

export function createHttpSecurityMiddleware(): RequestHandler {
  return (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    const requestId = randomUUID();
    const startedAt = process.hrtime.bigint();

    response.locals.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );

    if (isObservedBoundary(request.path)) {
      response.setHeader('Cache-Control', 'no-store');

      response.once('finish', () => {
        const durationMs = Number(
          (process.hrtime.bigint() - startedAt) / 1_000_000n,
        );

        logger.info('http.security_boundary_completed', {
          requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs,
        });
      });
    }

    next();
  };
}
