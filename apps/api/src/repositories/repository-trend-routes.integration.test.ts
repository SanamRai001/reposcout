import type { AddressInfo } from 'node:net';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { RepositorySnapshotStore } from './repository-snapshot-store.js';
import { RepositoryStore } from './repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for repository trend route tests.',
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
const servers: ReturnType<ReturnType<typeof createApp>['listen']>[] = [];

beforeEach(async () => {
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
  await pool.end();
});

async function startApp(): Promise<string> {
  const app = createApp({
    repositoryCatalog: repositoryStore,
    repositoryTrend: snapshotStore,
  });
  const server = app.listen(0);
  servers.push(server);

  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}`;
}

async function seedRepository(
  initialListing: 'listed' | 'unlisted' = 'listed',
) {
  return repositoryStore.upsertWithMetadata(
    {
      githubRepositoryId:
        initialListing === 'listed' ? '990000001' : '990000002',
      owner: 'trend-api',
      name:
        initialListing === 'listed'
          ? 'public-project'
          : 'private-candidate',
      fullName:
        initialListing === 'listed'
          ? 'trend-api/public-project'
          : 'trend-api/private-candidate',
      githubUrl:
        initialListing === 'listed'
          ? 'https://github.com/trend-api/public-project'
          : 'https://github.com/trend-api/private-candidate',
      defaultBranch: 'main',
      description: 'Trend API fixture.',
      isArchived: false,
      isFork: false,
      createdAtGithub: new Date('2025-01-01T00:00:00Z'),
      updatedAtGithub: new Date('2026-09-30T00:00:00Z'),
      pushedAtGithub: new Date('2026-09-30T01:00:00Z'),
      lastSyncedAt: new Date('2026-09-30T08:00:00Z'),
    },
    {
      stars: 140,
      forks: 14,
      openIssues: 4,
      primaryLanguage: 'TypeScript',
      licenseSpdx: 'MIT',
      topics: ['history'],
      observedAt: new Date('2026-09-30T08:00:00Z'),
    },
    {
      initialListing,
    },
  );
}

describe('repository trend API with PostgreSQL', () => {
  it('returns deterministic signed deltas for a listed repository', async () => {
    const repository = await seedRepository();

    await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-08-31T08:00:00Z'),
      stars: 100,
      forks: 10,
      openIssues: 9,
    });

    const baseUrl = await startApp();
    const response = await fetch(
      `${baseUrl}/api/repositories/${repository.id}/trend?windowDays=30`,
    );
    const body = (await response.json()) as {
      data: {
        status: string;
        requestedWindowDays: number;
        cutoffOn: string;
        actualWindowDays: number;
        baseline: { capturedAt: string; stars: number };
        latest: { capturedAt: string; stars: number };
        delta: {
          stars: number;
          forks: number;
          openIssues: number;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(body.data).toEqual(
      expect.objectContaining({
        status: 'complete',
        requestedWindowDays: 30,
        cutoffOn: '2026-08-31',
        actualWindowDays: 30,
        delta: {
          stars: 40,
          forks: 4,
          openIssues: -5,
        },
      }),
    );
    expect(body.data.baseline.capturedAt).toBe(
      '2026-08-31T08:00:00.000Z',
    );
    expect(body.data.latest.capturedAt).toBe(
      '2026-09-30T08:00:00.000Z',
    );
  });

  it('returns explicit insufficient-history state instead of a partial-window delta', async () => {
    const repository = await seedRepository();
    const baseUrl = await startApp();

    const response = await fetch(
      `${baseUrl}/api/repositories/${repository.id}/trend?windowDays=30`,
    );
    const body = (await response.json()) as {
      data: {
        status: string;
        reason: string;
        requestedWindowDays: number;
        availableWindowDays: number | null;
        oldestAvailable: { capturedOn: string } | null;
        latest: { capturedOn: string } | null;
      };
    };

    expect(response.status).toBe(200);
    expect(body.data).toEqual(
      expect.objectContaining({
        status: 'insufficient_history',
        reason: 'window_not_covered',
        requestedWindowDays: 30,
        availableWindowDays: 0,
      }),
    );
    expect(body.data.oldestAvailable?.capturedOn).toBe('2026-09-30');
    expect(body.data.latest?.capturedOn).toBe('2026-09-30');
  });

  it('requires an explicit valid trend window', async () => {
    const repository = await seedRepository();
    const baseUrl = await startApp();

    const missing = await fetch(
      `${baseUrl}/api/repositories/${repository.id}/trend`,
    );
    const invalid = await fetch(
      `${baseUrl}/api/repositories/${repository.id}/trend?windowDays=366`,
    );

    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toEqual({
      error: 'invalid_trend_window',
      message: 'windowDays must be an integer between 1 and 365.',
    });

    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({
      error: 'invalid_trend_window',
      message: 'windowDays must be an integer between 1 and 365.',
    });
  });

  it('does not expose snapshot history for an unlisted canonical repository', async () => {
    const repository = await seedRepository('unlisted');

    await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-08-31T08:00:00Z'),
      stars: 1,
      forks: 1,
      openIssues: 1,
    });

    const baseUrl = await startApp();
    const response = await fetch(
      `${baseUrl}/api/repositories/${repository.id}/trend?windowDays=30`,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'repository_not_found',
      message: 'Repository was not found.',
    });
  });
});
