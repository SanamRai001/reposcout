import { describe, expect, it, vi } from 'vitest';

import {
  GithubApiError,
  type GithubIssueSnapshot,
} from './github-client.js';
import {
  RepositoryContributionIssueIngestionService,
} from './repository-contribution-issue-ingestion-service.js';

const repository = {
  id: '11111111-1111-4111-8111-111111111111',
  githubRepositoryId: '123',
  owner: 'example',
  name: 'project',
  fullName: 'example/project',
};

const issue: GithubIssueSnapshot = {
  githubIssueId: '9001',
  number: 7,
  title: 'Contribution task',
  githubUrl: 'https://github.com/example/project/issues/7',
  state: 'open',
  locked: false,
  assigneeCount: 0,
  commentCount: 2,
  labels: ['good first issue'],
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-25T00:00:00Z'),
};

describe('RepositoryContributionIssueIngestionService', () => {
  it('does no provider work for an unlisted or unknown repository', async () => {
    const fetchRepositoryIssues = vi.fn();
    const upsert = vi.fn();
    const service = new RepositoryContributionIssueIngestionService(
      {
        async findById() {
          return null;
        },
      },
      { fetchRepositoryIssues },
      { upsert },
    );

    await expect(
      service.ingestRepository(repository.id, 25),
    ).resolves.toEqual({
      status: 'not_listed',
      repositoryId: repository.id,
    });
    expect(fetchRepositoryIssues).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('persists every fetched issue with one shared observation timestamp', async () => {
    const upsert = vi.fn(async (input) => ({
      id: '22222222-2222-4222-8222-222222222222',
      ...input,
      labels: [...input.labels],
      createdAt: new Date('2026-09-26T08:00:00Z'),
      updatedAt: new Date('2026-09-26T08:00:00Z'),
    }));
    const observedAt = new Date('2026-09-26T08:00:00Z');
    const service = new RepositoryContributionIssueIngestionService(
      {
        async findById() {
          return repository as never;
        },
      },
      {
        async fetchRepositoryIssues(reference, limit) {
          expect(reference).toEqual({
            owner: 'example',
            name: 'project',
          });
          expect(limit).toBe(25);
          return [issue];
        },
      },
      { upsert },
      () => observedAt,
    );

    const result = await service.ingestRepository(repository.id, 25);

    expect(result).toEqual({
      status: 'ingested',
      repositoryId: repository.id,
      fullName: 'example/project',
      fetchedCount: 1,
      persistedCount: 1,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: repository.id,
        githubIssueId: '9001',
        observedAt,
      }),
    );
  });

  it('preserves provider rate-limit retry semantics', async () => {
    const retryAt = new Date('2026-09-26T09:00:00Z');
    const service = new RepositoryContributionIssueIngestionService(
      {
        async findById() {
          return repository as never;
        },
      },
      {
        async fetchRepositoryIssues() {
          throw new GithubApiError(
            'rate_limited',
            'rate limited',
            403,
            retryAt,
          );
        },
      },
      { upsert: vi.fn() },
      () => new Date('2026-09-26T08:00:00Z'),
    );

    await expect(
      service.ingestRepository(repository.id, 25),
    ).resolves.toEqual({
      status: 'retry_later',
      repositoryId: repository.id,
      fullName: 'example/project',
      retryAt,
    });
  });

  it('routes invalid provider responses to manual review', async () => {
    const service = new RepositoryContributionIssueIngestionService(
      {
        async findById() {
          return repository as never;
        },
      },
      {
        async fetchRepositoryIssues() {
          throw new GithubApiError(
            'invalid_response',
            'bad payload',
            200,
          );
        },
      },
      { upsert: vi.fn() },
    );

    await expect(
      service.ingestRepository(repository.id, 25),
    ).resolves.toEqual({
      status: 'manual_review',
      repositoryId: repository.id,
      fullName: 'example/project',
      retryAt: null,
    });
  });
});
