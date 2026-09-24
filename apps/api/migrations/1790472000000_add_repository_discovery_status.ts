import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('repositories', {
    discovery_status: {
      type: 'text',
      notNull: true,
      default: 'DISCOVERABLE',
    },
  });

  pgm.addConstraint(
    'repositories',
    'repositories_discovery_status_valid',
    {
      check:
        "discovery_status IN ('DISCOVERABLE', 'PENDING_MODERATION', 'REJECTED')",
    },
  );

  pgm.sql(`
    UPDATE repositories AS r
    SET discovery_status = 'PENDING_MODERATION'
    FROM repository_submissions AS s
    WHERE s.status = 'PENDING'
      AND s.validation_outcome = 'VALID'
      AND s.github_repository_id = r.github_repository_id
  `);

  pgm.createIndex('repositories', ['discovery_status', 'id'], {
    name: 'repositories_discovery_status_id_idx',
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex('repositories', ['discovery_status', 'id'], {
    name: 'repositories_discovery_status_id_idx',
  });

  pgm.dropConstraint(
    'repositories',
    'repositories_discovery_status_valid',
  );

  pgm.dropColumn('repositories', 'discovery_status');
}
