import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { RepositoryStore } from './repository-store.js';
import { RepositorySnapshotBackfillService } from './repository-snapshot-backfill-service.js';
import { RepositorySnapshotStore } from './repository-snapshot-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for repository snapshot backfill tests.',
  );
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 3,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);
const repositoryStore = new RepositoryStore(pool);
const snapshotStore = new RepositorySnapshotStore(pool);
const backfillService = new RepositorySnapshotBackfillService(
  snapshotStore,
  snapshotStore,
);

beforeEach(async () => {
  await pool.query('DELETE FROM repository_snapshots');
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

async function seedRepository(
  githubRepositoryId: string,
  fullName: string,
  observedAt: Date,
  stars: number,
): Promise<string> {
  const [owner, name] = fullName.split('/');

  if (!owner || !name) {
    throw new Error('Backfill fixture full name is invalid.');
  }

  const repository = await repositoryStore.upsertWithMetadata(
    {
      githubRepositoryId,
      owner,
      name,
      fullName,
      githubUrl: `https://github.com/${fullName}`,
      defaultBranch: 'main',
      description: 'Backfill fixture.',
      isArchived: false,
      isFork: false,
      createdAtGithub: new Date('2025-01-01T00:00:00Z'),
      updatedAtGithub: observedAt,
      pushedAtGithub: observedAt,
      lastSyncedAt: observedAt,
    },
    {
      stars,
      forks: 2,
      openIssues: 1,
      primaryLanguage: 'TypeScript',
      licenseSpdx: 'MIT',
      topics: ['history'],
      observedAt,
    },
  );

  return repository.id;
}

describe('repository snapshot metadata backfill with PostgreSQL', () => {
  it('backfills stored metadata in bounded oldest-first batches', async () => {
    const firstId = await seedRepository(
      '700000001',
      'example/first',
      new Date('2026-09-20T12:00:00Z'),
      10,
    );
    const secondId = await seedRepository(
      '700000002',
      'example/second',
      new Date('2026-09-21T12:00:00Z'),
      20,
    );
    const thirdId = await seedRepository(
      '700000003',
      'example/third',
      new Date('2026-09-22T12:00:00Z'),
      30,
    );

    await pool.query('DELETE FROM repository_snapshots');

    const firstBatch = await backfillService.runBatch(2);

    expect(firstBatch.selected).toBe(2);
    expect(firstBatch.processed).toBe(2);
    expect(firstBatch.summary).toEqual({
      created: 2,
      existing: 0,
    });
    expect(firstBatch.items.map((item) => item.repositoryId)).toEqual([
      firstId,
      secondId,
    ]);

    const stored = await pool.query<{
      repository_id: string;
      captured_on: string;
      stars: string;
    }>(
      `
        SELECT repository_id, captured_on::text, stars
        FROM repository_snapshots
        ORDER BY captured_on ASC
      `,
    );

    expect(stored.rows).toEqual([
      {
        repository_id: firstId,
        captured_on: '2026-09-20',
        stars: '10',
      },
      {
        repository_id: secondId,
        captured_on: '2026-09-21',
        stars: '20',
      },
    ]);

    const secondBatch = await backfillService.runBatch(2);

    expect(secondBatch.selected).toBe(1);
    expect(secondBatch.items[0]?.repositoryId).toBe(thirdId);
    expect(secondBatch.summary.created).toBe(1);
  });

  it('does not select metadata whose observation day already has a snapshot', async () => {
    const repositoryId = await seedRepository(
      '700000004',
      'example/already-covered',
      new Date('2026-09-23T12:00:00Z'),
      40,
    );

    const candidates =
      await snapshotStore.listLatestMetadataBackfillCandidates(10);

    expect(candidates).toEqual([]);

    const count = await pool.query<{ count: string }>(
      `
        SELECT count(*)::text AS count
        FROM repository_snapshots
        WHERE repository_id = $1
      `,
      [repositoryId],
    );

    expect(count.rows[0]?.count).toBe('1');
  });

  it('backfills unlisted canonical repository observations too', async () => {
    const repository = await repositoryStore.upsertWithMetadata(
      {
        githubRepositoryId: '700000005',
        owner: 'example',
        name: 'unlisted',
        fullName: 'example/unlisted',
        githubUrl: 'https://github.com/example/unlisted',
        defaultBranch: 'main',
        description: 'Unlisted history fixture.',
        isArchived: false,
        isFork: false,
        createdAtGithub: new Date('2025-01-01T00:00:00Z'),
        updatedAtGithub: new Date('2026-09-24T12:00:00Z'),
        pushedAtGithub: new Date('2026-09-24T12:00:00Z'),
        lastSyncedAt: new Date('2026-09-24T12:00:00Z'),
      },
      {
        stars: 5,
        forks: 1,
        openIssues: 0,
        primaryLanguage: null,
        licenseSpdx: null,
        topics: [],
        observedAt: new Date('2026-09-24T12:00:00Z'),
      },
      {
        initialListing: 'unlisted',
      },
    );

    await pool.query(
      'DELETE FROM repository_snapshots WHERE repository_id = $1',
      [repository.id],
    );

    const report = await backfillService.runBatch(10);

    expect(report.items).toEqual([
      expect.objectContaining({
        repositoryId: repository.id,
        fullName: 'example/unlisted',
        result: 'created',
      }),
    ]);
  });
});
