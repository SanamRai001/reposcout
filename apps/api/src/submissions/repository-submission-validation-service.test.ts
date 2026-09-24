import { describe, expect, it, vi } from 'vitest';

import {
  GithubApiError,
  type GithubRepositorySnapshot,
} from '../github/github-client.js';
import type { RepositoryRecord } from '../repositories/repository.js';
import {
  RepositorySubmissionNotEligibleForValidationError,
  RepositorySubmissionNotFoundError,
  RepositorySubmissionValidationService,
} from './repository-submission-validation-service.js';
import type { RepositorySubmissionRecord } from './repository-submission.js';

const pendingSubmission: RepositorySubmissionRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  submittedUrl: 'https://github.com/example/project',
  normalizedOwner: 'example',
  normalizedName: 'project',
  normalizedFullName: 'example/project',
  status: 'PENDING',
  validationOutcome: null,
  resolvedRepository: null,
  duplicateRepositoryId: null,
  validatedAt: null,
  handoffRepositoryId: null,
  evidenceHandoffCompletedAt: null,
  createdAt: new Date('2026-09-23T12:00:00Z'),
  updatedAt: new Date('2026-09-23T12:00:00Z'),
};

const snapshot: GithubRepositorySnapshot = {
  githubRepositoryId: '987654321',
  owner: 'ExampleOrg',
  name: 'Project',
  fullName: 'ExampleOrg/Project',
  githubUrl: 'https://github.com/ExampleOrg/Project',
  defaultBranch: 'main',
  description: 'Resolved repository.',
  isArchived: false,
  isFork: false,
  isPrivate: false,
  createdAtGithub: new Date('2025-01-01T00:00:00Z'),
  updatedAtGithub: new Date('2026-09-23T00:00:00Z'),
  pushedAtGithub: new Date('2026-09-23T01:00:00Z'),
  metadata: {
    stars: 10,
    forks: 2,
    openIssues: 1,
    primaryLanguage: 'TypeScript',
    licenseSpdx: 'MIT',
    topics: ['backend'],
  },
};

const indexedRepository: RepositoryRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  githubRepositoryId: snapshot.githubRepositoryId,
  owner: snapshot.owner,
  name: snapshot.name,
  fullName: snapshot.fullName,
  githubUrl: snapshot.githubUrl,
  defaultBranch: snapshot.defaultBranch,
  description: snapshot.description,
  isArchived: snapshot.isArchived,
  isFork: snapshot.isFork,
  createdAtGithub: snapshot.createdAtGithub,
  updatedAtGithub: snapshot.updatedAtGithub,
  pushedAtGithub: snapshot.pushedAtGithub,
  lastSyncedAt: new Date('2026-09-23T02:00:00Z'),
  createdAt: new Date('2026-09-23T02:00:01Z'),
  updatedAt: new Date('2026-09-23T02:00:01Z'),
};

