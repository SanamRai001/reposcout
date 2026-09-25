import { afterAll, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for migration rollback tests.');
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 1,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);

afterAll(async () => {
  await pool.end();
});

describe('latest migration rollback', () => {
  it('removes only the terminal cooldown lookup index', async () => {
    const result = await pool.query<{
      repository_submissions: string | null;
      validation_column_exists: boolean;
      handoff_repository_column_exists: boolean;
      handoff_completed_column_exists: boolean;
      listing_column_exists: boolean;
      moderation_events: string | null;
      repositories: string | null;
      repository_metadata: string | null;
      repository_readme_content: string | null;
      repository_contribution_evidence: string | null;
      terminal_cooldown_index: string | null;
    }>(
      `
        SELECT
          to_regclass('public.repository_submissions')::text
            AS repository_submissions,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'repository_submissions'
              AND column_name = 'validation_outcome'
          ) AS validation_column_exists,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'repository_submissions'
              AND column_name = 'handoff_repository_id'
          ) AS handoff_repository_column_exists,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'repository_submissions'
              AND column_name = 'evidence_handoff_completed_at'
          ) AS handoff_completed_column_exists,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'repositories'
              AND column_name = 'is_listed'
          ) AS listing_column_exists,
          to_regclass(
            'public.repository_submission_moderation_events'
          )::text AS moderation_events,
          to_regclass('public.repositories')::text AS repositories,
          to_regclass('public.repository_metadata')::text AS repository_metadata,
          to_regclass('public.repository_readme_content')::text
            AS repository_readme_content,
          to_regclass('public.repository_contribution_evidence')::text
            AS repository_contribution_evidence,
          to_regclass(
            'public.repository_submissions_terminal_full_name_updated_idx'
          )::text AS terminal_cooldown_index
      `,
    );

    expect(result.rows[0]).toEqual({
      repository_submissions: 'repository_submissions',
      validation_column_exists: true,
      handoff_repository_column_exists: true,
      handoff_completed_column_exists: true,
      listing_column_exists: true,
      moderation_events: 'repository_submission_moderation_events',
      repositories: 'repositories',
      repository_metadata: 'repository_metadata',
      repository_readme_content: 'repository_readme_content',
      repository_contribution_evidence: 'repository_contribution_evidence',
      terminal_cooldown_index: null,
    });
  });
});
