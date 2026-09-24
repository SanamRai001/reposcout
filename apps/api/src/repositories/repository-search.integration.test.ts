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
  overrides: Partial<UpsertRepositoryInput> = {},
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
    discoveryStatus: 'DISCOVERABLE',
    createdAtGithub: new Date('2026-01-01T00:00:00.000Z'),
    updatedAtGithub: new Date('2026-09-20T00:00:00.000Z'),
    pushedAtGithub: new Date('2026-09-20T01:00:00.000Z'),
    lastSyncedAt: new Date('2026-09-21T00:00:00.000Z'),
    ...overrides,
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
      search: {
        query: string;
        filters: {
          language: string | null;
          license: string | null;
          topics: string[];
          minStars: number | null;
          maxStars: number | null;
          fork: boolean | null;
          archived: boolean | null;
        };
      };
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

  it('applies language, license, fork, and archived filters exactly', async () => {
    const activeTyped = await repositoryStore.upsertWithMetadata(
      createInput(
        '500000041',
        'typed-active',
        'Backend service for production workloads.',
      ),
      {
        stars: 200,
        forks: 20,
        openIssues: 5,
        primaryLanguage: 'TypeScript',
        licenseSpdx: 'MIT',
        topics: ['backend'],
        observedAt: new Date('2026-09-21T00:00:00.000Z'),
      },
    );

    await repositoryStore.upsertWithMetadata(
      createInput(
        '500000042',
        'typed-archived',
        'Backend service kept for historical reference.',
        { isArchived: true },
      ),
      {
        stars: 80,
        forks: 8,
        openIssues: 1,
        primaryLanguage: 'TypeScript',
        licenseSpdx: 'MIT',
        topics: ['backend'],
        observedAt: new Date('2026-09-21T00:00:00.000Z'),
      },
    );

    await repositoryStore.upsertWithMetadata(
      createInput(
        '500000043',
        'go-fork',
        'Backend service implemented in Go.',
        { isFork: true },
      ),
      {
        stars: 50,
        forks: 5,
        openIssues: 2,
        primaryLanguage: 'Go',
        licenseSpdx: 'Apache-2.0',
        topics: ['backend'],
        observedAt: new Date('2026-09-21T00:00:00.000Z'),
      },
    );

    await repositoryStore.upsert(
      createInput(
        '500000044',
        'metadata-pending',
        'Backend service without captured metadata yet.',
      ),
    );

    const baseUrl = await startApp();
    const response = await fetch(
      `${baseUrl}/api/repositories/search?q=backend&language=%20TYPESCRIPT%20&license=mit&fork=false&archived=false`,
    );
    const body = (await response.json()) as {
      data: Array<{ id: string }>;
      search: {
        query: string;
        filters: {
          language: string | null;
          license: string | null;
          topics: string[];
          minStars: number | null;
          maxStars: number | null;
          fork: boolean | null;
          archived: boolean | null;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(body.search).toEqual({
      query: 'backend',
      filters: {
        language: 'typescript',
        license: 'mit',
        topics: [],
        minStars: null,
        maxStars: null,
        fork: false,
        archived: false,
      },
    });
    expect(body.data.map((item) => item.id)).toEqual([
      activeTyped.id,
    ]);
  });

  it('applies all-topic containment and inclusive star ranges', async () => {
    const exactMatch = await repositoryStore.upsertWithMetadata(
      createInput(
        '500000045',
        'topic-star-match',
        'Backend SDK for production services.',
      ),
      {
        stars: 500,
        forks: 40,
        openIssues: 3,
        primaryLanguage: 'TypeScript',
        licenseSpdx: 'MIT',
        topics: ['backend', 'sdk', 'typescript'],
        observedAt: new Date('2026-09-21T00:00:00.000Z'),
      },
    );

    await repositoryStore.upsertWithMetadata(
      createInput(
        '500000046',
        'missing-topic',
        'Backend SDK without every requested topic.',
      ),
      {
        stars: 500,
        forks: 20,
        openIssues: 2,
        primaryLanguage: 'TypeScript',
        licenseSpdx: 'MIT',
        topics: ['backend', 'typescript'],
        observedAt: new Date('2026-09-21T00:00:00.000Z'),
      },
    );

    await repositoryStore.upsertWithMetadata(
      createInput(
        '500000047',
        'too-popular',
        'Backend SDK above the requested star range.',
      ),
      {
        stars: 5001,
        forks: 300,
        openIssues: 10,
        primaryLanguage: 'TypeScript',
        licenseSpdx: 'MIT',
        topics: ['backend', 'sdk', 'typescript'],
        observedAt: new Date('2026-09-21T00:00:00.000Z'),
      },
    );

    await repositoryStore.upsert(
      createInput(
        '500000048',
        'metadata-pending-range',
        'Backend SDK without metadata.',
      ),
    );

    const baseUrl = await startApp();
    const response = await fetch(
      `${baseUrl}/api/repositories/search?q=backend%20sdk&topic=SDK&topic=backend&minStars=500&maxStars=500`,
    );
    const body = (await response.json()) as {
      data: Array<{ id: string }>;
      search: {
        filters: {
          topics: string[];
          minStars: number | null;
          maxStars: number | null;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(body.search.filters).toEqual(
      expect.objectContaining({
        topics: ['backend', 'sdk'],
        minStars: 500,
        maxStars: 500,
      }),
    );
    expect(body.data.map((item) => item.id)).toEqual([
      exactMatch.id,
    ]);
  });

  it('supports filter-only discovery over authoritative repository metadata', async () => {
    const match = await repositoryStore.upsertWithMetadata(
      createInput(
        '500000061',
        'filter-only-match',
        'Description does not need to contain the filter values.',
        { isFork: false, isArchived: false },
      ),
      {
        stars: 750,
        forks: 30,
        openIssues: 4,
        primaryLanguage: 'TypeScript',
        licenseSpdx: 'MIT',
        topics: ['backend', 'sdk'],
        observedAt: new Date('2026-09-21T00:00:00.000Z'),
      },
    );

    await repositoryStore.upsertWithMetadata(
      createInput(
        '500000062',
        'wrong-language',
        'Another repository.',
      ),
      {
        stars: 750,
        forks: 20,
        openIssues: 2,
        primaryLanguage: 'Go',
        licenseSpdx: 'MIT',
        topics: ['backend', 'sdk'],
        observedAt: new Date('2026-09-21T00:00:00.000Z'),
      },
    );

    await repositoryStore.upsertWithMetadata(
      createInput(
        '500000063',
        'too-small',
        'Another repository.',
      ),
      {
        stars: 50,
        forks: 2,
        openIssues: 0,
        primaryLanguage: 'TypeScript',
        licenseSpdx: 'MIT',
        topics: ['backend', 'sdk'],
        observedAt: new Date('2026-09-21T00:00:00.000Z'),
      },
    );

    const baseUrl = await startApp();
    const response = await fetch(
      `${baseUrl}/api/repositories/search?language=typescript&license=mit&topic=backend&topic=sdk&minStars=500&fork=false&archived=false`,
    );
    const body = (await response.json()) as {
      data: Array<{ id: string }>;
      search: {
        query: string | null;
        filters: {
          language: string | null;
          license: string | null;
          topics: string[];
          minStars: number | null;
          maxStars: number | null;
          fork: boolean | null;
          archived: boolean | null;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(body.search).toEqual({
      query: null,
      filters: {
        language: 'typescript',
        license: 'mit',
        topics: ['backend', 'sdk'],
        minStars: 500,
        maxStars: null,
        fork: false,
        archived: false,
      },
    });
    expect(body.data.map((item) => item.id)).toEqual([match.id]);
  });

  it('paginates filter-only discovery and binds the cursor to its scope', async () => {
    const created = [];

    for (const [id, name] of [
      ['500000064', 'filter-page-one'],
      ['500000065', 'filter-page-two'],
    ] as const) {
      created.push(
        await repositoryStore.upsertWithMetadata(
          createInput(
            id,
            name,
            'Filter-only pagination fixture.',
          ),
          {
            stars: 200,
            forks: 5,
            openIssues: 1,
            primaryLanguage: 'TypeScript',
            licenseSpdx: 'MIT',
            topics: ['backend'],
            observedAt: new Date('2026-09-21T00:00:00.000Z'),
          },
        ),
      );
    }

    const expectedIds = created.map((item) => item.id).sort();
    const baseUrl = await startApp();

    const firstResponse = await fetch(
      `${baseUrl}/api/repositories/search?language=typescript&topic=backend&minStars=100&limit=1`,
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
      `${baseUrl}/api/repositories/search?language=typescript&topic=backend&minStars=100&limit=1&cursor=${encodeURIComponent(
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

    const changedScopeResponse = await fetch(
      `${baseUrl}/api/repositories/search?language=typescript&topic=backend&minStars=101&limit=1&cursor=${encodeURIComponent(
        firstBody.pagination.nextCursor as string,
      )}`,
    );
    const changedScopeBody = (await changedScopeResponse.json()) as {
      error: string;
    };

    expect(changedScopeResponse.status).toBe(400);
    expect(changedScopeBody.error).toBe('invalid_pagination');

    const lexicalReuseResponse = await fetch(
      `${baseUrl}/api/repositories/search?q=backend&language=typescript&topic=backend&minStars=100&limit=1&cursor=${encodeURIComponent(
        firstBody.pagination.nextCursor as string,
      )}`,
    );

    expect(lexicalReuseResponse.status).toBe(400);
  });

  it('rejects a cursor when only topic or star scope changes', async () => {
    for (const [id, name] of [
      ['500000049', 'topic-cursor-one'],
      ['500000050', 'topic-cursor-two'],
    ] as const) {
      await repositoryStore.upsertWithMetadata(
        createInput(
          id,
          name,
          'Backend SDK for cursor filtering.',
        ),
        {
          stars: 200,
          forks: 5,
          openIssues: 1,
          primaryLanguage: 'TypeScript',
          licenseSpdx: 'MIT',
          topics: ['backend', 'sdk'],
          observedAt: new Date('2026-09-21T00:00:00.000Z'),
        },
      );
    }

    const baseUrl = await startApp();
    const firstResponse = await fetch(
      `${baseUrl}/api/repositories/search?q=backend%20sdk&topic=backend&minStars=100&maxStars=500&limit=1`,
    );
    const firstBody = (await firstResponse.json()) as {
      pagination: { nextCursor: string | null };
    };

    expect(firstResponse.status).toBe(200);
    expect(firstBody.pagination.nextCursor).toEqual(expect.any(String));

    const changedTopicResponse = await fetch(
      `${baseUrl}/api/repositories/search?q=backend%20sdk&topic=sdk&minStars=100&maxStars=500&limit=1&cursor=${encodeURIComponent(
        firstBody.pagination.nextCursor as string,
      )}`,
    );

    expect(changedTopicResponse.status).toBe(400);

    const changedStarsResponse = await fetch(
      `${baseUrl}/api/repositories/search?q=backend%20sdk&topic=backend&minStars=101&maxStars=500&limit=1&cursor=${encodeURIComponent(
        firstBody.pagination.nextCursor as string,
      )}`,
    );

    expect(changedStarsResponse.status).toBe(400);
  });

  it('rejects a cursor when only the search filter scope changes', async () => {
    for (const [id, name] of [
      ['500000051', 'typed-one'],
      ['500000052', 'typed-two'],
    ] as const) {
      await repositoryStore.upsertWithMetadata(
        createInput(
          id,
          name,
          'Backend service with stable metadata.',
        ),
        {
          stars: 10,
          forks: 1,
          openIssues: 0,
          primaryLanguage: 'TypeScript',
          licenseSpdx: 'MIT',
          topics: ['backend'],
          observedAt: new Date('2026-09-21T00:00:00.000Z'),
        },
      );
    }

    const baseUrl = await startApp();
    const firstResponse = await fetch(
      `${baseUrl}/api/repositories/search?q=backend&language=typescript&license=mit&fork=false&archived=false&limit=1`,
    );
    const firstBody = (await firstResponse.json()) as {
      pagination: { nextCursor: string | null };
    };

    expect(firstResponse.status).toBe(200);
    expect(firstBody.pagination.nextCursor).toEqual(expect.any(String));

    const changedFilterResponse = await fetch(
      `${baseUrl}/api/repositories/search?q=backend&language=typescript&license=mit&fork=false&archived=true&limit=1&cursor=${encodeURIComponent(
        firstBody.pagination.nextCursor as string,
      )}`,
    );
    const changedFilterBody = (await changedFilterResponse.json()) as {
      error: string;
    };

    expect(changedFilterResponse.status).toBe(400);
    expect(changedFilterBody.error).toBe('invalid_pagination');
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
        filters: {
          language: null,
          license: null,
          topics: [],
          minStars: null,
          maxStars: null,
          fork: null,
          archived: null,
        },
      },
      pagination: {
        limit: 20,
        nextCursor: null,
      },
    });
  });
});
