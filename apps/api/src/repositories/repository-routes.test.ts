import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import type {
  RepositoryCatalogReader,
  RepositoryCatalogRecord,
} from './repository-catalog.js';

const servers: ReturnType<ReturnType<typeof createApp>['listen']>[] = [];

const repository: RepositoryCatalogRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  githubRepositoryId: '123456789',
  owner: 'openai',
  name: 'openai-node',
  fullName: 'openai/openai-node',
  githubUrl: 'https://github.com/openai/openai-node',
  defaultBranch: 'main',
  description: 'OpenAI Node SDK',
  isArchived: false,
  isFork: false,
  createdAtGithub: new Date('2023-04-19T00:00:00Z'),
  updatedAtGithub: new Date('2026-09-20T00:00:00Z'),
  pushedAtGithub: new Date('2026-09-20T01:00:00Z'),
  lastSyncedAt: new Date('2026-09-21T08:00:00Z'),
  createdAt: new Date('2026-09-21T08:00:01Z'),
  updatedAt: new Date('2026-09-21T08:00:01Z'),
  metadata: null,
};

afterEach(async () => {
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
});

function createCatalog(
  overrides: Partial<RepositoryCatalogReader> = {},
): RepositoryCatalogReader {
  return {
    listPage: vi.fn().mockResolvedValue({
      items: [],
      hasMore: false,
    }),
    searchPage: vi.fn().mockResolvedValue({
      items: [],
      hasMore: false,
    }),
    findById: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

async function startApp(repositoryCatalog: RepositoryCatalogReader) {
  const app = createApp({ repositoryCatalog });
  const server = app.listen(0);
  servers.push(server);

  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

describe('repository catalog routes', () => {
  it('returns a bounded repository page', async () => {
    const listPage = vi.fn().mockResolvedValue({
      items: [repository],
      hasMore: false,
    });
    const repositoryCatalog = createCatalog({ listPage });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(`${baseUrl}/api/repositories?limit=10`);
    const body = (await response.json()) as {
      data: Array<{ id: string; fullName: string }>;
      pagination: { limit: number; nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.fullName).toBe('openai/openai-node');
    expect(body.pagination).toEqual({
      limit: 10,
      nextCursor: null,
    });
    expect(listPage).toHaveBeenCalledWith({
      limit: 10,
      cursor: null,
    });
  });

  it('returns a next cursor when another page exists', async () => {
    const repositoryCatalog = createCatalog({
      listPage: vi.fn().mockResolvedValue({
        items: [repository],
        hasMore: true,
      }),
    });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(`${baseUrl}/api/repositories?limit=1`);
    const body = (await response.json()) as {
      pagination: { nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.pagination.nextCursor).toEqual(expect.any(String));
  });

  it('rejects invalid pagination', async () => {
    const listPage = vi.fn();
    const repositoryCatalog = createCatalog({ listPage });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(`${baseUrl}/api/repositories?limit=500`);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_pagination');
    expect(listPage).not.toHaveBeenCalled();
  });

  it('searches repositories with a normalized lexical query', async () => {
    const searchPage = vi.fn().mockResolvedValue({
      items: [repository],
      hasMore: false,
    });
    const repositoryCatalog = createCatalog({ searchPage });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(
      `${baseUrl}/api/repositories/search?q=%20TypeScript%20%20Backend%20&limit=5`,
    );
    const body = (await response.json()) as {
      data: Array<{ id: string }>;
      search: { query: string };
      pagination: { limit: number; nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.search.query).toBe('typescript backend');
    expect(body.pagination).toEqual({
      limit: 5,
      nextCursor: null,
    });
    expect(searchPage).toHaveBeenCalledWith({
      query: 'typescript backend',
      limit: 5,
      cursor: null,
    });
  });

  it('returns a search cursor bound to the normalized query', async () => {
    const repositoryCatalog = createCatalog({
      searchPage: vi.fn().mockResolvedValue({
        items: [repository],
        hasMore: true,
      }),
    });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(
      `${baseUrl}/api/repositories/search?q=typescript&limit=1`,
    );
    const body = (await response.json()) as {
      pagination: { nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.pagination.nextCursor).toEqual(expect.any(String));
  });

  it('rejects invalid search queries before persistence lookup', async () => {
    const searchPage = vi.fn();
    const repositoryCatalog = createCatalog({ searchPage });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(
      `${baseUrl}/api/repositories/search?q=-`,
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_search_query');
    expect(searchPage).not.toHaveBeenCalled();
  });

  it('returns repository detail by stable internal id', async () => {
    const findById = vi.fn().mockResolvedValue(repository);
    const repositoryCatalog = createCatalog({ findById });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(
      `${baseUrl}/api/repositories/${repository.id}`,
    );
    const body = (await response.json()) as {
      data: { id: string; githubRepositoryId: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(repository.id);
    expect(body.data.githubRepositoryId).toBe('123456789');
    expect(findById).toHaveBeenCalledWith(repository.id);
  });

  it('returns 404 when repository detail is missing', async () => {
    const repositoryCatalog = createCatalog({
      findById: vi.fn().mockResolvedValue(null),
    });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(
      `${baseUrl}/api/repositories/11111111-1111-4111-8111-111111111111`,
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('repository_not_found');
  });

  it('rejects malformed repository ids before persistence lookup', async () => {
    const findById = vi.fn();
    const repositoryCatalog = createCatalog({ findById });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(`${baseUrl}/api/repositories/not-a-uuid`);

    expect(response.status).toBe(400);
    expect(findById).not.toHaveBeenCalled();
  });
});
