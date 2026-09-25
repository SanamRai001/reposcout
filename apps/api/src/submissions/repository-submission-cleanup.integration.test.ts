import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { RepositorySubmissionCleanupService } from './repository-submission-cleanup-service.js';
import { RepositorySubmissionStore } from './repository-submission-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for repository submission cleanup tests.',
  );
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 5,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);
const store = new RepositorySubmissionStore(pool);

beforeEach(async () => {
  await pool.query('DELETE FROM repository_submission_moderation_events');
  await pool.query('DELETE FROM repository_submissions');
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

async function insertRepository(
  fullName: string,
  githubRepositoryId: string,
): Promise<string> {
  const [owner, name] = fullName.split('/');
  const id = randomUUID();

  if (!owner || !name) {
    throw new Error('Repository fixture full name is invalid.');
  }

  await pool.query(
    `
      INSERT INTO repositories (
        id,
        github_repository_id,
        owner,
        name,
        full_name,
        github_url,
        default_branch,
        description,
        is_archived,
        is_fork,
        is_listed,
        created_at_github,
        updated_at_github,
        pushed_at_github,
        last_synced_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'main',
        'cleanup fixture', false, false, true,
        '2026-01-01T00:00:00Z',
        '2026-01-02T00:00:00Z',
        '2026-01-03T00:00:00Z',
        '2026-01-04T00:00:00Z'
      )
    `,
    [
      id,
      githubRepositoryId,
      owner,
      name,
      fullName,
      `https://github.com/${fullName}`,
    ],
  );

  return id;
}

async function insertInvalid(
  fullName: string,
  updatedAt: Date,
): Promise<string> {
  const [owner, name] = fullName.split('/');
  const id = randomUUID();

  if (!owner || !name) {
    throw new Error('Submission fixture full name is invalid.');
  }

  await pool.query(
    `
      INSERT INTO repository_submissions (
        id,
        submitted_url,
        normalized_owner,
        normalized_name,
        normalized_full_name,
        status,
        validation_outcome,
        validated_at,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        'INVALID', 'INVALID', $6, $6, $6
      )
    `,
    [
      id,
      `https://github.com/${fullName}`,
      owner,
      name,
      fullName,
      updatedAt,
    ],
  );

  return id;
}

async function insertDuplicate(
  fullName: string,
  githubRepositoryId: string,
  duplicateRepositoryId: string,
  updatedAt: Date,
): Promise<string> {
  const [owner, name] = fullName.split('/');
  const id = randomUUID();

  if (!owner || !name) {
    throw new Error('Submission fixture full name is invalid.');
  }

  await pool.query(
    `
      INSERT INTO repository_submissions (
        id,
        submitted_url,
        normalized_owner,
        normalized_name,
        normalized_full_name,
        status,
        validation_outcome,
        github_repository_id,
        resolved_owner,
        resolved_name,
        resolved_full_name,
        resolved_github_url,
        duplicate_repository_id,
        validated_at,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        'DUPLICATE', 'DUPLICATE', $6,
        $3, $4, $5, $2, $7,
        $8, $8, $8
      )
    `,
    [
      id,
      `https://github.com/${fullName}`,
      owner,
      name,
      fullName,
      githubRepositoryId,
      duplicateRepositoryId,
      updatedAt,
    ],
  );

  return id;
}

async function insertPending(
  fullName: string,
  updatedAt: Date,
): Promise<string> {
  const [owner, name] = fullName.split('/');
  const id = randomUUID();

  if (!owner || !name) {
    throw new Error('Submission fixture full name is invalid.');
  }

  await pool.query(
    `
      INSERT INTO repository_submissions (
        id,
        submitted_url,
        normalized_owner,
        normalized_name,
        normalized_full_name,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $6)
    `,
    [
      id,
      `https://github.com/${fullName}`,
      owner,
      name,
      fullName,
      updatedAt,
    ],
  );

  return id;
}

describe('repository submission cleanup with PostgreSQL', () => {
  it('prunes only old non-audited INVALID/DUPLICATE rows', async () => {
    const old = new Date('2026-05-01T00:00:00Z');
    const recent = new Date('2026-09-01T00:00:00Z');
    const duplicateRepositoryId = await insertRepository(
      'listed/target',
      '910000001',
    );

    const oldInvalid = await insertInvalid('example/old-invalid', old);
    const oldDuplicate = await insertDuplicate(
      'example/old-duplicate',
      '910000001',
      duplicateRepositoryId,
      old,
    );
    const recentInvalid = await insertInvalid(
      'example/recent-invalid',
      recent,
    );
    const oldPending = await insertPending('example/old-pending', old);
    const auditedInvalid = await insertInvalid(
      'example/audited-invalid',
      old,
    );

    await pool.query(
      `
        INSERT INTO repository_submission_moderation_events (
          id,
          submission_id,
          decision,
          reviewer_ref,
          reason,
          created_at
        )
        VALUES ($1, $2, 'REJECTED', 'fixture:reviewer', 'audit guard fixture', $3)
      `,
      [randomUUID(), auditedInvalid, old],
    );

    const service = new RepositorySubmissionCleanupService(store, {
      retentionDays: 90,
      now: () => new Date('2026-09-25T12:00:00Z'),
    });

    const preview = await service.run('preview', 100);

    expect(preview.items.map((item) => item.id)).toEqual([
      oldDuplicate,
      oldInvalid,
    ].sort());

    const applied = await service.run('apply', 100);

    expect(applied.deleted).toBe(2);
    expect(applied.summary).toEqual({
      invalid: 1,
      duplicate: 1,
    });

    const remaining = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM repository_submissions
        ORDER BY id
      `,
    );

    expect(remaining.rows.map((row) => row.id).sort()).toEqual(
      [recentInvalid, oldPending, auditedInvalid].sort(),
    );

    const repositoryCount = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM repositories WHERE id = $1',
      [duplicateRepositoryId],
    );
    expect(repositoryCount.rows[0]?.count).toBe('1');

    const moderationCount = await pool.query<{ count: string }>(
      `
        SELECT count(*)::text AS count
        FROM repository_submission_moderation_events
        WHERE submission_id = $1
      `,
      [auditedInvalid],
    );
    expect(moderationCount.rows[0]?.count).toBe('1');
  });

  it('keeps cleanup bounded by the requested batch size', async () => {
    const old = new Date('2026-05-01T00:00:00Z');
    const ids = [
      await insertInvalid('example/cleanup-a', old),
      await insertInvalid('example/cleanup-b', old),
      await insertInvalid('example/cleanup-c', old),
    ];

    const service = new RepositorySubmissionCleanupService(store, {
      retentionDays: 90,
      now: () => new Date('2026-09-25T12:00:00Z'),
    });

    const report = await service.run('apply', 2);

    expect(report.deleted).toBe(2);

    const remaining = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM repository_submissions
        WHERE id = ANY($1::uuid[])
      `,
      [ids],
    );

    expect(remaining.rows).toHaveLength(1);
  });
});
