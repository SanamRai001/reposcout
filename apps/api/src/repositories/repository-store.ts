import { randomUUID } from 'node:crypto';

import type { DatabasePool } from '../database/database.js';
import type { RepositoryRecord, UpsertRepositoryInput } from './repository.js';

type RepositoryRow = {
  id: string;
  github_repository_id: string;
  owner: string;
  name: string;
  full_name: string;
  github_url: string;
  default_branch: string | null;
  description: string | null;
  is_archived: boolean;
  is_fork: boolean;
  created_at_github: Date;
  updated_at_github: Date;
  pushed_at_github: Date | null;
  last_synced_at: Date;
  created_at: Date;
  updated_at: Date;
};

const SELECT_COLUMNS = `
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
  last_synced_at,
  created_at,
  updated_at
`;

function mapRepositoryRow(row: RepositoryRow): RepositoryRecord {
  return {
    id: row.id,
    githubRepositoryId: row.github_repository_id,
    owner: row.owner,
    name: row.name,
    fullName: row.full_name,
    githubUrl: row.github_url,
    defaultBranch: row.default_branch,
    description: row.description,
    isArchived: row.is_archived,
    isFork: row.is_fork,
    createdAtGithub: row.created_at_github,
    updatedAtGithub: row.updated_at_github,
    pushedAtGithub: row.pushed_at_github,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertGithubRepositoryId(value: string): void {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(
      'githubRepositoryId must be a positive base-10 integer string.',
    );
  }
}

export class RepositoryStore {
  public constructor(private readonly pool: DatabasePool) {}

  async upsert(input: UpsertRepositoryInput): Promise<RepositoryRecord> {
    assertGithubRepositoryId(input.githubRepositoryId);

    const result = await this.pool.query<RepositoryRow>(
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
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14
        )
        ON CONFLICT (github_repository_id)
        DO UPDATE SET
          owner = EXCLUDED.owner,
          name = EXCLUDED.name,
          full_name = EXCLUDED.full_name,
          github_url = EXCLUDED.github_url,
          default_branch = EXCLUDED.default_branch,
          description = EXCLUDED.description,
          is_archived = EXCLUDED.is_archived,
          is_fork = EXCLUDED.is_fork,
          created_at_github = EXCLUDED.created_at_github,
          updated_at_github = EXCLUDED.updated_at_github,
          pushed_at_github = EXCLUDED.pushed_at_github,
          last_synced_at = EXCLUDED.last_synced_at,
          updated_at = current_timestamp
        WHERE EXCLUDED.last_synced_at >= repositories.last_synced_at
        RETURNING ${SELECT_COLUMNS}
      `,
      [
        randomUUID(),
        input.githubRepositoryId,
        input.owner,
        input.name,
        input.fullName,
        input.githubUrl,
        input.defaultBranch,
        input.description,
        input.isArchived,
        input.isFork,
        input.createdAtGithub,
        input.updatedAtGithub,
        input.pushedAtGithub,
        input.lastSyncedAt,
      ],
    );

    const row = result.rows[0];

    if (row) {
      return mapRepositoryRow(row);
    }

    const current = await this.findByGithubRepositoryId(
      input.githubRepositoryId,
    );

    if (!current) {
      throw new Error(
        'Repository upsert did not return or resolve an existing repository.',
      );
    }

    return current;
  }

  async findByGithubRepositoryId(
    githubRepositoryId: string,
  ): Promise<RepositoryRecord | null> {
    assertGithubRepositoryId(githubRepositoryId);

    const result = await this.pool.query<RepositoryRow>(
      `
        SELECT ${SELECT_COLUMNS}
        FROM repositories
        WHERE github_repository_id = $1
      `,
      [githubRepositoryId],
    );

    const row = result.rows[0];
    return row ? mapRepositoryRow(row) : null;
  }

  async findByFullName(fullName: string): Promise<RepositoryRecord[]> {
    const result = await this.pool.query<RepositoryRow>(
      `
        SELECT ${SELECT_COLUMNS}
        FROM repositories
        WHERE full_name = $1
        ORDER BY updated_at DESC, id ASC
      `,
      [fullName],
    );

    return result.rows.map(mapRepositoryRow);
  }
}
