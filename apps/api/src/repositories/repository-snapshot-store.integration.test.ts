import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import type { UpsertRepositoryInput } from './repository.js';
import { RepositorySnapshotStore } from './repository-snapshot-store.js';
import { RepositoryStore } from './repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for repository snapshot tests.');
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

beforeEach(async () => {
  await pool.query('DELETE FROM repository_snapshots');
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

function repositoryInput(): UpsertRepositoryInput {
  return {
    githubRepositoryId: '765432109876543210',
    owner: 'snapshot-org',
    name: 'tracked-project',
    fullName: 'snapshot-org/tracked-project',
    githubUrl: 'https://github.com/snapshot-org/tracked-project',
    defaultBranch: 'main',
    description: 'Snapshot persistence fixture.',
    isArchived: false,
    isFork: false,
    createdAtGithub: new Date('2025-01-01T00:00:00Z'),
    updatedAtGithub: new Date('2026-09-25T00:00:00Z'),
    pushedAtGithub: new Date('2026-09-25T01:00:00Z'),
    lastSyncedAt: new Date('2026-09-25T02:00:00Z'),
  };
}

describe('RepositorySnapshotStore with PostgreSQL', () => {
  it('creates one measured snapshot for a UTC day', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());

    const result = await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-09-25T12:34:56Z'),
      stars: 120,
      forks: 18,
      openIssues: 7,
    });

    expect(result.kind).toBe('created');
    expect(result.snapshot).toEqual(
      expect.objectContaining({
        repositoryId: repository.id,
        capturedOn: '2026-09-25',
        capturedAt: new Date('2026-09-25T12:34:56Z'),
        stars: 120,
        forks: 18,
        openIssues: 7,
      }),
    );
  });

  it('is first-write-wins and idempotent within the same UTC day', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());

    const first = await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-09-25T02:00:00Z'),
      stars: 100,
      forks: 10,
      openIssues: 5,
    });
    const retry = await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-09-25T22:00:00Z'),
      stars: 999,
      forks: 999,
      openIssues: 999,
    });

    expect(first.kind).toBe('created');
    expect(retry.kind).toBe('existing');
    expect(retry.snapshot.id).toBe(first.snapshot.id);
    expect(retry.snapshot.capturedAt.toISOString()).toBe(
      '2026-09-25T02:00:00.000Z',
    );
    expect(retry.snapshot.stars).toBe(100);

    const count = await pool.query<{ count: string }>(
      `
        SELECT count(*)::text AS count
        FROM repository_snapshots
        WHERE repository_id = $1
      `,
      [repository.id],
    );

    expect(count.rows[0]?.count).toBe('1');
  });

  it('keeps backfills for distinct UTC days and returns newest history first', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());

    await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-09-25T12:00:00Z'),
      stars: 30,
      forks: 3,
      openIssues: 1,
    });
    await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-09-23T12:00:00Z'),
      stars: 10,
      forks: 1,
      openIssues: 4,
    });
    await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-09-24T12:00:00Z'),
      stars: 20,
      forks: 2,
      openIssues: 2,
    });

    const history = await snapshotStore.listRecent(repository.id, 2);

    expect(history.map((snapshot) => snapshot.capturedOn)).toEqual([
      '2026-09-25',
      '2026-09-24',
    ]);
    expect(history.map((snapshot) => snapshot.stars)).toEqual([30, 20]);
  });

  it('uses the UTC date as the idempotency bucket', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());

    const beforeMidnight = await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-09-25T23:59:59Z'),
      stars: 1,
      forks: 1,
      openIssues: 1,
    });
    const afterMidnight = await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-09-26T00:00:00Z'),
      stars: 2,
      forks: 1,
      openIssues: 1,
    });

    expect(beforeMidnight.kind).toBe('created');
    expect(afterMidnight.kind).toBe('created');

    const history = await snapshotStore.listRecent(repository.id, 10);
    expect(history.map((snapshot) => snapshot.capturedOn)).toEqual([
      '2026-09-26',
      '2026-09-25',
    ]);
  });

  it('rejects invalid metric and query inputs before database work', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());

    await expect(
      snapshotStore.captureDaily({
        repositoryId: repository.id,
        capturedAt: new Date('invalid'),
        stars: 1,
        forks: 1,
        openIssues: 1,
      }),
    ).rejects.toThrow('capturedAt must be a valid date.');

    await expect(
      snapshotStore.captureDaily({
        repositoryId: repository.id,
        capturedAt: new Date('2026-09-25T12:00:00Z'),
        stars: -1,
        forks: 1,
        openIssues: 1,
      }),
    ).rejects.toThrow('stars must be a nonnegative safe integer.');

    await expect(
      snapshotStore.listRecent(repository.id, 366),
    ).rejects.toThrow('limit must be an integer between 1 and 365.');
  });

  it('cascades snapshots when the canonical repository is deleted', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());

    await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-09-25T12:00:00Z'),
      stars: 10,
      forks: 2,
      openIssues: 1,
    });

    await pool.query('DELETE FROM repositories WHERE id = $1', [
      repository.id,
    ]);

    const count = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM repository_snapshots',
    );

    expect(count.rows[0]?.count).toBe('0');
  });
});
