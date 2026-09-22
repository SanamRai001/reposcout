import { describe, expect, it, vi } from 'vitest';

import {
  fetchRepositoryCatalogPage,
  RepositoryCatalogError,
} from './repository-catalog-client.js';

function repository() {
  return {
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
    createdAtGithub: '2023-04-19T00:00:00.000Z',
    updatedAtGithub: '2026-09-20T00:00:00.000Z',
    pushedAtGithub: '2026-09-20T01:00:00.000Z',
    lastSyncedAt: '2026-09-21T08:00:00.000Z',
    createdAt: '2026-09-21T08:00:01.000Z',
    updatedAt: '2026-09-21T08:00:01.000Z',
    metadata: {
      stars: 1250,
      forks: 210,
      openIssues: 34,
      primaryLanguage: 'TypeScript',
      licenseSpdx: 'Apache-2.0',
      topics: ['openai', 'sdk', 'typescript'],
      observedAt: '2026-09-21T08:00:00.000Z',
    },
  };
}

describe('fetchRepositoryCatalogPage', () => {
  it('requests the first catalog page from the same-origin API', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [repository()],
          pagination: {
            limit: 20,
            nextCursor: 'next-page',
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    const page = await fetchRepositoryCatalogPage({
      fetchImplementation,
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/repositories',
      expect.objectContaining({
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      }),
    );
    expect(page.data[0]?.fullName).toBe('openai/openai-node');
    expect(page.data[0]?.metadata?.stars).toBe(1250);
    expect(page.pagination.nextCursor).toBe('next-page');
  });

  it('encodes pagination parameters without exposing cursor internals', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          pagination: {
            limit: 12,
            nextCursor: null,
          },
        }),
        { status: 200 },
      ),
    );

    await fetchRepositoryCatalogPage({
      cursor: 'cursor with + unsafe chars',
      limit: 12,
      fetchImplementation,
    });

    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      '/api/repositories?limit=12&cursor=cursor+with+%2B+unsafe+chars',
    );
  });

  it('surfaces a stable API error', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'internal_server_error',
          message: 'Catalog unavailable.',
        }),
        { status: 503 },
      ),
    );

    await expect(
      fetchRepositoryCatalogPage({ fetchImplementation }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: 'RepositoryCatalogError',
        message: 'Catalog unavailable.',
        status: 503,
      }),
    );
  });

  it('rejects malformed successful responses', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: 'incomplete' }],
          pagination: {
            limit: 20,
            nextCursor: null,
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      fetchRepositoryCatalogPage({ fetchImplementation }),
    ).rejects.toBeInstanceOf(RepositoryCatalogError);
  });
});
