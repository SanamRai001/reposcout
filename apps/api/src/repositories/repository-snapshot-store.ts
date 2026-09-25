import { randomUUID } from 'node:crypto';

import type { DatabasePool } from '../database/database.js';
import { isRepositoryId } from './repository-catalog.js';
import type {
  CaptureRepositorySnapshotInput,
  CaptureRepositorySnapshotResult,
  RepositorySnapshotRecord,
} from './repository-snapshot.js';

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
}
