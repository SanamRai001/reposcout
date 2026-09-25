import type {
  CaptureRepositorySnapshotResult,
  RepositorySnapshotBackfillCandidate,
} from './repository-snapshot.js';

export const DEFAULT_SNAPSHOT_BACKFILL_BATCH_LIMIT = 50;
export const MAX_SNAPSHOT_BACKFILL_BATCH_LIMIT = 500;

type SnapshotBackfillReader = Readonly<{
  listLatestMetadataBackfillCandidates(
    limit: number,
  ): Promise<RepositorySnapshotBackfillCandidate[]>;
}>;

type SnapshotWriter = Readonly<{
  captureDaily(input: {
    repositoryId: string;
    capturedAt: Date;
    stars: number;
    forks: number;
    openIssues: number;
  }): Promise<CaptureRepositorySnapshotResult>;
}>;

export type RepositorySnapshotBackfillBatchItem = Readonly<{
  repositoryId: string;
  fullName: string;
  observedAt: string;
  result: CaptureRepositorySnapshotResult['kind'];
}>;

export type RepositorySnapshotBackfillBatchReport = Readonly<{
  selected: number;
  processed: number;
  summary: Readonly<{
    created: number;
    existing: number;
  }>;
  items: readonly RepositorySnapshotBackfillBatchItem[];
}>;

export function parseSnapshotBackfillBatchLimit(
  value: unknown,
): number {
  if (value === undefined) {
    return DEFAULT_SNAPSHOT_BACKFILL_BATCH_LIMIT;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(
      'Snapshot backfill batch limit must be an integer between 1 and 500.',
    );
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_SNAPSHOT_BACKFILL_BATCH_LIMIT
  ) {
    throw new Error(
      'Snapshot backfill batch limit must be an integer between 1 and 500.',
    );
  }

  return parsed;
}

export class RepositorySnapshotBackfillService {
  public constructor(
    private readonly candidateReader: SnapshotBackfillReader,
    private readonly snapshotWriter: SnapshotWriter,
  ) {}

  async runBatch(
    limit: number = DEFAULT_SNAPSHOT_BACKFILL_BATCH_LIMIT,
  ): Promise<RepositorySnapshotBackfillBatchReport> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new Error(
        'Snapshot backfill batch limit must be an integer between 1 and 500.',
      );
    }

    const candidates =
      await this.candidateReader.listLatestMetadataBackfillCandidates(limit);
    const items: RepositorySnapshotBackfillBatchItem[] = [];

    for (const candidate of candidates) {
      const result = await this.snapshotWriter.captureDaily({
        repositoryId: candidate.repositoryId,
        capturedAt: candidate.observedAt,
        stars: candidate.stars,
        forks: candidate.forks,
        openIssues: candidate.openIssues,
      });

      items.push({
        repositoryId: candidate.repositoryId,
        fullName: candidate.fullName,
        observedAt: candidate.observedAt.toISOString(),
        result: result.kind,
      });
    }

    const summary = {
      created: items.filter((item) => item.result === 'created').length,
      existing: items.filter((item) => item.result === 'existing').length,
    };

    return {
      selected: candidates.length,
      processed: items.length,
      summary,
      items,
    };
  }
}
