import type { DatabasePool } from '../database/database.js';
import type { ContributionEvidenceStatus } from './repository-contribution-evidence.js';
import type { RepositoryContributionIssueRecord } from './repository-contribution-issue.js';
import {
  buildContributionDiscoverySignalSnapshot,
} from './repository-contribution-signals.js';
import type {
  ContributionDiscoveryFilters,
  ContributionDiscoveryItem,
  ContributionDiscoveryPage,
  ContributionDiscoveryPageInput,
  ContributionDiscoveryReader,
} from './repository-contribution-discovery.js';

type ContributionDiscoveryRow = {
  issue_id: string;
  repository_id: string;
  github_issue_id: string;
  issue_number: number;
  issue_title: string;
  issue_github_url: string;
  issue_state: 'open' | 'closed';
  issue_locked: boolean;
  issue_assignee_count: number;
  issue_comment_count: number;
  issue_labels: string[];
  issue_created_at_github: Date;
  issue_updated_at_github: Date;
  issue_observed_at: Date;
  issue_created_at: Date;
  issue_updated_at: Date;
  repository_full_name: string;
  repository_github_url: string;
  repository_primary_language: string | null;
  evidence_status: ContributionEvidenceStatus | null;
  contributing_api_url: string | null;
  contributing_html_url: string | null;
  code_of_conduct_api_url: string | null;
  code_of_conduct_html_url: string | null;
  issue_template_api_url: string | null;
  issue_template_html_url: string | null;
  pull_request_template_api_url: string | null;
  pull_request_template_html_url: string | null;
};

const DAY_MS = 86_400_000;

function parameter(values: unknown[], value: unknown): string {
  values.push(value);
  return `$${values.length}`;
}

function labelPredicate(
  values: unknown[],
  normalizedLabel: 'good first issue' | 'help wanted',
  expected: boolean,
): string {
  const placeholder = parameter(values, normalizedLabel);
  const exists = `
    EXISTS (
      SELECT 1
      FROM unnest(i.labels) AS issue_label(value)
      WHERE regexp_replace(
        translate(lower(btrim(issue_label.value)), '_-', '  '),
        '[[:space:]]+',
        ' ',
        'g'
      ) = ${placeholder}
    )
  `;

  return expected ? exists : `NOT ${exists}`;
}

function addBooleanFilter(
  conditions: string[],
  value: boolean | null,
  whenTrue: string,
  whenFalse: string,
): void {
  if (value === true) {
    conditions.push(whenTrue);
  } else if (value === false) {
    conditions.push(whenFalse);
  }
}

function addProcessFilter(
  conditions: string[],
  filter: ContributionDiscoveryFilters['contributing'],
): void {
  switch (filter) {
    case 'present':
      conditions.push(
        "e.status = 'OBSERVED' AND e.contributing_api_url IS NOT NULL",
      );
      return;
    case 'absent':
      conditions.push(
        "e.status = 'OBSERVED' AND e.contributing_api_url IS NULL",
      );
      return;
    case 'missing':
      conditions.push('e.repository_id IS NULL');
      return;
    case 'not_applicable':
      conditions.push("e.status = 'UNSUPPORTED_FORK'");
      return;
    case null:
      return;
  }
}

function mapLink(apiUrl: string | null, htmlUrl: string | null) {
  return apiUrl && htmlUrl ? { apiUrl, htmlUrl } : null;
}

function mapIssue(row: ContributionDiscoveryRow): RepositoryContributionIssueRecord {
  return {
    id: row.issue_id,
    repositoryId: row.repository_id,
    githubIssueId: row.github_issue_id,
    number: row.issue_number,
    title: row.issue_title,
    githubUrl: row.issue_github_url,
    state: row.issue_state,
    locked: row.issue_locked,
    assigneeCount: row.issue_assignee_count,
    commentCount: row.issue_comment_count,
    labels: row.issue_labels,
    createdAtGithub: row.issue_created_at_github,
    updatedAtGithub: row.issue_updated_at_github,
    observedAt: row.issue_observed_at,
    createdAt: row.issue_created_at,
    updatedAt: row.issue_updated_at,
  };
}

function mapItem(
  row: ContributionDiscoveryRow,
  evaluatedAt: Date,
): ContributionDiscoveryItem {
  const issue = mapIssue(row);
  const repositoryEvidence =
    row.evidence_status === null
      ? null
      : {
          status: row.evidence_status,
          contributing: mapLink(
            row.contributing_api_url,
            row.contributing_html_url,
          ),
          codeOfConduct: mapLink(
            row.code_of_conduct_api_url,
            row.code_of_conduct_html_url,
          ),
          issueTemplate: mapLink(
            row.issue_template_api_url,
            row.issue_template_html_url,
          ),
          pullRequestTemplate: mapLink(
            row.pull_request_template_api_url,
            row.pull_request_template_html_url,
          ),
        };

  return {
    repository: {
      id: row.repository_id,
      fullName: row.repository_full_name,
      githubUrl: row.repository_github_url,
      primaryLanguage: row.repository_primary_language,
    },
    issue,
    signalSnapshot: buildContributionDiscoverySignalSnapshot({
      repositoryId: row.repository_id,
      evaluatedAt,
      issue: {
        githubIssueId: issue.githubIssueId,
        number: issue.number,
        title: issue.title,
        state: issue.state,
        locked: issue.locked,
        assigneeCount: issue.assigneeCount,
        commentCount: issue.commentCount,
        labels: issue.labels,
        createdAt: issue.createdAtGithub,
        updatedAt: issue.updatedAtGithub,
      },
      repositoryEvidence,
    }),
  };
}

