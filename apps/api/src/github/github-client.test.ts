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
    private: false,
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

  it('fetches and validates bounded README content from the pinned GitHub API', async () => {
    const readme = '# RepoScout fixture\n';
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'file',
          encoding: 'base64',
          size: Buffer.byteLength(readme, 'utf8'),
          name: 'README.md',
          path: 'README.md',
          sha: 'abc123',
          content: Buffer.from(readme, 'utf8').toString('base64'),
        }),
        { status: 200 },
      ),
    );
    const client = new GithubClient({
      token: 'secret-token',
      fetchImplementation,
    });

    const result = await client.fetchReadme(reference, 'main');

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://api.github.com/repos/openai/openai-node/readme?ref=main',
    );
    expect(init?.redirect).toBe('error');

    const headers = init?.headers as Headers;
    expect(headers.get('x-github-api-version')).toBe('2026-03-10');
    expect(headers.get('authorization')).toBe('Bearer secret-token');
    expect(result).toEqual({
      status: 'present',
      path: 'README.md',
      sha: 'abc123',
      sizeBytes: Buffer.byteLength(readme, 'utf8'),
      content: readme,
    });
  });

  it('records README 404 as not-found content evidence', async () => {
    const client = new GithubClient({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status: 404 })),
    });

    await expect(client.fetchReadme(reference, 'main')).resolves.toEqual({
      status: 'not_found',
    });
  });

  it('does not decode README bodies above RepoScout storage limits', async () => {
    const client = new GithubClient({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'file',
            size: 300_000,
            path: 'README.md',
            sha: 'large123',
          }),
          { status: 200 },
        ),
      ),
    });

    await expect(client.fetchReadme(reference, 'main')).resolves.toEqual({
      status: 'too_large',
      path: 'README.md',
      sha: 'large123',
      sizeBytes: 300_000,
    });
  });

  it('rejects README content whose decoded byte size is inconsistent', async () => {
    const content = 'hello';
    const client = new GithubClient({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'file',
            encoding: 'base64',
            size: 100,
            path: 'README.md',
            sha: 'badsize',
            content: Buffer.from(content, 'utf8').toString('base64'),
          }),
          { status: 200 },
        ),
      ),
    });

    await expect(client.fetchReadme(reference, 'main')).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('normalizes community profile contribution evidence', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          files: {
            contributing: {
              url: 'https://api.github.com/repos/openai/openai-node/contents/CONTRIBUTING.md',
              html_url: 'https://github.com/openai/openai-node/blob/main/CONTRIBUTING.md',
            },
            code_of_conduct_file: {
              url: 'https://api.github.com/repos/openai/openai-node/contents/CODE_OF_CONDUCT.md',
              html_url: 'https://github.com/openai/openai-node/blob/main/CODE_OF_CONDUCT.md',
            },
            issue_template: null,
            pull_request_template: {
              url: 'https://api.github.com/repos/openai/openai-node/contents/.github/PULL_REQUEST_TEMPLATE.md',
              html_url: 'https://github.com/openai/openai-node/blob/main/.github/PULL_REQUEST_TEMPLATE.md',
            },
          },
          updated_at: '2026-09-20T12:00:00Z',
        }),
        { status: 200 },
      ),
    );
    const client = new GithubClient({ fetchImplementation });

    const result = await client.fetchCommunityProfile(reference);

    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.github.com/repos/openai/openai-node/community/profile',
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
      }),
    );
    expect(result).toEqual({
      contributing: {
        apiUrl: 'https://api.github.com/repos/openai/openai-node/contents/CONTRIBUTING.md',
        htmlUrl: 'https://github.com/openai/openai-node/blob/main/CONTRIBUTING.md',
      },
      codeOfConduct: {
        apiUrl: 'https://api.github.com/repos/openai/openai-node/contents/CODE_OF_CONDUCT.md',
        htmlUrl: 'https://github.com/openai/openai-node/blob/main/CODE_OF_CONDUCT.md',
      },
      issueTemplate: null,
      pullRequestTemplate: {
        apiUrl: 'https://api.github.com/repos/openai/openai-node/contents/.github/PULL_REQUEST_TEMPLATE.md',
        htmlUrl: 'https://github.com/openai/openai-node/blob/main/.github/PULL_REQUEST_TEMPLATE.md',
      },
      updatedAt: new Date('2026-09-20T12:00:00Z'),
    });
  });

  it('probes only supported security-policy paths in precedence order', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: 'file',
            path: 'SECURITY.md',
            sha: 'security-sha',
            size: 420,
          }),
          { status: 200 },
        ),
      );
    const client = new GithubClient({ fetchImplementation });

    const result = await client.fetchSecurityPolicy(reference, 'main');

    expect(result).toEqual({
      path: 'SECURITY.md',
      sha: 'security-sha',
      sizeBytes: 420,
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      'https://api.github.com/repos/openai/openai-node/contents/.github/SECURITY.md?ref=main',
    );
    expect(fetchImplementation.mock.calls[1]?.[0]).toBe(
      'https://api.github.com/repos/openai/openai-node/contents/SECURITY.md?ref=main',
    );
  });

  it('returns null when no supported repository-local security policy exists', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 404 }));
    const client = new GithubClient({ fetchImplementation });

    await expect(
      client.fetchSecurityPolicy(reference, 'main'),
    ).resolves.toBeNull();

    expect(fetchImplementation).toHaveBeenCalledTimes(3);
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

  it('fetches bounded issues and excludes pull requests from issue opportunities', async () => {
    const issue = {
      id: 700000001,
      number: 42,
      title: 'Improve parser errors',
      html_url: 'https://github.com/openai/openai-node/issues/42',
      state: 'open',
      locked: false,
      assignees: [],
      comments: 3,
      labels: [
        { name: 'good first issue' },
        { name: 'help wanted' },
      ],
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-20T00:00:00Z',
    };
    const pullRequest = {
      id: 700000002,
      number: 43,
      pull_request: {
        url: 'https://api.github.com/repos/openai/openai-node/pulls/43',
      },
    };
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([issue, pullRequest]), { status: 200 }),
    );
    const client = new GithubClient({
      token: 'secret-token',
      fetchImplementation,
    });

    const result = await client.fetchIssues(reference, 50);

    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.github.com/repos/openai/openai-node/issues?state=all&sort=updated&direction=desc&per_page=50&page=1',
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
      }),
    );
    expect(result).toEqual({
      fetchedItems: 2,
      excludedPullRequests: 1,
      issues: [
        {
          githubIssueId: '700000001',
          number: 42,
          title: 'Improve parser errors',
          htmlUrl: 'https://github.com/openai/openai-node/issues/42',
          state: 'open',
          locked: false,
          assigneeCount: 0,
          commentCount: 3,
          labels: ['good first issue', 'help wanted'],
          createdAt: new Date('2026-09-01T00:00:00Z'),
          updatedAt: new Date('2026-09-20T00:00:00Z'),
        },
      ],
    });
  });

  it('rejects malformed GitHub issue fields before persistence', async () => {
    const client = new GithubClient({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: 700000003,
              number: 44,
              title: 'Broken labels',
              html_url: 'https://github.com/openai/openai-node/issues/44',
              state: 'open',
              locked: false,
              assignees: [],
              comments: 0,
              labels: [{ name: '' }],
              created_at: '2026-09-01T00:00:00Z',
              updated_at: '2026-09-20T00:00:00Z',
            },
          ]),
          { status: 200 },
        ),
      ),
    });

    await expect(client.fetchIssues(reference, 25)).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('preserves GitHub issue rate-limit reset information', async () => {
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

    await expect(client.fetchIssues(reference, 25)).rejects.toMatchObject({
      name: 'GithubApiError',
      kind: 'rate_limited',
      status: 403,
      retryAt: new Date(1790000000 * 1000),
    } satisfies Partial<GithubApiError>);
  });

  it('bounds GitHub issue page size before making a request', async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const client = new GithubClient({ fetchImplementation });

    await expect(client.fetchIssues(reference, 0)).rejects.toThrow(
      'GitHub issue limit must be an integer between 1 and 100.',
    );
    await expect(client.fetchIssues(reference, 101)).rejects.toThrow(
      'GitHub issue limit must be an integer between 1 and 100.',
    );
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

});
