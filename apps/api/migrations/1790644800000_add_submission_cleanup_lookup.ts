import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createIndex(
    'repository_submissions',
    ['updated_at', 'id'],
    {
      name: 'repository_submissions_cleanup_candidates_idx',
      where: `
        status IN ('INVALID', 'DUPLICATE')
        AND handoff_repository_id IS NULL
        AND evidence_handoff_completed_at IS NULL
      `,
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex(
    'repository_submissions',
    ['updated_at', 'id'],
    {
      name: 'repository_submissions_cleanup_candidates_idx',
    },
  );
}
