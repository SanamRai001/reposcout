import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { GithubClient } from './github-client.js';
import { RepositoryContributionEvidenceService } from './repository-contribution-evidence-service.js';
import { RepositoryContributionEvidenceStore } from '../repositories/repository-contribution-evidence-store.js';
import type { UpsertRepositoryInput } from '../repositories/repository.js';
import { RepositoryStore } from '../repositories/repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for contribution evidence tests.');
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
const evidenceStore = new RepositoryContributionEvidenceStore(pool);

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
    githubRepositoryId: '6655443322',
    owner: 'example',
    name: 'community-project',
    fullName: 'example/community-project',
    githubUrl: 'https://github.com/example/community-project',
    defaultBranch: 'main',
    description: 'Contribution evidence fixture.',
    isArchived: false,
    isFork: false,
    discoveryStatus: 'DISCOVERABLE',
    createdAtGithub: new Date('2026-01-01T00:00:00Z'),
    updatedAtGithub: new Date('2026-09-20T00:00:00Z'),
    pushedAtGithub: new Date('2026-09-20T01:00:00Z'),
    lastSyncedAt: new Date('2026-09-21T00:00:00Z'),
    ...overrides,
  };
}

describe('repository contribution evidence', () => {
  it('persists GitHub community-profile evidence and local security provenance', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: {
              contributing: {
                url: 'https://api.github.com/repos/example/community-project/contents/CONTRIBUTING.md',
                html_url: 'https://github.com/example/community-project/blob/main/CONTRIBUTING.md',
              },
              code_of_conduct_file: {
                url: 'https://api.github.com/repos/example/community-project/contents/CODE_OF_CONDUCT.md',
                html_url: 'https://github.com/example/community-project/blob/main/CODE_OF_CONDUCT.md',
              },
              issue_template: {
                url: 'https://api.github.com/repos/example/community-project/contents/.github/ISSUE_TEMPLATE',
                html_url: 'https://github.com/example/community-project/tree/main/.github/ISSUE_TEMPLATE',
              },
              pull_request_template: null,
            },
            updated_at: '2026-09-20T12:00:00Z',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: 'file',
            path: 'SECURITY.md',
            sha: 'security-local-sha',
            size: 512,
          }),
          { status: 200 },
        ),
      );

    const service = new RepositoryContributionEvidenceService(
      new GithubClient({ fetchImplementation }),
      evidenceStore,
      () => new Date('2026-09-22T15:00:00Z'),
    );

    const result = await service.refresh(repository);
    const persisted = await evidenceStore.findByRepositoryId(repository.id);

    expect(result).toEqual(
      expect.objectContaining({
        repositoryId: repository.id,
        status: 'OBSERVED',
        contributing: {
          apiUrl:
            'https://api.github.com/repos/example/community-project/contents/CONTRIBUTING.md',
          htmlUrl:
            'https://github.com/example/community-project/blob/main/CONTRIBUTING.md',
        },
        codeOfConduct: {
          apiUrl:
            'https://api.github.com/repos/example/community-project/contents/CODE_OF_CONDUCT.md',
          htmlUrl:
            'https://github.com/example/community-project/blob/main/CODE_OF_CONDUCT.md',
        },
        issueTemplate: {
          apiUrl:
            'https://api.github.com/repos/example/community-project/contents/.github/ISSUE_TEMPLATE',
          htmlUrl:
            'https://github.com/example/community-project/tree/main/.github/ISSUE_TEMPLATE',
        },
        pullRequestTemplate: null,
        securityPolicy: {
          sourceRef: 'main',
          path: 'SECURITY.md',
          sha: 'security-local-sha',
          sizeBytes: 512,
        },
        communityProfileUpdatedAt: new Date('2026-09-20T12:00:00Z'),
        observedAt: new Date('2026-09-22T15:00:00Z'),
      }),
    );
    expect(persisted).toEqual(result);
  });

  it('preserves newer contribution evidence when a stale observation arrives', async () => {
    const repository = await repositoryStore.upsert(repositoryInput());

    await evidenceStore.upsert({
      repositoryId: repository.id,
      status: 'OBSERVED',
      contributing: {
        apiUrl:
          'https://api.github.com/repos/example/community-project/contents/CONTRIBUTING.md',
        htmlUrl:
          'https://github.com/example/community-project/blob/main/CONTRIBUTING.md',
      },
      codeOfConduct: null,
      issueTemplate: null,
      pullRequestTemplate: null,
      securityPolicy: null,
      communityProfileUpdatedAt: new Date('2026-09-22T11:00:00Z'),
      observedAt: new Date('2026-09-22T16:00:00Z'),
    });

    const stale = await evidenceStore.upsert({
      repositoryId: repository.id,
      status: 'OBSERVED',
      contributing: null,
      codeOfConduct: null,
      issueTemplate: null,
      pullRequestTemplate: null,
      securityPolicy: null,
      communityProfileUpdatedAt: new Date('2026-09-21T11:00:00Z'),
      observedAt: new Date('2026-09-22T15:30:00Z'),
    });

    expect(stale.contributing).not.toBeNull();
    expect(stale.observedAt.toISOString()).toBe(
      '2026-09-22T16:00:00.000Z',
    );
  });

  it('stores fork status without inventing unsupported community evidence', async () => {
    const repository = await repositoryStore.upsert(
      repositoryInput({
        githubRepositoryId: '6655443323',
        isFork: true,
      }),
    );
    const fetchImplementation = vi.fn<typeof fetch>();
    const service = new RepositoryContributionEvidenceService(
      new GithubClient({ fetchImplementation }),
      evidenceStore,
      () => new Date('2026-09-22T17:00:00Z'),
    );

    const result = await service.refresh(repository);

    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        status: 'UNSUPPORTED_FORK',
        contributing: null,
        codeOfConduct: null,
        issueTemplate: null,
        pullRequestTemplate: null,
        securityPolicy: null,
        communityProfileUpdatedAt: null,
      }),
    );
  });
});
