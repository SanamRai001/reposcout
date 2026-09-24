import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import type { UpsertRepositoryMetadataInput } from './repository-metadata.js';
import type { UpsertRepositoryInput } from './repository.js';
import { RepositoryStore } from './repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for repository persistence tests.');
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

beforeEach(async () => {
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

function createInput(
  overrides: Partial<UpsertRepositoryInput> = {},
): UpsertRepositoryInput {
  return {
    githubRepositoryId: '123456789012345678',
    owner: 'example',
    name: 'project',
    fullName: 'example/project',
    githubUrl: 'https://github.com/example/project',
    defaultBranch: 'main',
    description: 'A repository persistence fixture.',
    isArchived: false,
    isFork: false,
    discoveryStatus: 'DISCOVERABLE',
    createdAtGithub: new Date('2026-01-01T00:00:00.000Z'),
    updatedAtGithub: new Date('2026-01-02T00:00:00.000Z'),
    pushedAtGithub: new Date('2026-01-03T00:00:00.000Z'),
    lastSyncedAt: new Date('2026-01-04T00:00:00.000Z'),
    ...overrides,
  };
}

function createMetadataInput(
  overrides: Partial<UpsertRepositoryMetadataInput> = {},
): UpsertRepositoryMetadataInput {
  return {
    stars: 10,
    forks: 2,
    openIssues: 3,
    primaryLanguage: 'TypeScript',
    licenseSpdx: 'MIT',
    topics: ['backend', 'typescript'],
    observedAt: new Date('2026-01-04T00:00:00.000Z'),
    ...overrides,
  };
}

describe('RepositoryStore', () => {
  it('creates a repository and preserves a bigint GitHub ID without precision loss', async () => {
    const created = await repositoryStore.upsert(createInput());

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(created.githubRepositoryId).toBe('123456789012345678');
    expect(created.fullName).toBe('example/project');
    expect(created.defaultBranch).toBe('main');
    expect(created.description).toBe('A repository persistence fixture.');
  });

  it('is idempotent by GitHub repository ID and preserves internal identity', async () => {
    const first = await repositoryStore.upsert(createInput());
    const second = await repositoryStore.upsert(
      createInput({
        description: 'Updated description.',
        lastSyncedAt: new Date('2026-01-05T00:00:00.000Z'),
      }),
    );

    const count = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM repositories',
    );

    expect(count.rows[0]?.count).toBe('1');
    expect(second.id).toBe(first.id);
    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
    expect(second.description).toBe('Updated description.');
    expect(second.lastSyncedAt.toISOString()).toBe(
      '2026-01-05T00:00:00.000Z',
    );
  });

  it('updates rename and transfer fields on the same canonical repository', async () => {
    const first = await repositoryStore.upsert(createInput());

    const renamed = await repositoryStore.upsert(
      createInput({
        owner: 'new-org',
        name: 'renamed-project',
        fullName: 'new-org/renamed-project',
        githubUrl: 'https://github.com/new-org/renamed-project',
        lastSyncedAt: new Date('2026-01-06T00:00:00.000Z'),
      }),
    );

    expect(renamed.id).toBe(first.id);
    expect(renamed.githubRepositoryId).toBe(first.githubRepositoryId);
    expect(renamed.owner).toBe('new-org');
    expect(renamed.name).toBe('renamed-project');
    expect(renamed.fullName).toBe('new-org/renamed-project');
  });

  it('does not let an older sync overwrite newer repository state', async () => {
    const current = await repositoryStore.upsert(
      createInput({
        owner: 'current-org',
        name: 'current-name',
        fullName: 'current-org/current-name',
        githubUrl: 'https://github.com/current-org/current-name',
        lastSyncedAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    );

    const staleResult = await repositoryStore.upsert(
      createInput({
        owner: 'stale-org',
        name: 'stale-name',
        fullName: 'stale-org/stale-name',
        githubUrl: 'https://github.com/stale-org/stale-name',
        lastSyncedAt: new Date('2026-01-15T00:00:00.000Z'),
      }),
    );

    expect(staleResult.id).toBe(current.id);
    expect(staleResult.fullName).toBe('current-org/current-name');
    expect(staleResult.lastSyncedAt.toISOString()).toBe(
      '2026-02-01T00:00:00.000Z',
    );
  });

  it('writes canonical state and measured metadata together', async () => {
    const repository = await repositoryStore.upsertWithMetadata(
      createInput(),
      createMetadataInput(),
    );

    const catalogRecord = await repositoryStore.findById(repository.id);

    expect(catalogRecord?.metadata).toEqual(
      expect.objectContaining({
        repositoryId: repository.id,
        stars: 10,
        forks: 2,
        openIssues: 3,
        primaryLanguage: 'TypeScript',
        licenseSpdx: 'MIT',
        topics: ['backend', 'typescript'],
        observedAt: new Date('2026-01-04T00:00:00.000Z'),
      }),
    );
  });

  it('does not let stale metadata overwrite a newer observation', async () => {
    const current = await repositoryStore.upsertWithMetadata(
      createInput({
        lastSyncedAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
      createMetadataInput({
        stars: 100,
        observedAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    );

    await repositoryStore.upsertWithMetadata(
      createInput({
        description: 'Stale repository state.',
        lastSyncedAt: new Date('2026-01-15T00:00:00.000Z'),
      }),
      createMetadataInput({
        stars: 5,
        observedAt: new Date('2026-01-15T00:00:00.000Z'),
      }),
    );

    const catalogRecord = await repositoryStore.findById(current.id);

    expect(catalogRecord?.description).toBe(
      'A repository persistence fixture.',
    );
    expect(catalogRecord?.metadata?.stars).toBe(100);
    expect(catalogRecord?.metadata?.observedAt.toISOString()).toBe(
      '2026-02-01T00:00:00.000Z',
    );
  });

  it('finds by GitHub repository ID and returns null when missing', async () => {
    await repositoryStore.upsert(createInput());

    const found = await repositoryStore.findByGithubRepositoryId(
      '123456789012345678',
    );
    const missing =
      await repositoryStore.findByGithubRepositoryId('999999999999999999');

    expect(found?.fullName).toBe('example/project');
    expect(missing).toBeNull();
  });

  it('returns all exact current full-name matches without assuming uniqueness', async () => {
    await repositoryStore.upsert(
      createInput({
        githubRepositoryId: '100000000000000001',
      }),
    );
    await repositoryStore.upsert(
      createInput({
        githubRepositoryId: '100000000000000002',
      }),
    );

    const matches = await repositoryStore.findByFullName('example/project');

    expect(matches).toHaveLength(2);
    expect(matches.map((repository) => repository.githubRepositoryId).sort()).toEqual([
      '100000000000000001',
      '100000000000000002',
    ]);
  });

  it('rejects invalid GitHub IDs before querying PostgreSQL', async () => {
    await expect(
      repositoryStore.findByGithubRepositoryId('9007199254740991.5'),
    ).rejects.toThrow(
      'githubRepositoryId must be a positive base-10 integer string.',
    );
  });
});
