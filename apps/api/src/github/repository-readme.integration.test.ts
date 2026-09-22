import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { GithubClient } from './github-client.js';
import { RepositoryReadmeService } from './repository-readme-service.js';
import { RepositoryReadmeStore } from '../repositories/repository-readme-store.js';
import type { UpsertRepositoryInput } from '../repositories/repository.js';
import { RepositoryStore } from '../repositories/repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for README content tests.');
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 3,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);
const repositoryStore = new RepositoryStore(pool);
const readmeStore = new RepositoryReadmeStore(pool);

beforeEach(async () => {
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

function repositoryInput(
  overrides: Partial<UpsertRepositoryInput> = {},
): UpsertRepositoryInput {
  return {
    githubRepositoryId: '9988776655',
    owner: 'example',
    name: 'readme-project',
    fullName: 'example/readme-project',
    githubUrl: 'https://github.com/example/readme-project',
    defaultBranch: 'main',
    description: 'README integration fixture.',
    isArchived: false,
    isFork: false,
    createdAtGithub: new Date('2026-01-01T00:00:00Z'),
    updatedAtGithub: new Date('2026-09-20T00:00:00Z'),
    pushedAtGithub: new Date('2026-09-20T01:00:00Z'),
    lastSyncedAt: new Date('2026-09-21T00:00:00Z'),
    ...overrides,
  };
}

describe('repository README content', () => {
  it('flows validated GitHub README text into PostgreSQL with provenance', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());
    const readme = '# Useful Project\n\nA useful repository.\n';
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'file',
          encoding: 'base64',
          size: Buffer.byteLength(readme, 'utf8'),
          name: 'README.md',
          path: 'docs/README.md',
          sha: '1234567890abcdef',
          content: Buffer.from(readme, 'utf8').toString('base64'),
        }),
        { status: 200 },
      ),
    );
    const service = new RepositoryReadmeService(
      new GithubClient({ fetchImplementation }),
      readmeStore,
      () => new Date('2026-09-22T08:00:00Z'),
    );

    const result = await service.refresh(repository);
    const persisted = await readmeStore.findByRepositoryId(repository.id);

    expect(result).toEqual(
      expect.objectContaining({
        repositoryId: repository.id,
        status: 'PRESENT',
        sourceRef: 'main',
        path: 'docs/README.md',
        sha: '1234567890abcdef',
        sizeBytes: Buffer.byteLength(readme, 'utf8'),
        content: readme,
        observedAt: new Date('2026-09-22T08:00:00Z'),
      }),
    );
    expect(persisted).toEqual(result);
  });

  it('preserves a newer README observation when an older refresh arrives later', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());

    await readmeStore.upsert({
      repositoryId: repository.id,
      status: 'PRESENT',
      sourceRef: 'main',
      path: 'README.md',
      sha: 'newer-sha',
      sizeBytes: 6,
      content: 'newer\n',
      observedAt: new Date('2026-09-22T10:00:00Z'),
    });

    const stale = await readmeStore.upsert({
      repositoryId: repository.id,
      status: 'PRESENT',
      sourceRef: 'main',
      path: 'README.md',
      sha: 'older-sha',
      sizeBytes: 6,
      content: 'older\n',
      observedAt: new Date('2026-09-22T09:00:00Z'),
    });

    expect(stale.sha).toBe('newer-sha');
    expect(stale.content).toBe('newer\n');
    expect(stale.observedAt.toISOString()).toBe(
      '2026-09-22T10:00:00.000Z',
    );
  });

  it('stores oversized README evidence without storing the body', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'file',
          size: 300_000,
          path: 'README.md',
          sha: 'oversized-sha',
        }),
        { status: 200 },
      ),
    );
    const service = new RepositoryReadmeService(
      new GithubClient({ fetchImplementation }),
      readmeStore,
      () => new Date('2026-09-22T11:00:00Z'),
    );

    const result = await service.refresh(repository);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'TOO_LARGE',
        sourceRef: 'main',
        path: 'README.md',
        sha: 'oversized-sha',
        sizeBytes: 300_000,
        content: null,
      }),
    );
  });
});
