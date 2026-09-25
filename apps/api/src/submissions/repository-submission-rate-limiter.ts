import { createHmac, randomBytes } from 'node:crypto';

import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';

import { responseRequestId } from '../http-security.js';
import { logger } from '../logger.js';

export type RepositorySubmissionRateLimitOptions = Readonly<{
  windowMs: number;
  maxAttempts: number;
  maxTrackedClients: number;
  now?: () => number;
}>;

export type RepositorySubmissionRateLimitDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}>;

type RateLimitBucket = {
  attempts: number;
  resetAtMs: number;
};

export class RepositorySubmissionRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly now: () => number;

  public constructor(
    private readonly options: RepositorySubmissionRateLimitOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  public consume(clientKey: string): RepositorySubmissionRateLimitDecision {
    const now = this.now();
    let bucket = this.buckets.get(clientKey);

    if (bucket && bucket.resetAtMs <= now) {
      this.buckets.delete(clientKey);
      bucket = undefined;
    }

    if (!bucket) {
      if (this.buckets.size >= this.options.maxTrackedClients) {
        this.removeExpiredBuckets(now);
      }

      if (this.buckets.size >= this.options.maxTrackedClients) {
        return {
          allowed: false,
          limit: this.options.maxAttempts,
          remaining: 0,
          retryAfterSeconds: this.retryAfterForCapacity(now),
        };
      }

      this.buckets.set(clientKey, {
        attempts: 1,
        resetAtMs: now + this.options.windowMs,
      });

      return {
        allowed: true,
        limit: this.options.maxAttempts,
        remaining: Math.max(0, this.options.maxAttempts - 1),
        retryAfterSeconds: this.toRetryAfterSeconds(this.options.windowMs),
      };
    }

    const retryAfterSeconds = this.toRetryAfterSeconds(
      bucket.resetAtMs - now,
    );

    if (bucket.attempts >= this.options.maxAttempts) {
      return {
        allowed: false,
        limit: this.options.maxAttempts,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    bucket.attempts += 1;

    return {
      allowed: true,
      limit: this.options.maxAttempts,
      remaining: Math.max(0, this.options.maxAttempts - bucket.attempts),
      retryAfterSeconds,
    };
  }

  private removeExpiredBuckets(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAtMs <= now) {
        this.buckets.delete(key);
      }
    }
  }

  private retryAfterForCapacity(now: number): number {
    let earliestResetAtMs: number | null = null;

    for (const bucket of this.buckets.values()) {
      if (
        earliestResetAtMs === null ||
        bucket.resetAtMs < earliestResetAtMs
      ) {
        earliestResetAtMs = bucket.resetAtMs;
      }
    }

    return this.toRetryAfterSeconds(
      Math.max(1, (earliestResetAtMs ?? now + this.options.windowMs) - now),
    );
  }

  private toRetryAfterSeconds(durationMs: number): number {
    return Math.max(1, Math.ceil(durationMs / 1_000));
  }
}

function clientAddress(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown-client';
}

export function hashRepositorySubmissionClientKey(
  address: string,
  secret: Buffer,
): string {
  return createHmac('sha256', secret).update(address, 'utf8').digest('hex');
}

export function createRepositorySubmissionRateLimitMiddleware(
  limiter: RepositorySubmissionRateLimiter,
): RequestHandler {
  const clientKeySecret = randomBytes(32);
  return (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    if (request.method !== 'POST') {
      next();
      return;
    }

    const decision = limiter.consume(
      hashRepositorySubmissionClientKey(
        clientAddress(request),
        clientKeySecret,
      ),
    );

    response.setHeader('RateLimit-Limit', String(decision.limit));
    response.setHeader('RateLimit-Remaining', String(decision.remaining));
    response.setHeader('RateLimit-Reset', String(decision.retryAfterSeconds));

    if (decision.allowed) {
      next();
      return;
    }

    response.setHeader('Retry-After', String(decision.retryAfterSeconds));
    logger.info('submission.rate_limit_rejected', {
      requestId: responseRequestId(response),
      limit: decision.limit,
      retryAfterSeconds: decision.retryAfterSeconds,
    });
    response.status(429).json({
      error: 'submission_rate_limited',
      message:
        'Too many repository submission attempts. Try again after the retry window.',
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  };
}
