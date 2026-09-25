import { randomUUID } from 'node:crypto';

import type { DatabasePool } from '../database/database.js';
import { isRepositoryId } from '../repositories/repository-catalog.js';
import type {
  ModerateRepositorySubmissionInput,
  RepositorySubmissionModerationEvent,
  RepositorySubmissionModerationResult,
} from './repository-submission-moderation.js';
import type {
  CreateRepositorySubmissionInput,
  CreateRepositorySubmissionResult,
  RecordRepositorySubmissionEvidenceHandoffInput,
  RecordRepositorySubmissionValidationInput,
  RepositorySubmissionRecord,
  RepositorySubmissionStatus,
  RepositorySubmissionValidationOutcome,
  ResolvedRepositoryIdentity,
} from './repository-submission.js';

type RepositorySubmissionModerationEventRow = {
  id: string;
  submission_id: string;
  decision: 'APPROVED' | 'REJECTED';
  reviewer_ref: string;
  reason: string;
  created_at: Date;
};

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
  handoff_repository_id: string | null;
  evidence_handoff_completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const MODERATION_EVENT_SELECT_COLUMNS = `
  id,
  submission_id,
  decision,
  reviewer_ref,
  reason,
  created_at
`;

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
  handoff_repository_id,
  evidence_handoff_completed_at,
  created_at,
  updated_at
