import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { RepositoryStore } from '../repositories/repository-store.js';
import { GithubClient } from './github-client.js';
import { RepositoryIngestionService } from './repository-ingestion-service.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for repository ingestion tests.');
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

function githubResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 24681012,
    name: 'useful-project',
    full_name: 'small-org/useful-project',
    html_url: 'https://github.com/small-org/useful-project',
    default_branch: 'main',
    description: 'A useful project that deserves discovery.',
    archived: false,
    fork: false,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2026-09-20T00:00:00Z',
    pushed_at: '2026-09-20T03:00:00Z',
    stargazers_count: 321,
    forks_count: 27,
    open_issues_count: 8,
    language: 'TypeScript',
    license: {
      spdx_id: 'MIT',
    },
    topics: ['developer-tools', 'typescript'],
    owner: {
      login: 'small-org',
    },
    ...overrides,
  };
}

describe('repository ingestion', () => {
  it('flows a validated GitHub response into canonical PostgreSQL persistence', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(githubResponse()), { status: 200 }),
    );

    const githubClient = new GithubClient({ fetchImplementation });
    const syncedAt = new Date('2026-09-21T10:00:00Z');
    const service = new RepositoryIngestionService(
      githubClient,
      repositoryStore,
      () => syncedAt,
    );

    const repository = await service.ingest(
      'https://github.com/small-org/useful-project',
    );

    expect(repository.githubRepositoryId).toBe('24681012');
    expect(repository.fullName).toBe('small-org/useful-project');
    expect(repository.lastSyncedAt.toISOString()).toBe(
      '2026-09-21T10:00:00.000Z',
    );

    const persisted =
      await repositoryStore.findByGithubRepositoryId('24681012');

    expect(persisted?.id).toBe(repository.id);
    expect(persisted?.description).toBe(
      'A useful project that deserves discovery.',
    );

    const catalogRepository = await repositoryStore.findById(repository.id);

    expect(catalogRepository?.metadata).toEqual(
      expect.objectContaining({
        repositoryId: repository.id,
        stars: 321,
        forks: 27,
        openIssues: 8,
        primaryLanguage: 'TypeScript',
        licenseSpdx: 'MIT',
        topics: ['developer-tools', 'typescript'],
        observedAt: syncedAt,
      }),
    );
  });

  it('refreshes the same canonical repository after a GitHub rename', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(githubResponse()), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            githubResponse({
              name: 'better-project',
              full_name: 'new-org/better-project',
              html_url: 'https://github.com/new-org/better-project',
              owner: { login: 'new-org' },
              updated_at: '2026-09-21T00:00:00Z',
              stargazers_count: 400,
              forks_count: 31,
              open_issues_count: 6,
              language: 'TypeScript',
              license: { spdx_id: 'MIT' },
              topics: ['backend', 'typescript'],
            }),
          ),
          { status: 200 },
        ),
      );

    const githubClient = new GithubClient({ fetchImplementation });
    const syncTimes = [
      new Date('2026-09-21T10:00:00Z'),
      new Date('2026-09-21T11:00:00Z'),
    ];
    const service = new RepositoryIngestionService(
      githubClient,
      repositoryStore,
      () => syncTimes.shift() ?? new Date('2026-09-21T12:00:00Z'),
    );

    const first = await service.ingest('small-org/useful-project');
    const renamed = await service.ingest('new-org/better-project');

    expect(renamed.id).toBe(first.id);
    expect(renamed.githubRepositoryId).toBe(first.githubRepositoryId);
    expect(renamed.fullName).toBe('new-org/better-project');

    const count = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM repositories',
    );

    expect(count.rows[0]?.count).toBe('1');

    const catalogRepository = await repositoryStore.findById(renamed.id);
    expect(catalogRepository?.metadata).toEqual(
      expect.objectContaining({
        stars: 400,
        forks: 31,
        openIssues: 6,
        topics: ['backend', 'typescript'],
        observedAt: new Date('2026-09-21T11:00:00Z'),
      }),
    );
  });
});
