import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('repository_submissions', {
    handoff_repository_id: {
      type: 'uuid',
      references: 'repositories',
    },
    evidence_handoff_completed_at: {
      type: 'timestamptz',
    },
  });

  pgm.addConstraint(
    'repository_submissions',
    'repository_submissions_evidence_handoff_shape',
    {
      check: `
        (
          handoff_repository_id IS NULL
          AND evidence_handoff_completed_at IS NULL
        )
        OR
        (
          handoff_repository_id IS NOT NULL
          AND evidence_handoff_completed_at IS NOT NULL
          AND validation_outcome = 'VALID'
        )
      `,
    },
  );

  pgm.createIndex(
    'repository_submissions',
    ['validated_at', 'id'],
    {
      name: 'repository_submissions_evidence_handoff_candidates_idx',
      where: `
        status = 'PENDING'
        AND validation_outcome = 'VALID'
        AND evidence_handoff_completed_at IS NULL
      `,
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex(
    'repository_submissions',
    ['validated_at', 'id'],
    {
      name: 'repository_submissions_evidence_handoff_candidates_idx',
    },
  );

  pgm.dropConstraint(
    'repository_submissions',
    'repository_submissions_evidence_handoff_shape',
  );

  pgm.dropColumns('repository_submissions', [
    'handoff_repository_id',
    'evidence_handoff_completed_at',
  ]);
}
