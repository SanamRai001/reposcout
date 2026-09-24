import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { GithubClient } from '../github/github-client.js';
import { RepositoryStore } from '../repositories/repository-store.js';
import type { UpsertRepositoryInput } from '../repositories/repository.js';
import { RepositorySubmissionService } from './repository-submission-service.js';
import { RepositorySubmissionStore } from './repository-submission-store.js';
import { RepositorySubmissionValidationService } from './repository-submission-validation-service.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for repository submission validation tests.',
  );
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
const intakeService = new RepositorySubmissionService(
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

function githubPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 987654321,
    name: 'Project',
    full_name: 'CanonicalOrg/Project',
    html_url: 'https://github.com/CanonicalOrg/Project',
    default_branch: 'main',
    description: 'Resolved public repository.',
    archived: false,
    fork: false,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2026-09-23T00:00:00Z',
    pushed_at: '2026-09-23T01:00:00Z',
    stargazers_count: 25,
    forks_count: 3,
    open_issues_count: 2,
    language: 'TypeScript',
    license: {
      spdx_id: 'MIT',
    },
    topics: ['backend'],
    owner: {
      login: 'CanonicalOrg',
    },
    ...overrides,
  };
}

function indexedRepositoryInput(
  overrides: Partial<UpsertRepositoryInput> = {},
): UpsertRepositoryInput {
  return {
    githubRepositoryId: '987654321',
    owner: 'CanonicalOrg',
    name: 'Project',
    fullName: 'CanonicalOrg/Project',
    githubUrl: 'https://github.com/CanonicalOrg/Project',
    defaultBranch: 'main',
    description: 'Already indexed canonical repository.',
    isArchived: false,
    isFork: false,
    createdAtGithub: new Date('2025-01-01T00:00:00Z'),
    updatedAtGithub: new Date('2026-09-23T00:00:00Z'),
    pushedAtGithub: new Date('2026-09-23T01:00:00Z'),
    lastSyncedAt: new Date('2026-09-23T02:00:00Z'),
    ...overrides,
  };
}

function validationService(
  fetchImplementation: typeof fetch,
  now: Date,
): RepositorySubmissionValidationService {
  return new RepositorySubmissionValidationService(
    new GithubClient({ fetchImplementation }),
    repositoryStore,
    submissionStore,
    () => now,
  );
}

describe('repository submission validation with PostgreSQL', () => {
  it('records canonical GitHub identity for a reachable unique repository', async () => {
    const submission = await intakeService.submit(
      'https://github.com/example/project',
    );
    const validatedAt = new Date('2026-09-24T01:00:00Z');
    const service = validationService(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(githubPayload()), { status: 200 }),
      ),
      validatedAt,
    );

    const result = await service.validate(submission.id);
    const persisted = await submissionStore.findById(submission.id);

    expect(result).toEqual(
      expect.objectContaining({
        id: submission.id,
        status: 'PENDING',
        validationOutcome: 'VALID',
        resolvedRepository: {
          githubRepositoryId: '987654321',
          owner: 'CanonicalOrg',
          name: 'Project',
          fullName: 'CanonicalOrg/Project',
          githubUrl: 'https://github.com/CanonicalOrg/Project',
        },
        duplicateRepositoryId: null,
        validatedAt,
      }),
    );
    expect(persisted).toEqual(result);
  });

  it('detects an indexed repository by canonical GitHub id even when submitted name differs', async () => {
    const indexed = await repositoryStore.upsert(
      indexedRepositoryInput(),
    );
    const submission = await intakeService.submit(
      'https://github.com/legacy-org/old-project-name',
    );
    const validatedAt = new Date('2026-09-24T02:00:00Z');
    const service = validationService(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(githubPayload()), { status: 200 }),
      ),
      validatedAt,
    );

    const result = await service.validate(submission.id);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'DUPLICATE',
        validationOutcome: 'DUPLICATE',
        duplicateRepositoryId: indexed.id,
        resolvedRepository: expect.objectContaining({
          githubRepositoryId: '987654321',
          fullName: 'CanonicalOrg/Project',
        }),
        validatedAt,
      }),
    );
  });

  it('records GitHub 404 as INVALID without resolved identity', async () => {
    const submission = await intakeService.submit(
      'https://github.com/example/missing-project',
    );
    const validatedAt = new Date('2026-09-24T03:00:00Z');
    const service = validationService(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status: 404 })),
      validatedAt,
    );

    const result = await service.validate(submission.id);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'INVALID',
        validationOutcome: 'INVALID',
        resolvedRepository: null,
        duplicateRepositoryId: null,
        validatedAt,
      }),
    );
  });

  it('leaves a submission pending and unvalidated on rate limiting', async () => {
    const submission = await intakeService.submit(
      'https://github.com/example/rate-limited',
    );
    const service = validationService(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', {
          status: 429,
          headers: {
            'x-ratelimit-reset': '1790298000',
          },
        }),
      ),
      new Date('2026-09-24T04:00:00Z'),
    );

    await expect(service.validate(submission.id)).rejects.toMatchObject({
      kind: 'rate_limited',
    });

    const persisted = await submissionStore.findById(submission.id);
    expect(persisted).toEqual(
      expect.objectContaining({
        status: 'PENDING',
        validationOutcome: null,
        resolvedRepository: null,
        duplicateRepositoryId: null,
        validatedAt: null,
      }),
    );
  });

  it('is idempotent after a deterministic validation outcome is recorded', async () => {
    const submission = await intakeService.submit(
      'https://github.com/example/idempotent',
    );
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(githubPayload()), { status: 200 }),
    );
    const service = validationService(
      fetchImplementation,
      new Date('2026-09-24T05:00:00Z'),
    );

    const first = await service.validate(submission.id);
    const second = await service.validate(submission.id);

    expect(second).toEqual(first);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});
