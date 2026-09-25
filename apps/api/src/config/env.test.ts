import { describe, expect, it } from 'vitest';

import { loadEnvironment } from './env.js';

const BASE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '4000',
  DATABASE_URL: 'postgresql://reposcout:reposcout@localhost:5432/reposcout_test',
};

describe('loadEnvironment', () => {
  it('loads database and GitHub defaults', () => {
    const environment = loadEnvironment(BASE_ENV);

    expect(environment.nodeEnv).toBe('test');
    expect(environment.database.ssl).toBe(false);
    expect(environment.database.poolMax).toBe(10);
    expect(environment.database.connectionTimeoutMs).toBe(5_000);
    expect(environment.database.idleTimeoutMs).toBe(10_000);
    expect(environment.github.token).toBeUndefined();
    expect(environment.github.requestTimeoutMs).toBe(8_000);
    expect(environment.moderation.reviewers).toEqual([]);
    expect(environment.http.trustProxyHops).toBe(0);
    expect(environment.submission.rateLimit).toEqual({
      windowMs: 600_000,
      maxAttempts: 10,
      maxTrackedClients: 10_000,
    });
    expect(environment.submission.resubmissionCooldownMs).toBe(86_400_000);
  });

  it('loads an optional GitHub token without requiring one for public data', () => {
    const environment = loadEnvironment({
      ...BASE_ENV,
      GITHUB_TOKEN: '  example-token  ',
      GITHUB_REQUEST_TIMEOUT_MS: '12000',
    });

    expect(environment.github.token).toBe('example-token');
    expect(environment.github.requestTimeoutMs).toBe(12_000);
  });

  it('loads explicit submission rate-limit and proxy settings', () => {
    const environment = loadEnvironment({
      ...BASE_ENV,
      TRUST_PROXY_HOPS: '1',
      SUBMISSION_RATE_LIMIT_WINDOW_MS: '120000',
      SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS: '4',
      SUBMISSION_RATE_LIMIT_MAX_CLIENTS: '5000',
      SUBMISSION_RESUBMISSION_COOLDOWN_MS: '7200000',
    });

    expect(environment.http.trustProxyHops).toBe(1);
    expect(environment.submission.rateLimit).toEqual({
      windowMs: 120_000,
      maxAttempts: 4,
      maxTrackedClients: 5_000,
    });
    expect(environment.submission.resubmissionCooldownMs).toBe(7_200_000);
  });

  it('rejects invalid submission rate-limit and proxy settings', () => {
    expect(() =>
      loadEnvironment({
        ...BASE_ENV,
        TRUST_PROXY_HOPS: '6',
      }),
    ).toThrow('TRUST_PROXY_HOPS must be an integer between 0 and 5.');

    expect(() =>
      loadEnvironment({
        ...BASE_ENV,
        SUBMISSION_RATE_LIMIT_WINDOW_MS: '500',
      }),
    ).toThrow(
      'SUBMISSION_RATE_LIMIT_WINDOW_MS must be an integer between 1000 and 3600000.',
    );

    expect(() =>
      loadEnvironment({
        ...BASE_ENV,
        SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS: '0',
      }),
    ).toThrow(
      'SUBMISSION_RATE_LIMIT_MAX_ATTEMPTS must be an integer between 1 and 1000.',
    );

    expect(() =>
      loadEnvironment({
        ...BASE_ENV,
        SUBMISSION_RATE_LIMIT_MAX_CLIENTS: '99',
      }),
    ).toThrow(
      'SUBMISSION_RATE_LIMIT_MAX_CLIENTS must be an integer between 100 and 100000.',
    );

    expect(() =>
      loadEnvironment({
        ...BASE_ENV,
        SUBMISSION_RESUBMISSION_COOLDOWN_MS: '59999',
      }),
    ).toThrow(
      'SUBMISSION_RESUBMISSION_COOLDOWN_MS must be an integer between 60000 and 2592000000.',
    );
  });

  it('loads trusted moderation reviewer credentials', () => {
    const environment = loadEnvironment({
      ...BASE_ENV,
      MODERATION_REVIEWERS_JSON: JSON.stringify({
        'maintainer:SanamRai001':
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'reviewer:second':
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    });

    expect(environment.moderation.reviewers).toEqual([
      {
        reviewerRef: 'maintainer:SanamRai001',
        token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      {
        reviewerRef: 'reviewer:second',
        token: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    ]);
  });

  it('rejects malformed moderation reviewer configuration', () => {
    expect(() =>
      loadEnvironment({
        ...BASE_ENV,
        MODERATION_REVIEWERS_JSON: '[]',
      }),
    ).toThrow(
      'MODERATION_REVIEWERS_JSON must be a JSON object mapping reviewer references to bearer tokens.',
    );

    expect(() =>
      loadEnvironment({
        ...BASE_ENV,
        MODERATION_REVIEWERS_JSON: JSON.stringify({
          reviewer: 'too-short',
        }),
      }),
    ).toThrow(
      'Moderation reviewer tokens must be 32-512 non-whitespace characters.',
    );
  });

  it('rejects a missing database URL', () => {
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'test',
      }),
    ).toThrow('DATABASE_URL is required.');
  });

  it('rejects non-PostgreSQL database URLs', () => {
    expect(() =>
      loadEnvironment({
        ...BASE_ENV,
        DATABASE_URL: 'mysql://localhost/reposcout',
      }),
    ).toThrow('DATABASE_URL must use the postgres:// or postgresql:// protocol.');
  });

  it('rejects invalid boolean database settings', () => {
    expect(() =>
      loadEnvironment({
        ...BASE_ENV,
        DATABASE_SSL: 'yes',
      }),
    ).toThrow('DATABASE_SSL must be either "true" or "false".');
  });

  it('rejects invalid pool sizes', () => {
    expect(() =>
      loadEnvironment({
        ...BASE_ENV,
        DATABASE_POOL_MAX: '0',
      }),
    ).toThrow('DATABASE_POOL_MAX must be an integer between 1 and 100.');
  });

  it('rejects invalid GitHub request timeouts', () => {
    expect(() =>
      loadEnvironment({
        ...BASE_ENV,
        GITHUB_REQUEST_TIMEOUT_MS: '100',
      }),
    ).toThrow(
      'GITHUB_REQUEST_TIMEOUT_MS must be an integer between 500 and 60000.',
    );
  });
});
