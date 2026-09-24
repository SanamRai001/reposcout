import { describe, expect, it, vi } from 'vitest';

import {
  InvalidRepositorySubmissionError,
  RepositoryAlreadyIndexedError,
  RepositorySubmissionAlreadyPendingError,
  RepositorySubmissionService,
  normalizeRepositorySubmissionUrl,
} from './repository-submission-service.js';
import type { RepositorySubmissionRecord } from './repository-submission.js';

const submission: RepositorySubmissionRecord = {
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

describe('normalizeRepositorySubmissionUrl', () => {
  it('canonicalizes casing and optional .git suffix', () => {
    expect(
      normalizeRepositorySubmissionUrl(
        '  https://github.com/Example/Project.git  ',
      ),
    ).toEqual({
      submittedUrl: 'https://github.com/example/project',
      normalizedOwner: 'example',
      normalizedName: 'project',
      normalizedFullName: 'example/project',
    });
  });

  it('rejects shorthand owner/repository references', () => {
    expect(() =>
      normalizeRepositorySubmissionUrl('example/project'),
    ).toThrow(InvalidRepositorySubmissionError);
  });

  it('rejects non-GitHub URLs', () => {
    expect(() =>
      normalizeRepositorySubmissionUrl(
        'https://example.com/example/project',
      ),
    ).toThrow(InvalidRepositorySubmissionError);
  });
});

describe('RepositorySubmissionService', () => {
  it('creates one normalized pending submission', async () => {
    const existsByNormalizedFullName = vi.fn().mockResolvedValue(false);
    const createPending = vi.fn().mockResolvedValue({
      kind: 'created',
      submission,
    });
    const service = new RepositorySubmissionService(
      { existsByNormalizedFullName },
      { createPending },
    );

    await expect(
      service.submit('https://github.com/Example/Project.git'),
    ).resolves.toBe(submission);

    expect(existsByNormalizedFullName).toHaveBeenCalledWith(
      'example/project',
    );
    expect(createPending).toHaveBeenCalledWith({
      submittedUrl: 'https://github.com/example/project',
      normalizedOwner: 'example',
      normalizedName: 'project',
      normalizedFullName: 'example/project',
    });
  });

  it('rejects repositories already in the canonical index', async () => {
    const createPending = vi.fn();
    const service = new RepositorySubmissionService(
      {
        existsByNormalizedFullName: vi.fn().mockResolvedValue(true),
      },
      { createPending },
    );

    await expect(
      service.submit('https://github.com/example/project'),
    ).rejects.toBeInstanceOf(RepositoryAlreadyIndexedError);
    expect(createPending).not.toHaveBeenCalled();
  });

  it('rejects an already-pending normalized repository', async () => {
    const service = new RepositorySubmissionService(
      {
        existsByNormalizedFullName: vi.fn().mockResolvedValue(false),
      },
      {
        createPending: vi.fn().mockResolvedValue({
          kind: 'pending_duplicate',
          submission,
        }),
      },
    );

    await expect(
      service.submit('https://github.com/example/project'),
    ).rejects.toBeInstanceOf(
      RepositorySubmissionAlreadyPendingError,
    );
  });
});
