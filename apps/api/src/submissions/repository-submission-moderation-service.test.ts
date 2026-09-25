import { describe, expect, it, vi } from 'vitest';

import {
  InvalidRepositorySubmissionModerationError,
  RepositorySubmissionAlreadyModeratedError,
  RepositorySubmissionModerationNotFoundError,
  RepositorySubmissionModerationService,
  RepositorySubmissionNotEligibleForModerationError,
} from './repository-submission-moderation-service.js';

describe('RepositorySubmissionModerationService', () => {
  it('normalizes reviewer/reason and delegates one final decision', async () => {
    const decidedAt = new Date('2026-09-25T01:00:00Z');
    const persisted = {
      submissionId: '11111111-1111-4111-8111-111111111111',
      repositoryId: '22222222-2222-4222-8222-222222222222',
      status: 'APPROVED' as const,
      event: {
        id: '33333333-3333-4333-8333-333333333333',
        submissionId: '11111111-1111-4111-8111-111111111111',
        decision: 'APPROVED' as const,
        reviewerRef: 'maintainer:SanamRai001',
        reason: 'Useful project with clear purpose.',
        createdAt: decidedAt,
      },
    };
    const moderate = vi.fn().mockResolvedValue({
      kind: 'moderated',
      result: persisted,
    });
    const service = new RepositorySubmissionModerationService(
      { moderate },
      () => decidedAt,
    );

    await expect(
      service.moderate({
        submissionId: persisted.submissionId,
        decision: 'APPROVED',
        reviewerRef: '  maintainer:SanamRai001  ',
        reason: '  Useful   project with clear purpose.  ',
      }),
    ).resolves.toBe(persisted);

    expect(moderate).toHaveBeenCalledWith({
      submissionId: persisted.submissionId,
      decision: 'APPROVED',
      reviewerRef: 'maintainer:SanamRai001',
      reason: 'Useful project with clear purpose.',
      decidedAt,
    });
  });

  it('rejects invalid decision, reviewer, and reason before persistence', async () => {
    const moderate = vi.fn();
    const service = new RepositorySubmissionModerationService({
      moderate,
    });

    await expect(
      service.moderate({
        submissionId: '11111111-1111-4111-8111-111111111111',
        decision: 'MAYBE',
        reviewerRef: 'maintainer',
        reason: 'reason',
      }),
    ).rejects.toBeInstanceOf(
      InvalidRepositorySubmissionModerationError,
    );

    await expect(
      service.moderate({
        submissionId: '11111111-1111-4111-8111-111111111111',
        decision: 'APPROVED',
        reviewerRef: '   ',
        reason: 'reason',
      }),
    ).rejects.toBeInstanceOf(
      InvalidRepositorySubmissionModerationError,
    );

    await expect(
      service.moderate({
        submissionId: '11111111-1111-4111-8111-111111111111',
        decision: 'REJECTED',
        reviewerRef: 'maintainer',
        reason: '   ',
      }),
    ).rejects.toBeInstanceOf(
      InvalidRepositorySubmissionModerationError,
    );

    expect(moderate).not.toHaveBeenCalled();
  });

  it('maps store state outcomes into typed domain errors', async () => {
    const submissionId =
      '11111111-1111-4111-8111-111111111111';

    const notFound = new RepositorySubmissionModerationService({
      moderate: vi.fn().mockResolvedValue({ kind: 'not_found' }),
    });
    await expect(
      notFound.moderate({
        submissionId,
        decision: 'APPROVED',
        reviewerRef: 'maintainer',
        reason: 'reason',
      }),
    ).rejects.toBeInstanceOf(
      RepositorySubmissionModerationNotFoundError,
    );

    const ineligible = new RepositorySubmissionModerationService({
      moderate: vi.fn().mockResolvedValue({ kind: 'not_eligible' }),
    });
    await expect(
      ineligible.moderate({
        submissionId,
        decision: 'REJECTED',
        reviewerRef: 'maintainer',
        reason: 'reason',
      }),
    ).rejects.toBeInstanceOf(
      RepositorySubmissionNotEligibleForModerationError,
    );

    const already = new RepositorySubmissionModerationService({
      moderate: vi.fn().mockResolvedValue({
        kind: 'already_moderated',
        decision: 'APPROVED',
      }),
    });

    await expect(
      already.moderate({
        submissionId,
        decision: 'REJECTED',
        reviewerRef: 'maintainer',
        reason: 'changed mind',
      }),
    ).rejects.toMatchObject({
      decision: 'APPROVED',
    } satisfies Partial<RepositorySubmissionAlreadyModeratedError>);
  });
});
