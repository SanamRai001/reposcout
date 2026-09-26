import { describe, expect, it, vi } from 'vitest';

import type { RepositoryRefreshResult } from './repository-refresh-service.js';
import {
  parseSnapshotMaintenanceLimit,
  RepositorySnapshotMaintenanceService,
} from './repository-snapshot-maintenance-service.js';

function refreshed(fullName: string): RepositoryRefreshResult {
  return {
    status: 'refreshed',
    repository: {
      id: '11111111-1111-4111-8111-111111111111',
      githubRepositoryId: '1',
      owner: fullName.split('/')[0] ?? 'example',
      name: fullName.split('/')[1] ?? 'repo',
      fullName,
      githubUrl: `https://github.com/${fullName}`,
      defaultBranch: 'main',
      description: null,
      isArchived: false,
      isFork: false,
      createdAtGithub: new Date('2025-01-01T00:00:00Z'),
      updatedAtGithub: new Date('2026-09-26T00:00:00Z'),
      pushedAtGithub: new Date('2026-09-26T00:00:00Z'),
      lastSyncedAt: new Date('2026-09-26T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-09-26T00:00:00Z'),
    },
  };
}

describe('parseSnapshotMaintenanceLimit', () => {
  it('uses safe defaults and accepts bounded explicit values', () => {
    expect(parseSnapshotMaintenanceLimit('refreshLimit', undefined)).toBe(25);
    expect(parseSnapshotMaintenanceLimit('backfillLimit', undefined)).toBe(100);
    expect(parseSnapshotMaintenanceLimit('refreshLimit', '100')).toBe(100);
    expect(parseSnapshotMaintenanceLimit('backfillLimit', '500')).toBe(500);
  });

  it.each([
    ['refreshLimit', '0'],
    ['refreshLimit', '101'],
    ['backfillLimit', '501'],
    ['backfillLimit', 'abc'],
  ] as const)('rejects invalid %s value %s', (name, value) => {
    expect(() => parseSnapshotMaintenanceLimit(name, value)).toThrow();
  });
});

describe('RepositorySnapshotMaintenanceService', () => {
  it('returns already_running without doing work when the lock is held', async () => {
    const backfill = vi.fn();
    const candidates = vi.fn();
    const refresh = vi.fn();
    const service = new RepositorySnapshotMaintenanceService(
      {
        async tryAcquireRunLock() {
          return null;
        },
      },
      { runBatch: backfill },
      { listRefreshCandidates: candidates },
      { refresh },
      () => new Date('2026-09-26T00:00:00Z'),
    );

    const result = await service.run();

    expect(result).toEqual({
      status: 'already_running',
      startedAt: '2026-09-26T00:00:00.000Z',
    });
    expect(backfill).not.toHaveBeenCalled();
    expect(candidates).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('backfills first, then refreshes a bounded candidate set and releases the lock', async () => {
    const release = vi.fn(async () => undefined);
    const calls: string[] = [];
    const service = new RepositorySnapshotMaintenanceService(
      {
        async tryAcquireRunLock() {
          return { release };
        },
      },
      {
        async runBatch(limit) {
          calls.push(`backfill:${limit}`);
          return {
            selected: 1,
            processed: 1,
            summary: { created: 1, existing: 0 },
            items: [],
          };
        },
      },
      {
        async listRefreshCandidates(input) {
          calls.push(`select:${input.limit}`);
          return [
            {
              repositoryId: '11111111-1111-4111-8111-111111111111',
              fullName: 'example/one',
              lastSyncedAt: new Date('2026-09-20T00:00:00Z'),
            },
            {
              repositoryId: '22222222-2222-4222-8222-222222222222',
              fullName: 'example/two',
              lastSyncedAt: new Date('2026-09-21T00:00:00Z'),
            },
          ];
        },
      },
      {
        async refresh(fullName) {
          calls.push(`refresh:${fullName}`);
          return refreshed(fullName);
        },
      },
      (() => {
        const values = [
          new Date('2026-09-26T00:00:00Z'),
          new Date('2026-09-26T00:01:00Z'),
        ];
        return () => values.shift() ?? new Date('2026-09-26T00:01:00Z');
      })(),
    );

    const result = await service.run({
      refreshLimit: 2,
      backfillLimit: 5,
    });

    expect(calls).toEqual([
      'backfill:5',
      'select:2',
      'refresh:example/one',
      'refresh:example/two',
    ]);
    expect(result.status).toBe('completed');
    if (result.status === 'completed') {
      expect(result.refresh.summary.refreshed).toBe(2);
      expect(result.refresh.processed).toBe(2);
    }
    expect(release).toHaveBeenCalledOnce();
  });

  it('halts the remaining batch on provider retry pressure and surfaces retryAt', async () => {
    const release = vi.fn(async () => undefined);
    const refresh = vi
      .fn()
      .mockResolvedValueOnce(refreshed('example/one'))
      .mockResolvedValueOnce({
        status: 'retry_later',
        repository: null,
        retryAt: new Date('2026-09-26T01:00:00Z'),
      } satisfies RepositoryRefreshResult);
    const service = new RepositorySnapshotMaintenanceService(
      {
        async tryAcquireRunLock() {
          return { release };
        },
      },
      {
        async runBatch() {
          return {
            selected: 0,
            processed: 0,
            summary: { created: 0, existing: 0 },
            items: [],
          };
        },
      },
      {
        async listRefreshCandidates() {
          return [
            {
              repositoryId: '11111111-1111-4111-8111-111111111111',
              fullName: 'example/one',
              lastSyncedAt: new Date('2026-09-20T00:00:00Z'),
            },
            {
              repositoryId: '22222222-2222-4222-8222-222222222222',
              fullName: 'example/two',
              lastSyncedAt: new Date('2026-09-21T00:00:00Z'),
            },
            {
              repositoryId: '33333333-3333-4333-8333-333333333333',
              fullName: 'example/three',
              lastSyncedAt: new Date('2026-09-22T00:00:00Z'),
            },
          ];
        },
      },
      { refresh },
      () => new Date('2026-09-26T00:00:00Z'),
    );

    const result = await service.run();

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('halted');
    if (result.status === 'halted') {
      expect(result.refresh.haltedReason).toBe('retry_later');
      expect(result.refresh.retryAt).toBe('2026-09-26T01:00:00.000Z');
      expect(result.refresh.selected).toBe(3);
      expect(result.refresh.processed).toBe(2);
    }
    expect(release).toHaveBeenCalledOnce();
  });

  it('releases the advisory lock when work throws unexpectedly', async () => {
    const release = vi.fn(async () => undefined);
    const service = new RepositorySnapshotMaintenanceService(
      {
        async tryAcquireRunLock() {
          return { release };
        },
      },
      {
        async runBatch() {
          throw new Error('database failed');
        },
      },
      {
        async listRefreshCandidates() {
          return [];
        },
      },
      {
        async refresh() {
          return refreshed('example/repo');
        },
      },
    );

    await expect(service.run()).rejects.toThrow('database failed');
    expect(release).toHaveBeenCalledOnce();
  });
});
