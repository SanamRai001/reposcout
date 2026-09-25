import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('repositories', {
    is_listed: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
  });

  pgm.sql(`
    UPDATE repositories
    SET is_listed = false
    WHERE id IN (
      SELECT handoff_repository_id
      FROM repository_submissions
      WHERE status = 'PENDING'
        AND validation_outcome = 'VALID'
        AND evidence_handoff_completed_at IS NOT NULL
        AND handoff_repository_id IS NOT NULL
    )
  `);

  pgm.dropConstraint(
    'repository_submissions',
    'repository_submissions_validation_shape',
  );

  pgm.addConstraint(
    'repository_submissions',
    'repository_submissions_validation_shape',
    {
      check: `
        (
          validation_outcome IS NULL
          AND github_repository_id IS NULL
          AND resolved_owner IS NULL
          AND resolved_name IS NULL
          AND resolved_full_name IS NULL
          AND resolved_github_url IS NULL
          AND duplicate_repository_id IS NULL
          AND validated_at IS NULL
        )
        OR
        (
          validation_outcome = 'VALID'
          AND status IN ('PENDING', 'APPROVED', 'REJECTED')
          AND github_repository_id IS NOT NULL
          AND resolved_owner IS NOT NULL
          AND resolved_name IS NOT NULL
          AND resolved_full_name IS NOT NULL
          AND resolved_github_url IS NOT NULL
          AND duplicate_repository_id IS NULL
          AND validated_at IS NOT NULL
        )
        OR
        (
          validation_outcome = 'DUPLICATE'
          AND status = 'DUPLICATE'
          AND github_repository_id IS NOT NULL
          AND resolved_owner IS NOT NULL
          AND resolved_name IS NOT NULL
          AND resolved_full_name IS NOT NULL
          AND resolved_github_url IS NOT NULL
          AND duplicate_repository_id IS NOT NULL
          AND validated_at IS NOT NULL
        )
        OR
        (
          validation_outcome = 'INVALID'
          AND status = 'INVALID'
          AND github_repository_id IS NULL
          AND resolved_owner IS NULL
          AND resolved_name IS NULL
          AND resolved_full_name IS NULL
          AND resolved_github_url IS NULL
          AND duplicate_repository_id IS NULL
          AND validated_at IS NOT NULL
        )
      `,
    },
  );

  pgm.createTable('repository_submission_moderation_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
    },
    submission_id: {
      type: 'uuid',
      notNull: true,
      references: 'repository_submissions',
    },
    decision: {
      type: 'text',
      notNull: true,
    },
    reviewer_ref: {
      type: 'text',
      notNull: true,
    },
    reason: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
    },
  });

  pgm.addConstraint(
    'repository_submission_moderation_events',
    'repository_submission_moderation_events_decision_valid',
    {
      check: "decision IN ('APPROVED', 'REJECTED')",
    },
  );

  pgm.addConstraint(
    'repository_submission_moderation_events',
    'repository_submission_moderation_events_reviewer_ref_valid',
    {
      check: `
        char_length(btrim(reviewer_ref)) BETWEEN 1 AND 200
      `,
    },
  );

  pgm.addConstraint(
    'repository_submission_moderation_events',
    'repository_submission_moderation_events_reason_valid',
    {
      check: `
        char_length(btrim(reason)) BETWEEN 1 AND 2000
      `,
    },
  );

  pgm.createIndex(
    'repository_submission_moderation_events',
    'submission_id',
    {
      name: 'repository_submission_moderation_events_submission_unique',
      unique: true,
    },
  );

  pgm.createIndex(
    'repository_submissions',
    ['evidence_handoff_completed_at', 'id'],
    {
      name: 'repository_submissions_moderation_candidates_idx',
      where: `
        status = 'PENDING'
        AND validation_outcome = 'VALID'
        AND evidence_handoff_completed_at IS NOT NULL
        AND handoff_repository_id IS NOT NULL
      `,
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex(
    'repository_submissions',
    ['evidence_handoff_completed_at', 'id'],
    {
      name: 'repository_submissions_moderation_candidates_idx',
    },
  );

  pgm.dropTable('repository_submission_moderation_events');

  pgm.dropConstraint(
    'repository_submissions',
    'repository_submissions_validation_shape',
  );

  pgm.sql(`
    UPDATE repository_submissions
    SET status = 'PENDING'
    WHERE validation_outcome = 'VALID'
      AND status IN ('APPROVED', 'REJECTED')
  `);

  pgm.addConstraint(
    'repository_submissions',
    'repository_submissions_validation_shape',
    {
      check: `
        (
          validation_outcome IS NULL
          AND github_repository_id IS NULL
          AND resolved_owner IS NULL
          AND resolved_name IS NULL
          AND resolved_full_name IS NULL
          AND resolved_github_url IS NULL
          AND duplicate_repository_id IS NULL
          AND validated_at IS NULL
        )
        OR
        (
          validation_outcome = 'VALID'
          AND status = 'PENDING'
          AND github_repository_id IS NOT NULL
          AND resolved_owner IS NOT NULL
          AND resolved_name IS NOT NULL
          AND resolved_full_name IS NOT NULL
          AND resolved_github_url IS NOT NULL
          AND duplicate_repository_id IS NULL
          AND validated_at IS NOT NULL
        )
        OR
        (
          validation_outcome = 'DUPLICATE'
          AND status = 'DUPLICATE'
          AND github_repository_id IS NOT NULL
          AND resolved_owner IS NOT NULL
          AND resolved_name IS NOT NULL
          AND resolved_full_name IS NOT NULL
          AND resolved_github_url IS NOT NULL
          AND duplicate_repository_id IS NOT NULL
          AND validated_at IS NOT NULL
        )
        OR
        (
          validation_outcome = 'INVALID'
          AND status = 'INVALID'
          AND github_repository_id IS NULL
          AND resolved_owner IS NULL
          AND resolved_name IS NULL
          AND resolved_full_name IS NULL
          AND resolved_github_url IS NULL
          AND duplicate_repository_id IS NULL
          AND validated_at IS NOT NULL
        )
      `,
    },
  );

  pgm.dropColumns('repositories', ['is_listed']);
}
