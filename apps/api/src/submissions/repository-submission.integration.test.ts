import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { RepositoryStore } from '../repositories/repository-store.js';
import type { UpsertRepositoryInput } from '../repositories/repository.js';
import {
  RepositoryAlreadyIndexedError,
  RepositorySubmissionAlreadyPendingError,
  RepositorySubmissionService,
} from './repository-submission-service.js';
import { RepositorySubmissionStore } from './repository-submission-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for repository submission tests.');
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 5,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);
const repositoryStore = new RepositoryStore(pool);
const submissionStore = new RepositorySubmissionStore(pool);
const service = new RepositorySubmissionService(
  repositoryStore,
  submissionStore,
);

beforeEach(async () => {
  await pool.query('DELETE FROM repository_submissions');
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

function repositoryInput(): UpsertRepositoryInput {
  return {
    githubRepositoryId: '777777777',
    owner: 'Example',
    name: 'Project',
    fullName: 'Example/Project',
    githubUrl: 'https://github.com/Example/Project',
    defaultBranch: 'main',
    description: 'Already indexed repository fixture.',
    isArchived: false,
    isFork: false,
    createdAtGithub: new Date('2026-01-01T00:00:00Z'),
    updatedAtGithub: new Date('2026-09-23T00:00:00Z'),
    pushedAtGithub: new Date('2026-09-23T01:00:00Z'),
    lastSyncedAt: new Date('2026-09-23T02:00:00Z'),
  };
}

describe('repository submission intake with PostgreSQL', () => {
  it('stores one canonical pending submission', async () => {
    const submission = await service.submit(
      'https://github.com/Example/Project.git',
    );

    expect(submission).toEqual(
      expect.objectContaining({
        submittedUrl: 'https://github.com/example/project',
        normalizedOwner: 'example',
        normalizedName: 'project',
        normalizedFullName: 'example/project',
        status: 'PENDING',
      }),
    );

    const persisted =
      await submissionStore.findPendingByNormalizedFullName(
        'example/project',
      );

    expect(persisted).toEqual(submission);
  });

  it('rejects an already-indexed repository case-insensitively', async () => {
    await repositoryStore.upsert(repositoryInput());

    await expect(
      service.submit('https://github.com/example/project'),
    ).rejects.toBeInstanceOf(RepositoryAlreadyIndexedError);

    const count = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM repository_submissions',
    );
    expect(count.rows[0]?.count).toBe('0');
  });

  it('treats casing and .git variations as the same pending repository', async () => {
    await service.submit('https://github.com/Example/Project');

    await expect(
      service.submit('https://github.com/example/project.git'),
    ).rejects.toBeInstanceOf(
      RepositorySubmissionAlreadyPendingError,
    );

    const count = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM repository_submissions',
    );
    expect(count.rows[0]?.count).toBe('1');
  });

  it('allows only one pending row under concurrent duplicate submissions', async () => {
    const results = await Promise.allSettled([
      service.submit('https://github.com/Example/RaceProject'),
      service.submit('https://github.com/example/raceproject.git'),
    ]);

    const fulfilled = results.filter(
      (result) => result.status === 'fulfilled',
    );
    const rejected = results.filter(
      (result) => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejection = rejected[0];

    if (!rejection || rejection.status !== 'rejected') {
      throw new Error('Expected one rejected concurrent submission.');
    }

    expect(rejection.reason).toBeInstanceOf(
      RepositorySubmissionAlreadyPendingError,
    );

    const rows = await pool.query<{
      normalized_full_name: string;
      status: string;
    }>(
      `
        SELECT normalized_full_name, status
        FROM repository_submissions
      `,
    );

    expect(rows.rows).toEqual([
      {
        normalized_full_name: 'example/raceproject',
        status: 'PENDING',
      },
    ]);
  });
});
