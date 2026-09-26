import { randomUUID } from 'node:crypto';

import type { DatabasePool } from '../database/database.js';
import { isRepositoryId } from './repository-catalog.js';
import type {
  RepositoryContributionIssueRecord,
  RepositoryContributionIssueState,
  UpsertRepositoryContributionIssueInput,
} from './repository-contribution-issue.js';

type ContributionIssueRow = {
  id: string;
  repository_id: string;
  github_issue_id: string;
  number: number;
  title: string;
  github_url: string;
  state: RepositoryContributionIssueState;
  locked: boolean;
  assignee_count: number;
  comment_count: number;
  labels: string[];
  created_at_github: Date;
  updated_at_github: Date;
  observed_at: Date;
  created_at: Date;
  updated_at: Date;
};

function mapRow(row: ContributionIssueRow): RepositoryContributionIssueRecord {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    githubIssueId: row.github_issue_id,
    number: row.number,
    title: row.title,
    githubUrl: row.github_url,
    state: row.state,
    locked: row.locked,
    assigneeCount: row.assignee_count,
    commentCount: row.comment_count,
    labels: row.labels,
    createdAtGithub: row.created_at_github,
    updatedAtGithub: row.updated_at_github,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
}

function assertNonnegativeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a nonnegative safe integer.`);
  }
}

function assertDate(name: string, value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${name} must be a valid date.`);
  }
}

function assertGithubIssueId(value: string): void {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error('githubIssueId must be a positive integer string.');
  }
}

function assertGithubIssueUrl(value: string): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('githubUrl must be a valid GitHub issue URL.');
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== 'github.com' ||
    !/\/issues\/\d+\/?$/.test(url.pathname)
  ) {
    throw new Error('githubUrl must be a valid GitHub issue URL.');
  }
}

function normalizeLabels(labels: readonly string[]): string[] {
  if (
    !Array.isArray(labels) ||
    labels.some(
      (label) =>
        typeof label !== 'string' ||
        label.trim().length === 0 ||
        label.length > 255,
    )
  ) {
    throw new Error('labels must contain only non-empty strings up to 255 characters.');
  }

  return [...new Set(labels.map((label) => label.trim()))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function assertInput(
  input: UpsertRepositoryContributionIssueInput,
): string[] {
  if (!isRepositoryId(input.repositoryId)) {
    throw new Error('repositoryId must be a valid repository UUID.');
  }

  assertGithubIssueId(input.githubIssueId);
  assertPositiveInteger('number', input.number);

  if (!input.title.trim()) {
    throw new Error('title must be non-empty.');
  }

  assertGithubIssueUrl(input.githubUrl);

  if (input.state !== 'open' && input.state !== 'closed') {
    throw new Error('state must be open or closed.');
  }

  assertNonnegativeInteger('assigneeCount', input.assigneeCount);
  assertNonnegativeInteger('commentCount', input.commentCount);
  assertDate('createdAtGithub', input.createdAtGithub);
  assertDate('updatedAtGithub', input.updatedAtGithub);
  assertDate('observedAt', input.observedAt);

  if (input.updatedAtGithub < input.createdAtGithub) {
    throw new Error(
      'updatedAtGithub must not be earlier than createdAtGithub.',
    );
  }

  return normalizeLabels(input.labels);
}

export class RepositoryContributionIssueStore {
  public constructor(private readonly pool: DatabasePool) {}

  async upsert(
    input: UpsertRepositoryContributionIssueInput,
  ): Promise<RepositoryContributionIssueRecord> {
    const labels = assertInput(input);

    const result = await this.pool.query<ContributionIssueRow>(
      `
        INSERT INTO repository_contribution_issues (
          id,
          repository_id,
          github_issue_id,
          number,
          title,
          github_url,
          state,
          locked,
          assignee_count,
          comment_count,
          labels,
          created_at_github,
          updated_at_github,
          observed_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14
        )
        ON CONFLICT (github_issue_id)
        DO UPDATE SET
          number = EXCLUDED.number,
          title = EXCLUDED.title,
          github_url = EXCLUDED.github_url,
          state = EXCLUDED.state,
          locked = EXCLUDED.locked,
          assignee_count = EXCLUDED.assignee_count,
          comment_count = EXCLUDED.comment_count,
          labels = EXCLUDED.labels,
          created_at_github = EXCLUDED.created_at_github,
          updated_at_github = EXCLUDED.updated_at_github,
          observed_at = EXCLUDED.observed_at,
          updated_at = current_timestamp
        WHERE
          repository_contribution_issues.repository_id =
            EXCLUDED.repository_id
          AND (
            EXCLUDED.updated_at_github >
              repository_contribution_issues.updated_at_github
            OR (
              EXCLUDED.updated_at_github =
                repository_contribution_issues.updated_at_github
              AND EXCLUDED.observed_at >=
                repository_contribution_issues.observed_at
            )
          )
        RETURNING
          id,
          repository_id,
          github_issue_id,
          number,
          title,
          github_url,
          state,
          locked,
          assignee_count,
          comment_count,
          labels,
          created_at_github,
          updated_at_github,
          observed_at,
          created_at,
          updated_at
      `,
      [
        randomUUID(),
        input.repositoryId,
        input.githubIssueId,
        input.number,
        input.title.trim(),
        input.githubUrl,
        input.state,
        input.locked,
        input.assigneeCount,
        input.commentCount,
        labels,
        input.createdAtGithub,
        input.updatedAtGithub,
        input.observedAt,
      ],
    );

    const row = result.rows[0];

    if (row) {
      return mapRow(row);
    }

    const current = await this.findByGithubIssueId(input.githubIssueId);

    if (!current) {
      throw new Error(
        'Contribution issue upsert did not return or resolve existing state.',
      );
    }

    if (current.repositoryId !== input.repositoryId) {
      throw new Error(
        'GitHub issue identity is already associated with another repository.',
      );
    }

    return current;
  }

  async findByGithubIssueId(
    githubIssueId: string,
  ): Promise<RepositoryContributionIssueRecord | null> {
    assertGithubIssueId(githubIssueId);

    const result = await this.pool.query<ContributionIssueRow>(
      `
        SELECT
          id,
          repository_id,
          github_issue_id,
          number,
          title,
          github_url,
          state,
          locked,
          assignee_count,
          comment_count,
          labels,
          created_at_github,
          updated_at_github,
          observed_at,
          created_at,
          updated_at
        FROM repository_contribution_issues
        WHERE github_issue_id = $1
      `,
      [githubIssueId],
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async listByRepositoryId(
    repositoryId: string,
    limit = 100,
  ): Promise<RepositoryContributionIssueRecord[]> {
    if (!isRepositoryId(repositoryId)) {
      throw new Error('repositoryId must be a valid repository UUID.');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('limit must be an integer between 1 and 100.');
    }

    const result = await this.pool.query<ContributionIssueRow>(
      `
        SELECT
          id,
          repository_id,
          github_issue_id,
          number,
          title,
          github_url,
          state,
          locked,
          assignee_count,
          comment_count,
          labels,
          created_at_github,
          updated_at_github,
          observed_at,
          created_at,
          updated_at
        FROM repository_contribution_issues
        WHERE repository_id = $1
        ORDER BY updated_at_github DESC, id ASC
        LIMIT $2
      `,
      [repositoryId, limit],
    );

    return result.rows.map(mapRow);
  }
}
