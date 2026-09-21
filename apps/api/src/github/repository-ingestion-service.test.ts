import { describe, expect, it, vi } from 'vitest';

import type { GithubRepositorySnapshot } from './github-client.js';
import { RepositoryIngestionService } from './repository-ingestion-service.js';
import type {
  RepositoryRecord,
  UpsertRepositoryInput,
} from '../repositories/repository.js';

const fetchedRepository: GithubRepositorySnapshot = {
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
};

const persistedRepository: RepositoryRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  ...fetchedRepository,
  lastSyncedAt: new Date('2026-09-21T12:00:00Z'),
  createdAt: new Date('2026-09-21T12:00:01Z'),
  updatedAt: new Date('2026-09-21T12:00:01Z'),
};

describe('RepositoryIngestionService', () => {
  it('parses, fetches, normalizes and persists one repository', async () => {
    const fetchRepository = vi.fn().mockResolvedValue(fetchedRepository);
    const upsert = vi.fn<
      (input: UpsertRepositoryInput) => Promise<RepositoryRecord>
    >().mockResolvedValue(persistedRepository);
    const now = new Date('2026-09-21T12:00:00Z');

    const service = new RepositoryIngestionService(
      { fetchRepository },
      { upsert },
      () => now,
    );

    const result = await service.ingest(
      'https://github.com/openai/openai-node',
    );

    expect(fetchRepository).toHaveBeenCalledWith({
      owner: 'openai',
      name: 'openai-node',
    });
    expect(upsert).toHaveBeenCalledWith({
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
      lastSyncedAt: now,
    });
    expect(result).toBe(persistedRepository);
  });

  it('does not persist when the GitHub fetch fails', async () => {
    const fetchRepository = vi
      .fn()
      .mockRejectedValue(new Error('GitHub unavailable'));
    const upsert = vi.fn();

    const service = new RepositoryIngestionService(
      { fetchRepository },
      { upsert },
    );

    await expect(service.ingest('openai/openai-node')).rejects.toThrow(
      'GitHub unavailable',
    );
    expect(upsert).not.toHaveBeenCalled();
  });
});
