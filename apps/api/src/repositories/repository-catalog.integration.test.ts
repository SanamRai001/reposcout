import type { AddressInfo } from 'node:net';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import type { UpsertRepositoryInput } from './repository.js';
import { RepositoryStore } from './repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for repository catalog tests.');
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 2,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);
const repositoryStore = new RepositoryStore(pool);
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

function createInput(
  githubRepositoryId: string,
  name: string,
): UpsertRepositoryInput {
  return {
    githubRepositoryId,
    owner: 'catalog-org',
    name,
    fullName: `catalog-org/${name}`,
    githubUrl: `https://github.com/catalog-org/${name}`,
    defaultBranch: 'main',
    description: `Catalog fixture ${name}`,
    isArchived: false,
    isFork: false,
    createdAtGithub: new Date('2026-01-01T00:00:00.000Z'),
    updatedAtGithub: new Date('2026-09-20T00:00:00.000Z'),
    pushedAtGithub: new Date('2026-09-20T01:00:00.000Z'),
    lastSyncedAt: new Date('2026-09-21T00:00:00.000Z'),
  };
}

async function startApp(): Promise<string> {
  const app = createApp({
    repositoryCatalog: repositoryStore,
  });
  const server = app.listen(0);
  servers.push(server);

  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}`;
}

describe('repository catalog API with PostgreSQL', () => {
  it('paginates through canonical repositories without duplicates', async () => {
    const created = await Promise.all([
      repositoryStore.upsert(createInput('300000001', 'alpha')),
      repositoryStore.upsert(createInput('300000002', 'beta')),
      repositoryStore.upsert(createInput('300000003', 'gamma')),
    ]);
    const expectedIds = created.map((repository) => repository.id).sort();
    const baseUrl = await startApp();

    const firstResponse = await fetch(
      `${baseUrl}/api/repositories?limit=2`,
    );
    const firstBody = (await firstResponse.json()) as {
      data: Array<{ id: string }>;
      pagination: { nextCursor: string | null };
    };

    expect(firstResponse.status).toBe(200);
    expect(firstBody.data.map((repository) => repository.id)).toEqual(
      expectedIds.slice(0, 2),
    );
    expect(firstBody.pagination.nextCursor).toEqual(expect.any(String));

    const secondResponse = await fetch(
      `${baseUrl}/api/repositories?limit=2&cursor=${encodeURIComponent(
        firstBody.pagination.nextCursor as string,
      )}`,
    );
    const secondBody = (await secondResponse.json()) as {
      data: Array<{ id: string }>;
      pagination: { nextCursor: string | null };
    };

    expect(secondResponse.status).toBe(200);
    expect(secondBody.data.map((repository) => repository.id)).toEqual(
      expectedIds.slice(2),
    );
    expect(secondBody.pagination.nextCursor).toBeNull();

    const allIds = [
      ...firstBody.data.map((repository) => repository.id),
      ...secondBody.data.map((repository) => repository.id),
    ];

    expect(new Set(allIds).size).toBe(3);
  });

  it('returns canonical repository detail from PostgreSQL', async () => {
    const repository = await repositoryStore.upsert(
      createInput('400000001', 'detail-project'),
    );
    const baseUrl = await startApp();

    const response = await fetch(
      `${baseUrl}/api/repositories/${repository.id}`,
    );
    const body = (await response.json()) as {
      data: {
        id: string;
        githubRepositoryId: string;
        fullName: string;
        lastSyncedAt: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.data).toEqual(
      expect.objectContaining({
        id: repository.id,
        githubRepositoryId: '400000001',
        fullName: 'catalog-org/detail-project',
        lastSyncedAt: '2026-09-21T00:00:00.000Z',
      }),
    );
  });

  it('returns an empty first page without manufacturing a cursor', async () => {
    const baseUrl = await startApp();

    const response = await fetch(`${baseUrl}/api/repositories`);
    const body = (await response.json()) as {
      data: unknown[];
      pagination: { limit: number; nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: [],
      pagination: {
        limit: 20,
        nextCursor: null,
      },
    });
  });
});
