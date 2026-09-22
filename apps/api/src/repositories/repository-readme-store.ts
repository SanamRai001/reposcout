import type { DatabasePool } from '../database/database.js';
import { isRepositoryId } from './repository-catalog.js';
import type {
  RepositoryReadmeRecord,
  RepositoryReadmeStatus,
  UpsertRepositoryReadmeInput,
} from './repository-readme.js';

type RepositoryReadmeRow = {
  repository_id: string;
  status: RepositoryReadmeStatus;
  source_ref: string | null;
  path: string | null;
  sha: string | null;
  size_bytes: string | null;
  content: string | null;
  observed_at: Date;
  created_at: Date;
  updated_at: Date;
};

function parseSize(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Stored README size is invalid.');
  }

  return parsed;
}

function mapRow(row: RepositoryReadmeRow): RepositoryReadmeRecord {
  return {
    repositoryId: row.repository_id,
    status: row.status,
    sourceRef: row.source_ref,
    path: row.path,
    sha: row.sha,
    sizeBytes: parseSize(row.size_bytes),
    content: row.content,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertNullableNonEmpty(name: string, value: string | null): void {
  if (value !== null && value.trim().length === 0) {
    throw new Error(`${name} must be null or non-empty.`);
  }
}

function assertInput(input: UpsertRepositoryReadmeInput): void {
  if (!isRepositoryId(input.repositoryId)) {
    throw new Error('repositoryId must be a valid repository UUID.');
  }

  assertNullableNonEmpty('sourceRef', input.sourceRef);
  assertNullableNonEmpty('path', input.path);
  assertNullableNonEmpty('sha', input.sha);

  if (
    input.sizeBytes !== null &&
    (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0)
  ) {
    throw new Error('sizeBytes must be null or a nonnegative safe integer.');
  }

  if (input.status === 'PRESENT') {
    if (
      input.sourceRef === null ||
      input.path === null ||
      input.sha === null ||
      input.sizeBytes === null ||
      input.content === null
    ) {
      throw new Error('PRESENT README input is incomplete.');
    }

    if (Buffer.byteLength(input.content, 'utf8') !== input.sizeBytes) {
      throw new Error('README content byte size does not match sizeBytes.');
    }

    return;
  }

  if (input.status === 'TOO_LARGE') {
    if (
      input.sourceRef === null ||
      input.path === null ||
      input.sha === null ||
      input.sizeBytes === null ||
      input.content !== null
    ) {
      throw new Error('TOO_LARGE README input is invalid.');
    }

    return;
  }

  if (
    input.path !== null ||
    input.sha !== null ||
    input.sizeBytes !== null ||
    input.content !== null
  ) {
    throw new Error('NOT_FOUND README input must not include file content metadata.');
  }
}

export class RepositoryReadmeStore {
  public constructor(private readonly pool: DatabasePool) {}

  async upsert(
    input: UpsertRepositoryReadmeInput,
  ): Promise<RepositoryReadmeRecord> {
    assertInput(input);

    const result = await this.pool.query<RepositoryReadmeRow>(
      `
        INSERT INTO repository_readme_content (
          repository_id,
          status,
          source_ref,
          path,
          sha,
          size_bytes,
          content,
          observed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (repository_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          source_ref = EXCLUDED.source_ref,
          path = EXCLUDED.path,
          sha = EXCLUDED.sha,
          size_bytes = EXCLUDED.size_bytes,
          content = EXCLUDED.content,
          observed_at = EXCLUDED.observed_at,
          updated_at = current_timestamp
        WHERE EXCLUDED.observed_at >= repository_readme_content.observed_at
        RETURNING
          repository_id,
          status,
          source_ref,
          path,
          sha,
          size_bytes,
          content,
          observed_at,
          created_at,
          updated_at
      `,
      [
        input.repositoryId,
        input.status,
        input.sourceRef,
        input.path,
        input.sha,
        input.sizeBytes,
        input.content,
        input.observedAt,
      ],
    );

    const row = result.rows[0];

    if (row) {
      return mapRow(row);
    }

    const current = await this.findByRepositoryId(input.repositoryId);

    if (!current) {
      throw new Error(
        'README upsert did not return or resolve existing content state.',
      );
    }

    return current;
  }

  async findByRepositoryId(
    repositoryId: string,
  ): Promise<RepositoryReadmeRecord | null> {
    if (!isRepositoryId(repositoryId)) {
      throw new Error('repositoryId must be a valid repository UUID.');
    }

    const result = await this.pool.query<RepositoryReadmeRow>(
      `
        SELECT
          repository_id,
          status,
          source_ref,
          path,
          sha,
          size_bytes,
          content,
          observed_at,
          created_at,
          updated_at
        FROM repository_readme_content
        WHERE repository_id = $1
      `,
      [repositoryId],
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }
}
