import { describe, expect, it } from 'vitest';

import { RepositorySubmissionRateLimiter } from './repository-submission-rate-limiter.js';

describe('RepositorySubmissionRateLimiter', () => {
  it('allows requests until the fixed-window limit is exhausted', () => {
    let now = 1_000;
    const limiter = new RepositorySubmissionRateLimiter({
      windowMs: 60_000,
      maxAttempts: 2,
      maxTrackedClients: 100,
      now: () => now,
    });

    expect(limiter.consume('client-a')).toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      retryAfterSeconds: 60,
    });

    now += 1_000;

    expect(limiter.consume('client-a')).toEqual({
      allowed: true,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 59,
    });

    expect(limiter.consume('client-a')).toEqual({
      allowed: false,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 59,
    });
  });

  it('starts a fresh window after the previous window expires', () => {
    let now = 5_000;
    const limiter = new RepositorySubmissionRateLimiter({
      windowMs: 10_000,
      maxAttempts: 1,
      maxTrackedClients: 100,
      now: () => now,
    });

    expect(limiter.consume('client-a').allowed).toBe(true);
    expect(limiter.consume('client-a').allowed).toBe(false);

    now += 10_000;

    expect(limiter.consume('client-a')).toEqual({
      allowed: true,
      limit: 1,
      remaining: 0,
      retryAfterSeconds: 10,
    });
  });

  it('keeps independent buckets for different client keys', () => {
    const limiter = new RepositorySubmissionRateLimiter({
      windowMs: 60_000,
      maxAttempts: 1,
      maxTrackedClients: 100,
      now: () => 10_000,
    });

    expect(limiter.consume('client-a').allowed).toBe(true);
    expect(limiter.consume('client-b').allowed).toBe(true);
    expect(limiter.consume('client-a').allowed).toBe(false);
  });

  it('bounds memory and denies untracked clients until capacity frees', () => {
    let now = 20_000;
    const limiter = new RepositorySubmissionRateLimiter({
      windowMs: 30_000,
      maxAttempts: 5,
      maxTrackedClients: 2,
      now: () => now,
    });

    expect(limiter.consume('client-a').allowed).toBe(true);
    expect(limiter.consume('client-b').allowed).toBe(true);

    expect(limiter.consume('client-c')).toEqual({
      allowed: false,
      limit: 5,
      remaining: 0,
      retryAfterSeconds: 30,
    });

    now += 30_000;

    expect(limiter.consume('client-c').allowed).toBe(true);
  });
});
