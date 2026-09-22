import { describe, expect, it, vi } from 'vitest';

import type { GithubReadmeSnapshot } from './github-client.js';
import { RepositoryReadmeService } from './repository-readme-service.js';
import type {
  RepositoryReadmeRecord,
  UpsertRepositoryReadmeInput,
} from '../repositories/repository-readme.js';
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
  createdAt: new Date('2026-09-21T08:00:01Z'),
  updatedAt: new Date('2026-09-21T08:00:01Z'),
};

const persistedReadme: RepositoryReadmeRecord = {
  repositoryId: repository.id,
  status: 'PRESENT',
  sourceRef: 'main',
  path: 'README.md',
  sha: 'abc123',
  sizeBytes: 8,
  content: '# Hello\n',
  observedAt: new Date('2026-09-22T08:00:00Z'),
  createdAt: new Date('2026-09-22T08:00:01Z'),
  updatedAt: new Date('2026-09-22T08:00:01Z'),
};

describe('RepositoryReadmeService', () => {
  it('maps present README content with source ref provenance', async () => {
    const snapshot: GithubReadmeSnapshot = {
      status: 'present',
      path: 'README.md',
      sha: 'abc123',
      sizeBytes: 8,
      content: '# Hello\n',
    };
    const fetchReadme = vi.fn().mockResolvedValue(snapshot);
    const upsert = vi.fn<
      (input: UpsertRepositoryReadmeInput) => Promise<RepositoryReadmeRecord>
    >().mockResolvedValue(persistedReadme);
    const observedAt = new Date('2026-09-22T08:00:00Z');
    const service = new RepositoryReadmeService(
      { fetchReadme },
      { upsert },
      () => observedAt,
    );

    const result = await service.refresh(repository);

    expect(fetchReadme).toHaveBeenCalledWith(
      {
        owner: 'openai',
        name: 'openai-node',
      },
      'main',
    );
    expect(upsert).toHaveBeenCalledWith({
      repositoryId: repository.id,
      status: 'PRESENT',
      sourceRef: 'main',
      path: 'README.md',
      sha: 'abc123',
      sizeBytes: 8,
      content: '# Hello\n',
      observedAt,
    });
    expect(result).toBe(persistedReadme);
  });

  it('stores a not-found observation without inventing file metadata', async () => {
    const fetchReadme = vi.fn().mockResolvedValue({
      status: 'not_found',
    } satisfies GithubReadmeSnapshot);
    const upsert = vi.fn().mockResolvedValue({
      ...persistedReadme,
      status: 'NOT_FOUND',
      path: null,
      sha: null,
      sizeBytes: null,
      content: null,
    });
    const observedAt = new Date('2026-09-22T09:00:00Z');
    const service = new RepositoryReadmeService(
      { fetchReadme },
      { upsert },
      () => observedAt,
    );

    await service.refresh(repository);

    expect(upsert).toHaveBeenCalledWith({
      repositoryId: repository.id,
      status: 'NOT_FOUND',
      sourceRef: 'main',
      path: null,
      sha: null,
      sizeBytes: null,
      content: null,
      observedAt,
    });
  });

  it('does not call GitHub for repositories without a default branch', async () => {
    const fetchReadme = vi.fn();
    const upsert = vi.fn().mockResolvedValue({
      ...persistedReadme,
      status: 'NOT_FOUND',
      sourceRef: null,
      path: null,
      sha: null,
      sizeBytes: null,
      content: null,
    });
    const service = new RepositoryReadmeService(
      { fetchReadme },
      { upsert },
      () => new Date('2026-09-22T10:00:00Z'),
    );

    await service.refresh({
      ...repository,
      defaultBranch: null,
    });

    expect(fetchReadme).not.toHaveBeenCalled();
  });
});