function assertInput(input: ContributionDiscoveryPageInput): void {
  if (
    !Number.isInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 50
  ) {
    throw new Error('limit must be an integer between 1 and 50.');
  }

  if (
    !(input.evaluatedAt instanceof Date) ||
    Number.isNaN(input.evaluatedAt.getTime())
  ) {
    throw new Error('evaluatedAt must be a valid date.');
  }

  if (
    input.position &&
    (
      !input.position.issueId ||
      !(input.position.updatedAtGithub instanceof Date) ||
      Number.isNaN(input.position.updatedAtGithub.getTime())
    )
  ) {
    throw new Error('position is invalid.');
  }
}

export class RepositoryContributionDiscoveryStore
  implements ContributionDiscoveryReader {
  public constructor(private readonly pool: DatabasePool) {}

  async discoverPage(
    input: ContributionDiscoveryPageInput,
  ): Promise<ContributionDiscoveryPage> {
    assertInput(input);

    const values: unknown[] = [];
    const conditions: string[] = [
      'r.is_listed = true',
      "i.state = 'open'",
    ];

    addBooleanFilter(
      conditions,
      input.filters.unassigned,
      'i.assignee_count = 0',
      'i.assignee_count > 0',
    );
    addBooleanFilter(
      conditions,
      input.filters.unlocked,
      'i.locked = false',
      'i.locked = true',
    );

    if (input.filters.goodFirstIssue !== null) {
      conditions.push(
        labelPredicate(
          values,
          'good first issue',
          input.filters.goodFirstIssue,
        ),
      );
    }

    if (input.filters.helpWanted !== null) {
      conditions.push(
        labelPredicate(
          values,
          'help wanted',
          input.filters.helpWanted,
        ),
      );
    }

    if (input.filters.primaryLanguage !== null) {
      const placeholder = parameter(
        values,
        input.filters.primaryLanguage,
      );
      conditions.push(`lower(m.primary_language) = ${placeholder}`);
    }

    if (input.filters.updatedWithinDays !== null) {
      const threshold = new Date(
        input.evaluatedAt.getTime() -
          input.filters.updatedWithinDays * DAY_MS,
      );
      const placeholder = parameter(values, threshold);
      conditions.push(`i.updated_at_github >= ${placeholder}`);
    }

    addProcessFilter(conditions, input.filters.contributing);

    if (input.position) {
      const updatedAtPlaceholder = parameter(
        values,
        input.position.updatedAtGithub,
      );
      const idPlaceholder = parameter(values, input.position.issueId);
      conditions.push(`
        (
          i.updated_at_github < ${updatedAtPlaceholder}
          OR (
            i.updated_at_github = ${updatedAtPlaceholder}
            AND i.id > ${idPlaceholder}
          )
        )
      `);
    }

    const fetchLimit = input.limit + 1;
    const limitPlaceholder = parameter(values, fetchLimit);

    const result = await this.pool.query<ContributionDiscoveryRow>(
      `
        SELECT
          i.id AS issue_id,
          i.repository_id,
          i.github_issue_id,
          i.number AS issue_number,
          i.title AS issue_title,
          i.github_url AS issue_github_url,
          i.state AS issue_state,
          i.locked AS issue_locked,
          i.assignee_count AS issue_assignee_count,
          i.comment_count AS issue_comment_count,
          i.labels AS issue_labels,
          i.created_at_github AS issue_created_at_github,
          i.updated_at_github AS issue_updated_at_github,
          i.observed_at AS issue_observed_at,
          i.created_at AS issue_created_at,
          i.updated_at AS issue_updated_at,
          r.full_name AS repository_full_name,
          r.github_url AS repository_github_url,
          m.primary_language AS repository_primary_language,
          e.status AS evidence_status,
          e.contributing_api_url,
          e.contributing_html_url,
          e.code_of_conduct_api_url,
          e.code_of_conduct_html_url,
          e.issue_template_api_url,
          e.issue_template_html_url,
          e.pull_request_template_api_url,
          e.pull_request_template_html_url
        FROM repository_contribution_issues i
        INNER JOIN repositories r ON r.id = i.repository_id
        LEFT JOIN repository_metadata m ON m.repository_id = r.id
        LEFT JOIN repository_contribution_evidence e
          ON e.repository_id = r.id
        WHERE ${conditions.join('\n          AND ')}
        ORDER BY i.updated_at_github DESC, i.id ASC
        LIMIT ${limitPlaceholder}
      `,
      values,
    );

    const hasMore = result.rows.length > input.limit;
    const rows = hasMore
      ? result.rows.slice(0, input.limit)
      : result.rows;

    return {
      items: rows.map((row) => mapItem(row, input.evaluatedAt)),
      hasMore,
    };
  }
}
