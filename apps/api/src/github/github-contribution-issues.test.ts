import { describe, expect, it, vi } from 'vitest';

import { GithubApiError, GithubClient } from './github-client.js';

const reference = { owner: 'example', name: 'project' } as const;

function issuePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 880000001,
    number: 42,
    title: 'Improve contribution docs',
    html_url: 'https://github.com/example/project/issues/42',
    state: 'open',
    locked: false,
    assignees: [],
    comments: 3,
    labels: [
      { name: 'good first issue' },
      { name: 'help wanted' },
    ],
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-25T00:00:00Z',
    ...overrides,
  };
}

describe('GithubClient contribution issues', () => {
  it('fetches one bounded recent-issues page and excludes pull requests', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          issuePayload(),
          issuePayload({
            id: 880000002,
            number: 43,
            html_url: 'https://github.com/example/project/pull/43',
            pull_request: {
              url: 'https://api.github.com/repos/example/project/pulls/43',
            },
          }),
        ]),
        { status: 200 },
      ),
    );
    const client = new GithubClient({
      token: 'secret-token',
      fetchImplementation,
    });

    const issues = await client.fetchRepositoryIssues(reference, 25);

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://api.github.com/repos/example/project/issues?state=all&sort=updated&direction=desc&per_page=25',
    );
    expect(init?.method).toBe('GET');
    expect(init?.redirect).toBe('error');

    const headers = init?.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer secret-token');
    expect(headers.get('x-github-api-version')).toBe('2026-03-10');

    expect(issues).toEqual([
      {
        githubIssueId: '880000001',
        number: 42,
        title: 'Improve contribution docs',
        githubUrl: 'https://github.com/example/project/issues/42',
        state: 'open',
        locked: false,
        assigneeCount: 0,
        commentCount: 3,
        labels: ['good first issue', 'help wanted'],
        createdAt: new Date('2026-09-01T00:00:00Z'),
        updatedAt: new Date('2026-09-25T00:00:00Z'),
      },
    ]);
  });

  it('rejects malformed issue label evidence', async () => {
    const client = new GithubClient({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify([
            issuePayload({
              labels: [{ name: null }],
            }),
          ]),
          { status: 200 },
        ),
      ),
    });

    await expect(
      client.fetchRepositoryIssues(reference, 10),
    ).rejects.toMatchObject({
      name: 'GithubApiError',
      kind: 'invalid_response',
    } satisfies Partial<GithubApiError>);
  });

  it('rejects issue URLs that are not issue resources', async () => {
    const client = new GithubClient({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify([
            issuePayload({
              html_url: 'https://github.com/example/project/discussions/42',
            }),
          ]),
          { status: 200 },
        ),
      ),
    });

    await expect(
      client.fetchRepositoryIssues(reference, 10),
    ).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('preserves GitHub rate-limit reset information', async () => {
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

    await expect(
      client.fetchRepositoryIssues(reference, 10),
    ).rejects.toMatchObject({
      name: 'GithubApiError',
      kind: 'rate_limited',
      status: 403,
      retryAt: new Date(1790000000 * 1000),
    } satisfies Partial<GithubApiError>);
  });

  it('enforces the hard one-page issue limit', async () => {
    const client = new GithubClient();

    await expect(
      client.fetchRepositoryIssues(reference, 0),
    ).rejects.toThrow(
      'GitHub issue limit must be an integer between 1 and 100.',
    );
    await expect(
      client.fetchRepositoryIssues(reference, 101),
    ).rejects.toThrow(
      'GitHub issue limit must be an integer between 1 and 100.',
    );
  });
});
