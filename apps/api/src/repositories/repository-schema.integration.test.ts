import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for repository schema tests.');
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 2,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);

beforeEach(async () => {
  await pool.query('DELETE FROM repositories');
});

afterAll(async () => {
  await pool.end();
});

type RepositoryFixtureOverrides = Partial<{
  id: string;
  githubRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  githubUrl: string;
}>;

function createRepositoryFixture(overrides: RepositoryFixtureOverrides = {}) {
  const owner = overrides.owner ?? 'example';
  const name = overrides.name ?? 'project';

  return {
    id: overrides.id ?? randomUUID(),
    githubRepositoryId: overrides.githubRepositoryId ?? '123456789',
    owner,
    name,
    fullName: overrides.fullName ?? `${owner}/${name}`,
    githubUrl:
      overrides.githubUrl ?? `https://github.com/${owner}/${name}`,
  };
}

async function insertRepository(
  fixture: ReturnType<typeof createRepositoryFixture>,
): Promise<void> {
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
        created_at_github,
        updated_at_github,
        pushed_at_github,
        last_synced_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'main',
        'Schema integration fixture',
        false,
        false,
        '2026-01-01T00:00:00Z',
        '2026-01-02T00:00:00Z',
        '2026-01-03T00:00:00Z',
        '2026-01-04T00:00:00Z'
      )
    `,
    [
      fixture.id,
      fixture.githubRepositoryId,
      fixture.owner,
      fixture.name,
      fixture.fullName,
      fixture.githubUrl,
    ],
  );
}

describe('repositories schema', () => {
  it('creates the canonical repository columns with expected PostgreSQL types', async () => {
    const result = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
    }>(
      `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'repositories'
        ORDER BY ordinal_position
      `,
    );

    expect(result.rows).toEqual([
      { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
      {
        column_name: 'github_repository_id',
        data_type: 'bigint',
        is_nullable: 'NO',
      },
      { column_name: 'owner', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'name', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'full_name', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'github_url', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'default_branch', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'description', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'is_archived', data_type: 'boolean', is_nullable: 'NO' },
      { column_name: 'is_fork', data_type: 'boolean', is_nullable: 'NO' },
      {
        column_name: 'created_at_github',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
      {
        column_name: 'updated_at_github',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
      {
        column_name: 'pushed_at_github',
        data_type: 'timestamp with time zone',
        is_nullable: 'YES',
      },
      {
        column_name: 'last_synced_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
      {
        column_name: 'created_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
      {
        column_name: 'updated_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
    ]);
  });

  it('creates repository metadata with separate measured facts', async () => {
    const result = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
    }>(
      `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'repository_metadata'
        ORDER BY ordinal_position
      `,
    );

    expect(result.rows).toEqual([
      { column_name: 'repository_id', data_type: 'uuid', is_nullable: 'NO' },
      { column_name: 'stars', data_type: 'bigint', is_nullable: 'NO' },
      { column_name: 'forks', data_type: 'bigint', is_nullable: 'NO' },
      { column_name: 'open_issues', data_type: 'bigint', is_nullable: 'NO' },
      { column_name: 'primary_language', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'license_spdx', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'topics', data_type: 'ARRAY', is_nullable: 'NO' },
      {
        column_name: 'observed_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
      {
        column_name: 'created_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
      {
        column_name: 'updated_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
    ]);
  });

  it('creates bounded README content storage with explicit provenance', async () => {
    const result = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
    }>(
      `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'repository_readme_content'
        ORDER BY ordinal_position
      `,
    );

    expect(result.rows).toEqual([
      { column_name: 'repository_id', data_type: 'uuid', is_nullable: 'NO' },
      { column_name: 'status', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'source_ref', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'path', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'sha', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'size_bytes', data_type: 'bigint', is_nullable: 'YES' },
      { column_name: 'content', data_type: 'text', is_nullable: 'YES' },
      {
        column_name: 'observed_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
      {
        column_name: 'created_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
      {
        column_name: 'updated_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
    ]);
  });

  it('creates contribution evidence storage with explicit provenance fields', async () => {
    const result = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
    }>(
      `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'repository_contribution_evidence'
        ORDER BY ordinal_position
      `,
    );

    expect(result.rows).toEqual([
      { column_name: 'repository_id', data_type: 'uuid', is_nullable: 'NO' },
      { column_name: 'status', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'contributing_api_url', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'contributing_html_url', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'code_of_conduct_api_url', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'code_of_conduct_html_url', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'issue_template_api_url', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'issue_template_html_url', data_type: 'text', is_nullable: 'YES' },
      {
        column_name: 'pull_request_template_api_url',
        data_type: 'text',
        is_nullable: 'YES',
      },
      {
        column_name: 'pull_request_template_html_url',
        data_type: 'text',
        is_nullable: 'YES',
      },
      { column_name: 'security_source_ref', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'security_path', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'security_sha', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'security_size_bytes', data_type: 'bigint', is_nullable: 'YES' },
      {
        column_name: 'community_profile_updated_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'YES',
      },
      {
        column_name: 'observed_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
      {
        column_name: 'created_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
      {
        column_name: 'updated_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
    ]);
  });

  it('creates repository submission intake storage with normalized identity fields', async () => {
    const result = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
    }>(
      `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'repository_submissions'
        ORDER BY ordinal_position
      `,
    );

    expect(result.rows).toEqual([
      { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
      { column_name: 'submitted_url', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'normalized_owner', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'normalized_name', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'normalized_full_name', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'status', data_type: 'text', is_nullable: 'NO' },
      {
        column_name: 'created_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
      {
        column_name: 'updated_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'NO',
      },
    ]);
  });

  it('rejects malformed normalized submission identity at the database boundary', async () => {
    await expect(
      pool.query(
        `
          INSERT INTO repository_submissions (
            id,
            submitted_url,
            normalized_owner,
            normalized_name,
            normalized_full_name,
            status
          )
          VALUES (
            $1,
            'https://github.com/Example/Project',
            'Example',
            'project',
            'Example/project',
            'PENDING'
          )
        `,
        [randomUUID()],
      ),
    ).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('enforces one pending submission per normalized repository', async () => {
    const values = [
      randomUUID(),
      'https://github.com/example/project',
      'example',
      'project',
      'example/project',
    ];

    await pool.query(
      `
        INSERT INTO repository_submissions (
          id,
          submitted_url,
          normalized_owner,
          normalized_name,
          normalized_full_name,
          status
        )
        VALUES ($1, $2, $3, $4, $5, 'PENDING')
      `,
      values,
    );

    await expect(
      pool.query(
        `
          INSERT INTO repository_submissions (
            id,
            submitted_url,
            normalized_owner,
            normalized_name,
            normalized_full_name,
            status
          )
          VALUES ($1, $2, $3, $4, $5, 'PENDING')
        `,
        [
          randomUUID(),
          'https://github.com/example/project',
          'example',
          'project',
          'example/project',
        ],
      ),
    ).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('rejects unsupported-fork evidence that invents contribution files', async () => {
    const repository = createRepositoryFixture({
      githubRepositoryId: '4433221100',
    });
    await insertRepository(repository);

    await expect(
      pool.query(
        `
          INSERT INTO repository_contribution_evidence (
            repository_id,
            status,
            contributing_api_url,
            contributing_html_url,
            observed_at
          )
          VALUES (
            $1,
            'UNSUPPORTED_FORK',
            'https://api.github.com/repos/example/project/contents/CONTRIBUTING.md',
            'https://github.com/example/project/blob/main/CONTRIBUTING.md',
            current_timestamp
          )
        `,
        [repository.id],
      ),
    ).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('rejects an invalid README storage shape', async () => {
    const repository = createRepositoryFixture({
      githubRepositoryId: '444444444',
    });
    await insertRepository(repository);

    await expect(
      pool.query(
        `
          INSERT INTO repository_readme_content (
            repository_id,
            status,
            source_ref,
            path,
            sha,
            size_bytes,
            content,
            observed_at
          )
          VALUES (
            $1,
            'TOO_LARGE',
            'main',
            'README.md',
            'sha',
            300000,
            'body should not be stored',
            current_timestamp
          )
        `,
        [repository.id],
      ),
    ).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('enforces nonnegative measured counts', async () => {
    const repository = createRepositoryFixture({
      githubRepositoryId: '555555555',
    });
    await insertRepository(repository);

    await expect(
      pool.query(
        `
          INSERT INTO repository_metadata (
            repository_id,
            stars,
            forks,
            open_issues,
            topics,
            observed_at
          )
          VALUES ($1, -1, 0, 0, '{}', current_timestamp)
        `,
        [repository.id],
      ),
    ).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('enforces GitHub repository ID as the canonical unique identity', async () => {
    const first = createRepositoryFixture({
      githubRepositoryId: '987654321',
      owner: 'first-owner',
      name: 'first-name',
    });
    const duplicateIdentity = createRepositoryFixture({
      githubRepositoryId: '987654321',
      owner: 'different-owner',
      name: 'different-name',
    });

    await insertRepository(first);

    await expect(insertRepository(duplicateIdentity)).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('allows owner and repository name to change without changing canonical identity', async () => {
    const repository = createRepositoryFixture({
      githubRepositoryId: '777777777',
      owner: 'old-owner',
      name: 'old-name',
    });

    await insertRepository(repository);

    await pool.query(
      `
        UPDATE repositories
        SET
          owner = $2,
          name = $3,
          full_name = $4,
          github_url = $5,
          updated_at = current_timestamp
        WHERE github_repository_id = $1
      `,
      [
        repository.githubRepositoryId,
        'new-owner',
        'new-name',
        'new-owner/new-name',
        'https://github.com/new-owner/new-name',
      ],
    );

    const result = await pool.query<{
      id: string;
      github_repository_id: string;
      full_name: string;
    }>(
      `
        SELECT id, github_repository_id, full_name
        FROM repositories
        WHERE github_repository_id = $1
      `,
      [repository.githubRepositoryId],
    );

    expect(result.rows).toEqual([
      {
        id: repository.id,
        github_repository_id: repository.githubRepositoryId,
        full_name: 'new-owner/new-name',
      },
    ]);
  });

  it('rejects invalid external identities and empty canonical names', async () => {
    const invalidIdentity = createRepositoryFixture({
      githubRepositoryId: '0',
    });

    await expect(insertRepository(invalidIdentity)).rejects.toMatchObject({
      code: '23514',
    });

    const emptyOwner = createRepositoryFixture({
      githubRepositoryId: '222222222',
      owner: '   ',
      fullName: 'example/project',
      githubUrl: 'https://github.com/example/project',
    });

    await expect(insertRepository(emptyOwner)).rejects.toMatchObject({
      code: '23514',
    });
  });
});
