import pg from 'pg';
import type { Pool as PoolType, PoolConfig } from 'pg';

import type { DatabaseEnvironment } from '../config/env.js';
import { logger } from '../logger.js';

const { Pool } = pg;

export type DatabasePool = PoolType;

export function createDatabasePool(
  environment: DatabaseEnvironment,
): DatabasePool {
  const config: PoolConfig = {
    connectionString: environment.url,
    max: environment.poolMax,
    connectionTimeoutMillis: environment.connectionTimeoutMs,
    idleTimeoutMillis: environment.idleTimeoutMs,
    application_name: 'reposcout-api',
    statement_timeout: 10_000,
  };

  if (environment.ssl) {
    config.ssl = {
      rejectUnauthorized: true,
    };
  }

  const pool = new Pool(config);

  pool.on('error', (error) => {
    logger.error('database.pool_error', {
      error: error.message,
    });
  });

  return pool;
}

export async function verifyDatabaseConnection(
  pool: DatabasePool,
): Promise<void> {
  const result = await pool.query<{ ok: number }>('SELECT 1::int AS ok');

  if (result.rows[0]?.ok !== 1) {
    throw new Error('PostgreSQL connectivity check returned an invalid result.');
  }
}
