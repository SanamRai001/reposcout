import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { RepositoryContributionIssueStore } from './repository-contribution-issue-store.js';
import { RepositoryStore } from './repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for contribution issue persistence tests.',
  );
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
const issueStore = new RepositoryContributionIssueStore(pool);

beforeEach(async () => {
  await pool.query('DELETE FROM repository_contribution_issues');
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

async function seedRepository(
  githubRepositoryId: string,
  name: string,
) {
  return repositoryStore.upsert(
    {
      githubRepositoryId,
      owner: 'contribution-fixture',
      name,
      fullName: `contribution-fixture/${name}`,
      githubUrl: `https://github.com/contribution-fixture/${name}`,
      defaultBranch: 'main',
      description: 'Contribution issue persistence fixture.',
      isArchived: false,
      isFork: false,
      createdAtGithub: new Date('2025-01-01T00:00:00Z'),
      updatedAtGithub: new Date('2026-09-26T00:00:00Z'),
      pushedAtGithub: new Date('2026-09-26T00:00:00Z'),
      lastSyncedAt: new Date('2026-09-26T08:00:00Z'),
    },
    { initialListing: 'listed' },
  );
}

function issueInput(
  repositoryId: string,
  overrides: Partial<Parameters<typeof issueStore.upsert>[0]> = {},
) {
  return {
    repositoryId,
    githubIssueId: '991000001',
    number: 42,
    title: 'Improve contribution docs',
    githubUrl:
      'https://github.com/contribution-fixture/project/issues/42',
    state: 'open' as const,
    locked: false,
    assigneeCount: 0,
    commentCount: 2,
    labels: ['good first issue', 'help wanted'],
    createdAtGithub: new Date('2026-09-01T00:00:00Z'),
    updatedAtGithub: new Date('2026-09-25T00:00:00Z'),
    observedAt: new Date('2026-09-26T08:00:00Z'),
    ...overrides,
  };
}

describe('RepositoryContributionIssueStore with PostgreSQL', () => {
  it('persists measured issue observations and lists them by repository', async () => {
    const repository = await seedRepository('991100001', 'project');

    const stored = await issueStore.upsert(issueInput(repository.id));
    const listed = await issueStore.listByRepositoryId(repository.id);

    expect(stored).toEqual(
      expect.objectContaining({
        repositoryId: repository.id,
        githubIssueId: '991000001',
        number: 42,
        state: 'open',
        assigneeCount: 0,
        commentCount: 2,
        labels: ['good first issue', 'help wanted'],
      }),
    );
    expect(listed.map((issue) => issue.id)).toEqual([stored.id]);
  });

  it('does not let an older GitHub observation overwrite newer state', async () => {
    const repository = await seedRepository('991100002', 'project');
    const current = await issueStore.upsert(
      issueInput(repository.id, {
        title: 'Current title',
        state: 'closed',
        commentCount: 8,
        updatedAtGithub: new Date('2026-09-25T12:00:00Z'),
        observedAt: new Date('2026-09-26T08:00:00Z'),
      }),
    );

    const stale = await issueStore.upsert(
      issueInput(repository.id, {
        title: 'Stale title',
        state: 'open',
        commentCount: 1,
        updatedAtGithub: new Date('2026-09-24T12:00:00Z'),
        observedAt: new Date('2026-09-26T09:00:00Z'),
      }),
    );

    expect(stale.id).toBe(current.id);
    expect(stale.title).toBe('Current title');
    expect(stale.state).toBe('closed');
    expect(stale.commentCount).toBe(8);
    expect(stale.updatedAtGithub).toEqual(
      new Date('2026-09-25T12:00:00Z'),
    );
  });

  it('allows a newer observation to update mutable measured state', async () => {
    const repository = await seedRepository('991100003', 'project');
    const first = await issueStore.upsert(issueInput(repository.id));

    const updated = await issueStore.upsert(
      issueInput(repository.id, {
        title: 'Updated contribution docs',
        state: 'closed',
        locked: true,
        assigneeCount: 1,
        commentCount: 5,
        labels: ['help wanted'],
        updatedAtGithub: new Date('2026-09-26T07:00:00Z'),
        observedAt: new Date('2026-09-26T08:30:00Z'),
      }),
    );

    expect(updated.id).toBe(first.id);
    expect(updated).toEqual(
      expect.objectContaining({
        title: 'Updated contribution docs',
        state: 'closed',
        locked: true,
        assigneeCount: 1,
        commentCount: 5,
        labels: ['help wanted'],
      }),
    );
  });

  it('does not allow one GitHub issue identity to move between repositories', async () => {
    const firstRepository = await seedRepository('991100004', 'first');
    const secondRepository = await seedRepository('991100005', 'second');

    await issueStore.upsert(issueInput(firstRepository.id));

    await expect(
      issueStore.upsert(
        issueInput(secondRepository.id, {
          number: 99,
          githubUrl:
            'https://github.com/contribution-fixture/second/issues/99',
          updatedAtGithub: new Date('2026-09-26T09:00:00Z'),
          observedAt: new Date('2026-09-26T10:00:00Z'),
        }),
      ),
    ).rejects.toThrow(
      'GitHub issue identity is already associated with another repository.',
    );
  });
});
