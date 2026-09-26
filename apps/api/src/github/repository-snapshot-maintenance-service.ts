import type {
  RepositorySnapshotBackfillBatchReport,
} from '../repositories/repository-snapshot-backfill-service.js';
import type {
  RepositorySnapshotRefreshCandidate,
  SnapshotMaintenanceLockHandle,
} from '../repositories/repository-snapshot-maintenance-store.js';
import {
  DEFAULT_REFRESH_INTERVAL_MS,
} from './repository-refresh-policy.js';
import type {
  RepositoryRefreshResult,
} from './repository-refresh-service.js';

export const DEFAULT_SNAPSHOT_REFRESH_BATCH_LIMIT = 25;
export const MAX_SNAPSHOT_REFRESH_BATCH_LIMIT = 100;
export const DEFAULT_SNAPSHOT_MAINTENANCE_BACKFILL_LIMIT = 100;
export const MAX_SNAPSHOT_MAINTENANCE_BACKFILL_LIMIT = 500;

type RunLockProvider = Readonly<{
  tryAcquireRunLock(): Promise<SnapshotMaintenanceLockHandle | null>;
}>;

type BackfillRunner = Readonly<{
  runBatch(limit: number): Promise<RepositorySnapshotBackfillBatchReport>;
}>;

type RefreshCandidateReader = Readonly<{
  listRefreshCandidates(input: Readonly<{
    now: Date;
    refreshIntervalMs: number;
    limit: number;
  }>): Promise<RepositorySnapshotRefreshCandidate[]>;
}>;

type RefreshRunner = Readonly<{
  refresh(referenceValue: string): Promise<RepositoryRefreshResult>;
}>;

export type SnapshotMaintenanceOptions = Readonly<{
  refreshLimit?: number;
  backfillLimit?: number;
  refreshIntervalMs?: number;
}>;

export type SnapshotMaintenanceRefreshItem = Readonly<{
  repositoryId: string;
  fullName: string;
  status: RepositoryRefreshResult['status'];
  retryAt: string | null;
}>;

export type SnapshotMaintenanceReport =
  | Readonly<{
      status: 'already_running';
      startedAt: string;
    }>
  | Readonly<{
      status: 'completed' | 'halted';
      startedAt: string;
      completedAt: string;
      backfill: RepositorySnapshotBackfillBatchReport;
      refresh: Readonly<{
        selected: number;
        processed: number;
        summary: Readonly<{
          refreshed: number;
          skipped: number;
          unavailable: number;
          retryLater: number;
          manualReview: number;
        }>;
        items: readonly SnapshotMaintenanceRefreshItem[];
        haltedReason: 'retry_later' | 'manual_review' | null;
        retryAt: string | null;
      }>;
    }>;

function assertLimit(
  name: string,
  value: number,
  maximum: number,
): void {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(
      `${name} must be an integer between 1 and ${maximum}.`,
    );
  }
}

export function parseSnapshotMaintenanceLimit(
  name: 'refreshLimit' | 'backfillLimit',
  value: unknown,
): number {
  const defaults = {
    refreshLimit: DEFAULT_SNAPSHOT_REFRESH_BATCH_LIMIT,
    backfillLimit: DEFAULT_SNAPSHOT_MAINTENANCE_BACKFILL_LIMIT,
  } as const;
  const maximums = {
    refreshLimit: MAX_SNAPSHOT_REFRESH_BATCH_LIMIT,
    backfillLimit: MAX_SNAPSHOT_MAINTENANCE_BACKFILL_LIMIT,
  } as const;

  if (value === undefined) {
    return defaults[name];
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(
      `${name} must be an integer between 1 and ${maximums[name]}.`,
    );
  }

  const parsed = Number(value);
  assertLimit(name, parsed, maximums[name]);
  return parsed;
}

export class RepositorySnapshotMaintenanceService {
  public constructor(
    private readonly lockProvider: RunLockProvider,
    private readonly backfillRunner: BackfillRunner,
    private readonly candidateReader: RefreshCandidateReader,
    private readonly refreshRunner: RefreshRunner,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(
    options: SnapshotMaintenanceOptions = {},
  ): Promise<SnapshotMaintenanceReport> {
    const refreshLimit =
      options.refreshLimit ?? DEFAULT_SNAPSHOT_REFRESH_BATCH_LIMIT;
    const backfillLimit =
      options.backfillLimit ?? DEFAULT_SNAPSHOT_MAINTENANCE_BACKFILL_LIMIT;
    const refreshIntervalMs =
      options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;

    assertLimit(
      'refreshLimit',
      refreshLimit,
      MAX_SNAPSHOT_REFRESH_BATCH_LIMIT,
    );
    assertLimit(
      'backfillLimit',
      backfillLimit,
      MAX_SNAPSHOT_MAINTENANCE_BACKFILL_LIMIT,
    );

    if (!Number.isFinite(refreshIntervalMs) || refreshIntervalMs <= 0) {
      throw new Error(
        'refreshIntervalMs must be a positive finite number.',
      );
    }

    const startedAt = this.now();
    const lock = await this.lockProvider.tryAcquireRunLock();

    if (!lock) {
      return {
        status: 'already_running',
        startedAt: startedAt.toISOString(),
      };
    }

    try {
      const backfill = await this.backfillRunner.runBatch(backfillLimit);
      const candidates = await this.candidateReader.listRefreshCandidates({
        now: startedAt,
        refreshIntervalMs,
        limit: refreshLimit,
      });
      const items: SnapshotMaintenanceRefreshItem[] = [];
      let haltedReason: 'retry_later' | 'manual_review' | null = null;
      let retryAt: string | null = null;

      for (const candidate of candidates) {
        const result = await this.refreshRunner.refresh(candidate.fullName);

        items.push({
          repositoryId: candidate.repositoryId,
          fullName: candidate.fullName,
          status: result.status,
          retryAt:
            'retryAt' in result
              ? result.retryAt?.toISOString() ?? null
              : null,
        });

        if (result.status === 'retry_later') {
          haltedReason = 'retry_later';
          retryAt = result.retryAt.toISOString();
          break;
        }

        if (result.status === 'manual_review') {
          haltedReason = 'manual_review';
          break;
        }
      }

      const summary = {
        refreshed: items.filter((item) => item.status === 'refreshed').length,
        skipped: items.filter((item) => item.status === 'skipped').length,
        unavailable: items.filter((item) => item.status === 'unavailable')
          .length,
        retryLater: items.filter((item) => item.status === 'retry_later')
          .length,
        manualReview: items.filter((item) => item.status === 'manual_review')
          .length,
      };
      const completedAt = this.now().toISOString();

      return {
        status: haltedReason === null ? 'completed' : 'halted',
        startedAt: startedAt.toISOString(),
        completedAt,
        backfill,
        refresh: {
          selected: candidates.length,
          processed: items.length,
          summary,
          items,
          haltedReason,
          retryAt,
        },
      };
    } finally {
      await lock.release();
    }
  }
}
