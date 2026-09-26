import { randomUUID } from 'node:crypto';

import type { DatabasePool } from '../database/database.js';
import { isRepositoryId } from './repository-catalog.js';
import type {
  RepositoryIssueRecord,
  RepositoryIssueState,
  UpsertRepositoryIssueInput,
} from './repository-issue.js';

type RepositoryIssueRow = {
  id: string;
  repository_id: string;
  github_issue_id: string;
  issue_number: number;
  title: string;
  html_url: string;
  state: RepositoryIssueState;
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

const SELECT_COLUMNS = `
  id,
  repository_id,
  github_issue_id,
  issue_number,
  title,
  html_url,
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
`;

function mapRow(row: RepositoryIssueRow): RepositoryIssueRecord {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    githubIssueId: row.github_issue_id,
    number: row.issue_number,
    title: row.title,
    htmlUrl: row.html_url,
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

function assertGithubUrl(value: string): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('htmlUrl must be a valid URL.');
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== 'github.com'
  ) {
    throw new Error('htmlUrl must use https://github.com.');
  }
}

function normalizeLabels(labels: readonly string[]): string[] {
  const normalized = labels.map((label) => {
    const value = label.trim();

    if (!value) {
      throw new Error('issue labels must be non-empty.');
    }

    return value;
  });

  return [...new Set(normalized)].sort((left, right) =>
    left.localeCompare(right),
  );
}

function assertInput(input: UpsertRepositoryIssueInput): string[] {
  if (!isRepositoryId(input.repositoryId)) {
    throw new Error('repositoryId must be a valid repository UUID.');
  }

  assertGithubIssueId(input.githubIssueId);

  if (!Number.isSafeInteger(input.number) || input.number < 1) {
    throw new Error('issue number must be a positive safe integer.');
  }

  if (!input.title.trim()) {
    throw new Error('issue title must be non-empty.');
  }

  assertGithubUrl(input.htmlUrl);

  if (input.state !== 'open' && input.state !== 'closed') {
    throw new Error('issue state must be open or closed.');
  }

  for (const [name, value] of [
    ['assigneeCount', input.assigneeCount],
    ['commentCount', input.commentCount],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} must be a nonnegative safe integer.`);
    }
  }

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

export class RepositoryIssueStore {
  public constructor(private readonly pool: DatabasePool) {}

  async upsert(
    input: UpsertRepositoryIssueInput,
  ): Promise<RepositoryIssueRecord> {
    const labels = assertInput(input);
    const result = await this.pool.query<RepositoryIssueRow>(
      `
        INSERT INTO repository_issues (
          id,
          repository_id,
          github_issue_id,
          issue_number,
          title,
          html_url,
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
          title = EXCLUDED.title,
          html_url = EXCLUDED.html_url,
          state = EXCLUDED.state,
          locked = EXCLUDED.locked,
          assignee_count = EXCLUDED.assignee_count,
          comment_count = EXCLUDED.comment_count,
          labels = EXCLUDED.labels,
          created_at_github = EXCLUDED.created_at_github,
          updated_at_github = EXCLUDED.updated_at_github,
          observed_at = EXCLUDED.observed_at,
          updated_at = current_timestamp
        WHERE repository_issues.repository_id = EXCLUDED.repository_id
          AND repository_issues.issue_number = EXCLUDED.issue_number
          AND (
            EXCLUDED.updated_at_github > repository_issues.updated_at_github
            OR (
              EXCLUDED.updated_at_github = repository_issues.updated_at_github
              AND EXCLUDED.observed_at >= repository_issues.observed_at
            )
          )
        RETURNING ${SELECT_COLUMNS}
      `,
      [
        randomUUID(),
        input.repositoryId,
        input.githubIssueId,
        input.number,
        input.title,
        input.htmlUrl,
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
        'Issue upsert did not return or resolve existing state.',
      );
    }

    if (
      current.repositoryId !== input.repositoryId ||
      current.number !== input.number
    ) {
      throw new Error(
        'GitHub issue identity conflicts with existing repository issue.',
      );
    }

    return current;
  }

  async upsertMany(
    inputs: readonly UpsertRepositoryIssueInput[],
  ): Promise<RepositoryIssueRecord[]> {
    const records: RepositoryIssueRecord[] = [];

    for (const input of inputs) {
      records.push(await this.upsert(input));
    }

    return records;
  }

  async findByGithubIssueId(
    githubIssueId: string,
  ): Promise<RepositoryIssueRecord | null> {
    assertGithubIssueId(githubIssueId);

    const result = await this.pool.query<RepositoryIssueRow>(
      `
        SELECT ${SELECT_COLUMNS}
        FROM repository_issues
        WHERE github_issue_id = $1
      `,
      [githubIssueId],
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async findByRepositoryAndNumber(
    repositoryId: string,
    issueNumber: number,
  ): Promise<RepositoryIssueRecord | null> {
    if (!isRepositoryId(repositoryId)) {
      throw new Error('repositoryId must be a valid repository UUID.');
    }

    if (!Number.isSafeInteger(issueNumber) || issueNumber < 1) {
      throw new Error('issue number must be a positive safe integer.');
    }

    const result = await this.pool.query<RepositoryIssueRow>(
      `
        SELECT ${SELECT_COLUMNS}
        FROM repository_issues
        WHERE repository_id = $1
          AND issue_number = $2
      `,
      [repositoryId, issueNumber],
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }
}
