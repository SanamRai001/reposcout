import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('repository_readme_content', {
    repository_id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
      references: 'repositories',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'text',
      notNull: true,
    },
    source_ref: {
      type: 'text',
    },
    path: {
      type: 'text',
    },
    sha: {
      type: 'text',
    },
    size_bytes: {
      type: 'bigint',
    },
    content: {
      type: 'text',
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

  pgm.addConstraint(
    'repository_readme_content',
    'repository_readme_content_status_valid',
    {
      check: "status IN ('PRESENT', 'NOT_FOUND', 'TOO_LARGE')",
    },
  );

  pgm.addConstraint(
    'repository_readme_content',
    'repository_readme_content_size_nonnegative',
    {
      check: 'size_bytes IS NULL OR size_bytes >= 0',
    },
  );

  pgm.addConstraint(
    'repository_readme_content',
    'repository_readme_content_source_ref_not_empty',
    {
      check: "source_ref IS NULL OR char_length(btrim(source_ref)) > 0",
    },
  );

  pgm.addConstraint(
    'repository_readme_content',
    'repository_readme_content_path_not_empty',
    {
      check: "path IS NULL OR char_length(btrim(path)) > 0",
    },
  );

  pgm.addConstraint(
    'repository_readme_content',
    'repository_readme_content_sha_not_empty',
    {
      check: "sha IS NULL OR char_length(btrim(sha)) > 0",
    },
  );

  pgm.addConstraint(
    'repository_readme_content',
    'repository_readme_content_shape_valid',
    {
      check: `
        (
          status = 'PRESENT'
          AND source_ref IS NOT NULL
          AND path IS NOT NULL
          AND sha IS NOT NULL
          AND size_bytes IS NOT NULL
          AND content IS NOT NULL
        )
        OR
        (
          status = 'TOO_LARGE'
          AND source_ref IS NOT NULL
          AND path IS NOT NULL
          AND sha IS NOT NULL
          AND size_bytes IS NOT NULL
          AND content IS NULL
        )
        OR
        (
          status = 'NOT_FOUND'
          AND path IS NULL
          AND sha IS NULL
          AND size_bytes IS NULL
          AND content IS NULL
        )
      `,
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('repository_readme_content');
}
