import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { RepositorySnapshotMaintenanceStore } from './repository-snapshot-maintenance-store.js';
import { RepositoryStore } from './repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for snapshot maintenance integration tests.',
  );
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 6,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);
const repositoryStore = new RepositoryStore(pool);
const maintenanceStore = new RepositorySnapshotMaintenanceStore(pool);

beforeEach(async () => {
  await pool.query('DELETE FROM repository_snapshots');
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

async function seed(
  githubRepositoryId: string,
  name: string,
  lastSyncedAt: Date,
  initialListing: 'listed' | 'unlisted' = 'listed',
): Promise<string> {
  const repository = await repositoryStore.upsert(
    {
      githubRepositoryId,
      owner: 'maintenance-org',
      name,
      fullName: `maintenance-org/${name}`,
      githubUrl: `https://github.com/maintenance-org/${name}`,
      defaultBranch: 'main',
      description: 'Snapshot maintenance fixture.',
      isArchived: false,
      isFork: false,
      createdAtGithub: new Date('2025-01-01T00:00:00Z'),
      updatedAtGithub: lastSyncedAt,
      pushedAtGithub: lastSyncedAt,
      lastSyncedAt,
    },
    {
      initialListing,
    },
  );

  return repository.id;
}

describe('RepositorySnapshotMaintenanceStore with PostgreSQL', () => {
  it('selects only stale listed repositories missing the current UTC-day snapshot', async () => {
    const oldestId = await seed(
      '910000001',
      'oldest',
      new Date('2026-09-24T00:00:00Z'),
    );
    const secondId = await seed(
      '910000002',
      'second',
      new Date('2026-09-25T00:00:00Z'),
    );
    await seed(
      '910000003',
      'recent',
      new Date('2026-09-26T08:00:00Z'),
    );
    await seed(
      '910000004',
      'unlisted',
      new Date('2026-09-20T00:00:00Z'),
      'unlisted',
    );
    const coveredId = await seed(
      '910000005',
      'covered',
      new Date('2026-09-20T00:00:00Z'),
    );

    await pool.query(
      `
        INSERT INTO repository_snapshots (
          id,
          repository_id,
          captured_on,
          captured_at,
          stars,
          forks,
          open_issues
        )
        VALUES (
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          $1,
          '2026-09-26',
          '2026-09-26T00:05:00Z',
          1,
          1,
          1
        )
      `,
      [coveredId],
    );

    const candidates = await maintenanceStore.listRefreshCandidates({
      now: new Date('2026-09-26T12:00:00Z'),
      refreshIntervalMs: 6 * 60 * 60 * 1000,
      limit: 10,
    });

    expect(candidates.map((candidate) => candidate.repositoryId)).toEqual([
      oldestId,
      secondId,
    ]);
  });

  it('uses deterministic oldest-sync ordering with a hard batch limit', async () => {
    const firstId = await seed(
      '920000001',
      'first',
      new Date('2026-09-20T00:00:00Z'),
    );
    const secondId = await seed(
      '920000002',
      'second',
      new Date('2026-09-21T00:00:00Z'),
    );
    await seed(
      '920000003',
      'third',
      new Date('2026-09-22T00:00:00Z'),
    );

    const candidates = await maintenanceStore.listRefreshCandidates({
      now: new Date('2026-09-26T12:00:00Z'),
      refreshIntervalMs: 6 * 60 * 60 * 1000,
      limit: 2,
    });

    expect(candidates.map((candidate) => candidate.repositoryId)).toEqual([
      firstId,
      secondId,
    ]);
  });

  it('allows only one overlapping maintenance run lock', async () => {
    const first = await maintenanceStore.tryAcquireRunLock();

    expect(first).not.toBeNull();

    const secondStore = new RepositorySnapshotMaintenanceStore(pool);
    const second = await secondStore.tryAcquireRunLock();

    expect(second).toBeNull();

    await first?.release();

    const third = await secondStore.tryAcquireRunLock();

    expect(third).not.toBeNull();
    await third?.release();
  });

  it('validates maintenance selection inputs', async () => {
    await expect(
      maintenanceStore.listRefreshCandidates({
        now: new Date('invalid'),
        refreshIntervalMs: 1000,
        limit: 1,
      }),
    ).rejects.toThrow('now must be a valid date.');

    await expect(
      maintenanceStore.listRefreshCandidates({
        now: new Date(),
        refreshIntervalMs: 0,
        limit: 1,
      }),
    ).rejects.toThrow(
      'refreshIntervalMs must be a positive finite number.',
    );

    await expect(
      maintenanceStore.listRefreshCandidates({
        now: new Date(),
        refreshIntervalMs: 1000,
        limit: 101,
      }),
    ).rejects.toThrow(
      'refresh limit must be an integer between 1 and 100.',
    );
  });
});
