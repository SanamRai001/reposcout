import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { GithubClient } from '../github/github-client.js';
import { RepositoryContributionEvidenceService } from '../github/repository-contribution-evidence-service.js';
import { RepositoryIngestionService } from '../github/repository-ingestion-service.js';
import { RepositoryReadmeService } from '../github/repository-readme-service.js';
import { RepositoryContributionEvidenceStore } from '../repositories/repository-contribution-evidence-store.js';
import { RepositoryReadmeStore } from '../repositories/repository-readme-store.js';
import { RepositoryStore } from '../repositories/repository-store.js';
import { RepositorySubmissionEvidenceHandoffService } from './repository-submission-evidence-handoff-service.js';
import { RepositorySubmissionStore } from './repository-submission-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for submission evidence handoff tests.',
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
const readmeStore = new RepositoryReadmeStore(pool);
const contributionStore = new RepositoryContributionEvidenceStore(pool);

beforeEach(async () => {
  await pool.query('DELETE FROM repository_submissions');
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

function repositoryPayload(): Record<string, unknown> {
  return {
    id: 987654321,
    name: 'Project',
    full_name: 'CanonicalOrg/Project',
    html_url: 'https://github.com/CanonicalOrg/Project',
    default_branch: 'main',
    description: 'Evidence handoff repository.',
    archived: false,
    fork: false,
    private: false,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
    pushed_at: '2026-09-24T01:00:00Z',
    stargazers_count: 42,
    forks_count: 5,
    open_issues_count: 3,
    language: 'TypeScript',
    license: {
      spdx_id: 'MIT',
    },
    topics: ['backend', 'typescript'],
    owner: {
      login: 'CanonicalOrg',
    },
  };
}

async function createValidSubmission(): Promise<string> {
  const result = await submissionStore.createPending({
    submittedUrl: 'https://github.com/example/project',
    normalizedOwner: 'example',
    normalizedName: 'project',
    normalizedFullName: 'example/project',
  });

  if (result.kind !== 'created') {
    throw new Error('Expected a fresh submission fixture.');
  }

  await submissionStore.recordValidation({
    kind: 'valid',
    submissionId: result.submission.id,
    repository: {
      githubRepositoryId: '987654321',
      owner: 'CanonicalOrg',
      name: 'Project',
      fullName: 'CanonicalOrg/Project',
      githubUrl: 'https://github.com/CanonicalOrg/Project',
    },
    validatedAt: new Date('2026-09-24T03:00:00Z'),
  });

  return result.submission.id;
}

function githubFetch(options: {
  readmeStatus?: number;
} = {}): typeof fetch {
  const readmeStatus = options.readmeStatus ?? 404;

  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);

    if (url === 'https://api.github.com/repos/CanonicalOrg/Project') {
      return new Response(JSON.stringify(repositoryPayload()), {
        status: 200,
      });
    }

    if (
      url ===
      'https://api.github.com/repos/CanonicalOrg/Project/readme?ref=main'
    ) {
      return new Response('{}', {
        status: readmeStatus,
      });
    }

    if (
      url ===
      'https://api.github.com/repos/CanonicalOrg/Project/community/profile'
    ) {
      return new Response(
        JSON.stringify({
          files: {
            contributing: null,
            code_of_conduct_file: null,
            issue_template: null,
            pull_request_template: null,
          },
          updated_at: '2026-09-24T02:00:00Z',
        }),
        { status: 200 },
      );
    }

    if (
      url.startsWith(
        'https://api.github.com/repos/CanonicalOrg/Project/contents/',
      )
    ) {
      return new Response('{}', { status: 404 });
    }

    throw new Error(`Unexpected GitHub test URL: ${url}`);
  });
}

