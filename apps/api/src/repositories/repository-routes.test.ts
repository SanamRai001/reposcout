import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import type { RepositoryCatalogReader } from './repository-catalog.js';
import type { RepositoryRecord } from './repository.js';

const servers: ReturnType<ReturnType<typeof createApp>['listen']>[] = [];

const repository: RepositoryRecord = {
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
    const repositoryCatalog: RepositoryCatalogReader = {
      listPage,
      findById: vi.fn(),
    };
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
    const repositoryCatalog: RepositoryCatalogReader = {
      listPage: vi.fn().mockResolvedValue({
        items: [repository],
        hasMore: true,
      }),
      findById: vi.fn(),
    };
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(`${baseUrl}/api/repositories?limit=1`);
    const body = (await response.json()) as {
      pagination: { nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.pagination.nextCursor).toEqual(expect.any(String));
  });

  it('rejects invalid pagination', async () => {
    const repositoryCatalog: RepositoryCatalogReader = {
      listPage: vi.fn(),
      findById: vi.fn(),
    };
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(`${baseUrl}/api/repositories?limit=500`);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_pagination');
    expect(repositoryCatalog.listPage).not.toHaveBeenCalled();
  });

  it('returns repository detail by stable internal id', async () => {
    const findById = vi.fn().mockResolvedValue(repository);
    const repositoryCatalog: RepositoryCatalogReader = {
      listPage: vi.fn(),
      findById,
    };
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
    const repositoryCatalog: RepositoryCatalogReader = {
      listPage: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
    };
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(
      `${baseUrl}/api/repositories/11111111-1111-4111-8111-111111111111`,
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('repository_not_found');
  });

  it('rejects malformed repository ids before persistence lookup', async () => {
    const repositoryCatalog: RepositoryCatalogReader = {
      listPage: vi.fn(),
      findById: vi.fn(),
    };
    const { baseUrl } = await startApp(repositoryCatalog);

    const response = await fetch(`${baseUrl}/api/repositories/not-a-uuid`);

    expect(response.status).toBe(400);
    expect(repositoryCatalog.findById).not.toHaveBeenCalled();
  });
});
