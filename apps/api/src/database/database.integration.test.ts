import { afterAll, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import {
  createDatabasePool,
  verifyDatabaseConnection,
} from './database.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for database integration tests.');
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 2,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);

afterAll(async () => {
  await pool.end();
});

describe('PostgreSQL connection', () => {
  it('connects to PostgreSQL and executes a query', async () => {
    await expect(verifyDatabaseConnection(pool)).resolves.toBeUndefined();

    const result = await pool.query<{ database_name: string }>(
      'SELECT current_database() AS database_name',
    );

    expect(result.rows[0]?.database_name).toBe('reposcout_test');
  });
});
