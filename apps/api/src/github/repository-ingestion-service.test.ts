import { describe, expect, it, vi } from 'vitest';

import type { GithubRepositorySnapshot } from './github-client.js';
import { RepositoryIngestionService } from './repository-ingestion-service.js';
import type { UpsertRepositoryMetadataInput } from '../repositories/repository-metadata.js';
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
  isPrivate: false,
  createdAtGithub: new Date('2023-04-19T00:00:00Z'),
  updatedAtGithub: new Date('2026-09-20T00:00:00Z'),
  pushedAtGithub: new Date('2026-09-20T01:00:00Z'),
  metadata: {
    stars: 1250,
    forks: 210,
    openIssues: 34,
    primaryLanguage: 'TypeScript',
    licenseSpdx: 'Apache-2.0',
    topics: ['openai', 'sdk', 'typescript'],
  },
};

const persistedRepository: RepositoryRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  githubRepositoryId: fetchedRepository.githubRepositoryId,
  owner: fetchedRepository.owner,
  name: fetchedRepository.name,
  fullName: fetchedRepository.fullName,
  githubUrl: fetchedRepository.githubUrl,
  defaultBranch: fetchedRepository.defaultBranch,
  description: fetchedRepository.description,
  isArchived: fetchedRepository.isArchived,
  isFork: fetchedRepository.isFork,
  createdAtGithub: fetchedRepository.createdAtGithub,
  updatedAtGithub: fetchedRepository.updatedAtGithub,
  pushedAtGithub: fetchedRepository.pushedAtGithub,
  lastSyncedAt: new Date('2026-09-21T12:00:00Z'),
  createdAt: new Date('2026-09-21T12:00:01Z'),
  updatedAt: new Date('2026-09-21T12:00:01Z'),
};

describe('RepositoryIngestionService', () => {
  it('persists canonical state and measured metadata from one fetch', async () => {
    const fetchRepository = vi.fn().mockResolvedValue(fetchedRepository);
    const upsertWithMetadata = vi.fn<
      (
        input: UpsertRepositoryInput,
        metadata: UpsertRepositoryMetadataInput,
      ) => Promise<RepositoryRecord>
    >().mockResolvedValue(persistedRepository);
    const now = new Date('2026-09-21T12:00:00Z');

    const service = new RepositoryIngestionService(
      { fetchRepository },
      { upsertWithMetadata },
      () => now,
    );

    const result = await service.ingest(
      'https://github.com/openai/openai-node',
    );

    expect(fetchRepository).toHaveBeenCalledWith({
      owner: 'openai',
      name: 'openai-node',
    });
    expect(upsertWithMetadata).toHaveBeenCalledWith(
      {
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
      },
      {
        stars: 1250,
        forks: 210,
        openIssues: 34,
        primaryLanguage: 'TypeScript',
        licenseSpdx: 'Apache-2.0',
        topics: ['openai', 'sdk', 'typescript'],
        observedAt: now,
      },
    );
    expect(result).toBe(persistedRepository);
  });

  it('does not persist when the GitHub fetch fails', async () => {
    const fetchRepository = vi
      .fn()
      .mockRejectedValue(new Error('GitHub unavailable'));
    const upsertWithMetadata = vi.fn();

    const service = new RepositoryIngestionService(
      { fetchRepository },
      { upsertWithMetadata },
    );

    await expect(service.ingest('openai/openai-node')).rejects.toThrow(
      'GitHub unavailable',
    );
    expect(upsertWithMetadata).not.toHaveBeenCalled();
  });
});
