import { describe, expect, it } from 'vitest';

import {
  parseSnapshotBackfillBatchLimit,
  RepositorySnapshotBackfillService,
} from './repository-snapshot-backfill-service.js';

describe('parseSnapshotBackfillBatchLimit', () => {
  it('uses a bounded default and accepts explicit values', () => {
    expect(parseSnapshotBackfillBatchLimit(undefined)).toBe(50);
    expect(parseSnapshotBackfillBatchLimit('1')).toBe(1);
    expect(parseSnapshotBackfillBatchLimit('500')).toBe(500);
  });

  it.each(['0', '501', '-1', '1.5', 'abc'])(
    'rejects invalid value %s',
    (value) => {
      expect(() => parseSnapshotBackfillBatchLimit(value)).toThrow(
        'Snapshot backfill batch limit must be an integer between 1 and 500.',
      );
    },
  );
});

describe('RepositorySnapshotBackfillService', () => {
  it('captures selected stored metadata observations without provider work', async () => {
    const writes: string[] = [];
    const service = new RepositorySnapshotBackfillService(
      {
        async listLatestMetadataBackfillCandidates(limit) {
          expect(limit).toBe(2);
          return [
            {
              repositoryId: '11111111-1111-4111-8111-111111111111',
              fullName: 'example/one',
              observedAt: new Date('2026-09-20T12:00:00Z'),
              stars: 10,
              forks: 2,
              openIssues: 1,
            },
            {
              repositoryId: '22222222-2222-4222-8222-222222222222',
              fullName: 'example/two',
              observedAt: new Date('2026-09-21T12:00:00Z'),
              stars: 20,
              forks: 4,
              openIssues: 3,
            },
          ];
        },
      },
      {
        async captureDaily(input) {
          writes.push(input.repositoryId);
          return {
            kind: writes.length === 1 ? 'created' : 'existing',
            snapshot: {
              id:
                writes.length === 1
                  ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
                  : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              repositoryId: input.repositoryId,
              capturedOn: input.capturedAt.toISOString().slice(0, 10),
              capturedAt: input.capturedAt,
              stars: input.stars,
              forks: input.forks,
              openIssues: input.openIssues,
              createdAt: input.capturedAt,
            },
          };
        },
      },
    );

    const report = await service.runBatch(2);

    expect(writes).toHaveLength(2);
    expect(report).toEqual({
      selected: 2,
      processed: 2,
      summary: {
        created: 1,
        existing: 1,
      },
      items: [
        {
          repositoryId: '11111111-1111-4111-8111-111111111111',
          fullName: 'example/one',
          observedAt: '2026-09-20T12:00:00.000Z',
          result: 'created',
        },
        {
          repositoryId: '22222222-2222-4222-8222-222222222222',
          fullName: 'example/two',
          observedAt: '2026-09-21T12:00:00.000Z',
          result: 'existing',
        },
      ],
    });
  });
});
