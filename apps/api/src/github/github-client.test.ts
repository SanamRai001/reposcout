import { describe, expect, it, vi } from 'vitest';

import {
  GithubApiError,
  GithubClient,
} from './github-client.js';

const reference = { owner: 'openai', name: 'openai-node' } as const;

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 123456789,
    name: 'openai-node',
    full_name: 'openai/openai-node',
    html_url: 'https://github.com/openai/openai-node',
    default_branch: 'main',
    description: 'Official JavaScript / TypeScript library for the OpenAI API',
    archived: false,
    fork: false,
    created_at: '2023-04-19T00:00:00Z',
    updated_at: '2026-09-20T00:00:00Z',
    pushed_at: '2026-09-20T01:00:00Z',
    stargazers_count: 1250,
    forks_count: 210,
    open_issues_count: 34,
    language: 'TypeScript',
    license: {
      spdx_id: 'Apache-2.0',
    },
    topics: ['sdk', 'typescript', 'openai'],
    owner: {
      login: 'openai',
    },
    ...overrides,
  };
}

describe('GithubClient', () => {
  it('calls only the GitHub API origin with pinned version headers', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(validPayload()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = new GithubClient({
      token: 'secret-token',
      fetchImplementation,
    });

    const repository = await client.fetchRepository(reference);

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImplementation.mock.calls[0] ?? [];

    expect(url).toBe('https://api.github.com/repos/openai/openai-node');
    expect(init?.method).toBe('GET');
    expect(init?.redirect).toBe('error');

    const headers = init?.headers as Headers;
    expect(headers.get('accept')).toBe('application/vnd.github+json');
    expect(headers.get('user-agent')).toBe('RepoScout');
    expect(headers.get('x-github-api-version')).toBe('2026-03-10');
    expect(headers.get('authorization')).toBe('Bearer secret-token');

    expect(repository.githubRepositoryId).toBe('123456789');
    expect(repository.fullName).toBe('openai/openai-node');
    expect(repository.createdAtGithub.toISOString()).toBe(
      '2023-04-19T00:00:00.000Z',
    );
    expect(repository.metadata).toEqual({
      stars: 1250,
      forks: 210,
      openIssues: 34,
      primaryLanguage: 'TypeScript',
      licenseSpdx: 'Apache-2.0',
      topics: ['openai', 'sdk', 'typescript'],
    });
  });

  it('supports unauthenticated public requests when no token is configured', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(validPayload()), { status: 200 }),
    );

    const client = new GithubClient({ fetchImplementation });
    await client.fetchRepository(reference);

    const [, init] = fetchImplementation.mock.calls[0] ?? [];
    const headers = init?.headers as Headers;

    expect(headers.has('authorization')).toBe(false);
  });

  it('maps a 404 to a stable not-found error', async () => {
    const client = new GithubClient({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status: 404 })),
    });

    await expect(client.fetchRepository(reference)).rejects.toMatchObject({
      name: 'GithubApiError',
      kind: 'not_found',
      status: 404,
    } satisfies Partial<GithubApiError>);
  });

  it('maps exhausted GitHub rate limits with reset time', async () => {
    const client = new GithubClient({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1790000000',
          },
        }),
      ),
    });

    await expect(client.fetchRepository(reference)).rejects.toMatchObject({
      name: 'GithubApiError',
      kind: 'rate_limited',
      status: 403,
      retryAt: new Date(1790000000 * 1000),
    } satisfies Partial<GithubApiError>);
  });

  it('rejects malformed repository payloads before persistence', async () => {
    const client = new GithubClient({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify(
            validPayload({
              full_name: 'someone-else/openai-node',
            }),
          ),
          { status: 200 },
        ),
      ),
    });

    await expect(client.fetchRepository(reference)).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('rejects invalid measured metadata before persistence', async () => {
    const client = new GithubClient({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify(
            validPayload({
              stargazers_count: -1,
            }),
          ),
          { status: 200 },
        ),
      ),
    });

    await expect(client.fetchRepository(reference)).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('rejects unsafe numeric repository IDs instead of silently rounding them', async () => {
    const client = new GithubClient({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify(
            validPayload({
              id: Number.MAX_SAFE_INTEGER + 1,
            }),
          ),
          { status: 200 },
        ),
      ),
    });

    await expect(client.fetchRepository(reference)).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });
});
