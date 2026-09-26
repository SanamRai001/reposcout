import { describe, expect, it, vi } from 'vitest';

import {
  RepositoryContributionIssueBatchService,
} from './repository-contribution-issue-batch-service.js';

function repository(id: string) {
  return {
    id,
    fullName: `example/${id}`,
  };
}

describe('RepositoryContributionIssueBatchService', () => {
  it('processes a bounded listed page and returns a continuation cursor', async () => {
    const first = '11111111-1111-4111-8111-111111111111';
    const second = '22222222-2222-4222-8222-222222222222';
    const ingestRepository = vi.fn(async (repositoryId: string) => ({
      status: 'ingested' as const,
      repositoryId,
      fullName: `example/${repositoryId}`,
      fetchedCount: 2,
      persistedCount: 2,
    }));
    const service = new RepositoryContributionIssueBatchService(
      {
        async listPage(input) {
          expect(input.limit).toBe(2);
          expect(input.cursor).toBeNull();
          return {
            items: [
              repository(first) as never,
              repository(second) as never,
            ],
            hasMore: true,
          };
        },
      },
      { ingestRepository },
    );

    const result = await service.run({
      repositoryLimit: 2,
      issueLimit: 10,
    });

    expect(ingestRepository).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({
        status: 'completed',
        selected: 2,
        processed: 2,
        persistedIssues: 4,
        haltedReason: null,
        retryAt: null,
        nextCursorRepositoryId: second,
      }),
    );
  });

  it('halts on retry pressure and resumes after the last completed repository', async () => {
    const first = '11111111-1111-4111-8111-111111111111';
    const second = '22222222-2222-4222-8222-222222222222';
    const third = '33333333-3333-4333-8333-333333333333';
    const retryAt = new Date('2026-09-26T09:00:00Z');
    const ingestRepository = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'ingested',
        repositoryId: first,
        fullName: 'example/first',
        fetchedCount: 1,
        persistedCount: 1,
      })
      .mockResolvedValueOnce({
        status: 'retry_later',
        repositoryId: second,
        fullName: 'example/second',
        retryAt,
      });
    const service = new RepositoryContributionIssueBatchService(
      {
        async listPage() {
          return {
            items: [
              repository(first) as never,
              repository(second) as never,
              repository(third) as never,
            ],
            hasMore: false,
          };
        },
      },
      { ingestRepository },
    );

    const result = await service.run({
      repositoryLimit: 3,
      issueLimit: 20,
    });

    expect(ingestRepository).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({
        status: 'halted',
        selected: 3,
        processed: 2,
        persistedIssues: 1,
        haltedReason: 'retry_later',
        retryAt: '2026-09-26T09:00:00.000Z',
        nextCursorRepositoryId: first,
      }),
    );
  });

  it('halts on manual review rather than continuing across the catalog', async () => {
    const first = '11111111-1111-4111-8111-111111111111';
    const second = '22222222-2222-4222-8222-222222222222';
    const ingestRepository = vi.fn().mockResolvedValue({
      status: 'manual_review',
      repositoryId: first,
      fullName: 'example/first',
      retryAt: null,
    });
    const service = new RepositoryContributionIssueBatchService(
      {
        async listPage() {
          return {
            items: [
              repository(first) as never,
              repository(second) as never,
            ],
            hasMore: false,
          };
        },
      },
      { ingestRepository },
    );

    const result = await service.run();

    expect(ingestRepository).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('halted');
    expect(result.haltedReason).toBe('manual_review');
    expect(result.nextCursorRepositoryId).toBeNull();
  });
});
