import { describe, expect, it, vi } from 'vitest';

import { GithubApiError } from '../github/github-client.js';
import type { RepositoryRecord } from '../repositories/repository.js';
import type { RepositorySubmissionRecord } from './repository-submission.js';
import {
  RepositorySubmissionEvidenceHandoffService,
  RepositorySubmissionNotEligibleForEvidenceHandoffError,
} from './repository-submission-evidence-handoff-service.js';

const repository: RepositoryRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  githubRepositoryId: '987654321',
  owner: 'CanonicalOrg',
  name: 'Project',
  fullName: 'CanonicalOrg/Project',
  githubUrl: 'https://github.com/CanonicalOrg/Project',
  defaultBranch: 'main',
  description: 'Repository fixture',
  isArchived: false,
  isFork: false,
  discoveryStatus: 'PENDING_MODERATION',
  createdAtGithub: new Date('2025-01-01T00:00:00Z'),
  updatedAtGithub: new Date('2026-09-24T00:00:00Z'),
  pushedAtGithub: new Date('2026-09-24T01:00:00Z'),
  lastSyncedAt: new Date('2026-09-24T02:00:00Z'),
  createdAt: new Date('2026-09-24T02:00:01Z'),
  updatedAt: new Date('2026-09-24T02:00:01Z'),
};

const submission: RepositorySubmissionRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  submittedUrl: 'https://github.com/example/project',
  normalizedOwner: 'example',
  normalizedName: 'project',
  normalizedFullName: 'example/project',
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
  validatedAt: new Date('2026-09-24T03:00:00Z'),
  handoffRepositoryId: null,
  evidenceHandoffCompletedAt: null,
  createdAt: new Date('2026-09-24T02:30:00Z'),
  updatedAt: new Date('2026-09-24T03:00:00Z'),
};

function completedSubmission(
  completedAt: Date,
): RepositorySubmissionRecord {
  return {
    ...submission,
    handoffRepositoryId: repository.id,
    evidenceHandoffCompletedAt: completedAt,
    updatedAt: completedAt,
  };
}

