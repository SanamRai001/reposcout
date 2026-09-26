import type { RepositorySnapshotRecord } from './repository-snapshot.js';

export const MAX_REPOSITORY_TREND_WINDOW_DAYS = 365;

export type RepositoryTrendSnapshot = Readonly<{
  capturedOn: string;
  capturedAt: Date;
  stars: number;
  forks: number;
  openIssues: number;
}>;

export type RepositoryMetricDelta = Readonly<{
  stars: number;
  forks: number;
  openIssues: number;
}>;

export type RepositoryTrendResult =
  | Readonly<{
      status: 'complete';
      repositoryId: string;
      requestedWindowDays: number;
      cutoffOn: string;
      actualWindowDays: number;
      baseline: RepositoryTrendSnapshot;
      latest: RepositoryTrendSnapshot;
      delta: RepositoryMetricDelta;
    }>
  | Readonly<{
      status: 'insufficient_history';
      reason: 'no_snapshots' | 'window_not_covered';
      repositoryId: string;
      requestedWindowDays: number;
      cutoffOn: string | null;
      availableWindowDays: number | null;
      oldestAvailable: RepositoryTrendSnapshot | null;
      latest: RepositoryTrendSnapshot | null;
    }>;

export type RepositoryTrendReader = Readonly<{
  readTrend(
    repositoryId: string,
    windowDays: number,
  ): Promise<RepositoryTrendResult>;
}>;

export function parseRepositoryTrendWindowDays(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(
      'windowDays must be an integer between 1 and 365.',
    );
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_REPOSITORY_TREND_WINDOW_DAYS
  ) {
    throw new Error(
      'windowDays must be an integer between 1 and 365.',
    );
  }

  return parsed;
}

export function toTrendSnapshot(
  snapshot: RepositorySnapshotRecord,
): RepositoryTrendSnapshot {
  return {
    capturedOn: snapshot.capturedOn,
    capturedAt: snapshot.capturedAt,
    stars: snapshot.stars,
    forks: snapshot.forks,
    openIssues: snapshot.openIssues,
  };
}


export type RepositoryTrendResponse =
  | Readonly<{
      status: 'complete';
      repositoryId: string;
      requestedWindowDays: number;
      cutoffOn: string;
      actualWindowDays: number;
      baseline: Readonly<{
        capturedOn: string;
        capturedAt: string;
        stars: number;
        forks: number;
        openIssues: number;
      }>;
      latest: Readonly<{
        capturedOn: string;
        capturedAt: string;
        stars: number;
        forks: number;
        openIssues: number;
      }>;
      delta: RepositoryMetricDelta;
    }>
  | Readonly<{
      status: 'insufficient_history';
      reason: 'no_snapshots' | 'window_not_covered';
      repositoryId: string;
      requestedWindowDays: number;
      cutoffOn: string | null;
      availableWindowDays: number | null;
      oldestAvailable: null | Readonly<{
        capturedOn: string;
        capturedAt: string;
        stars: number;
        forks: number;
        openIssues: number;
      }>;
      latest: null | Readonly<{
        capturedOn: string;
        capturedAt: string;
        stars: number;
        forks: number;
        openIssues: number;
      }>;
    }>;

function toTrendSnapshotResponse(snapshot: RepositoryTrendSnapshot) {
  return {
    capturedOn: snapshot.capturedOn,
    capturedAt: snapshot.capturedAt.toISOString(),
    stars: snapshot.stars,
    forks: snapshot.forks,
    openIssues: snapshot.openIssues,
  };
}

export function toRepositoryTrendResponse(
  trend: RepositoryTrendResult,
): RepositoryTrendResponse {
  if (trend.status === 'complete') {
    return {
      ...trend,
      baseline: toTrendSnapshotResponse(trend.baseline),
      latest: toTrendSnapshotResponse(trend.latest),
    };
  }

  return {
    ...trend,
    oldestAvailable: trend.oldestAvailable
      ? toTrendSnapshotResponse(trend.oldestAvailable)
      : null,
    latest: trend.latest
      ? toTrendSnapshotResponse(trend.latest)
      : null,
  };
}
