import type { PoolClient } from 'pg';

import type { DatabasePool } from '../database/database.js';

const SNAPSHOT_MAINTENANCE_LOCK_CLASS = 73_091;
const SNAPSHOT_MAINTENANCE_LOCK_KEY = 1;

export type RepositorySnapshotRefreshCandidate = Readonly<{
  repositoryId: string;
  fullName: string;
  lastSyncedAt: Date;
}>;

export type SnapshotMaintenanceLockHandle = Readonly<{
  release(): Promise<void>;
}>;

export class RepositorySnapshotMaintenanceStore {
  public constructor(private readonly pool: DatabasePool) {}

  async tryAcquireRunLock(): Promise<SnapshotMaintenanceLockHandle | null> {
    const client = await this.pool.connect();
    let released = false;

    try {
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1, $2) AS acquired',
        [SNAPSHOT_MAINTENANCE_LOCK_CLASS, SNAPSHOT_MAINTENANCE_LOCK_KEY],
      );

      if (result.rows[0]?.acquired !== true) {
        client.release();
        return null;
      }

      return {
        release: async (): Promise<void> => {
          if (released) {
            return;
          }

          released = true;

          try {
            await client.query(
              'SELECT pg_advisory_unlock($1, $2)',
              [
                SNAPSHOT_MAINTENANCE_LOCK_CLASS,
                SNAPSHOT_MAINTENANCE_LOCK_KEY,
              ],
            );
          } finally {
            client.release();
          }
        },
      };
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async listRefreshCandidates(input: Readonly<{
    now: Date;
    refreshIntervalMs: number;
    limit: number;
  }>): Promise<RepositorySnapshotRefreshCandidate[]> {
    if (!(input.now instanceof Date) || Number.isNaN(input.now.getTime())) {
      throw new Error('now must be a valid date.');
    }

    if (
      !Number.isFinite(input.refreshIntervalMs) ||
      input.refreshIntervalMs <= 0
    ) {
      throw new Error(
        'refreshIntervalMs must be a positive finite number.',
      );
    }

    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
      throw new Error(
        'refresh limit must be an integer between 1 and 100.',
      );
    }

    const refreshBefore = new Date(
      input.now.getTime() - input.refreshIntervalMs,
    );

    const result = await this.pool.query<{
      repository_id: string;
      full_name: string;
      last_synced_at: Date;
    }>(
      `
        SELECT
          r.id AS repository_id,
          r.full_name,
          r.last_synced_at
        FROM repositories AS r
        WHERE r.is_listed = true
          AND r.last_synced_at <= $1
          AND NOT EXISTS (
            SELECT 1
            FROM repository_snapshots AS s
            WHERE s.repository_id = r.id
              AND s.captured_on =
                (($2::timestamptz AT TIME ZONE 'UTC')::date)
          )
        ORDER BY r.last_synced_at ASC, r.id ASC
        LIMIT $3
      `,
      [refreshBefore, input.now, input.limit],
    );

    return result.rows.map((row) => ({
      repositoryId: row.repository_id,
      fullName: row.full_name,
      lastSyncedAt: row.last_synced_at,
    }));
  }
}
