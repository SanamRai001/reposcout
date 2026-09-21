import { describe, expect, it } from 'vitest';

import { loadEnvironment } from './env.js';

const BASE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '4000',
  DATABASE_URL: 'postgresql://reposcout:reposcout@localhost:5432/reposcout_test',
};

describe('loadEnvironment', () => {
  it('loads database defaults', () => {
    const environment = loadEnvironment(BASE_ENV);

    expect(environment.nodeEnv).toBe('test');
    expect(environment.database.ssl).toBe(false);
    expect(environment.database.poolMax).toBe(10);
    expect(environment.database.connectionTimeoutMs).toBe(5_000);
    expect(environment.database.idleTimeoutMs).toBe(10_000);
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
});