function handoffService(
  fetchImplementation: typeof fetch,
  completedAt: Date,
): RepositorySubmissionEvidenceHandoffService {
  const githubClient = new GithubClient({ fetchImplementation });

  return new RepositorySubmissionEvidenceHandoffService(
    submissionStore,
    new RepositoryIngestionService(
      githubClient,
      repositoryStore,
      () => new Date('2026-09-24T04:00:00Z'),
    ),
    new RepositoryReadmeService(
      githubClient,
      readmeStore,
      () => new Date('2026-09-24T04:01:00Z'),
    ),
    new RepositoryContributionEvidenceService(
      githubClient,
      contributionStore,
      () => new Date('2026-09-24T04:02:00Z'),
    ),
    () => completedAt,
  );
}

describe('repository submission evidence handoff with PostgreSQL', () => {
  it('ingests canonical facts and both evidence families before marking handoff complete', async () => {
    const submissionId = await createValidSubmission();
    const completedAt = new Date('2026-09-24T04:03:00Z');
    const service = handoffService(githubFetch(), completedAt);

    const result = await service.handoff(submissionId);
    const submission = await submissionStore.findById(submissionId);

    expect(result.kind).toBe('completed');

    if (result.kind !== 'completed') {
      throw new Error('Expected completed evidence handoff.');
    }

    expect(submission).toEqual(
      expect.objectContaining({
        id: submissionId,
        status: 'PENDING',
        validationOutcome: 'VALID',
        handoffRepositoryId: result.repositoryId,
        evidenceHandoffCompletedAt: completedAt,
      }),
    );

    const repository =
      await repositoryStore.findByGithubRepositoryId('987654321');

    expect(repository).not.toBeNull();
    expect(repository?.id).toBe(result.repositoryId);

    const catalog = await repositoryStore.findById(result.repositoryId);
    expect(catalog?.metadata).toEqual(
      expect.objectContaining({
        stars: 42,
        forks: 5,
        openIssues: 3,
        primaryLanguage: 'TypeScript',
        licenseSpdx: 'MIT',
        topics: ['backend', 'typescript'],
      }),
    );

    const readme = await readmeStore.findByRepositoryId(result.repositoryId);
    expect(readme).toEqual(
      expect.objectContaining({
        status: 'NOT_FOUND',
        sourceRef: 'main',
      }),
    );

    const contribution =
      await contributionStore.findByRepositoryId(result.repositoryId);
    expect(contribution).toEqual(
      expect.objectContaining({
        status: 'OBSERVED',
        communityProfileUpdatedAt: new Date(
          '2026-09-24T02:00:00Z',
        ),
      }),
    );

    await expect(
      submissionStore.listPendingEvidenceHandoffCandidates(10),
    ).resolves.toEqual([]);
  });

  it('keeps partial handoff retryable when README refresh fails but contribution evidence succeeds', async () => {
    const submissionId = await createValidSubmission();
    const service = handoffService(
      githubFetch({ readmeStatus: 502 }),
      new Date('2026-09-24T04:03:00Z'),
    );

    const result = await service.handoff(submissionId);
    const submission = await submissionStore.findById(submissionId);

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'incomplete',
        repositoryId: expect.any(String),
        rateLimited: false,
      }),
    );
    expect(result.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'readme',
          kind: 'retryable',
          errorKind: 'request_failed',
        }),
        {
          stage: 'contribution',
          kind: 'completed',
        },
      ]),
    );

    expect(submission).toEqual(
      expect.objectContaining({
        status: 'PENDING',
        validationOutcome: 'VALID',
        handoffRepositoryId: null,
        evidenceHandoffCompletedAt: null,
      }),
    );

    const repository =
      await repositoryStore.findByGithubRepositoryId('987654321');
    expect(repository).not.toBeNull();

    await expect(
      readmeStore.findByRepositoryId(repository!.id),
    ).resolves.toBeNull();

    await expect(
      contributionStore.findByRepositoryId(repository!.id),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'OBSERVED',
      }),
    );

    const candidates =
      await submissionStore.listPendingEvidenceHandoffCandidates(10);
    expect(candidates.map((item) => item.id)).toEqual([submissionId]);
  });
});
