import { randomUUID } from 'node:crypto';

import type { DatabasePool } from '../database/database.js';
import type {
  CreateRepositorySubmissionInput,
  CreateRepositorySubmissionResult,
  RepositorySubmissionRecord,
  RepositorySubmissionStatus,
} from './repository-submission.js';

type RepositorySubmissionRow = {
  id: string;
  submitted_url: string;
  normalized_owner: string;
  normalized_name: string;
  normalized_full_name: string;
  status: RepositorySubmissionStatus;
  created_at: Date;
  updated_at: Date;
};

const SELECT_COLUMNS = `
  id,
  submitted_url,
  normalized_owner,
  normalized_name,
  normalized_full_name,
  status,
  created_at,
  updated_at
`;

function mapRow(row: RepositorySubmissionRow): RepositorySubmissionRecord {
  return {
    id: row.id,
    submittedUrl: row.submitted_url,
    normalizedOwner: row.normalized_owner,
    normalizedName: row.normalized_name,
    normalizedFullName: row.normalized_full_name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RepositorySubmissionStore {
  public constructor(private readonly pool: DatabasePool) {}

  async createPending(
    input: CreateRepositorySubmissionInput,
  ): Promise<CreateRepositorySubmissionResult> {
    const result = await this.pool.query<RepositorySubmissionRow>(
      `
        INSERT INTO repository_submissions (
          id,
          submitted_url,
          normalized_owner,
          normalized_name,
          normalized_full_name,
          status
        )
        VALUES ($1, $2, $3, $4, $5, 'PENDING')
        ON CONFLICT DO NOTHING
        RETURNING ${SELECT_COLUMNS}
      `,
      [
        randomUUID(),
        input.submittedUrl,
        input.normalizedOwner,
        input.normalizedName,
        input.normalizedFullName,
      ],
    );

    const created = result.rows[0];

    if (created) {
      return {
        kind: 'created',
        submission: mapRow(created),
      };
    }

    const existing = await this.findPendingByNormalizedFullName(
      input.normalizedFullName,
    );

    if (!existing) {
      throw new Error(
        'Submission insert conflicted without resolving an existing pending submission.',
      );
    }

    return {
      kind: 'pending_duplicate',
      submission: existing,
    };
  }

  async findPendingByNormalizedFullName(
    normalizedFullName: string,
  ): Promise<RepositorySubmissionRecord | null> {
    const result = await this.pool.query<RepositorySubmissionRow>(
      `
        SELECT ${SELECT_COLUMNS}
        FROM repository_submissions
        WHERE normalized_full_name = $1
          AND status = 'PENDING'
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `,
      [normalizedFullName],
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }
}
