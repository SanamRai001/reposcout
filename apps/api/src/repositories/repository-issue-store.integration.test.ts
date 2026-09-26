import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { RepositoryIssueStore } from './repository-issue-store.js';
import { RepositoryStore } from './repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for repository issue persistence tests.',
  );
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 4,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);
const repositoryStore = new RepositoryStore(pool);
const issueStore = new RepositoryIssueStore(pool);

beforeEach(async () => {
  await pool.query('DELETE FROM repository_issues');
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
      owner: 'issue-fixtures',
      name,
      fullName: `issue-fixtures/${name}`,
      githubUrl: `https://github.com/issue-fixtures/${name}`,
      defaultBranch: 'main',
      description: 'Issue persistence fixture.',
      isArchived: false,
      isFork: false,
      createdAtGithub: new Date('2025-01-01T00:00:00Z'),
      updatedAtGithub: new Date('2026-09-26T00:00:00Z'),
      pushedAtGithub: new Date('2026-09-26T00:00:00Z'),
      lastSyncedAt: new Date('2026-09-26T01:00:00Z'),
    },
    {
      initialListing: 'listed',
    },
  );
}

function issueInput(
  repositoryId: string,
  overrides: Partial<Parameters<RepositoryIssueStore['upsert']>[0]> = {},
) {
  return {
    repositoryId,
    githubIssueId: '880000001',
    number: 7,
    title: 'Improve contribution docs',
    htmlUrl:
      'https://github.com/issue-fixtures/project/issues/7',
    state: 'open' as const,
    locked: false,
    assigneeCount: 0,
    commentCount: 2,
    labels: ['help wanted', 'good first issue', 'help wanted'],
    createdAtGithub: new Date('2026-09-01T00:00:00Z'),
    updatedAtGithub: new Date('2026-09-20T00:00:00Z'),
    observedAt: new Date('2026-09-20T01:00:00Z'),
    ...overrides,
  };
}

describe('RepositoryIssueStore with PostgreSQL', () => {
  it('creates the issue table and contribution-discovery lookup index', async () => {
    const result = await pool.query<{
      issue_table: string | null;
      discovery_index: string | null;
    }>(
      `
        SELECT
          to_regclass('public.repository_issues')::text AS issue_table,
          to_regclass(
            'public.repository_issues_discovery_idx'
          )::text AS discovery_index
      `,
    );

    expect(result.rows[0]).toEqual({
      issue_table: 'repository_issues',
      discovery_index: 'repository_issues_discovery_idx',
    });
  });

  it('persists measured issue fields and deterministic label storage', async () => {
    const repository = await seedRepository('880000001', 'project');

    const issue = await issueStore.upsert(issueInput(repository.id));

    expect(issue).toEqual(
      expect.objectContaining({
        repositoryId: repository.id,
        githubIssueId: '880000001',
        number: 7,
        title: 'Improve contribution docs',
        state: 'open',
        locked: false,
        assigneeCount: 0,
        commentCount: 2,
        labels: ['good first issue', 'help wanted'],
      }),
    );
  });

  it('accepts a newer GitHub observation for the same canonical issue', async () => {
    const repository = await seedRepository('880000002', 'newer');
    await issueStore.upsert(issueInput(repository.id));

    const updated = await issueStore.upsert(
      issueInput(repository.id, {
        title: 'Updated contribution docs',
        state: 'closed',
        locked: true,
        assigneeCount: 1,
        commentCount: 5,
        updatedAtGithub: new Date('2026-09-21T00:00:00Z'),
        observedAt: new Date('2026-09-21T01:00:00Z'),
      }),
    );

    expect(updated).toEqual(
      expect.objectContaining({
        title: 'Updated contribution docs',
        state: 'closed',
        locked: true,
        assigneeCount: 1,
        commentCount: 5,
        updatedAtGithub: new Date('2026-09-21T00:00:00Z'),
      }),
    );
  });

  it('preserves newer stored state when an older GitHub observation arrives later', async () => {
    const repository = await seedRepository('880000003', 'stale');
    await issueStore.upsert(
      issueInput(repository.id, {
        title: 'Newest title',
        commentCount: 9,
        updatedAtGithub: new Date('2026-09-22T00:00:00Z'),
        observedAt: new Date('2026-09-22T01:00:00Z'),
      }),
    );

    const result = await issueStore.upsert(
      issueInput(repository.id, {
        title: 'Stale title',
        commentCount: 1,
        updatedAtGithub: new Date('2026-09-21T00:00:00Z'),
        observedAt: new Date('2026-09-23T01:00:00Z'),
      }),
    );

    expect(result.title).toBe('Newest title');
    expect(result.commentCount).toBe(9);
    expect(result.updatedAtGithub).toEqual(
      new Date('2026-09-22T00:00:00Z'),
    );
  });

  it('rejects reuse of one GitHub issue identity for another repository', async () => {
    const first = await seedRepository('880000004', 'first');
    const second = await seedRepository('880000005', 'second');

    await issueStore.upsert(issueInput(first.id));

    await expect(
      issueStore.upsert(
        issueInput(second.id, {
          htmlUrl:
            'https://github.com/issue-fixtures/second/issues/7',
        }),
      ),
    ).rejects.toThrow(
      'GitHub issue identity conflicts with existing repository issue.',
    );
  });
});
