import { describe, expect, it } from 'vitest';

import {
  parseSubmissionCleanupBatchLimit,
  RepositorySubmissionCleanupService,
  type RepositorySubmissionCleanupCandidate,
} from './repository-submission-cleanup-service.js';

const candidates: RepositorySubmissionCleanupCandidate[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'INVALID',
    updatedAt: new Date('2026-05-01T00:00:00Z'),
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    status: 'DUPLICATE',
    updatedAt: new Date('2026-05-02T00:00:00Z'),
  },
];

describe('RepositorySubmissionCleanupService', () => {
  it('previews eligible rows without deleting them', async () => {
    let listed: { cutoff: Date; limit: number } | null = null;
    let deleteCalled = false;

    const service = new RepositorySubmissionCleanupService(
      {
        async listCleanupCandidates(cutoff, limit) {
          listed = { cutoff, limit };
          return candidates;
        },
        async deleteCleanupCandidates() {
          deleteCalled = true;
          return [];
        },
      },
      {
        retentionDays: 90,
        now: () => new Date('2026-09-25T12:00:00Z'),
      },
    );

    const report = await service.run('preview', 25);

    expect(listed).toEqual({
      cutoff: new Date('2026-06-27T12:00:00Z'),
      limit: 25,
    });
    expect(deleteCalled).toBe(false);
    expect(report).toEqual({
      mode: 'preview',
      cutoff: new Date('2026-06-27T12:00:00Z'),
      retentionDays: 90,
      selected: 2,
      deleted: 0,
      summary: {
        invalid: 1,
        duplicate: 1,
      },
      items: candidates,
    });
  });

  it('deletes only through explicit apply mode', async () => {
    let listCalled = false;
    let deleted: { cutoff: Date; limit: number } | null = null;

    const service = new RepositorySubmissionCleanupService(
      {
        async listCleanupCandidates() {
          listCalled = true;
          return [];
        },
        async deleteCleanupCandidates(cutoff, limit) {
          deleted = { cutoff, limit };
          return candidates;
        },
      },
      {
        retentionDays: 90,
        now: () => new Date('2026-09-25T12:00:00Z'),
      },
    );

    const report = await service.run('apply', 10);

    expect(listCalled).toBe(false);
    expect(deleted).toEqual({
      cutoff: new Date('2026-06-27T12:00:00Z'),
      limit: 10,
    });
    expect(report.deleted).toBe(2);
    expect(report.selected).toBe(2);
  });

  it('requires retention to remain beyond the maximum resubmission cooldown', () => {
    expect(
      () =>
        new RepositorySubmissionCleanupService(
          {
            async listCleanupCandidates() {
              return [];
            },
            async deleteCleanupCandidates() {
              return [];
            },
          },
          { retentionDays: 30 },
        ),
    ).toThrow('retentionDays must be an integer between 31 and 3650.');
  });
});

describe('parseSubmissionCleanupBatchLimit', () => {
  it('uses a bounded default and accepts explicit limits', () => {
    expect(parseSubmissionCleanupBatchLimit(undefined)).toBe(100);
    expect(parseSubmissionCleanupBatchLimit('1')).toBe(1);
    expect(parseSubmissionCleanupBatchLimit('1000')).toBe(1_000);
  });

  it.each(['0', '1001', '1.5', '-1', 'abc'])(
    'rejects invalid cleanup batch limit %s',
    (value) => {
      expect(() => parseSubmissionCleanupBatchLimit(value)).toThrow(
        'Cleanup batch limit must be an integer between 1 and 1000.',
      );
    },
  );
});
