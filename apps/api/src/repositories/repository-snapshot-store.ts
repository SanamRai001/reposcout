import { randomUUID } from 'node:crypto';

import type { DatabasePool } from '../database/database.js';
import { isRepositoryId } from './repository-catalog.js';
import type {
  CaptureRepositorySnapshotInput,
  CaptureRepositorySnapshotResult,
  RepositorySnapshotBackfillCandidate,
  RepositorySnapshotRecord,
} from './repository-snapshot.js';
import {
  MAX_REPOSITORY_TREND_WINDOW_DAYS,
  toTrendSnapshot,
  type RepositoryTrendResult,
} from './repository-trend.js';

type RepositorySnapshotRow = Readonly<{
  id: string;
  repository_id: string;
  captured_on: string;
  captured_at: Date;
  stars: string;
  forks: string;
  open_issues: string;
  created_at: Date;
}>;

function parseCount(name: string, value: string): number {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Stored snapshot ${name} is invalid.`);
  }

  return parsed;
}

function mapRow(row: RepositorySnapshotRow): RepositorySnapshotRecord {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    capturedOn: row.captured_on,
    capturedAt: row.captured_at,
    stars: parseCount('stars', row.stars),
    forks: parseCount('forks', row.forks),
    openIssues: parseCount('openIssues', row.open_issues),
    createdAt: row.created_at,
  };
}

function assertCount(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a nonnegative safe integer.`);
  }
}

function capturedOnUtc(capturedAt: Date): string {
  if (!(capturedAt instanceof Date) || Number.isNaN(capturedAt.getTime())) {
    throw new Error('capturedAt must be a valid date.');
  }

  return capturedAt.toISOString().slice(0, 10);
}

function assertLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 365) {
    throw new Error('limit must be an integer between 1 and 365.');
  }
}


function shiftUtcDay(day: string, deltaDays: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Stored snapshot capturedOn is invalid.');
  }

  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function utcDayDifference(earlier: string, later: string): number {
  const earlierMs = Date.parse(`${earlier}T00:00:00.000Z`);
  const laterMs = Date.parse(`${later}T00:00:00.000Z`);

  if (!Number.isFinite(earlierMs) || !Number.isFinite(laterMs)) {
    throw new Error('Stored snapshot capturedOn is invalid.');
  }

  return Math.round((laterMs - earlierMs) / 86_400_000);
}

function assertTrendWindow(windowDays: number): void {
  if (
    !Number.isInteger(windowDays) ||
    windowDays < 1 ||
    windowDays > MAX_REPOSITORY_TREND_WINDOW_DAYS
  ) {
    throw new Error(
      'windowDays must be an integer between 1 and 365.',
    );
  }
}

export class RepositorySnapshotStore {
  public constructor(private readonly pool: DatabasePool) {}

  async captureDaily(
    input: CaptureRepositorySnapshotInput,
  ): Promise<CaptureRepositorySnapshotResult> {
    if (!isRepositoryId(input.repositoryId)) {
      throw new Error('repositoryId must be a valid repository UUID.');
    }

    assertCount('stars', input.stars);
    assertCount('forks', input.forks);
    assertCount('openIssues', input.openIssues);

    const capturedOn = capturedOnUtc(input.capturedAt);
    const result = await this.pool.query<RepositorySnapshotRow>(
      `
        INSERT INTO repository_snapshots (
          id,
          repository_id,
          captured_on,
          captured_at,
          stars,
          forks,
          open_issues
        )
        VALUES ($1, $2, $3::date, $4, $5, $6, $7)
        ON CONFLICT (repository_id, captured_on) DO NOTHING
        RETURNING
          id,
          repository_id,
          captured_on::text,
          captured_at,
          stars,
          forks,
          open_issues,
          created_at
      `,
      [
        randomUUID(),
        input.repositoryId,
        capturedOn,
        input.capturedAt,
        input.stars,
        input.forks,
        input.openIssues,
      ],
    );

    const inserted = result.rows[0];

    if (inserted) {
      return {
        kind: 'created',
        snapshot: mapRow(inserted),
      };
    }

    const existing = await this.pool.query<RepositorySnapshotRow>(
      `
        SELECT
          id,
          repository_id,
          captured_on::text,
          captured_at,
          stars,
          forks,
          open_issues,
          created_at
        FROM repository_snapshots
        WHERE repository_id = $1
          AND captured_on = $2::date
      `,
      [input.repositoryId, capturedOn],
    );

    const row = existing.rows[0];

    if (!row) {
      throw new Error(
        'Snapshot conflict did not resolve to an existing daily snapshot.',
      );
    }

    return {
      kind: 'existing',
      snapshot: mapRow(row),
    };
  }

