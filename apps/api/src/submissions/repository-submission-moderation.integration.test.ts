import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import {
  EMPTY_REPOSITORY_SEARCH_FILTERS,
} from '../repositories/repository-catalog.js';
import type { UpsertRepositoryMetadataInput } from '../repositories/repository-metadata.js';
import type { UpsertRepositoryInput } from '../repositories/repository.js';
import { RepositoryStore } from '../repositories/repository-store.js';
import {
  RepositorySubmissionAlreadyModeratedError,
  RepositorySubmissionModerationService,
  RepositorySubmissionNotEligibleForModerationError,
} from './repository-submission-moderation-service.js';
import { RepositorySubmissionService } from './repository-submission-service.js';
import { RepositorySubmissionStore } from './repository-submission-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for repository submission moderation tests.',
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
  await pool.query('DELETE FROM repository_submission_moderation_events');
  await pool.query('DELETE FROM repository_submissions');
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

function repositoryInput(
  githubRepositoryId: string,
  name: string,
): UpsertRepositoryInput {
  return {
    githubRepositoryId,
    owner: 'community-org',
    name,
    fullName: `community-org/${name}`,
    githubUrl: `https://github.com/community-org/${name}`,
    defaultBranch: 'main',
    description: `Moderation fixture ${name}`,
    isArchived: false,
    isFork: false,
    createdAtGithub: new Date('2026-01-01T00:00:00Z'),
    updatedAtGithub: new Date('2026-09-24T00:00:00Z'),
    pushedAtGithub: new Date('2026-09-24T01:00:00Z'),
    lastSyncedAt: new Date('2026-09-24T02:00:00Z'),
  };
}

function metadataInput(): UpsertRepositoryMetadataInput {
  return {
    stars: 25,
    forks: 3,
    openIssues: 2,
    primaryLanguage: 'TypeScript',
    licenseSpdx: 'MIT',
    topics: ['backend', 'typescript'],
    observedAt: new Date('2026-09-24T02:00:00Z'),
  };
}

async function prepareModerationCandidate(
  githubRepositoryId: string,
  name: string,
) {
  const repository = await repositoryStore.upsertWithMetadata(
    repositoryInput(githubRepositoryId, name),
    metadataInput(),
    { initialListing: 'unlisted' },
  );

  const created = await submissionStore.createPending({
    submittedUrl: `https://github.com/community-org/${name}`,
    normalizedOwner: 'community-org',
    normalizedName: name,
    normalizedFullName: `community-org/${name}`,
  });

  if (created.kind !== 'created') {
    throw new Error('Expected a new moderation fixture submission.');
  }

  const validated = await submissionStore.recordValidation({
    kind: 'valid',
    submissionId: created.submission.id,
    repository: {
      githubRepositoryId,
      owner: 'community-org',
      name,
      fullName: `community-org/${name}`,
      githubUrl: `https://github.com/community-org/${name}`,
    },
    validatedAt: new Date('2026-09-24T03:00:00Z'),
  });

  const handedOff = await submissionStore.recordEvidenceHandoffComplete({
    submissionId: validated.id,
    repositoryId: repository.id,
    completedAt: new Date('2026-09-24T04:00:00Z'),
  });

  return { repository, submission: handedOff };
}

