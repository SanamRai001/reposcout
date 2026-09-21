import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('repositories', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
    },
    github_repository_id: {
      type: 'bigint',
      notNull: true,
      unique: true,
    },
    owner: {
      type: 'text',
      notNull: true,
    },
    name: {
      type: 'text',
      notNull: true,
    },
    full_name: {
      type: 'text',
      notNull: true,
    },
    github_url: {
      type: 'text',
      notNull: true,
    },
    default_branch: {
      type: 'text',
    },
    description: {
      type: 'text',
    },
    is_archived: {
      type: 'boolean',
      notNull: true,
    },
    is_fork: {
      type: 'boolean',
      notNull: true,
    },
    created_at_github: {
      type: 'timestamptz',
      notNull: true,
    },
    updated_at_github: {
      type: 'timestamptz',
      notNull: true,
    },
    pushed_at_github: {
      type: 'timestamptz',
    },
    last_synced_at: {
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
    'repositories',
    'repositories_github_repository_id_positive',
    {
      check: 'github_repository_id > 0',
    },
  );

  pgm.addConstraint('repositories', 'repositories_owner_not_empty', {
    check: "char_length(btrim(owner)) > 0",
  });

  pgm.addConstraint('repositories', 'repositories_name_not_empty', {
    check: "char_length(btrim(name)) > 0",
  });

  pgm.addConstraint('repositories', 'repositories_full_name_not_empty', {
    check: "char_length(btrim(full_name)) > 0",
  });

  pgm.addConstraint('repositories', 'repositories_github_url_not_empty', {
    check: "char_length(btrim(github_url)) > 0",
  });

  pgm.createIndex('repositories', 'full_name', {
    name: 'repositories_full_name_idx',
  });

  pgm.createIndex('repositories', 'last_synced_at', {
    name: 'repositories_last_synced_at_idx',
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('repositories');
}
