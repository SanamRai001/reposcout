import type { AddressInfo } from 'node:net';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import type { UpsertRepositoryInput } from './repository.js';
import { RepositoryStore } from './repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for repository search tests.');
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
  description: string,
): UpsertRepositoryInput {
  return {
    githubRepositoryId,
    owner: 'catalog-org',
    name,
    fullName: `catalog-org/${name}`,
    githubUrl: `https://github.com/catalog-org/${name}`,
    defaultBranch: 'main',
    description,
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

describe('repository lexical search API with PostgreSQL', () => {
  it('matches all normalized query terms across canonical repository text', async () => {
    const typedApi = await repositoryStore.upsertWithMetadata(
      createInput(
        '500000001',
        'typed-api',
        'Production TypeScript backend SDK for service integrations.',
      ),
      {
        stars: 150,
        forks: 12,
        openIssues: 4,
        primaryLanguage: 'TypeScript',
        licenseSpdx: 'MIT',
        topics: ['backend', 'sdk'],
        observedAt: new Date('2026-09-21T00:00:00.000Z'),
      },
    );
    await repositoryStore.upsert(
      createInput(
        '500000002',
        'typed-worker',
        'TypeScript backend worker for scheduled jobs.',
      ),
    );
    await repositoryStore.upsert(
      createInput(
        '500000003',
        'react-dashboard',
        'React frontend analytics dashboard.',
      ),
    );

    const baseUrl = await startApp();
    const response = await fetch(
      `${baseUrl}/api/repositories/search?q=production%20sdk`,
    );
    const body = (await response.json()) as {
      data: Array<{
        id: string;
        fullName: string;
        metadata: null | { stars: number };
      }>;
      search: { query: string };
      pagination: { nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.search.query).toBe('production sdk');
    expect(body.data).toEqual([
      expect.objectContaining({
        id: typedApi.id,
        fullName: 'catalog-org/typed-api',
        metadata: expect.objectContaining({
          stars: 150,
        }),
      }),
    ]);
    expect(body.pagination.nextCursor).toBeNull();
  });

  it('paginates matching repositories in stable UUID order without duplicates', async () => {
    const first = await repositoryStore.upsert(
      createInput(
        '500000011',
        'typescript-one',
        'TypeScript backend service.',
      ),
    );
    const second = await repositoryStore.upsert(
      createInput(
        '500000012',
        'typescript-two',
        'TypeScript backend worker.',
      ),
    );
    await repositoryStore.upsert(
      createInput(
        '500000013',
        'go-service',
        'Go backend service.',
      ),
    );

    const expectedIds = [first.id, second.id].sort();
    const baseUrl = await startApp();

    const firstResponse = await fetch(
      `${baseUrl}/api/repositories/search?q=typescript%20backend&limit=1`,
    );
    const firstBody = (await firstResponse.json()) as {
      data: Array<{ id: string }>;
      pagination: { nextCursor: string | null };
    };

    expect(firstResponse.status).toBe(200);
    expect(firstBody.data.map((item) => item.id)).toEqual([
      expectedIds[0],
    ]);
    expect(firstBody.pagination.nextCursor).toEqual(expect.any(String));

    const secondResponse = await fetch(
      `${baseUrl}/api/repositories/search?q=typescript%20backend&limit=1&cursor=${encodeURIComponent(
        firstBody.pagination.nextCursor as string,
      )}`,
    );
    const secondBody = (await secondResponse.json()) as {
      data: Array<{ id: string }>;
      pagination: { nextCursor: string | null };
    };

    expect(secondResponse.status).toBe(200);
    expect(secondBody.data.map((item) => item.id)).toEqual([
      expectedIds[1],
    ]);
    expect(secondBody.pagination.nextCursor).toBeNull();

    const allIds = [
      ...firstBody.data.map((item) => item.id),
      ...secondBody.data.map((item) => item.id),
    ];
    expect(new Set(allIds).size).toBe(2);
  });

  it('matches repository identity fields without metadata/search enrichment', async () => {
    const repository = await repositoryStore.upsert(
      createInput(
        '500000021',
        'schema-cli',
        'Command line schema validator.',
      ),
    );
    const baseUrl = await startApp();

    const response = await fetch(
      `${baseUrl}/api/repositories/search?q=catalog%20org%20schema%20cli`,
    );
    const body = (await response.json()) as {
      data: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.data.map((item) => item.id)).toEqual([repository.id]);
  });

  it('returns an empty page for a valid query with no matches', async () => {
    await repositoryStore.upsert(
      createInput(
        '500000031',
        'typescript-api',
        'TypeScript API server.',
      ),
    );
    const baseUrl = await startApp();

    const response = await fetch(
      `${baseUrl}/api/repositories/search?q=rust%20compiler`,
    );
    const body = (await response.json()) as {
      data: unknown[];
      search: { query: string };
      pagination: { limit: number; nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: [],
      search: {
        query: 'rust compiler',
      },
      pagination: {
        limit: 20,
        nextCursor: null,
      },
    });
  });
});
