import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('repository_contribution_evidence', {
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
    contributing_api_url: {
      type: 'text',
    },
    contributing_html_url: {
      type: 'text',
    },
    code_of_conduct_api_url: {
      type: 'text',
    },
    code_of_conduct_html_url: {
      type: 'text',
    },
    issue_template_api_url: {
      type: 'text',
    },
    issue_template_html_url: {
      type: 'text',
    },
    pull_request_template_api_url: {
      type: 'text',
    },
    pull_request_template_html_url: {
      type: 'text',
    },
    security_source_ref: {
      type: 'text',
    },
    security_path: {
      type: 'text',
    },
    security_sha: {
      type: 'text',
    },
    security_size_bytes: {
      type: 'bigint',
    },
    community_profile_updated_at: {
      type: 'timestamptz',
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
    'repository_contribution_evidence',
    'repository_contribution_evidence_status_valid',
    {
      check: "status IN ('OBSERVED', 'UNSUPPORTED_FORK')",
    },
  );

  pgm.addConstraint(
    'repository_contribution_evidence',
    'repository_contribution_evidence_security_size_nonnegative',
    {
      check:
        'security_size_bytes IS NULL OR security_size_bytes >= 0',
    },
  );

  for (const prefix of [
    'contributing',
    'code_of_conduct',
    'issue_template',
    'pull_request_template',
  ]) {
    pgm.addConstraint(
      'repository_contribution_evidence',
      `repository_contribution_evidence_${prefix}_pair`,
      {
        check: `
          (
            ${prefix}_api_url IS NULL
            AND ${prefix}_html_url IS NULL
          )
          OR
          (
            ${prefix}_api_url IS NOT NULL
            AND ${prefix}_html_url IS NOT NULL
          )
        `,
      },
    );
  }

  pgm.addConstraint(
    'repository_contribution_evidence',
    'repository_contribution_evidence_security_shape',
    {
      check: `
        (
          security_source_ref IS NULL
          AND security_path IS NULL
          AND security_sha IS NULL
          AND security_size_bytes IS NULL
        )
        OR
        (
          security_source_ref IS NOT NULL
          AND security_path IS NOT NULL
          AND security_sha IS NOT NULL
          AND security_size_bytes IS NOT NULL
        )
      `,
    },
  );

  pgm.addConstraint(
    'repository_contribution_evidence',
    'repository_contribution_evidence_unsupported_fork_empty',
    {
      check: `
        status <> 'UNSUPPORTED_FORK'
        OR
        (
          contributing_api_url IS NULL
          AND contributing_html_url IS NULL
          AND code_of_conduct_api_url IS NULL
          AND code_of_conduct_html_url IS NULL
          AND issue_template_api_url IS NULL
          AND issue_template_html_url IS NULL
          AND pull_request_template_api_url IS NULL
          AND pull_request_template_html_url IS NULL
          AND security_source_ref IS NULL
          AND security_path IS NULL
          AND security_sha IS NULL
          AND security_size_bytes IS NULL
          AND community_profile_updated_at IS NULL
        )
      `,
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('repository_contribution_evidence');
}
