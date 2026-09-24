import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { RepositoryStore } from '../repositories/repository-store.js';
import type { UpsertRepositoryInput } from '../repositories/repository.js';
import { GithubClient } from './github-client.js';
import { RepositoryIngestionService } from './repository-ingestion-service.js';
import { RepositoryRefreshService } from './repository-refresh-service.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for repository refresh tests.');
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 2,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);
const repositoryStore = new RepositoryStore(pool);

beforeEach(async () => {
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

function existingInput(
  overrides: Partial<UpsertRepositoryInput> = {},
): UpsertRepositoryInput {
  return {
    githubRepositoryId: '24681012',
    owner: 'small-org',
    name: 'useful-project',
    fullName: 'small-org/useful-project',
    githubUrl: 'https://github.com/small-org/useful-project',
    defaultBranch: 'main',
    description: 'Last known good repository metadata.',
    isArchived: false,
    isFork: false,
    discoveryStatus: 'DISCOVERABLE',
    createdAtGithub: new Date('2025-01-01T00:00:00Z'),
    updatedAtGithub: new Date('2026-09-20T00:00:00Z'),
    pushedAtGithub: new Date('2026-09-20T03:00:00Z'),
    lastSyncedAt: new Date('2026-09-20T00:00:00Z'),
    ...overrides,
  };
}

describe('repository refresh operations', () => {
  it('preserves last known repository data when GitHub returns 404', async () => {
    const existing = await repositoryStore.upsert(existingInput());

    const githubClient = new GithubClient({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status: 404 })),
    });
    const ingestionService = new RepositoryIngestionService(
      githubClient,
      repositoryStore,
      () => new Date('2026-09-21T12:00:00Z'),
    );
    const refreshService = new RepositoryRefreshService(
      repositoryStore,
      ingestionService,
      () => new Date('2026-09-21T12:00:00Z'),
    );

    const result = await refreshService.refresh(
      'small-org/useful-project',
      { force: true },
    );

    expect(result.status).toBe('unavailable');

    const stored =
      await repositoryStore.findByGithubRepositoryId('24681012');

    expect(stored?.id).toBe(existing.id);
    expect(stored?.description).toBe('Last known good repository metadata.');
    expect(stored?.lastSyncedAt.toISOString()).toBe(
      '2026-09-20T00:00:00.000Z',
    );
  });

  it('skips a recent repository without issuing a GitHub request', async () => {
    await repositoryStore.upsert(
      existingInput({
        lastSyncedAt: new Date('2026-09-21T10:00:00Z'),
      }),
    );

    const fetchImplementation = vi.fn<typeof fetch>();
    const githubClient = new GithubClient({ fetchImplementation });
    const ingestionService = new RepositoryIngestionService(
      githubClient,
      repositoryStore,
    );
    const refreshService = new RepositoryRefreshService(
      repositoryStore,
      ingestionService,
      () => new Date('2026-09-21T12:00:00Z'),
    );

    const result = await refreshService.refresh('small-org/useful-project');

    expect(result.status).toBe('skipped');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
