import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import type { DatabasePool } from '../database/database.js';
import {
  assertRepositoryDiscoveryScope,
  isRepositoryId,
  parseRepositorySearchFilters,
  parseRepositorySearchQuery,
  type RepositoryCatalogRecord,
  type RepositoryPage,
  type RepositoryPageInput,
  type RepositorySearchPageInput,
} from './repository-catalog.js';
import type {
  RepositoryMetadataRecord,
  UpsertRepositoryMetadataInput,
} from './repository-metadata.js';
import type {
  RepositoryPersistenceOptions,
  RepositoryRecord,
  UpsertRepositoryInput,
} from './repository.js';

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

type RepositoryMetadataRow = {
  repository_id: string;
  stars: string;
  forks: string;
  open_issues: string;
  primary_language: string | null;
  license_spdx: string | null;
  topics: string[];
  observed_at: Date;
  created_at: Date;
  updated_at: Date;
};

type RepositoryCatalogRow = RepositoryRow & {
  metadata_repository_id: string | null;
  metadata_stars: string | null;
  metadata_forks: string | null;
  metadata_open_issues: string | null;
  metadata_primary_language: string | null;
  metadata_license_spdx: string | null;
  metadata_topics: string[] | null;
  metadata_observed_at: Date | null;
  metadata_created_at: Date | null;
  metadata_updated_at: Date | null;
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

const UPSERT_REPOSITORY_SQL = `
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
    last_synced_at,
    is_listed
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
    $14,
    $15
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
`;

const UPSERT_METADATA_SQL = `
  INSERT INTO repository_metadata (
    repository_id,
    stars,
    forks,
    open_issues,
    primary_language,
    license_spdx,
    topics,
    observed_at
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8
  )
  ON CONFLICT (repository_id)
  DO UPDATE SET
    stars = EXCLUDED.stars,
    forks = EXCLUDED.forks,
    open_issues = EXCLUDED.open_issues,
    primary_language = EXCLUDED.primary_language,
    license_spdx = EXCLUDED.license_spdx,
    topics = EXCLUDED.topics,
    observed_at = EXCLUDED.observed_at,
    updated_at = current_timestamp
  WHERE EXCLUDED.observed_at >= repository_metadata.observed_at
  RETURNING
    repository_id,
    stars,
    forks,
    open_issues,
    primary_language,
    license_spdx,
    topics,
    observed_at,
    created_at,
    updated_at
`;

const INSERT_DAILY_SNAPSHOT_SQL = `
  INSERT INTO repository_snapshots (
    id,
    repository_id,
    captured_on,
    captured_at,
    stars,
    forks,
    open_issues
  )
  VALUES (
    $1,
    $2,
    (($3::timestamptz AT TIME ZONE 'UTC')::date),
    $3,
    $4,
    $5,
    $6
  )
  ON CONFLICT (repository_id, captured_on) DO NOTHING
`;

const CATALOG_SELECT_COLUMNS = `
  r.id,
  r.github_repository_id,
  r.owner,
  r.name,
  r.full_name,
  r.github_url,
  r.default_branch,
  r.description,
  r.is_archived,
  r.is_fork,
  r.created_at_github,
  r.updated_at_github,
  r.pushed_at_github,
  r.last_synced_at,
  r.created_at,
  r.updated_at,
  m.repository_id AS metadata_repository_id,
  m.stars AS metadata_stars,
  m.forks AS metadata_forks,
  m.open_issues AS metadata_open_issues,
  m.primary_language AS metadata_primary_language,
  m.license_spdx AS metadata_license_spdx,
  m.topics AS metadata_topics,
  m.observed_at AS metadata_observed_at,
  m.created_at AS metadata_created_at,
  m.updated_at AS metadata_updated_at
`;

function repositoryParams(
  input: UpsertRepositoryInput,
  options: RepositoryPersistenceOptions = {},
): unknown[] {
  return [
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
    options.initialListing !== 'unlisted',
  ];
}

function metadataParams(
  repositoryId: string,
  input: UpsertRepositoryMetadataInput,
): unknown[] {
  return [
    repositoryId,
    input.stars,
    input.forks,
    input.openIssues,
    input.primaryLanguage,
    input.licenseSpdx,
    input.topics,
    input.observedAt,
  ];
}

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

function parseCount(value: string): number {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Stored repository metadata count is invalid.');
  }

  return parsed;
}

