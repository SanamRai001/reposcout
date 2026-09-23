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
      pagination: { limit: number; nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.search).toEqual({
      query: 'typescript backend',
      filters: {
        language: null,
        license: null,
        topics: [],
        minStars: null,
        maxStars: null,
        fork: null,
        archived: null,
      },
    });
    expect(body.pagination).toEqual({
      limit: 5,
      nextCursor: null,
    });
    expect(searchPage).toHaveBeenCalledWith({
      query: 'typescript backend',
      filters: {
        primaryLanguage: null,
        licenseSpdx: null,
        topics: [],
        minStars: null,
        maxStars: null,
        isFork: null,
        isArchived: null,
      },
      limit: 5,
      cursor: null,
    });
  });

  it('normalizes and forwards scalar search filters', async () => {
    const searchPage = vi.fn().mockResolvedValue({
      items: [repository],
      hasMore: false,
    });
    const repositoryCatalog = createCatalog({ searchPage });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(
      `${baseUrl}/api/repositories/search?q=backend&language=%20TypeScript%20&license=MIT&fork=FALSE&archived=true`,
    );
    const body = (await response.json()) as {
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
        archived: true,
      },
    });
    expect(searchPage).toHaveBeenCalledWith({
      query: 'backend',
      filters: {
        primaryLanguage: 'typescript',
        licenseSpdx: 'mit',
        topics: [],
        minStars: null,
        maxStars: null,
        isFork: false,
        isArchived: true,
      },
      limit: 20,
      cursor: null,
    });
  });

  it('normalizes repeated topics and star-range filters', async () => {
    const searchPage = vi.fn().mockResolvedValue({
      items: [repository],
      hasMore: false,
    });
    const repositoryCatalog = createCatalog({ searchPage });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(
      `${baseUrl}/api/repositories/search?q=backend&topic=%20SDK%20&topic=backend&topic=sdk&minStars=100&maxStars=5000`,
    );
    const body = (await response.json()) as {
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
    expect(body.search.filters).toEqual({
      language: null,
      license: null,
      topics: ['backend', 'sdk'],
      minStars: 100,
      maxStars: 5000,
      fork: null,
      archived: null,
    });
    expect(searchPage).toHaveBeenCalledWith({
      query: 'backend',
      filters: {
        primaryLanguage: null,
        licenseSpdx: null,
        topics: ['backend', 'sdk'],
        minStars: 100,
        maxStars: 5000,
        isFork: null,
        isArchived: null,
      },
      limit: 20,
      cursor: null,
    });
  });

  it('rejects invalid scalar search filters before persistence lookup', async () => {
    const searchPage = vi.fn();
    const repositoryCatalog = createCatalog({ searchPage });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(
      `${baseUrl}/api/repositories/search?q=backend&fork=maybe`,
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_search_filter');
    expect(searchPage).not.toHaveBeenCalled();
  });

  it('rejects an invalid star range before persistence lookup', async () => {
    const searchPage = vi.fn();
    const repositoryCatalog = createCatalog({ searchPage });
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(
      `${baseUrl}/api/repositories/search?q=backend&minStars=500&maxStars=100`,
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_search_filter');
    expect(searchPage).not.toHaveBeenCalled();
  });

  it('returns a search cursor bound to the normalized query and filters', async () => {
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
