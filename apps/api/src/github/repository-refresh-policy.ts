import { GithubApiError } from './github-client.js';
import type { RepositoryRecord } from '../repositories/repository.js';

export const DEFAULT_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_RATE_LIMIT_RETRY_MS = 15 * 60 * 1000;
const DEFAULT_REQUEST_RETRY_MS = 5 * 60 * 1000;
const DEFAULT_UNAVAILABLE_RETRY_MS = 24 * 60 * 60 * 1000;

export type RefreshEligibility = Readonly<{
  shouldRefresh: boolean;
  nextEligibleAt: Date;
}>;

export type RetryDecision = Readonly<{
  kind: 'retry_later' | 'unavailable' | 'manual_review';
  retryAt: Date | null;
}>;

export function evaluateRefreshEligibility(
  repository: Pick<RepositoryRecord, 'lastSyncedAt'>,
  now: Date,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
): RefreshEligibility {
  if (!Number.isFinite(refreshIntervalMs) || refreshIntervalMs <= 0) {
    throw new Error('refreshIntervalMs must be a positive finite number.');
  }

  const nextEligibleAt = new Date(
    repository.lastSyncedAt.getTime() + refreshIntervalMs,
  );

  return {
    shouldRefresh: now.getTime() >= nextEligibleAt.getTime(),
    nextEligibleAt,
  };
}

export function decideRetry(
  error: GithubApiError,
  now: Date,
): RetryDecision {
  switch (error.kind) {
    case 'rate_limited':
      return {
        kind: 'retry_later',
        retryAt:
          error.retryAt ??
          new Date(now.getTime() + DEFAULT_RATE_LIMIT_RETRY_MS),
      };
    case 'request_failed':
      return {
        kind: 'retry_later',
        retryAt: new Date(now.getTime() + DEFAULT_REQUEST_RETRY_MS),
      };
    case 'not_found':
      return {
        kind: 'unavailable',
        retryAt: new Date(now.getTime() + DEFAULT_UNAVAILABLE_RETRY_MS),
      };
    case 'invalid_response':
      return {
        kind: 'manual_review',
        retryAt: null,
      };
  }
}