function mapMetadataRow(row: RepositoryMetadataRow): RepositoryMetadataRecord {
  return {
    repositoryId: row.repository_id,
    stars: parseCount(row.stars),
    forks: parseCount(row.forks),
    openIssues: parseCount(row.open_issues),
    primaryLanguage: row.primary_language,
    licenseSpdx: row.license_spdx,
    topics: row.topics,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCatalogRow(row: RepositoryCatalogRow): RepositoryCatalogRecord {
  const repository = mapRepositoryRow(row);
  const metadata =
    row.metadata_repository_id &&
    row.metadata_stars !== null &&
    row.metadata_forks !== null &&
    row.metadata_open_issues !== null &&
    row.metadata_topics !== null &&
    row.metadata_observed_at &&
    row.metadata_created_at &&
    row.metadata_updated_at
      ? mapMetadataRow({
          repository_id: row.metadata_repository_id,
          stars: row.metadata_stars,
          forks: row.metadata_forks,
          open_issues: row.metadata_open_issues,
          primary_language: row.metadata_primary_language,
          license_spdx: row.metadata_license_spdx,
          topics: row.metadata_topics,
          observed_at: row.metadata_observed_at,
          created_at: row.metadata_created_at,
          updated_at: row.metadata_updated_at,
        })
      : null;

  return {
    ...repository,
    metadata,
  };
}

function assertGithubRepositoryId(value: string): void {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(
      'githubRepositoryId must be a positive base-10 integer string.',
    );
  }
}

function assertMetadata(input: UpsertRepositoryMetadataInput): void {
  for (const [name, value] of [
    ['stars', input.stars],
    ['forks', input.forks],
    ['openIssues', input.openIssues],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} must be a nonnegative safe integer.`);
    }
  }

  if (
    input.primaryLanguage !== null &&
    input.primaryLanguage.trim().length === 0
  ) {
    throw new Error('primaryLanguage must be null or non-empty.');
  }

  if (input.licenseSpdx !== null && input.licenseSpdx.trim().length === 0) {
    throw new Error('licenseSpdx must be null or non-empty.');
  }

  if (
    input.topics.some(
      (topic) => typeof topic !== 'string' || topic.trim().length === 0,
    )
  ) {
    throw new Error('topics must contain only non-empty strings.');
  }
}

function sqlParameter(position: number): string {
  return String.fromCharCode(36) + String(position);
}

export class RepositoryStore {
  public constructor(private readonly pool: DatabasePool) {}

  async upsert(
    input: UpsertRepositoryInput,
    options: RepositoryPersistenceOptions = {},
  ): Promise<RepositoryRecord> {
    assertGithubRepositoryId(input.githubRepositoryId);

    const result = await this.pool.query<RepositoryRow>(
      UPSERT_REPOSITORY_SQL,
      repositoryParams(input, options),
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

  async upsertWithMetadata(
    input: UpsertRepositoryInput,
    metadataInput: UpsertRepositoryMetadataInput,
    options: RepositoryPersistenceOptions = {},
  ): Promise<RepositoryRecord> {
    assertGithubRepositoryId(input.githubRepositoryId);
    assertMetadata(metadataInput);

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const repository = await this.upsertRepositoryWithClient(
        client,
        input,
        options,
      );

      if (input.lastSyncedAt.getTime() >= repository.lastSyncedAt.getTime()) {
        const metadataResult = await client.query<RepositoryMetadataRow>(
          UPSERT_METADATA_SQL,
          metadataParams(repository.id, metadataInput),
        );
        const metadata = metadataResult.rows[0];

        if (metadata) {
          await client.query(
            INSERT_DAILY_SNAPSHOT_SQL,
            [
              randomUUID(),
              repository.id,
              metadata.observed_at,
              metadata.stars,
              metadata.forks,
              metadata.open_issues,
            ],
          );
        }
      }

      await client.query('COMMIT');
      return repository;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async upsertRepositoryWithClient(
    client: PoolClient,
    input: UpsertRepositoryInput,
    options: RepositoryPersistenceOptions,
  ): Promise<RepositoryRecord> {
    const result = await client.query<RepositoryRow>(
      UPSERT_REPOSITORY_SQL,
      repositoryParams(input, options),
    );

    const row = result.rows[0];

    if (row) {
      return mapRepositoryRow(row);
    }

    const current = await client.query<RepositoryRow>(
      `
        SELECT ${SELECT_COLUMNS}
        FROM repositories
        WHERE github_repository_id = $1
      `,
      [input.githubRepositoryId],
    );

    const currentRow = current.rows[0];

    if (!currentRow) {
      throw new Error(
        'Repository upsert did not return or resolve an existing repository.',
      );
    }

    return mapRepositoryRow(currentRow);
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

  async existsByNormalizedFullName(
    normalizedFullName: string,
  ): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM repositories
          WHERE lower(full_name) = $1
            AND is_listed = true
        ) AS exists
      `,
      [normalizedFullName],
    );

    return result.rows[0]?.exists ?? false;
  }

  async findListedByGithubRepositoryId(
    githubRepositoryId: string,
  ): Promise<RepositoryRecord | null> {
    assertGithubRepositoryId(githubRepositoryId);

    const result = await this.pool.query<RepositoryRow>(
      `
        SELECT ${SELECT_COLUMNS}
        FROM repositories
        WHERE github_repository_id = $1
          AND is_listed = true
      `,
      [githubRepositoryId],
    );

    const row = result.rows[0];
    return row ? mapRepositoryRow(row) : null;
  }

  async findById(id: string): Promise<RepositoryCatalogRecord | null> {
    if (!isRepositoryId(id)) {
      throw new Error('id must be a valid repository UUID.');
    }

    const result = await this.pool.query<RepositoryCatalogRow>(
      `
        SELECT ${CATALOG_SELECT_COLUMNS}
        FROM repositories r
        LEFT JOIN repository_metadata m ON m.repository_id = r.id
        WHERE r.id = $1
          AND r.is_listed = true
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? mapCatalogRow(row) : null;
  }

  async searchPage(
    input: RepositorySearchPageInput,
  ): Promise<RepositoryPage> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) {
      throw new Error('limit must be an integer between 1 and 50.');
    }

    const query = parseRepositorySearchQuery(input.query);
    const filters = parseRepositorySearchFilters({
      language: input.filters.primaryLanguage ?? undefined,
      license: input.filters.licenseSpdx ?? undefined,
      topic:
        input.filters.topics.length === 0
          ? undefined
          : [...input.filters.topics],
      minStars:
        input.filters.minStars === null
          ? undefined
          : String(input.filters.minStars),
      maxStars:
        input.filters.maxStars === null
          ? undefined
          : String(input.filters.maxStars),
      fork:
        input.filters.isFork === null
          ? undefined
          : String(input.filters.isFork),
      archived:
        input.filters.isArchived === null
          ? undefined
          : String(input.filters.isArchived),
    });
    assertRepositoryDiscoveryScope(query, filters);

    if (
      input.cursor &&
      (
        input.cursor.query !== query ||
        input.cursor.filters.primaryLanguage !== filters.primaryLanguage ||
        input.cursor.filters.licenseSpdx !== filters.licenseSpdx ||
        input.cursor.filters.topics.length !== filters.topics.length ||
        input.cursor.filters.topics.some(
          (topic, index) => topic !== filters.topics[index],
        ) ||
        input.cursor.filters.minStars !== filters.minStars ||
        input.cursor.filters.maxStars !== filters.maxStars ||
        input.cursor.filters.isFork !== filters.isFork ||
        input.cursor.filters.isArchived !== filters.isArchived
      )
    ) {
      throw new Error('cursor is invalid.');
    }

    const fetchLimit = input.limit + 1;
    const searchVector = `
      to_tsvector(
        'simple',
        concat_ws(
          ' ',
          r.owner,
          r.name,
          r.full_name,
          COALESCE(r.description, '')
        )
      )
    `;

    const values: unknown[] = [];
    const conditions: string[] = ['r.is_listed = true'];

    if (query !== null) {
      values.push(query);
      conditions.push(
        `${searchVector} @@ plainto_tsquery('simple', ${sqlParameter(values.length)})`,
      );
    }

    if (filters.primaryLanguage !== null) {
      values.push(filters.primaryLanguage);
      conditions.push(
        `lower(m.primary_language) = $${values.length}`,
      );
    }

    if (filters.licenseSpdx !== null) {
      values.push(filters.licenseSpdx);
      conditions.push(
        `lower(m.license_spdx) = $${values.length}`,
      );
    }

    if (filters.topics.length > 0) {
      values.push([...filters.topics]);
      conditions.push(
        `m.topics @> ${sqlParameter(values.length)}::text[]`,
      );
    }

    if (filters.minStars !== null) {
      values.push(filters.minStars);
      conditions.push(
        `m.stars >= ${sqlParameter(values.length)}::bigint`,
      );
    }

    if (filters.maxStars !== null) {
      values.push(filters.maxStars);
      conditions.push(
        `m.stars <= ${sqlParameter(values.length)}::bigint`,
      );
    }

    if (filters.isFork !== null) {
      values.push(filters.isFork);
      conditions.push(`r.is_fork = $${values.length}`);
    }

    if (filters.isArchived !== null) {
      values.push(filters.isArchived);
      conditions.push(`r.is_archived = $${values.length}`);
    }

    if (input.cursor) {
      values.push(input.cursor.id);
      conditions.push(`r.id > $${values.length}`);
    }

    values.push(fetchLimit);
    const limitParameter = values.length;

    const result = await this.pool.query<RepositoryCatalogRow>(
      `
        SELECT ${CATALOG_SELECT_COLUMNS}
        FROM repositories r
        LEFT JOIN repository_metadata m ON m.repository_id = r.id
        WHERE ${conditions.join('\n          AND ')}
        ORDER BY r.id ASC
        LIMIT $${limitParameter}
      `,
      values,
    );

    const hasMore = result.rows.length > input.limit;
    const rows = hasMore ? result.rows.slice(0, input.limit) : result.rows;

    return {
      items: rows.map(mapCatalogRow),
      hasMore,
    };
  }

  async listPage(input: RepositoryPageInput): Promise<RepositoryPage> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) {
      throw new Error('limit must be an integer between 1 and 50.');
    }

    const fetchLimit = input.limit + 1;
    const result = input.cursor
      ? await this.pool.query<RepositoryCatalogRow>(
          `
            SELECT ${CATALOG_SELECT_COLUMNS}
            FROM repositories r
            LEFT JOIN repository_metadata m ON m.repository_id = r.id
            WHERE r.is_listed = true
              AND r.id > $1
            ORDER BY r.id ASC
            LIMIT $2
          `,
          [input.cursor.id, fetchLimit],
        )
      : await this.pool.query<RepositoryCatalogRow>(
          `
            SELECT ${CATALOG_SELECT_COLUMNS}
            FROM repositories r
            LEFT JOIN repository_metadata m ON m.repository_id = r.id
            WHERE r.is_listed = true
            ORDER BY r.id ASC
            LIMIT $1
          `,
          [fetchLimit],
        );

    const hasMore = result.rows.length > input.limit;
    const rows = hasMore ? result.rows.slice(0, input.limit) : result.rows;

    return {
      items: rows.map(mapCatalogRow),
      hasMore,
    };
  }
}
