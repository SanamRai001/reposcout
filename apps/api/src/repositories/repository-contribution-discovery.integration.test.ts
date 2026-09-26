import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { RepositoryContributionEvidenceStore } from './repository-contribution-evidence-store.js';
import { RepositoryContributionDiscoveryStore } from './repository-contribution-discovery-store.js';
import { RepositoryContributionIssueStore } from './repository-contribution-issue-store.js';
import {
  EMPTY_CONTRIBUTION_DISCOVERY_FILTERS,
  type ContributionDiscoveryFilters,
} from './repository-contribution-discovery.js';
import { RepositoryStore } from './repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for contribution discovery tests.',
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
const evidenceStore = new RepositoryContributionEvidenceStore(pool);
const discoveryStore = new RepositoryContributionDiscoveryStore(pool);

beforeEach(async () => {
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

function repositoryInput(
  githubRepositoryId: string,
  name: string,
) {
  return {
    githubRepositoryId,
    owner: 'contribution-fixture',
    name,
    fullName: `contribution-fixture/${name}`,
    githubUrl: `https://github.com/contribution-fixture/${name}`,
    defaultBranch: 'main',
    description: 'Contribution discovery fixture.',
    isArchived: false,
    isFork: false,
    createdAtGithub: new Date('2025-01-01T00:00:00.000Z'),
    updatedAtGithub: new Date('2026-09-26T00:00:00.000Z'),
    pushedAtGithub: new Date('2026-09-26T00:00:00.000Z'),
    lastSyncedAt: new Date('2026-09-26T08:00:00.000Z'),
  };
}

async function seedRepository(
  githubRepositoryId: string,
  name: string,
  listed: boolean,
) {
  return repositoryStore.upsertWithMetadata(
    repositoryInput(githubRepositoryId, name),
    {
      stars: 100,
      forks: 10,
      openIssues: 4,
      primaryLanguage: 'TypeScript',
      licenseSpdx: 'MIT',
      topics: ['backend'],
      observedAt: new Date('2026-09-26T08:00:00.000Z'),
    },
    {
      initialListing: listed ? 'listed' : 'unlisted',
    },
  );
}

async function seedIssue(
  repositoryId: string,
  githubIssueId: string,
  number: number,
  overrides: Partial<Parameters<typeof issueStore.upsert>[0]> = {},
) {
  return issueStore.upsert({
    repositoryId,
    githubIssueId,
    number,
    title: `Contribution issue ${number}`,
    githubUrl:
      `https://github.com/contribution-fixture/project/issues/${number}`,
    state: 'open',
    locked: false,
    assigneeCount: 0,
    commentCount: 2,
    labels: ['Good-First_Issue', 'help-wanted'],
    createdAtGithub: new Date('2026-09-01T00:00:00.000Z'),
    updatedAtGithub: new Date('2026-09-25T12:00:00.000Z'),
    observedAt: new Date('2026-09-26T08:00:00.000Z'),
    ...overrides,
  });
}

function filters(
  overrides: Partial<ContributionDiscoveryFilters> = {},
): ContributionDiscoveryFilters {
  return {
    ...EMPTY_CONTRIBUTION_DISCOVERY_FILTERS,
    ...overrides,
  };
}

describe('RepositoryContributionDiscoveryStore with PostgreSQL', () => {
  it('filters listed open issues by measured availability, label hints, language, recency, and process evidence', async () => {
    const listed = await seedRepository('992100001', 'listed', true);
    const unlisted = await seedRepository('992100002', 'unlisted', false);

    await evidenceStore.upsert({
      repositoryId: listed.id,
      status: 'OBSERVED',
      contributing: {
        apiUrl:
          'https://api.github.com/repos/contribution-fixture/listed/contents/CONTRIBUTING.md',
        htmlUrl:
          'https://github.com/contribution-fixture/listed/blob/main/CONTRIBUTING.md',
      },
      codeOfConduct: null,
      issueTemplate: null,
      pullRequestTemplate: null,
      securityPolicy: null,
      communityProfileUpdatedAt: null,
      observedAt: new Date('2026-09-26T08:00:00.000Z'),
    });

    const match = await seedIssue(listed.id, '992000001', 1);

    await seedIssue(listed.id, '992000002', 2, {
      state: 'closed',
      updatedAtGithub: new Date('2026-09-26T08:00:00.000Z'),
    });
    await seedIssue(listed.id, '992000003', 3, {
      locked: true,
      assigneeCount: 1,
      labels: ['maintenance'],
      updatedAtGithub: new Date('2026-09-24T12:00:00.000Z'),
    });
    await seedIssue(unlisted.id, '992000004', 4, {
      updatedAtGithub: new Date('2026-09-26T09:00:00.000Z'),
    });

    const evaluatedAt = new Date('2026-09-26T12:00:00.000Z');
    const page = await discoveryStore.discoverPage({
      filters: filters({
        unassigned: true,
        unlocked: true,
        goodFirstIssue: true,
        helpWanted: true,
        primaryLanguage: 'typescript',
        updatedWithinDays: 30,
        contributing: 'present',
      }),
      limit: 20,
      position: null,
      evaluatedAt,
    });

    expect(page.hasMore).toBe(false);
    expect(page.items.map((item) => item.issue.id)).toEqual([match.id]);

    const item = page.items[0]!;
    expect(item.repository).toEqual({
      id: listed.id,
      fullName: 'contribution-fixture/listed',
      githubUrl: 'https://github.com/contribution-fixture/listed',
      primaryLanguage: 'TypeScript',
    });
    expect(item.signalSnapshot.normalizedLabels).toEqual([
      'good first issue',
      'help wanted',
    ]);
    expect(item.signalSnapshot.signals).toEqual(
      expect.objectContaining({
        'entry.good_first_issue_label': {
          id: 'entry.good_first_issue_label',
          availability: 'available',
          value: true,
        },
        'entry.help_wanted_label': {
          id: 'entry.help_wanted_label',
          availability: 'available',
          value: true,
        },
        'process.contributing_present': {
          id: 'process.contributing_present',
          availability: 'available',
          value: true,
        },
        'availability.open': {
          id: 'availability.open',
          availability: 'available',
          value: true,
        },
        'availability.unassigned': {
          id: 'availability.unassigned',
          availability: 'available',
          value: true,
        },
        'availability.unlocked': {
          id: 'availability.unlocked',
          availability: 'available',
          value: true,
        },
        'activity.days_since_update': {
          id: 'activity.days_since_update',
          availability: 'available',
          value: 1,
        },
      }),
    );
    expect(JSON.stringify(item.signalSnapshot)).not.toContain('"score"');
    expect(JSON.stringify(item.signalSnapshot)).not.toContain(
      'beginnerFriendly',
    );
  });

  it('paginates in deterministic GitHub-update order without leaking unlisted or closed issues', async () => {
    const listed = await seedRepository('992100003', 'paged', true);
    const unlisted = await seedRepository('992100004', 'hidden', false);

    const newer = await seedIssue(listed.id, '992000011', 11, {
      updatedAtGithub: new Date('2026-09-25T12:00:00.000Z'),
    });
    const older = await seedIssue(listed.id, '992000012', 12, {
      updatedAtGithub: new Date('2026-09-24T12:00:00.000Z'),
    });
    await seedIssue(listed.id, '992000013', 13, {
      state: 'closed',
      updatedAtGithub: new Date('2026-09-26T12:00:00.000Z'),
    });
    await seedIssue(unlisted.id, '992000014', 14, {
      updatedAtGithub: new Date('2026-09-26T13:00:00.000Z'),
    });

    const evaluatedAt = new Date('2026-09-26T14:00:00.000Z');
    const first = await discoveryStore.discoverPage({
      filters: filters(),
      limit: 1,
      position: null,
      evaluatedAt,
    });

    expect(first.hasMore).toBe(true);
    expect(first.items.map((item) => item.issue.id)).toEqual([newer.id]);

    const second = await discoveryStore.discoverPage({
      filters: filters(),
      limit: 1,
      position: {
        issueId: first.items[0]!.issue.id,
        updatedAtGithub: first.items[0]!.issue.updatedAtGithub,
      },
      evaluatedAt,
    });

    expect(second.hasMore).toBe(false);
    expect(second.items.map((item) => item.issue.id)).toEqual([older.id]);
  });

  it('distinguishes observed CONTRIBUTING absence from missing process evidence', async () => {
    const observed = await seedRepository('992100005', 'observed', true);
    const missing = await seedRepository('992100006', 'missing', true);

    await evidenceStore.upsert({
      repositoryId: observed.id,
      status: 'OBSERVED',
      contributing: null,
      codeOfConduct: null,
      issueTemplate: null,
      pullRequestTemplate: null,
      securityPolicy: null,
      communityProfileUpdatedAt: null,
      observedAt: new Date('2026-09-26T08:00:00.000Z'),
    });

    await seedIssue(observed.id, '992000021', 21);
    await seedIssue(missing.id, '992000022', 22);

    const evaluatedAt = new Date('2026-09-26T12:00:00.000Z');

    const absent = await discoveryStore.discoverPage({
      filters: filters({ contributing: 'absent' }),
      limit: 20,
      position: null,
      evaluatedAt,
    });
    const missingEvidence = await discoveryStore.discoverPage({
      filters: filters({ contributing: 'missing' }),
      limit: 20,
      position: null,
      evaluatedAt,
    });

    expect(absent.items.map((item) => item.repository.id)).toEqual([
      observed.id,
    ]);
    expect(
      absent.items[0]!.signalSnapshot.signals[
        'process.contributing_present'
      ],
    ).toEqual({
      id: 'process.contributing_present',
      availability: 'available',
      value: false,
    });

    expect(
      missingEvidence.items.map((item) => item.repository.id),
    ).toEqual([missing.id]);
    expect(
      missingEvidence.items[0]!.signalSnapshot.signals[
        'process.contributing_present'
      ],
    ).toEqual({
      id: 'process.contributing_present',
      availability: 'missing',
      reason: 'not_collected',
    });
  });
});