describe('repository submission moderation with PostgreSQL', () => {
  it('keeps prepared evidence hidden until approval publishes it atomically', async () => {
    const { repository, submission } = await prepareModerationCandidate(
      '900000001',
      'approve-project',
    );

    expect(
      await repositoryStore.findByGithubRepositoryId('900000001'),
    ).toEqual(expect.objectContaining({ id: repository.id }));
    expect(
      await repositoryStore.findListedByGithubRepositoryId('900000001'),
    ).toBeNull();
    expect(await repositoryStore.findById(repository.id)).toBeNull();
    expect(
      await repositoryStore.existsByNormalizedFullName(
        'community-org/approve-project',
      ),
    ).toBe(false);

    const catalogBefore = await repositoryStore.listPage({
      limit: 20,
      cursor: null,
    });
    expect(catalogBefore.items).toEqual([]);

    const searchBefore = await repositoryStore.searchPage({
      query: 'approve project',
      filters: EMPTY_REPOSITORY_SEARCH_FILTERS,
      limit: 20,
      cursor: null,
    });
    expect(searchBefore.items).toEqual([]);

    await repositoryStore.upsert(
      {
        ...repositoryInput('900000001', 'approve-project'),
        description: 'A later normal refresh must preserve listing state.',
        lastSyncedAt: new Date('2026-09-24T05:00:00Z'),
      },
    );

    expect(await repositoryStore.findById(repository.id)).toBeNull();

    const candidates =
      await submissionStore.listPendingModerationCandidates(10);
    expect(candidates.map((item) => item.id)).toEqual([submission.id]);

    const decidedAt = new Date('2026-09-24T06:00:00Z');
    const moderation = new RepositorySubmissionModerationService(
      submissionStore,
      () => decidedAt,
    );

    const result = await moderation.moderate({
      submissionId: submission.id,
      decision: 'APPROVED',
      reviewerRef: 'maintainer:SanamRai001',
      reason: 'Public, useful project with sufficient evidence.',
    });

    expect(result).toEqual(
      expect.objectContaining({
        submissionId: submission.id,
        repositoryId: repository.id,
        status: 'APPROVED',
        event: expect.objectContaining({
          submissionId: submission.id,
          decision: 'APPROVED',
          reviewerRef: 'maintainer:SanamRai001',
          reason: 'Public, useful project with sufficient evidence.',
          createdAt: decidedAt,
        }),
      }),
    );

    expect(
      await repositoryStore.findListedByGithubRepositoryId('900000001'),
    ).toEqual(expect.objectContaining({ id: repository.id }));
    expect(await repositoryStore.findById(repository.id)).toEqual(
      expect.objectContaining({ id: repository.id }),
    );

    const catalogAfter = await repositoryStore.listPage({
      limit: 20,
      cursor: null,
    });
    expect(catalogAfter.items.map((item) => item.id)).toEqual([
      repository.id,
    ]);

    const events = await submissionStore.listModerationEvents(
      submission.id,
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(result.event);

    await expect(
      moderation.moderate({
        submissionId: submission.id,
        decision: 'REJECTED',
        reviewerRef: 'maintainer:other',
        reason: 'Attempted conflicting second decision.',
      }),
    ).rejects.toMatchObject({
      decision: 'APPROVED',
    } satisfies Partial<RepositorySubmissionAlreadyModeratedError>);

    expect(
      await submissionStore.listModerationEvents(submission.id),
    ).toHaveLength(1);
  });

  it('keeps rejected repositories hidden and allows a later resubmission', async () => {
    const { repository, submission } = await prepareModerationCandidate(
      '900000002',
      'reject-project',
    );
    const moderation = new RepositorySubmissionModerationService(
      submissionStore,
      () => new Date('2026-09-24T07:00:00Z'),
    );

    await moderation.moderate({
      submissionId: submission.id,
      decision: 'REJECTED',
      reviewerRef: 'maintainer:SanamRai001',
      reason: 'Placeholder repository without enough useful project content.',
    });

    expect(await repositoryStore.findById(repository.id)).toBeNull();
    expect(
      await repositoryStore.findListedByGithubRepositoryId('900000002'),
    ).toBeNull();
    expect(
      await repositoryStore.findByGithubRepositoryId('900000002'),
    ).not.toBeNull();

    const newSubmission = await intakeService.submit(
      'https://github.com/community-org/reject-project',
    );

    expect(newSubmission.status).toBe('PENDING');
    expect(newSubmission.id).not.toBe(submission.id);
  });

  it('rejects moderation before deterministic evidence handoff completes', async () => {
    const created = await submissionStore.createPending({
      submittedUrl: 'https://github.com/community-org/not-ready',
      normalizedOwner: 'community-org',
      normalizedName: 'not-ready',
      normalizedFullName: 'community-org/not-ready',
    });

    if (created.kind !== 'created') {
      throw new Error('Expected a new submission.');
    }

    const moderation = new RepositorySubmissionModerationService(
      submissionStore,
    );

    await expect(
      moderation.moderate({
        submissionId: created.submission.id,
        decision: 'APPROVED',
        reviewerRef: 'maintainer:SanamRai001',
        reason: 'Too early.',
      }),
    ).rejects.toBeInstanceOf(
      RepositorySubmissionNotEligibleForModerationError,
    );
  });
});
