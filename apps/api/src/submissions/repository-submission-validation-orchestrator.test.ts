import { describe, expect, it, vi } from 'vitest';

import { GithubApiError } from '../github/github-client.js';
import type { RepositorySubmissionRecord } from './repository-submission.js';
import {
  DEFAULT_SUBMISSION_VALIDATION_BATCH_LIMIT,
  RepositorySubmissionValidationOrchestrator,
  parseSubmissionValidationBatchLimit,
} from './repository-submission-validation-orchestrator.js';

function submission(
  id: string,
  overrides: Partial<RepositorySubmissionRecord> = {},
): RepositorySubmissionRecord {
  return {
    id,
    submittedUrl: 'https://github.com/example/project',
    normalizedOwner: 'example',
    normalizedName: 'project',
    normalizedFullName: 'example/project',
    status: 'PENDING',
    validationOutcome: null,
    resolvedRepository: null,
    duplicateRepositoryId: null,
    validatedAt: null,
    createdAt: new Date('2026-09-24T00:00:00Z'),
    updatedAt: new Date('2026-09-24T00:00:00Z'),
    ...overrides,
  };
}

const ids = {
  one: '11111111-1111-4111-8111-111111111111',
  two: '22222222-2222-4222-8222-222222222222',
  three: '33333333-3333-4333-8333-333333333333',
};

describe('parseSubmissionValidationBatchLimit', () => {
  it('uses a bounded default and accepts explicit limits', () => {
    expect(parseSubmissionValidationBatchLimit(undefined)).toBe(
      DEFAULT_SUBMISSION_VALIDATION_BATCH_LIMIT,
    );
    expect(parseSubmissionValidationBatchLimit('1')).toBe(1);
    expect(parseSubmissionValidationBatchLimit('50')).toBe(50);
  });

  it('rejects invalid limits', () => {
    expect(() => parseSubmissionValidationBatchLimit('0')).toThrow();
    expect(() => parseSubmissionValidationBatchLimit('51')).toThrow();
    expect(() => parseSubmissionValidationBatchLimit('1.5')).toThrow();
    expect(() => parseSubmissionValidationBatchLimit('abc')).toThrow();
  });
});

describe('RepositorySubmissionValidationOrchestrator', () => {
  it('reports deterministic validation outcomes separately', async () => {
    const candidates = [
      submission(ids.one),
      submission(ids.two),
      submission(ids.three),
    ];
    const validate = vi
      .fn()
      .mockResolvedValueOnce(
        submission(ids.one, {
          validationOutcome: 'VALID',
          validatedAt: new Date('2026-09-24T01:00:00Z'),
        }),
      )
      .mockResolvedValueOnce(
        submission(ids.two, {
          status: 'DUPLICATE',
          validationOutcome: 'DUPLICATE',
          duplicateRepositoryId:
            '44444444-4444-4444-8444-444444444444',
          validatedAt: new Date('2026-09-24T01:01:00Z'),
        }),
      )
      .mockResolvedValueOnce(
        submission(ids.three, {
          status: 'INVALID',
          validationOutcome: 'INVALID',
          validatedAt: new Date('2026-09-24T01:02:00Z'),
        }),
      );
    const orchestrator = new RepositorySubmissionValidationOrchestrator(
      {
        listPendingValidationCandidates: vi
          .fn()
          .mockResolvedValue(candidates),
      },
      { validate },
    );

    const report = await orchestrator.runBatch(3);

    expect(report).toEqual({
      selected: 3,
      processed: 3,
      remainingSelected: 0,
      stoppedEarly: false,
      summary: {
        valid: 1,
        duplicate: 1,
        invalid: 1,
        retryable: 0,
      },
      items: [
        {
          kind: 'validated',
          submissionId: ids.one,
          status: 'PENDING',
          validationOutcome: 'VALID',
        },
        {
          kind: 'validated',
          submissionId: ids.two,
          status: 'DUPLICATE',
          validationOutcome: 'DUPLICATE',
        },
        {
          kind: 'validated',
          submissionId: ids.three,
          status: 'INVALID',
          validationOutcome: 'INVALID',
        },
      ],
    });
  });

  it('continues after isolated retryable request failures', async () => {
    const candidates = [submission(ids.one), submission(ids.two)];
    const validate = vi
      .fn()
      .mockRejectedValueOnce(
        new GithubApiError(
          'request_failed',
          'Temporary GitHub failure.',
          503,
        ),
      )
      .mockResolvedValueOnce(
        submission(ids.two, {
          validationOutcome: 'VALID',
          validatedAt: new Date('2026-09-24T02:00:00Z'),
        }),
      );
    const orchestrator = new RepositorySubmissionValidationOrchestrator(
      {
        listPendingValidationCandidates: vi
          .fn()
          .mockResolvedValue(candidates),
      },
      { validate },
    );

    const report = await orchestrator.runBatch(2);

    expect(validate).toHaveBeenCalledTimes(2);
    expect(report.stoppedEarly).toBe(false);
    expect(report.summary).toEqual({
      valid: 1,
      duplicate: 0,
      invalid: 0,
      retryable: 1,
    });
    expect(report.items[0]).toEqual({
      kind: 'retryable',
      submissionId: ids.one,
      errorKind: 'request_failed',
      message: 'Temporary GitHub failure.',
      retryAt: null,
    });
  });

  it('stops remaining selected work after rate limiting', async () => {
    const retryAt = new Date('2026-09-24T04:30:00Z');
    const candidates = [
      submission(ids.one),
      submission(ids.two),
      submission(ids.three),
    ];
    const validate = vi
      .fn()
      .mockResolvedValueOnce(
        submission(ids.one, {
          validationOutcome: 'VALID',
          validatedAt: new Date('2026-09-24T03:00:00Z'),
        }),
      )
      .mockRejectedValueOnce(
        new GithubApiError(
          'rate_limited',
          'GitHub API rate limit was reached.',
          429,
          retryAt,
        ),
      );
    const orchestrator = new RepositorySubmissionValidationOrchestrator(
      {
        listPendingValidationCandidates: vi
          .fn()
          .mockResolvedValue(candidates),
      },
      { validate },
    );

    const report = await orchestrator.runBatch(3);

    expect(validate).toHaveBeenCalledTimes(2);
    expect(report).toEqual({
      selected: 3,
      processed: 2,
      remainingSelected: 1,
      stoppedEarly: true,
      summary: {
        valid: 1,
        duplicate: 0,
        invalid: 0,
        retryable: 1,
      },
      items: [
        {
          kind: 'validated',
          submissionId: ids.one,
          status: 'PENDING',
          validationOutcome: 'VALID',
        },
        {
          kind: 'retryable',
          submissionId: ids.two,
          errorKind: 'rate_limited',
          message: 'GitHub API rate limit was reached.',
          retryAt: '2026-09-24T04:30:00.000Z',
        },
      ],
    });
  });

  it('does not hide unexpected validation failures as retryable', async () => {
    const orchestrator = new RepositorySubmissionValidationOrchestrator(
      {
        listPendingValidationCandidates: vi
          .fn()
          .mockResolvedValue([submission(ids.one)]),
      },
      {
        validate: vi.fn().mockRejectedValue(
          new Error('Database connection lost.'),
        ),
      },
    );

    await expect(orchestrator.runBatch(1)).rejects.toThrow(
      'Database connection lost.',
    );
  });
});
