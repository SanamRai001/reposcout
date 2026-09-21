import { afterAll, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for migration rollback tests.');
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 1,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);

afterAll(async () => {
  await pool.end();
});

describe('repositories migration rollback', () => {
  it('removes the repositories table', async () => {
    const result = await pool.query<{ relation_name: string | null }>(
      "SELECT to_regclass('public.repositories')::text AS relation_name",
    );

    expect(result.rows[0]?.relation_name).toBeNull();
  });
});
