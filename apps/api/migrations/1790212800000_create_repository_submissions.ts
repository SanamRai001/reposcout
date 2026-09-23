import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('repository_submissions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
    },
    submitted_url: {
      type: 'text',
      notNull: true,
    },
    normalized_owner: {
      type: 'text',
      notNull: true,
    },
    normalized_name: {
      type: 'text',
      notNull: true,
    },
    normalized_full_name: {
      type: 'text',
      notNull: true,
    },
    status: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.addConstraint(
    'repository_submissions',
    'repository_submissions_status_valid',
    {
      check:
        "status IN ('PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'INVALID')",
    },
  );

  for (const column of [
    'submitted_url',
    'normalized_owner',
    'normalized_name',
    'normalized_full_name',
  ]) {
    pgm.addConstraint(
      'repository_submissions',
      `repository_submissions_${column}_not_empty`,
      {
        check: `char_length(btrim(${column})) > 0`,
      },
    );
  }

  pgm.addConstraint(
    'repository_submissions',
    'repository_submissions_normalized_owner_lowercase',
    {
      check: 'normalized_owner = lower(normalized_owner)',
    },
  );

  pgm.addConstraint(
    'repository_submissions',
    'repository_submissions_normalized_name_lowercase',
    {
      check: 'normalized_name = lower(normalized_name)',
    },
  );

  pgm.addConstraint(
    'repository_submissions',
    'repository_submissions_normalized_full_name_shape',
    {
      check:
        "normalized_full_name = normalized_owner || '/' || normalized_name",
    },
  );

  pgm.addConstraint(
    'repository_submissions',
    'repository_submissions_submitted_url_shape',
    {
      check:
        "submitted_url = 'https://github.com/' || normalized_full_name",
    },
  );

  pgm.createIndex(
    'repository_submissions',
    'normalized_full_name',
    {
      name: 'repository_submissions_pending_full_name_unique',
      unique: true,
      where: "status = 'PENDING'",
    },
  );

  pgm.createIndex('repository_submissions', ['status', 'created_at'], {
    name: 'repository_submissions_status_created_at_idx',
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('repository_submissions');
}
