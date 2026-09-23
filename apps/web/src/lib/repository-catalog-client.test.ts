import { describe, expect, it, vi } from 'vitest';

import {
  fetchRepositoryCatalogPage,
  fetchRepositoryDiscoveryPage,
  normalizeRepositoryDiscoveryScope,
  repositoryDiscoveryScopeFromSearch,
  repositoryDiscoveryScopeToSearch,
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


describe('repository discovery client', () => {
  it('normalizes and serializes a shareable discovery scope deterministically', () => {
    const scope = normalizeRepositoryDiscoveryScope({
      query: '  TypeScript   Backend ',
      language: ' TypeScript ',
      license: ' MIT ',
      topics: [' SDK ', 'backend', 'sdk'],
      minStars: 100,
      maxStars: 5000,
      fork: false,
      archived: false,
    });

    expect(scope).toEqual({
      query: 'typescript backend',
      filters: {
        language: 'typescript',
        license: 'mit',
        topics: ['backend', 'sdk'],
        minStars: 100,
        maxStars: 5000,
        fork: false,
        archived: false,
      },
    });

    expect(repositoryDiscoveryScopeToSearch(scope)).toBe(
      'q=typescript+backend&language=typescript&license=mit&topic=backend&topic=sdk&minStars=100&maxStars=5000&fork=false&archived=false',
    );
  });

  it('reads filter-only discovery scope from browser search params', () => {
    expect(
      repositoryDiscoveryScopeFromSearch(
        '?language=typescript&topic=sdk&topic=backend&minStars=50&archived=false',
      ),
    ).toEqual({
      query: null,
      filters: {
        language: 'typescript',
        license: null,
        topics: ['backend', 'sdk'],
        minStars: 50,
        maxStars: null,
        fork: null,
        archived: false,
      },
    });
  });

  it('returns null for an unscoped browser URL', () => {
    expect(repositoryDiscoveryScopeFromSearch('')).toBeNull();
  });

  it('requests discovery with repeated topics and pagination cursor', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [repository()],
          search: {
            query: 'backend sdk',
            filters: {
              language: 'typescript',
              license: 'mit',
              topics: ['backend', 'sdk'],
              minStars: 100,
              maxStars: null,
              fork: false,
              archived: false,
            },
          },
          pagination: {
            limit: 12,
            nextCursor: 'next-discovery',
          },
        }),
        { status: 200 },
      ),
    );

    const scope = normalizeRepositoryDiscoveryScope({
      query: 'backend sdk',
      language: 'typescript',
      license: 'mit',
      topics: ['backend', 'sdk'],
      minStars: 100,
      fork: false,
      archived: false,
    });

    if (!scope) {
      throw new Error('Expected discovery scope.');
    }

    const page = await fetchRepositoryDiscoveryPage({
      scope,
      limit: 12,
      cursor: 'opaque cursor',
      fetchImplementation,
    });

    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      '/api/repositories/search?q=backend+sdk&language=typescript&license=mit&topic=backend&topic=sdk&minStars=100&fork=false&archived=false&limit=12&cursor=opaque+cursor',
    );
    expect(page.search).toEqual(scope);
    expect(page.pagination.nextCursor).toBe('next-discovery');
  });

  it('rejects malformed successful discovery responses', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [repository()],
          search: {
            query: 'typescript',
            filters: {
              language: null,
            },
          },
          pagination: {
            limit: 12,
            nextCursor: null,
          },
        }),
        { status: 200 },
      ),
    );

    const scope = normalizeRepositoryDiscoveryScope({
      query: 'typescript',
    });

    if (!scope) {
      throw new Error('Expected discovery scope.');
    }

    await expect(
      fetchRepositoryDiscoveryPage({
        scope,
        fetchImplementation,
      }),
    ).rejects.toBeInstanceOf(RepositoryCatalogError);
  });
});
