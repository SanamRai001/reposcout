import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createIndex(
    'repository_contribution_issues',
    [
      'state',
      { name: 'updated_at_github', sort: 'DESC' },
      'id',
    ],
    {
      name: 'repository_contribution_issues_discovery_updated_idx',
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex(
    'repository_contribution_issues',
    [
      'state',
      { name: 'updated_at_github', sort: 'DESC' },
      'id',
    ],
    {
      name: 'repository_contribution_issues_discovery_updated_idx',
    },
  );
}
