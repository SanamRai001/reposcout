import { describe, expect, it, vi } from 'vitest';

import type { GithubClient } from './github-client.js';
import { RepositoryIssueIngestionService } from './repository-issue-ingestion-service.js';
import type { RepositoryIssueStore } from '../repositories/repository-issue-store.js';
import type { RepositoryRecord } from '../repositories/repository.js';

const repository: RepositoryRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  githubRepositoryId: '123',
  owner: 'example',
  name: 'project',
  fullName: 'example/project',
  githubUrl: 'https://github.com/example/project',
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
};

describe('RepositoryIssueIngestionService', () => {
  it('maps bounded GitHub issue observations into stale-safe persistence inputs', async () => {
    const fetchIssues = vi.fn<Pick<GithubClient, 'fetchIssues'>['fetchIssues']>()
      .mockResolvedValue({
        fetchedItems: 2,
        excludedPullRequests: 1,
        issues: [
          {
            githubIssueId: '700000001',
            number: 12,
            title: 'Add example',
            htmlUrl: 'https://github.com/example/project/issues/12',
            state: 'open',
            locked: false,
            assigneeCount: 0,
            commentCount: 4,
            labels: ['good first issue'],
            createdAt: new Date('2026-09-01T00:00:00Z'),
            updatedAt: new Date('2026-09-20T00:00:00Z'),
          },
        ],
      });
    const upsertMany = vi.fn<
      Pick<RepositoryIssueStore, 'upsertMany'>['upsertMany']
    >().mockResolvedValue([]);
    const service = new RepositoryIssueIngestionService(
      { fetchIssues },
      { upsertMany },
      () => new Date('2026-09-26T12:00:00Z'),
    );

    const result = await service.refresh(repository, 50);

    expect(fetchIssues).toHaveBeenCalledWith(
      { owner: 'example', name: 'project' },
      50,
    );
    expect(upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        repositoryId: repository.id,
        githubIssueId: '700000001',
        number: 12,
        title: 'Add example',
        labels: ['good first issue'],
        observedAt: new Date('2026-09-26T12:00:00Z'),
      }),
    ]);
    expect(result).toEqual({
      repositoryId: repository.id,
      fullName: repository.fullName,
      requestedLimit: 50,
      fetchedItems: 2,
      excludedPullRequests: 1,
      issues: [],
    });
  });
});
