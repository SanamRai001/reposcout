import { describe, expect, it } from 'vitest';

import { GithubApiError } from './github-client.js';
import {
  decideRetry,
  evaluateRefreshEligibility,
} from './repository-refresh-policy.js';

describe('evaluateRefreshEligibility', () => {
  const lastSyncedAt = new Date('2026-09-21T00:00:00Z');

  it('skips a recently synchronized repository', () => {
    const result = evaluateRefreshEligibility(
      { lastSyncedAt },
      new Date('2026-09-21T05:59:59Z'),
    );

    expect(result.shouldRefresh).toBe(false);
    expect(result.nextEligibleAt.toISOString()).toBe(
      '2026-09-21T06:00:00.000Z',
    );
  });

  it('refreshes when the interval has elapsed', () => {
    const result = evaluateRefreshEligibility(
      { lastSyncedAt },
      new Date('2026-09-21T06:00:00Z'),
    );

    expect(result.shouldRefresh).toBe(true);
  });
});

describe('decideRetry', () => {
  const now = new Date('2026-09-21T12:00:00Z');

  it('uses GitHub rate-limit reset time when available', () => {
    const retryAt = new Date('2026-09-21T13:00:00Z');
    const result = decideRetry(
      new GithubApiError('rate_limited', 'limited', 403, retryAt),
      now,
    );

    expect(result).toEqual({
      kind: 'retry_later',
      retryAt,
    });
  });

  it('delays transient request failures', () => {
    const result = decideRetry(
      new GithubApiError('request_failed', 'failed', 502),
      now,
    );

    expect(result.kind).toBe('retry_later');
    expect(result.retryAt?.toISOString()).toBe('2026-09-21T12:05:00.000Z');
  });

  it('preserves unavailable repositories and retries later', () => {
    const result = decideRetry(
      new GithubApiError('not_found', 'missing', 404),
      now,
    );

    expect(result.kind).toBe('unavailable');
    expect(result.retryAt?.toISOString()).toBe('2026-09-22T12:00:00.000Z');
  });

  it('requires manual review for invalid upstream data', () => {
    const result = decideRetry(
      new GithubApiError('invalid_response', 'bad payload'),
      now,
    );

    expect(result).toEqual({
      kind: 'manual_review',
      retryAt: null,
    });
  });
});
