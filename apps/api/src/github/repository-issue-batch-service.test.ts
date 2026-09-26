import { describe, expect, it, vi } from 'vitest';

import { GithubApiError } from './github-client.js';
import {
  parseIssueBatchLimit,
  RepositoryIssueBatchService,
} from './repository-issue-batch-service.js';
import type { RepositoryCatalogRecord } from '../repositories/repository-catalog.js';

function repository(
  id: string,
  fullName: string,
): RepositoryCatalogRecord {
  const [owner, name] = fullName.split('/');

  return {
    id,
    githubRepositoryId: id.replace(/\D/g, '') || '1',
    owner: owner ?? 'example',
    name: name ?? 'project',
    fullName,
    githubUrl: `https://github.com/${fullName}`,
    defaultBranch: 'main',
    description: null,
    isArchived: false,
    isFork: false,
    createdAtGithub: new Date('2025-01-01T00:00:00Z'),
    updatedAtGithub: new Date('2026-09-26T00:00:00Z'),
    pushedAtGithub: new Date('2026-09-26T00:00:00Z'),
    lastSyncedAt: new Date('2026-09-26T01:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-09-26T01:00:00Z'),
    metadata: null,
  };
}

describe('RepositoryIssueBatchService', () => {
  it('uses bounded defaults and validates explicit limits', () => {
    expect(parseIssueBatchLimit('repositoryLimit', undefined)).toBe(10);
    expect(
      parseIssueBatchLimit('issuesPerRepositoryLimit', undefined),
    ).toBe(50);
    expect(parseIssueBatchLimit('repositoryLimit', '50')).toBe(50);
    expect(
      parseIssueBatchLimit('issuesPerRepositoryLimit', '100'),
    ).toBe(100);
    expect(() =>
      parseIssueBatchLimit('repositoryLimit', '51'),
    ).toThrow();
    expect(() =>
      parseIssueBatchLimit('issuesPerRepositoryLimit', '101'),
    ).toThrow();
  });

  it('refreshes only the listed catalog page and returns a continuation cursor', async () => {
    const first = repository(
      '11111111-1111-4111-8111-111111111111',
      'example/one',
    );
    const second = repository(
      '22222222-2222-4222-8222-222222222222',
      'example/two',
    );
    const listPage = vi.fn().mockResolvedValue({
      items: [first, second],
      hasMore: true,
    });
    const refresh = vi.fn()
      .mockResolvedValueOnce({
        repositoryId: first.id,
        fullName: first.fullName,
        requestedLimit: 25,
        fetchedItems: 3,
        excludedPullRequests: 1,
        issues: [{}, {}],
      })
      .mockResolvedValueOnce({
        repositoryId: second.id,
        fullName: second.fullName,
        requestedLimit: 25,
        fetchedItems: 2,
        excludedPullRequests: 0,
        issues: [{}],
      });
    const service = new RepositoryIssueBatchService(
      { listPage } as never,
      { refresh } as never,
    );

    const result = await service.run({
      repositoryLimit: 2,
      issuesPerRepositoryLimit: 25,
    });

    expect(listPage).toHaveBeenCalledWith({
      limit: 2,
      cursor: null,
    });
    expect(refresh).toHaveBeenNthCalledWith(1, first, 25);
    expect(refresh).toHaveBeenNthCalledWith(2, second, 25);
    expect(result).toEqual(
      expect.objectContaining({
        status: 'completed',
        selected: 2,
        processed: 2,
        refreshedRepositories: 2,
        storedIssues: 3,
        excludedPullRequests: 1,
        nextCursor: { id: second.id },
      }),
    );
  });

  it('halts on GitHub rate pressure and resumes from the last completed repository', async () => {
    const first = repository(
      '11111111-1111-4111-8111-111111111111',
      'example/one',
    );
    const second = repository(
      '22222222-2222-4222-8222-222222222222',
      'example/two',
    );
    const third = repository(
      '33333333-3333-4333-8333-333333333333',
      'example/three',
    );
    const refresh = vi.fn()
      .mockResolvedValueOnce({
        repositoryId: first.id,
        fullName: first.fullName,
        requestedLimit: 50,
        fetchedItems: 1,
        excludedPullRequests: 0,
        issues: [{}],
      })
      .mockRejectedValueOnce(
        new GithubApiError(
          'rate_limited',
          'rate limited',
          403,
          new Date('2026-09-26T13:00:00Z'),
        ),
      );
    const service = new RepositoryIssueBatchService(
      {
        listPage: vi.fn().mockResolvedValue({
          items: [first, second, third],
          hasMore: false,
        }),
      } as never,
      { refresh } as never,
      () => new Date('2026-09-26T12:00:00Z'),
    );

    const result = await service.run();

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('halted');
    expect(result.haltedReason).toBe('retry_later');
    expect(result.retryAt).toBe('2026-09-26T13:00:00.000Z');
    expect(result.nextCursor).toEqual({ id: first.id });
  });
});
