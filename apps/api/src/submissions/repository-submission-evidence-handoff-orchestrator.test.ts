import { describe, expect, it, vi } from 'vitest';

import type { RepositorySubmissionRecord } from './repository-submission.js';
import {
  parseSubmissionEvidenceHandoffBatchLimit,
  RepositorySubmissionEvidenceHandoffOrchestrator,
} from './repository-submission-evidence-handoff-orchestrator.js';
import type {
  RepositorySubmissionEvidenceHandoffResult,
} from './repository-submission-evidence-handoff-service.js';

function candidate(id: string): RepositorySubmissionRecord {
  return {
    id,
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
    createdAt: new Date('2026-09-24T02:00:00Z'),
    updatedAt: new Date('2026-09-24T03:00:00Z'),
  };
}

function completed(
  submissionId: string,
): RepositorySubmissionEvidenceHandoffResult {
  return {
    kind: 'completed',
    submissionId,
    repositoryId: '11111111-1111-4111-8111-111111111111',
    alreadyCompleted: false,
    rateLimited: false,
    stages: [],
  };
}

describe('RepositorySubmissionEvidenceHandoffOrchestrator', () => {
  it('parses bounded batch limits', () => {
    expect(parseSubmissionEvidenceHandoffBatchLimit(undefined)).toBe(10);
    expect(parseSubmissionEvidenceHandoffBatchLimit('1')).toBe(1);
    expect(parseSubmissionEvidenceHandoffBatchLimit('50')).toBe(50);
    expect(() => parseSubmissionEvidenceHandoffBatchLimit('0')).toThrow();
    expect(() => parseSubmissionEvidenceHandoffBatchLimit('51')).toThrow();
  });

  it('summarizes completed and incomplete handoffs', async () => {
    const first = candidate(
      '22222222-2222-4222-8222-222222222221',
    );
    const second = candidate(
      '22222222-2222-4222-8222-222222222222',
    );
    const incomplete: RepositorySubmissionEvidenceHandoffResult = {
      kind: 'incomplete',
      submissionId: second.id,
      repositoryId: null,
      alreadyCompleted: false,
      rateLimited: false,
      stages: [],
    };
    const handoff = vi
      .fn()
      .mockResolvedValueOnce(completed(first.id))
      .mockResolvedValueOnce(incomplete);
    const orchestrator =
      new RepositorySubmissionEvidenceHandoffOrchestrator(
        {
          listPendingEvidenceHandoffCandidates:
            vi.fn().mockResolvedValue([first, second]),
        },
        { handoff },
      );

    const report = await orchestrator.runBatch(2);

    expect(report).toEqual({
      selected: 2,
      processed: 2,
      remainingSelected: 0,
      stoppedEarly: false,
      summary: {
        completed: 1,
        incomplete: 1,
      },
      items: [completed(first.id), incomplete],
    });
  });

  it('stops the selected batch after rate limiting', async () => {
    const first = candidate(
      '22222222-2222-4222-8222-222222222221',
    );
    const second = candidate(
      '22222222-2222-4222-8222-222222222222',
    );
    const rateLimited: RepositorySubmissionEvidenceHandoffResult = {
      kind: 'incomplete',
      submissionId: first.id,
      repositoryId: null,
      alreadyCompleted: false,
      rateLimited: true,
      stages: [],
    };
    const handoff = vi.fn().mockResolvedValue(rateLimited);
    const orchestrator =
      new RepositorySubmissionEvidenceHandoffOrchestrator(
        {
          listPendingEvidenceHandoffCandidates:
            vi.fn().mockResolvedValue([first, second]),
        },
        { handoff },
      );

    const report = await orchestrator.runBatch(2);

    expect(handoff).toHaveBeenCalledTimes(1);
    expect(report.stoppedEarly).toBe(true);
    expect(report.remainingSelected).toBe(1);
  });
});
