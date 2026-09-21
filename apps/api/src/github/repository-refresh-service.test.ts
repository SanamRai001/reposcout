import { describe, expect, it, vi } from 'vitest';

import { GithubApiError } from './github-client.js';
import { RepositoryRefreshService } from './repository-refresh-service.js';
import type { RepositoryRecord } from '../repositories/repository.js';

const repository: RepositoryRecord = {
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
  createdAtGithub: new Date('2023-04-19T00:00:00Z'),
  updatedAtGithub: new Date('2026-09-20T00:00:00Z'),
  pushedAtGithub: new Date('2026-09-20T01:00:00Z'),
  lastSyncedAt: new Date('2026-09-21T08:00:00Z'),
  createdAt: new Date('2026-09-21T08:00:00Z'),
  updatedAt: new Date('2026-09-21T08:00:00Z'),
};

describe('RepositoryRefreshService', () => {
  it('skips repositories synchronized within the refresh window', async () => {
    const findByFullName = vi.fn().mockResolvedValue([repository]);
    const ingest = vi.fn();
    const service = new RepositoryRefreshService(
      { findByFullName },
      { ingest },
      () => new Date('2026-09-21T12:00:00Z'),
    );

    const result = await service.refresh('openai/openai-node');

    expect(result.status).toBe('skipped');
    expect(ingest).not.toHaveBeenCalled();
  });

  it('allows an explicit force refresh', async () => {
    const findByFullName = vi.fn().mockResolvedValue([repository]);
    const ingest = vi.fn().mockResolvedValue({
      ...repository,
      lastSyncedAt: new Date('2026-09-21T12:00:00Z'),
    });
    const service = new RepositoryRefreshService(
      { findByFullName },
      { ingest },
      () => new Date('2026-09-21T12:00:00Z'),
    );

    const result = await service.refresh('openai/openai-node', {
      force: true,
    });

    expect(result.status).toBe('refreshed');
    expect(ingest).toHaveBeenCalledTimes(1);
  });

  it('preserves an existing repository when GitHub returns 404', async () => {
    const findByFullName = vi.fn().mockResolvedValue([repository]);
    const ingest = vi.fn().mockRejectedValue(
      new GithubApiError('not_found', 'not found', 404),
    );
    const service = new RepositoryRefreshService(
      { findByFullName },
      { ingest },
      () => new Date('2026-09-22T12:00:00Z'),
    );

    const result = await service.refresh('openai/openai-node');

    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') {
      throw new Error('expected unavailable result');
    }
    expect(result.repository?.id).toBe(repository.id);
    expect(result.retryAt.toISOString()).toBe('2026-09-23T12:00:00.000Z');
  });

  it('returns GitHub rate-limit retry decisions without throwing', async () => {
    const retryAt = new Date('2026-09-21T13:30:00Z');
    const findByFullName = vi.fn().mockResolvedValue([]);
    const ingest = vi.fn().mockRejectedValue(
      new GithubApiError('rate_limited', 'limited', 403, retryAt),
    );
    const service = new RepositoryRefreshService(
      { findByFullName },
      { ingest },
      () => new Date('2026-09-21T12:00:00Z'),
    );

    const result = await service.refresh('openai/openai-node');

    expect(result).toEqual({
      status: 'retry_later',
      repository: null,
      retryAt,
    });
  });

  it('surfaces invalid GitHub payloads for manual review', async () => {
    const findByFullName = vi.fn().mockResolvedValue([]);
    const ingest = vi.fn().mockRejectedValue(
      new GithubApiError('invalid_response', 'bad response'),
    );
    const service = new RepositoryRefreshService(
      { findByFullName },
      { ingest },
      () => new Date('2026-09-21T12:00:00Z'),
    );

    const result = await service.refresh('openai/openai-node');

    expect(result).toEqual({
      status: 'manual_review',
      repository: null,
      retryAt: null,
    });
  });
});