describe('RepositorySubmissionEvidenceHandoffService', () => {
  it('completes ingestion, README, and contribution evidence before recording handoff', async () => {
    const completedAt = new Date('2026-09-24T04:00:00Z');
    const findById = vi.fn().mockResolvedValue(submission);
    const recordEvidenceHandoffComplete = vi
      .fn()
      .mockResolvedValue(completedSubmission(completedAt));
    const ingest = vi.fn().mockResolvedValue(repository);
    const refreshReadme = vi.fn().mockResolvedValue({ status: 'PRESENT' });
    const refreshContribution = vi
      .fn()
      .mockResolvedValue({ status: 'OBSERVED' });

    const service = new RepositorySubmissionEvidenceHandoffService(
      { findById, recordEvidenceHandoffComplete },
      { ingest },
      { refresh: refreshReadme },
      { refresh: refreshContribution },
      () => completedAt,
    );

    const result = await service.handoff(submission.id);

    expect(ingest).toHaveBeenCalledWith(
      'https://github.com/CanonicalOrg/Project',
      {
        expectedGithubRepositoryId: '987654321',
        initialDiscoveryStatus: 'PENDING_MODERATION',
      },
    );
    expect(refreshReadme).toHaveBeenCalledWith(repository);
    expect(refreshContribution).toHaveBeenCalledWith(repository);
    expect(recordEvidenceHandoffComplete).toHaveBeenCalledWith({
      submissionId: submission.id,
      repositoryId: repository.id,
      completedAt,
    });
    expect(result).toEqual({
      kind: 'completed',
      submissionId: submission.id,
      repositoryId: repository.id,
      alreadyCompleted: false,
      rateLimited: false,
      stages: [
        { stage: 'ingestion', kind: 'completed' },
        { stage: 'readme', kind: 'completed' },
        { stage: 'contribution', kind: 'completed' },
      ],
    });
  });

  it('isolates a retryable README failure and still attempts contribution evidence', async () => {
    const recordEvidenceHandoffComplete = vi.fn();
    const refreshContribution = vi.fn().mockResolvedValue({
      status: 'OBSERVED',
    });
    const service = new RepositorySubmissionEvidenceHandoffService(
      {
        findById: vi.fn().mockResolvedValue(submission),
        recordEvidenceHandoffComplete,
      },
      { ingest: vi.fn().mockResolvedValue(repository) },
      {
        refresh: vi.fn().mockRejectedValue(
          new GithubApiError(
            'request_failed',
            'README request failed.',
            502,
          ),
        ),
      },
      { refresh: refreshContribution },
    );

    const result = await service.handoff(submission.id);

    expect(refreshContribution).toHaveBeenCalledWith(repository);
    expect(recordEvidenceHandoffComplete).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: 'incomplete',
      submissionId: submission.id,
      repositoryId: repository.id,
      alreadyCompleted: false,
      rateLimited: false,
      stages: [
        { stage: 'ingestion', kind: 'completed' },
        {
          stage: 'readme',
          kind: 'retryable',
          errorKind: 'request_failed',
          message: 'README request failed.',
          retryAt: null,
        },
        { stage: 'contribution', kind: 'completed' },
      ],
    });
  });

  it('stops remaining provider work after README rate limiting', async () => {
    const retryAt = new Date('2026-09-24T05:00:00Z');
    const refreshContribution = vi.fn();
    const service = new RepositorySubmissionEvidenceHandoffService(
      {
        findById: vi.fn().mockResolvedValue(submission),
        recordEvidenceHandoffComplete: vi.fn(),
      },
      { ingest: vi.fn().mockResolvedValue(repository) },
      {
        refresh: vi.fn().mockRejectedValue(
          new GithubApiError(
            'rate_limited',
            'GitHub rate limited.',
            429,
            retryAt,
          ),
        ),
      },
      { refresh: refreshContribution },
    );

    const result = await service.handoff(submission.id);

    expect(refreshContribution).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: 'incomplete',
      submissionId: submission.id,
      repositoryId: repository.id,
      alreadyCompleted: false,
      rateLimited: true,
      stages: [
        { stage: 'ingestion', kind: 'completed' },
        {
          stage: 'readme',
          kind: 'retryable',
          errorKind: 'rate_limited',
          message: 'GitHub rate limited.',
          retryAt: '2026-09-24T05:00:00.000Z',
        },
        {
          stage: 'contribution',
          kind: 'skipped',
          reason: 'rate_limited',
        },
      ],
    });
  });

  it('returns completed state without repeating external work', async () => {
    const completed = completedSubmission(
      new Date('2026-09-24T04:00:00Z'),
    );
    const ingest = vi.fn();
    const readme = vi.fn();
    const contribution = vi.fn();
    const service = new RepositorySubmissionEvidenceHandoffService(
      {
        findById: vi.fn().mockResolvedValue(completed),
        recordEvidenceHandoffComplete: vi.fn(),
      },
      { ingest },
      { refresh: readme },
      { refresh: contribution },
    );

    await expect(service.handoff(submission.id)).resolves.toEqual({
      kind: 'completed',
      submissionId: submission.id,
      repositoryId: repository.id,
      alreadyCompleted: true,
      rateLimited: false,
      stages: [],
    });

    expect(ingest).not.toHaveBeenCalled();
    expect(readme).not.toHaveBeenCalled();
    expect(contribution).not.toHaveBeenCalled();
  });

  it('rejects submissions that are not VALID and pending', async () => {
    const service = new RepositorySubmissionEvidenceHandoffService(
      {
        findById: vi.fn().mockResolvedValue({
          ...submission,
          validationOutcome: null,
          resolvedRepository: null,
          validatedAt: null,
        }),
        recordEvidenceHandoffComplete: vi.fn(),
      },
      { ingest: vi.fn() },
      { refresh: vi.fn() },
      { refresh: vi.fn() },
    );

    await expect(service.handoff(submission.id)).rejects.toBeInstanceOf(
      RepositorySubmissionNotEligibleForEvidenceHandoffError,
    );
  });
});
