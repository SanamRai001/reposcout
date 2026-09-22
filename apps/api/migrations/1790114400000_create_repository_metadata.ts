import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('repository_metadata', {
    repository_id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
      references: 'repositories',
      onDelete: 'CASCADE',
    },
    stars: {
      type: 'bigint',
      notNull: true,
    },
    forks: {
      type: 'bigint',
      notNull: true,
    },
    open_issues: {
      type: 'bigint',
      notNull: true,
    },
    primary_language: {
      type: 'text',
    },
    license_spdx: {
      type: 'text',
    },
    topics: {
      type: 'text[]',
      notNull: true,
      default: '{}',
    },
    observed_at: {
      type: 'timestamptz',
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

  for (const column of ['stars', 'forks', 'open_issues']) {
    pgm.addConstraint(
      'repository_metadata',
      `repository_metadata_${column}_nonnegative`,
      {
        check: `${column} >= 0`,
      },
    );
  }

  pgm.addConstraint(
    'repository_metadata',
    'repository_metadata_primary_language_not_empty',
    {
      check:
        'primary_language IS NULL OR char_length(btrim(primary_language)) > 0',
    },
  );

  pgm.addConstraint(
    'repository_metadata',
    'repository_metadata_license_spdx_not_empty',
    {
      check: "license_spdx IS NULL OR char_length(btrim(license_spdx)) > 0",
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('repository_metadata');
}
