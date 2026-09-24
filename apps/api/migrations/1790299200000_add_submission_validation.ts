import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('repository_submissions', {
    validation_outcome: {
      type: 'text',
    },
    github_repository_id: {
      type: 'bigint',
    },
    resolved_owner: {
      type: 'text',
    },
    resolved_name: {
      type: 'text',
    },
    resolved_full_name: {
      type: 'text',
    },
    resolved_github_url: {
      type: 'text',
    },
    duplicate_repository_id: {
      type: 'uuid',
      references: 'repositories',
      onDelete: 'SET NULL',
    },
    validated_at: {
      type: 'timestamptz',
    },
  });

  pgm.addConstraint(
    'repository_submissions',
    'repository_submissions_validation_outcome_valid',
    {
      check:
        "validation_outcome IS NULL OR validation_outcome IN ('VALID', 'DUPLICATE', 'INVALID')",
    },
  );

  pgm.addConstraint(
    'repository_submissions',
    'repository_submissions_github_repository_id_positive',
    {
      check:
        'github_repository_id IS NULL OR github_repository_id > 0',
    },
  );

  for (const column of [
    'resolved_owner',
    'resolved_name',
    'resolved_full_name',
    'resolved_github_url',
  ]) {
    pgm.addConstraint(
      'repository_submissions',
      `repository_submissions_${column}_not_empty`,
      {
        check:
          `${column} IS NULL OR char_length(btrim(${column})) > 0`,
      },
    );
  }

  pgm.addConstraint(
    'repository_submissions',
    'repository_submissions_resolved_full_name_shape',
    {
      check: `
        resolved_full_name IS NULL
        OR resolved_full_name = resolved_owner || '/' || resolved_name
      `,
    },
  );

  pgm.addConstraint(
    'repository_submissions',
    'repository_submissions_resolved_url_shape',
    {
      check: `
        resolved_github_url IS NULL
        OR resolved_github_url = 'https://github.com/' || resolved_full_name
      `,
    },
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

  pgm.createIndex(
    'repository_submissions',
    'github_repository_id',
    {
      name: 'repository_submissions_github_repository_id_idx',
      where: 'github_repository_id IS NOT NULL',
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint(
    'repository_submissions',
    'repository_submissions_validation_shape',
  );
  pgm.dropConstraint(
    'repository_submissions',
    'repository_submissions_resolved_url_shape',
  );
  pgm.dropConstraint(
    'repository_submissions',
    'repository_submissions_resolved_full_name_shape',
  );

  for (const column of [
    'resolved_owner',
    'resolved_name',
    'resolved_full_name',
    'resolved_github_url',
  ]) {
    pgm.dropConstraint(
      'repository_submissions',
      `repository_submissions_${column}_not_empty`,
    );
  }

  pgm.dropConstraint(
    'repository_submissions',
    'repository_submissions_github_repository_id_positive',
  );
  pgm.dropConstraint(
    'repository_submissions',
    'repository_submissions_validation_outcome_valid',
  );
  pgm.dropIndex(
    'repository_submissions',
    'github_repository_id',
    {
      name: 'repository_submissions_github_repository_id_idx',
    },
  );

  pgm.dropColumns('repository_submissions', [
    'validation_outcome',
    'github_repository_id',
    'resolved_owner',
    'resolved_name',
    'resolved_full_name',
    'resolved_github_url',
    'duplicate_repository_id',
    'validated_at',
  ]);
}