  async listRecent(
    repositoryId: string,
    limit: number,
  ): Promise<RepositorySnapshotRecord[]> {
    if (!isRepositoryId(repositoryId)) {
      throw new Error('repositoryId must be a valid repository UUID.');
    }

    assertLimit(limit);

    const result = await this.pool.query<RepositorySnapshotRow>(
      `
        SELECT
          id,
          repository_id,
          captured_on::text,
          captured_at,
          stars,
          forks,
          open_issues,
          created_at
        FROM repository_snapshots
        WHERE repository_id = $1
        ORDER BY captured_at DESC, id DESC
        LIMIT $2
      `,
      [repositoryId, limit],
    );

    return result.rows.map(mapRow);
  }
  async listLatestMetadataBackfillCandidates(
    limit: number,
  ): Promise<RepositorySnapshotBackfillCandidate[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new Error(
        'backfill limit must be an integer between 1 and 500.',
      );
    }

    const result = await this.pool.query<{
      repository_id: string;
      full_name: string;
      observed_at: Date;
      stars: string;
      forks: string;
      open_issues: string;
    }>(
      `
        SELECT
          r.id AS repository_id,
          r.full_name,
          m.observed_at,
          m.stars,
          m.forks,
          m.open_issues
        FROM repository_metadata AS m
        INNER JOIN repositories AS r
          ON r.id = m.repository_id
        WHERE NOT EXISTS (
          SELECT 1
          FROM repository_snapshots AS s
          WHERE s.repository_id = m.repository_id
            AND s.captured_on =
              ((m.observed_at AT TIME ZONE 'UTC')::date)
        )
        ORDER BY m.observed_at ASC, r.id ASC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows.map((row) => ({
      repositoryId: row.repository_id,
      fullName: row.full_name,
      observedAt: row.observed_at,
      stars: parseCount('stars', row.stars),
      forks: parseCount('forks', row.forks),
      openIssues: parseCount('openIssues', row.open_issues),
    }));
  }

  async readTrend(
    repositoryId: string,
    windowDays: number,
  ): Promise<RepositoryTrendResult> {
    if (!isRepositoryId(repositoryId)) {
      throw new Error('repositoryId must be a valid repository UUID.');
    }

    assertTrendWindow(windowDays);

    const latestResult = await this.pool.query<RepositorySnapshotRow>(
      `
        SELECT
          id,
          repository_id,
          captured_on::text,
          captured_at,
          stars,
          forks,
          open_issues,
          created_at
        FROM repository_snapshots
        WHERE repository_id = $1
        ORDER BY captured_on DESC, captured_at DESC, id DESC
        LIMIT 1
      `,
      [repositoryId],
    );
    const latestRow = latestResult.rows[0];

    if (!latestRow) {
      return {
        status: 'insufficient_history',
        reason: 'no_snapshots',
        repositoryId,
        requestedWindowDays: windowDays,
        cutoffOn: null,
        availableWindowDays: null,
        oldestAvailable: null,
        latest: null,
      };
    }

    const latest = mapRow(latestRow);
    const cutoffOn = shiftUtcDay(latest.capturedOn, -windowDays);
    const baselineResult = await this.pool.query<RepositorySnapshotRow>(
      `
        SELECT
          id,
          repository_id,
          captured_on::text,
          captured_at,
          stars,
          forks,
          open_issues,
          created_at
        FROM repository_snapshots
        WHERE repository_id = $1
          AND captured_on <= $2::date
        ORDER BY captured_on DESC, captured_at DESC, id DESC
        LIMIT 1
      `,
      [repositoryId, cutoffOn],
    );
    const baselineRow = baselineResult.rows[0];

    if (baselineRow) {
      const baseline = mapRow(baselineRow);

      return {
        status: 'complete',
        repositoryId,
        requestedWindowDays: windowDays,
        cutoffOn,
        actualWindowDays: utcDayDifference(
          baseline.capturedOn,
          latest.capturedOn,
        ),
        baseline: toTrendSnapshot(baseline),
        latest: toTrendSnapshot(latest),
        delta: {
          stars: latest.stars - baseline.stars,
          forks: latest.forks - baseline.forks,
          openIssues: latest.openIssues - baseline.openIssues,
        },
      };
    }

    const oldestResult = await this.pool.query<RepositorySnapshotRow>(
      `
        SELECT
          id,
          repository_id,
          captured_on::text,
          captured_at,
          stars,
          forks,
          open_issues,
          created_at
        FROM repository_snapshots
        WHERE repository_id = $1
        ORDER BY captured_on ASC, captured_at ASC, id ASC
        LIMIT 1
      `,
      [repositoryId],
    );
    const oldestRow = oldestResult.rows[0];

    if (!oldestRow) {
      throw new Error(
        'Latest repository snapshot disappeared during trend read.',
      );
    }

    const oldest = mapRow(oldestRow);

    return {
      status: 'insufficient_history',
      reason: 'window_not_covered',
      repositoryId,
      requestedWindowDays: windowDays,
      cutoffOn,
      availableWindowDays: utcDayDifference(
        oldest.capturedOn,
        latest.capturedOn,
      ),
      oldestAvailable: toTrendSnapshot(oldest),
      latest: toTrendSnapshot(latest),
    };
  }


}