`;

function mapModerationEvent(
  row: RepositorySubmissionModerationEventRow,
): RepositorySubmissionModerationEvent {
  return {
    id: row.id,
    submissionId: row.submission_id,
    decision: row.decision,
    reviewerRef: row.reviewer_ref,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

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
    handoffRepositoryId: row.handoff_repository_id,
    evidenceHandoffCompletedAt: row.evidence_handoff_completed_at,
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

  async listPendingValidationCandidates(
    limit: number,
  ): Promise<RepositorySubmissionRecord[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new Error(
        'Validation candidate limit must be an integer between 1 and 50.',
      );
    }

    const result = await this.pool.query<RepositorySubmissionRow>(
      `
        SELECT ${SELECT_COLUMNS}
        FROM repository_submissions
        WHERE status = 'PENDING'
          AND validation_outcome IS NULL
        ORDER BY created_at ASC, id ASC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows.map(mapRow);
  }

  async listPendingEvidenceHandoffCandidates(
    limit: number,
  ): Promise<RepositorySubmissionRecord[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new Error(
        'Evidence handoff candidate limit must be an integer between 1 and 50.',
      );
    }

    const result = await this.pool.query<RepositorySubmissionRow>(
      `
        SELECT ${SELECT_COLUMNS}
        FROM repository_submissions
        WHERE status = 'PENDING'
          AND validation_outcome = 'VALID'
          AND evidence_handoff_completed_at IS NULL
        ORDER BY validated_at ASC, id ASC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows.map(mapRow);
  }

  async recordEvidenceHandoffComplete(
    input: RecordRepositorySubmissionEvidenceHandoffInput,
  ): Promise<RepositorySubmissionRecord> {
    if (!isRepositoryId(input.submissionId)) {
      throw new Error('Submission id must be a valid UUID.');
    }

    if (!isRepositoryId(input.repositoryId)) {
      throw new Error('Handoff repository id must be a valid UUID.');
    }

    const result = await this.pool.query<RepositorySubmissionRow>(
      `
        UPDATE repository_submissions
        SET
          handoff_repository_id = $2,
          evidence_handoff_completed_at = $3,
          updated_at = current_timestamp
        WHERE id = $1
          AND status = 'PENDING'
          AND validation_outcome = 'VALID'
          AND evidence_handoff_completed_at IS NULL
        RETURNING ${SELECT_COLUMNS}
      `,
      [
        input.submissionId,
        input.repositoryId,
        input.completedAt,
      ],
    );

    const updated = result.rows[0];

    if (updated) {
      return mapRow(updated);
    }

    const current = await this.findById(input.submissionId);

    if (!current) {
      throw new Error('Submission does not exist.');
    }

    if (
      current.handoffRepositoryId !== null &&
      current.evidenceHandoffCompletedAt !== null
    ) {
      return current;
    }

    throw new Error(
      'Submission is no longer eligible for evidence handoff.',
    );
  }

  async listPendingModerationCandidates(
    limit: number,
  ): Promise<RepositorySubmissionRecord[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new Error(
        'Moderation candidate limit must be an integer between 1 and 50.',
      );
    }

    const result = await this.pool.query<RepositorySubmissionRow>(
      `
        SELECT ${SELECT_COLUMNS}
        FROM repository_submissions
        WHERE status = 'PENDING'
          AND validation_outcome = 'VALID'
          AND handoff_repository_id IS NOT NULL
          AND evidence_handoff_completed_at IS NOT NULL
        ORDER BY evidence_handoff_completed_at ASC, id ASC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows.map(mapRow);
  }

  async moderate(
    input: ModerateRepositorySubmissionInput,
  ): Promise<
    | Readonly<{
        kind: 'moderated';
        result: RepositorySubmissionModerationResult;
      }>
    | Readonly<{
        kind: 'not_found';
      }>
    | Readonly<{
        kind: 'not_eligible';
      }>
    | Readonly<{
        kind: 'already_moderated';
        decision: 'APPROVED' | 'REJECTED';
      }>
  > {
    if (!isRepositoryId(input.submissionId)) {
      throw new Error('Submission id must be a valid UUID.');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const locked = await client.query<RepositorySubmissionRow>(
        `
          SELECT ${SELECT_COLUMNS}
          FROM repository_submissions
          WHERE id = $1
          FOR UPDATE
        `,
        [input.submissionId],
      );

      const row = locked.rows[0];

      if (!row) {
        await client.query('ROLLBACK');
        return { kind: 'not_found' };
      }

      if (row.status === 'APPROVED' || row.status === 'REJECTED') {
        await client.query('ROLLBACK');
        return {
          kind: 'already_moderated',
          decision: row.status,
        };
      }

      if (
        row.status !== 'PENDING' ||
        row.validation_outcome !== 'VALID' ||
        row.handoff_repository_id === null ||
        row.evidence_handoff_completed_at === null
      ) {
        await client.query('ROLLBACK');
        return { kind: 'not_eligible' };
      }

      if (input.decision === 'APPROVED') {
        const listed = await client.query(
          `
            UPDATE repositories
            SET is_listed = true
            WHERE id = $1
          `,
          [row.handoff_repository_id],
        );

        if (listed.rowCount !== 1) {
          throw new Error(
            'Moderation approval could not publish the handoff repository.',
          );
        }
      }

      const updated = await client.query<RepositorySubmissionRow>(
        `
          UPDATE repository_submissions
          SET
            status = $2,
            updated_at = current_timestamp
          WHERE id = $1
          RETURNING ${SELECT_COLUMNS}
        `,
        [input.submissionId, input.decision],
      );

      if (!updated.rows[0]) {
        throw new Error('Moderation transition did not update the submission.');
      }

      const event = await client.query<RepositorySubmissionModerationEventRow>(
        `
          INSERT INTO repository_submission_moderation_events (
            id,
            submission_id,
            decision,
            reviewer_ref,
            reason,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING ${MODERATION_EVENT_SELECT_COLUMNS}
        `,
        [
          randomUUID(),
          input.submissionId,
          input.decision,
          input.reviewerRef,
          input.reason,
          input.decidedAt,
        ],
      );

      const eventRow = event.rows[0];

      if (!eventRow) {
        throw new Error('Moderation event was not persisted.');
      }

      await client.query('COMMIT');

      return {
        kind: 'moderated',
        result: {
          submissionId: input.submissionId,
          repositoryId: row.handoff_repository_id,
          status: input.decision,
          event: mapModerationEvent(eventRow),
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listModerationEvents(
    submissionId: string,
  ): Promise<RepositorySubmissionModerationEvent[]> {
    if (!isRepositoryId(submissionId)) {
      throw new Error('Submission id must be a valid UUID.');
    }

    const result =
      await this.pool.query<RepositorySubmissionModerationEventRow>(
        `
          SELECT ${MODERATION_EVENT_SELECT_COLUMNS}
          FROM repository_submission_moderation_events
          WHERE submission_id = $1
          ORDER BY created_at ASC, id ASC
        `,
        [submissionId],
      );

    return result.rows.map(mapModerationEvent);
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

    let updated: RepositorySubmissionRow | undefined;

    if (input.kind === 'valid') {
      assertResolvedRepository(input.repository);

      const result = await this.pool.query<RepositorySubmissionRow>(
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
      updated = result.rows[0];
    } else if (input.kind === 'duplicate') {
      assertResolvedRepository(input.repository);

      if (!isRepositoryId(input.duplicateRepositoryId)) {
        throw new Error('Duplicate repository id must be a valid UUID.');
      }

      const result = await this.pool.query<RepositorySubmissionRow>(
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
      updated = result.rows[0];
    } else {
      const result = await this.pool.query<RepositorySubmissionRow>(
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
      updated = result.rows[0];
    }

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
