import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('repository_contribution_issues', {
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
    },
    number: {
      type: 'integer',
      notNull: true,
    },
    title: {
      type: 'text',
      notNull: true,
    },
    github_url: {
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
    'repository_contribution_issues',
    'repository_contribution_issues_github_issue_unique',
    {
      unique: ['github_issue_id'],
    },
  );

  pgm.addConstraint(
    'repository_contribution_issues',
    'repository_contribution_issues_repository_number_unique',
    {
      unique: ['repository_id', 'number'],
    },
  );

  pgm.addConstraint(
    'repository_contribution_issues',
    'repository_contribution_issues_github_issue_positive',
    {
      check: 'github_issue_id > 0',
    },
  );

  pgm.addConstraint(
    'repository_contribution_issues',
    'repository_contribution_issues_number_positive',
    {
      check: 'number > 0',
    },
  );

  pgm.addConstraint(
    'repository_contribution_issues',
    'repository_contribution_issues_title_nonempty',
    {
      check: "length(btrim(title)) > 0",
    },
  );

  pgm.addConstraint(
    'repository_contribution_issues',
    'repository_contribution_issues_state_valid',
    {
      check: "state IN ('open', 'closed')",
    },
  );

  for (const column of ['assignee_count', 'comment_count']) {
    pgm.addConstraint(
      'repository_contribution_issues',
      `repository_contribution_issues_${column}_nonnegative`,
      {
        check: `${column} >= 0`,
      },
    );
  }

  pgm.addConstraint(
    'repository_contribution_issues',
    'repository_contribution_issues_updated_after_created',
    {
      check: 'updated_at_github >= created_at_github',
    },
  );

  pgm.createIndex(
    'repository_contribution_issues',
    [
      'repository_id',
      'state',
      { name: 'updated_at_github', sort: 'DESC' },
      'id',
    ],
    {
      name: 'repository_contribution_issues_repo_state_updated_idx',
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('repository_contribution_issues');
}
