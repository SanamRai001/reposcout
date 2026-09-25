import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('repository_snapshots', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
    },
    repository_id: {
      type: 'uuid',
      notNull: true,
      references: 'repositories',
      onDelete: 'CASCADE',
    },
    captured_on: {
      type: 'date',
      notNull: true,
    },
    captured_at: {
      type: 'timestamptz',
      notNull: true,
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
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.addConstraint(
    'repository_snapshots',
    'repository_snapshots_repository_day_unique',
    {
      unique: ['repository_id', 'captured_on'],
    },
  );

  for (const column of ['stars', 'forks', 'open_issues']) {
    pgm.addConstraint(
      'repository_snapshots',
      `repository_snapshots_${column}_nonnegative`,
      {
        check: `${column} >= 0`,
      },
    );
  }

  pgm.addConstraint(
    'repository_snapshots',
    'repository_snapshots_captured_on_matches_utc_day',
    {
      check:
        "captured_on = ((captured_at AT TIME ZONE 'UTC')::date)",
    },
  );

  pgm.createIndex(
    'repository_snapshots',
    ['repository_id', { name: 'captured_at', sort: 'DESC' }],
    {
      name: 'repository_snapshots_repository_captured_at_idx',
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('repository_snapshots');
}
