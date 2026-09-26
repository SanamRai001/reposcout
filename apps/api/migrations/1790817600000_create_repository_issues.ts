import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('repository_issues', {
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
    github_issue_id: {
      type: 'bigint',
      notNull: true,
      unique: true,
    },
    issue_number: {
      type: 'integer',
      notNull: true,
    },
    title: {
      type: 'text',
      notNull: true,
    },
    html_url: {
      type: 'text',
      notNull: true,
    },
    state: {
      type: 'text',
      notNull: true,
    },
    locked: {
      type: 'boolean',
      notNull: true,
    },
    assignee_count: {
      type: 'integer',
      notNull: true,
    },
    comment_count: {
      type: 'integer',
      notNull: true,
    },
    labels: {
      type: 'text[]',
      notNull: true,
      default: '{}',
    },
    created_at_github: {
      type: 'timestamptz',
      notNull: true,
    },
    updated_at_github: {
      type: 'timestamptz',
      notNull: true,
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
    'repository_issues',
    'repository_issues_repository_number_unique',
    {
      unique: ['repository_id', 'issue_number'],
    },
  );

  pgm.addConstraint(
    'repository_issues',
    'repository_issues_state_valid',
    {
      check: "state IN ('open', 'closed')",
    },
  );

  pgm.addConstraint(
    'repository_issues',
    'repository_issues_issue_number_positive',
    {
      check: 'issue_number > 0',
    },
  );

  for (const column of ['assignee_count', 'comment_count']) {
    pgm.addConstraint(
      'repository_issues',
      `repository_issues_${column}_nonnegative`,
      {
        check: `${column} >= 0`,
      },
    );
  }

  pgm.addConstraint(
    'repository_issues',
    'repository_issues_github_dates_valid',
    {
      check: 'updated_at_github >= created_at_github',
    },
  );

  pgm.createIndex(
    'repository_issues',
    [
      'repository_id',
      'state',
      { name: 'updated_at_github', sort: 'DESC' },
      'id',
    ],
    {
      name: 'repository_issues_discovery_idx',
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('repository_issues');
}
