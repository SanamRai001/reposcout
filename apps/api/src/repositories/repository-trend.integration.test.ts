import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import type { UpsertRepositoryInput } from './repository.js';
import { RepositorySnapshotStore } from './repository-snapshot-store.js';
import { RepositoryStore } from './repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for repository trend integration tests.',
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

beforeEach(async () => {
  await pool.query('DELETE FROM repository_snapshots');
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

function repositoryInput(): UpsertRepositoryInput {
  return {
    githubRepositoryId: '880000001',
    owner: 'trend-org',
    name: 'trend-project',
    fullName: 'trend-org/trend-project',
    githubUrl: 'https://github.com/trend-org/trend-project',
    defaultBranch: 'main',
    description: 'Trend integration fixture.',
    isArchived: false,
    isFork: false,
    createdAtGithub: new Date('2025-01-01T00:00:00Z'),
    updatedAtGithub: new Date('2026-09-30T00:00:00Z'),
    pushedAtGithub: new Date('2026-09-30T01:00:00Z'),
    lastSyncedAt: new Date('2026-09-30T02:00:00Z'),
  };
}

async function capture(
  repositoryId: string,
  capturedAt: string,
  stars: number,
  forks: number,
  openIssues: number,
): Promise<void> {
  await snapshotStore.captureDaily({
    repositoryId,
    capturedAt: new Date(capturedAt),
    stars,
    forks,
    openIssues,
  });
}

describe('repository trend reads with PostgreSQL', () => {
  it('computes signed metric deltas across an exactly covered window', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());

    await capture(
      repository.id,
      '2026-08-31T10:00:00Z',
      100,
      20,
      12,
    );
    await capture(
      repository.id,
      '2026-09-30T09:00:00Z',
      145,
      28,
      7,
    );

    const trend = await snapshotStore.readTrend(repository.id, 30);

    expect(trend).toEqual({
      status: 'complete',
      repositoryId: repository.id,
      requestedWindowDays: 30,
      cutoffOn: '2026-08-31',
      actualWindowDays: 30,
      baseline: {
        capturedOn: '2026-08-31',
        capturedAt: new Date('2026-08-31T10:00:00Z'),
        stars: 100,
        forks: 20,
        openIssues: 12,
      },
      latest: {
        capturedOn: '2026-09-30',
        capturedAt: new Date('2026-09-30T09:00:00Z'),
        stars: 145,
        forks: 28,
        openIssues: 7,
      },
      delta: {
        stars: 45,
        forks: 8,
        openIssues: -5,
      },
    });
  });

  it('uses the closest snapshot on or before the cutoff and reports actual span', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());

    await capture(
      repository.id,
      '2026-09-22T08:00:00Z',
      90,
      9,
      4,
    );
    await capture(
      repository.id,
      '2026-09-30T08:00:00Z',
      110,
      12,
      6,
    );

    const trend = await snapshotStore.readTrend(repository.id, 7);

    expect(trend).toEqual(
      expect.objectContaining({
        status: 'complete',
        requestedWindowDays: 7,
        cutoffOn: '2026-09-23',
        actualWindowDays: 8,
        delta: {
          stars: 20,
          forks: 3,
          openIssues: 2,
        },
      }),
    );

    if (trend.status === 'complete') {
      expect(trend.baseline.capturedOn).toBe('2026-09-22');
      expect(trend.latest.capturedOn).toBe('2026-09-30');
    }
  });

  it('returns explicit insufficient history when the requested window is not covered', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());

    await capture(
      repository.id,
      '2026-09-25T08:00:00Z',
      100,
      10,
      3,
    );
    await capture(
      repository.id,
      '2026-09-30T08:00:00Z',
      120,
      11,
      4,
    );

    const trend = await snapshotStore.readTrend(repository.id, 7);

    expect(trend).toEqual({
      status: 'insufficient_history',
      reason: 'window_not_covered',
      repositoryId: repository.id,
      requestedWindowDays: 7,
      cutoffOn: '2026-09-23',
      availableWindowDays: 5,
      oldestAvailable: {
        capturedOn: '2026-09-25',
        capturedAt: new Date('2026-09-25T08:00:00Z'),
        stars: 100,
        forks: 10,
        openIssues: 3,
      },
      latest: {
        capturedOn: '2026-09-30',
        capturedAt: new Date('2026-09-30T08:00:00Z'),
        stars: 120,
        forks: 11,
        openIssues: 4,
      },
    });
  });

  it('returns explicit no-history state when no snapshots exist', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());

    const trend = await snapshotStore.readTrend(repository.id, 30);

    expect(trend).toEqual({
      status: 'insufficient_history',
      reason: 'no_snapshots',
      repositoryId: repository.id,
      requestedWindowDays: 30,
      cutoffOn: null,
      availableWindowDays: null,
      oldestAvailable: null,
      latest: null,
    });
  });

  it('rejects invalid repository and window inputs', async () => {
    await expect(
      snapshotStore.readTrend('not-a-uuid', 30),
    ).rejects.toThrow('repositoryId must be a valid repository UUID.');

    const repository = await repositoryStore.upsert(repositoryInput());

    await expect(
      snapshotStore.readTrend(repository.id, 0),
    ).rejects.toThrow(
      'windowDays must be an integer between 1 and 365.',
    );
  });
});