describe('RepositorySubmissionValidationService', () => {
  it('records a valid canonical GitHub identity and keeps the submission pending', async () => {
    const fetchRepository = vi.fn().mockResolvedValue(snapshot);
    const findByGithubRepositoryId = vi.fn().mockResolvedValue(null);
    const validatedAt = new Date('2026-09-24T01:00:00Z');
    const resolved: RepositorySubmissionRecord = {
      ...pendingSubmission,
      validationOutcome: 'VALID',
      resolvedRepository: {
        githubRepositoryId: snapshot.githubRepositoryId,
        owner: snapshot.owner,
        name: snapshot.name,
        fullName: snapshot.fullName,
        githubUrl: snapshot.githubUrl,
      },
      validatedAt,
    };
    const recordValidation = vi.fn().mockResolvedValue(resolved);

    const service = new RepositorySubmissionValidationService(
      { fetchRepository },
      { findByGithubRepositoryId },
      {
        findById: vi.fn().mockResolvedValue(pendingSubmission),
        recordValidation,
      },
      () => validatedAt,
    );

    await expect(service.validate(pendingSubmission.id)).resolves.toBe(
      resolved,
    );

    expect(fetchRepository).toHaveBeenCalledWith({
      owner: 'example',
      name: 'project',
    });
    expect(findByGithubRepositoryId).toHaveBeenCalledWith('987654321');
    expect(recordValidation).toHaveBeenCalledWith({
      kind: 'valid',
      submissionId: pendingSubmission.id,
      repository: {
        githubRepositoryId: '987654321',
        owner: 'ExampleOrg',
        name: 'Project',
        fullName: 'ExampleOrg/Project',
        githubUrl: 'https://github.com/ExampleOrg/Project',
      },
      validatedAt,
    });
  });

  it('records GitHub not-found or inaccessible as deterministic INVALID', async () => {
    const validatedAt = new Date('2026-09-24T02:00:00Z');
    const invalid: RepositorySubmissionRecord = {
      ...pendingSubmission,
      status: 'INVALID',
      validationOutcome: 'INVALID',
      validatedAt,
    };
    const recordValidation = vi.fn().mockResolvedValue(invalid);

    const service = new RepositorySubmissionValidationService(
      {
        fetchRepository: vi.fn().mockRejectedValue(
          new GithubApiError(
            'not_found',
            'GitHub repository was not found or is not publicly accessible.',
            404,
          ),
        ),
      },
      {
        findByGithubRepositoryId: vi.fn(),
      },
      {
        findById: vi.fn().mockResolvedValue(pendingSubmission),
        recordValidation,
      },
      () => validatedAt,
    );

    await expect(service.validate(pendingSubmission.id)).resolves.toBe(
      invalid,
    );
    expect(recordValidation).toHaveBeenCalledWith({
      kind: 'invalid',
      submissionId: pendingSubmission.id,
      validatedAt,
    });
  });

  it('records a token-visible private repository as INVALID before duplicate lookup', async () => {
    const validatedAt = new Date('2026-09-24T02:30:00Z');
    const recordValidation = vi.fn().mockResolvedValue({
      ...pendingSubmission,
      status: 'INVALID',
      validationOutcome: 'INVALID',
      validatedAt,
    });
    const findByGithubRepositoryId = vi.fn();
    const service = new RepositorySubmissionValidationService(
      {
        fetchRepository: vi.fn().mockResolvedValue({
          ...snapshot,
          isPrivate: true,
        }),
      },
      { findByGithubRepositoryId },
      {
        findById: vi.fn().mockResolvedValue(pendingSubmission),
        recordValidation,
      },
      () => validatedAt,
    );

    await service.validate(pendingSubmission.id);

    expect(findByGithubRepositoryId).not.toHaveBeenCalled();
    expect(recordValidation).toHaveBeenCalledWith({
      kind: 'invalid',
      submissionId: pendingSubmission.id,
      validatedAt,
    });
  });

  it('classifies canonical GitHub identity already in the index as DUPLICATE', async () => {
    const validatedAt = new Date('2026-09-24T03:00:00Z');
    const duplicate: RepositorySubmissionRecord = {
      ...pendingSubmission,
      status: 'DUPLICATE',
      validationOutcome: 'DUPLICATE',
      resolvedRepository: {
        githubRepositoryId: snapshot.githubRepositoryId,
        owner: snapshot.owner,
        name: snapshot.name,
        fullName: snapshot.fullName,
        githubUrl: snapshot.githubUrl,
      },
      duplicateRepositoryId: indexedRepository.id,
      validatedAt,
    };
    const recordValidation = vi.fn().mockResolvedValue(duplicate);

    const service = new RepositorySubmissionValidationService(
      {
        fetchRepository: vi.fn().mockResolvedValue(snapshot),
      },
      {
        findByGithubRepositoryId: vi.fn().mockResolvedValue(indexedRepository),
      },
      {
        findById: vi.fn().mockResolvedValue(pendingSubmission),
        recordValidation,
      },
      () => validatedAt,
    );

    await expect(service.validate(pendingSubmission.id)).resolves.toBe(
      duplicate,
    );
    expect(recordValidation).toHaveBeenCalledWith({
      kind: 'duplicate',
      submissionId: pendingSubmission.id,
      repository: {
        githubRepositoryId: '987654321',
        owner: 'ExampleOrg',
        name: 'Project',
        fullName: 'ExampleOrg/Project',
        githubUrl: 'https://github.com/ExampleOrg/Project',
      },
      duplicateRepositoryId: indexedRepository.id,
      validatedAt,
    });
  });

  it('leaves the submission pending when GitHub failure is retryable', async () => {
    const recordValidation = vi.fn();
    const rateLimit = new GithubApiError(
      'rate_limited',
      'GitHub API rate limit was reached.',
      429,
      new Date('2026-09-24T04:00:00Z'),
    );
    const service = new RepositorySubmissionValidationService(
      {
        fetchRepository: vi.fn().mockRejectedValue(rateLimit),
      },
      {
        findByGithubRepositoryId: vi.fn(),
      },
      {
        findById: vi.fn().mockResolvedValue(pendingSubmission),
        recordValidation,
      },
    );

    await expect(
      service.validate(pendingSubmission.id),
    ).rejects.toBe(rateLimit);
    expect(recordValidation).not.toHaveBeenCalled();
  });

  it('returns an already-validated submission without another GitHub call', async () => {
    const fetchRepository = vi.fn();
    const validated: RepositorySubmissionRecord = {
      ...pendingSubmission,
      validationOutcome: 'VALID',
      resolvedRepository: {
        githubRepositoryId: snapshot.githubRepositoryId,
        owner: snapshot.owner,
        name: snapshot.name,
        fullName: snapshot.fullName,
        githubUrl: snapshot.githubUrl,
      },
      validatedAt: new Date('2026-09-24T05:00:00Z'),
    };
    const service = new RepositorySubmissionValidationService(
      { fetchRepository },
      { findByGithubRepositoryId: vi.fn() },
      {
        findById: vi.fn().mockResolvedValue(validated),
        recordValidation: vi.fn(),
      },
    );

    await expect(service.validate(validated.id)).resolves.toBe(validated);
    expect(fetchRepository).not.toHaveBeenCalled();
  });

  it('rejects missing and non-pending unvalidated submissions', async () => {
    const missing = new RepositorySubmissionValidationService(
      { fetchRepository: vi.fn() },
      { findByGithubRepositoryId: vi.fn() },
      {
        findById: vi.fn().mockResolvedValue(null),
        recordValidation: vi.fn(),
      },
    );

    await expect(
      missing.validate(pendingSubmission.id),
    ).rejects.toBeInstanceOf(RepositorySubmissionNotFoundError);

    const rejectedSubmission: RepositorySubmissionRecord = {
      ...pendingSubmission,
      status: 'REJECTED',
    };
    const ineligible = new RepositorySubmissionValidationService(
      { fetchRepository: vi.fn() },
      { findByGithubRepositoryId: vi.fn() },
      {
        findById: vi.fn().mockResolvedValue(rejectedSubmission),
        recordValidation: vi.fn(),
      },
    );

    await expect(
      ineligible.validate(rejectedSubmission.id),
    ).rejects.toBeInstanceOf(
      RepositorySubmissionNotEligibleForValidationError,
    );
  });
});
