import { randomUUID } from 'node:crypto';

import type { DatabasePool } from '../database/database.js';
import { isRepositoryId } from '../repositories/repository-catalog.js';
import type {
  CreateRepositorySubmissionInput,
  CreateRepositorySubmissionResult,
  RecordRepositorySubmissionValidationInput,
  RepositorySubmissionRecord,
  RepositorySubmissionStatus,
  RepositorySubmissionValidationOutcome,
  ResolvedRepositoryIdentity,
} from './repository-submission.js';

type RepositorySubmissionRow = {
  id: string;
  submitted_url: string;
  normalized_owner: string;
  normalized_name: string;
  normalized_full_name: string;
  status: RepositorySubmissionStatus;
  validation_outcome: RepositorySubmissionValidationOutcome | null;
  github_repository_id: string | null;
  resolved_owner: string | null;
  resolved_name: string | null;
  resolved_full_name: string | null;
  resolved_github_url: string | null;
  duplicate_repository_id: string | null;
  validated_at: Date | null;
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
  validation_outcome,
  github_repository_id,
  resolved_owner,
  resolved_name,
  resolved_full_name,
  resolved_github_url,
  duplicate_repository_id,
  validated_at,
  created_at,
  updated_at
`;

function mapResolvedRepository(
  row: RepositorySubmissionRow,
): ResolvedRepositoryIdentity | null {
  if (
    row.github_repository_id === null ||
    row.resolved_owner === null ||
    row.resolved_name === null ||
    row.resolved_full_name === null ||
    row.resolved_github_url === null
  ) {
    return null;
  }

  return {
    githubRepositoryId: row.github_repository_id,
    owner: row.resolved_owner,
    name: row.resolved_name,
    fullName: row.resolved_full_name,
    githubUrl: row.resolved_github_url,
  };
}

function mapRow(row: RepositorySubmissionRow): RepositorySubmissionRecord {
  return {
    id: row.id,
    submittedUrl: row.submitted_url,
    normalizedOwner: row.normalized_owner,
    normalizedName: row.normalized_name,
    normalizedFullName: row.normalized_full_name,
    status: row.status,
    validationOutcome: row.validation_outcome,
    resolvedRepository: mapResolvedRepository(row),
    duplicateRepositoryId: row.duplicate_repository_id,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertResolvedRepository(
  repository: ResolvedRepositoryIdentity,
): void {
  if (!/^[1-9]\d*$/.test(repository.githubRepositoryId)) {
    throw new Error(
      'Resolved GitHub repository id must be a positive base-10 integer string.',
    );
  }

  for (const [name, value] of [
    ['owner', repository.owner],
    ['name', repository.name],
    ['fullName', repository.fullName],
    ['githubUrl', repository.githubUrl],
  ] as const) {
    if (value.trim().length === 0) {
      throw new Error(`Resolved repository ${name} must be non-empty.`);
    }
  }

  if (repository.fullName !== `${repository.owner}/${repository.name}`) {
    throw new Error('Resolved repository fullName is inconsistent.');
  }

  if (repository.githubUrl !== `https://github.com/${repository.fullName}`) {
    throw new Error('Resolved repository githubUrl is inconsistent.');
  }
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

  async findById(id: string): Promise<RepositorySubmissionRecord | null> {
    if (!isRepositoryId(id)) {
      throw new Error('Submission id must be a valid UUID.');
    }

    const result = await this.pool.query<RepositorySubmissionRow>(
      `
        SELECT ${SELECT_COLUMNS}
        FROM repository_submissions
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
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

  async recordValidation(
    input: RecordRepositorySubmissionValidationInput,
  ): Promise<RepositorySubmissionRecord> {
    if (!isRepositoryId(input.submissionId)) {
      throw new Error('Submission id must be a valid UUID.');
    }

    let result;

    if (input.kind === 'valid') {
      assertResolvedRepository(input.repository);

      result = await this.pool.query<RepositorySubmissionRow>(
        `
          UPDATE repository_submissions
          SET
            status = 'PENDING',
            validation_outcome = 'VALID',
            github_repository_id = $2,
            resolved_owner = $3,
            resolved_name = $4,
            resolved_full_name = $5,
            resolved_github_url = $6,
            duplicate_repository_id = NULL,
            validated_at = $7,
            updated_at = current_timestamp
          WHERE id = $1
            AND status = 'PENDING'
            AND validation_outcome IS NULL
          RETURNING ${SELECT_COLUMNS}
        `,
        [
          input.submissionId,
          input.repository.githubRepositoryId,
          input.repository.owner,
          input.repository.name,
          input.repository.fullName,
          input.repository.githubUrl,
          input.validatedAt,
        ],
      );
    } else if (input.kind === 'duplicate') {
      assertResolvedRepository(input.repository);

      if (!isRepositoryId(input.duplicateRepositoryId)) {
        throw new Error('Duplicate repository id must be a valid UUID.');
      }

      result = await this.pool.query<RepositorySubmissionRow>(
        `
          UPDATE repository_submissions
          SET
            status = 'DUPLICATE',
            validation_outcome = 'DUPLICATE',
            github_repository_id = $2,
            resolved_owner = $3,
            resolved_name = $4,
            resolved_full_name = $5,
            resolved_github_url = $6,
            duplicate_repository_id = $7,
            validated_at = $8,
            updated_at = current_timestamp
          WHERE id = $1
            AND status = 'PENDING'
            AND validation_outcome IS NULL
          RETURNING ${SELECT_COLUMNS}
        `,
        [
          input.submissionId,
          input.repository.githubRepositoryId,
          input.repository.owner,
          input.repository.name,
          input.repository.fullName,
          input.repository.githubUrl,
          input.duplicateRepositoryId,
          input.validatedAt,
        ],
      );
    } else {
      result = await this.pool.query<RepositorySubmissionRow>(
        `
          UPDATE repository_submissions
          SET
            status = 'INVALID',
            validation_outcome = 'INVALID',
            github_repository_id = NULL,
            resolved_owner = NULL,
            resolved_name = NULL,
            resolved_full_name = NULL,
            resolved_github_url = NULL,
            duplicate_repository_id = NULL,
            validated_at = $2,
            updated_at = current_timestamp
          WHERE id = $1
            AND status = 'PENDING'
            AND validation_outcome IS NULL
          RETURNING ${SELECT_COLUMNS}
        `,
        [input.submissionId, input.validatedAt],
      );
    }

    const updated = result.rows[0];

    if (updated) {
      return mapRow(updated);
    }

    const current = await this.findById(input.submissionId);

    if (!current) {
      throw new Error('Submission does not exist.');
    }

    if (current.validationOutcome !== null) {
      return current;
    }

    throw new Error('Submission is no longer eligible for validation.');
  }
}
