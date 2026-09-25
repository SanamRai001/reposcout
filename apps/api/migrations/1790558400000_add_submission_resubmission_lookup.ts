import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createIndex(
    'repository_submissions',
    ['normalized_full_name', 'updated_at', 'id'],
    {
      name: 'repository_submissions_terminal_full_name_updated_idx',
      where: "status <> 'PENDING'",
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex(
    'repository_submissions',
    ['normalized_full_name', 'updated_at', 'id'],
    {
      name: 'repository_submissions_terminal_full_name_updated_idx',
    },
  );
}
