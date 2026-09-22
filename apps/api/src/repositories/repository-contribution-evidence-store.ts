import type { DatabasePool } from '../database/database.js';
import { isRepositoryId } from './repository-catalog.js';
import type {
  ContributionEvidenceStatus,
  LinkedContributionEvidence,
  RepositoryContributionEvidenceRecord,
  SecurityPolicyEvidence,
  UpsertRepositoryContributionEvidenceInput,
} from './repository-contribution-evidence.js';

type ContributionEvidenceRow = {
  repository_id: string;
  status: ContributionEvidenceStatus;
  contributing_api_url: string | null;
  contributing_html_url: string | null;
  code_of_conduct_api_url: string | null;
  code_of_conduct_html_url: string | null;
  issue_template_api_url: string | null;
  issue_template_html_url: string | null;
  pull_request_template_api_url: string | null;
  pull_request_template_html_url: string | null;
  security_source_ref: string | null;
  security_path: string | null;
  security_sha: string | null;
  security_size_bytes: string | null;
  community_profile_updated_at: Date | null;
  observed_at: Date;
  created_at: Date;
  updated_at: Date;
};

function parseSize(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Stored security policy size is invalid.');
  }

  return parsed;
}

function mapLink(
  apiUrl: string | null,
  htmlUrl: string | null,
): LinkedContributionEvidence | null {
  return apiUrl && htmlUrl ? { apiUrl, htmlUrl } : null;
}

function mapSecurity(row: ContributionEvidenceRow): SecurityPolicyEvidence | null {
  const sizeBytes = parseSize(row.security_size_bytes);

  if (
    row.security_source_ref === null ||
    row.security_path === null ||
    row.security_sha === null ||
    sizeBytes === null
  ) {
    return null;
  }

  return {
    sourceRef: row.security_source_ref,
    path: row.security_path,
    sha: row.security_sha,
    sizeBytes,
  };
}

function mapRow(
  row: ContributionEvidenceRow,
): RepositoryContributionEvidenceRecord {
  return {
    repositoryId: row.repository_id,
    status: row.status,
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
    securityPolicy: mapSecurity(row),
    communityProfileUpdatedAt: row.community_profile_updated_at,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertHttpsUrl(
  label: string,
  value: string,
  hostname: 'github.com' | 'api.github.com',
): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== hostname) {
    throw new Error(`${label} must use https://${hostname}.`);
  }
}

function assertLink(
  label: string,
  value: LinkedContributionEvidence | null,
): void {
  if (!value) {
    return;
  }

  assertHttpsUrl(`${label}.apiUrl`, value.apiUrl, 'api.github.com');
  assertHttpsUrl(`${label}.htmlUrl`, value.htmlUrl, 'github.com');
}

function assertInput(input: UpsertRepositoryContributionEvidenceInput): void {
  if (!isRepositoryId(input.repositoryId)) {
    throw new Error('repositoryId must be a valid repository UUID.');
  }

  assertLink('contributing', input.contributing);
  assertLink('codeOfConduct', input.codeOfConduct);
  assertLink('issueTemplate', input.issueTemplate);
  assertLink('pullRequestTemplate', input.pullRequestTemplate);

  if (input.securityPolicy) {
    if (
      input.securityPolicy.sourceRef.trim().length === 0 ||
      input.securityPolicy.path.trim().length === 0 ||
      input.securityPolicy.sha.trim().length === 0
    ) {
      throw new Error('securityPolicy provenance must be non-empty.');
    }

    if (
      !Number.isSafeInteger(input.securityPolicy.sizeBytes) ||
      input.securityPolicy.sizeBytes < 0
    ) {
      throw new Error(
        'securityPolicy.sizeBytes must be a nonnegative safe integer.',
      );
    }
  }

  if (
    input.status === 'UNSUPPORTED_FORK' &&
    (
      input.contributing ||
      input.codeOfConduct ||
      input.issueTemplate ||
      input.pullRequestTemplate ||
      input.securityPolicy ||
      input.communityProfileUpdatedAt
    )
  ) {
    throw new Error(
      'UNSUPPORTED_FORK evidence must not include community file evidence.',
    );
  }
}

export class RepositoryContributionEvidenceStore {
  public constructor(private readonly pool: DatabasePool) {}

  async upsert(
    input: UpsertRepositoryContributionEvidenceInput,
  ): Promise<RepositoryContributionEvidenceRecord> {
    assertInput(input);

    const result = await this.pool.query<ContributionEvidenceRow>(
      `
        INSERT INTO repository_contribution_evidence (
          repository_id,
          status,
          contributing_api_url,
          contributing_html_url,
          code_of_conduct_api_url,
          code_of_conduct_html_url,
          issue_template_api_url,
          issue_template_html_url,
          pull_request_template_api_url,
          pull_request_template_html_url,
          security_source_ref,
          security_path,
          security_sha,
          security_size_bytes,
          community_profile_updated_at,
          observed_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16
        )
        ON CONFLICT (repository_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          contributing_api_url = EXCLUDED.contributing_api_url,
          contributing_html_url = EXCLUDED.contributing_html_url,
          code_of_conduct_api_url = EXCLUDED.code_of_conduct_api_url,
          code_of_conduct_html_url = EXCLUDED.code_of_conduct_html_url,
          issue_template_api_url = EXCLUDED.issue_template_api_url,
          issue_template_html_url = EXCLUDED.issue_template_html_url,
          pull_request_template_api_url = EXCLUDED.pull_request_template_api_url,
          pull_request_template_html_url = EXCLUDED.pull_request_template_html_url,
          security_source_ref = EXCLUDED.security_source_ref,
          security_path = EXCLUDED.security_path,
          security_sha = EXCLUDED.security_sha,
          security_size_bytes = EXCLUDED.security_size_bytes,
          community_profile_updated_at = EXCLUDED.community_profile_updated_at,
          observed_at = EXCLUDED.observed_at,
          updated_at = current_timestamp
        WHERE EXCLUDED.observed_at >= repository_contribution_evidence.observed_at
        RETURNING
          repository_id,
          status,
          contributing_api_url,
          contributing_html_url,
          code_of_conduct_api_url,
          code_of_conduct_html_url,
          issue_template_api_url,
          issue_template_html_url,
          pull_request_template_api_url,
          pull_request_template_html_url,
          security_source_ref,
          security_path,
          security_sha,
          security_size_bytes,
          community_profile_updated_at,
          observed_at,
          created_at,
          updated_at
      `,
      [
        input.repositoryId,
        input.status,
        input.contributing?.apiUrl ?? null,
        input.contributing?.htmlUrl ?? null,
        input.codeOfConduct?.apiUrl ?? null,
        input.codeOfConduct?.htmlUrl ?? null,
        input.issueTemplate?.apiUrl ?? null,
        input.issueTemplate?.htmlUrl ?? null,
        input.pullRequestTemplate?.apiUrl ?? null,
        input.pullRequestTemplate?.htmlUrl ?? null,
        input.securityPolicy?.sourceRef ?? null,
        input.securityPolicy?.path ?? null,
        input.securityPolicy?.sha ?? null,
        input.securityPolicy?.sizeBytes ?? null,
        input.communityProfileUpdatedAt,
        input.observedAt,
      ],
    );

    const row = result.rows[0];

    if (row) {
      return mapRow(row);
    }

    const current = await this.findByRepositoryId(input.repositoryId);

    if (!current) {
      throw new Error(
        'Contribution evidence upsert did not return or resolve existing state.',
      );
    }

    return current;
  }

  async findByRepositoryId(
    repositoryId: string,
  ): Promise<RepositoryContributionEvidenceRecord | null> {
    if (!isRepositoryId(repositoryId)) {
      throw new Error('repositoryId must be a valid repository UUID.');
    }

    const result = await this.pool.query<ContributionEvidenceRow>(
      `
        SELECT
          repository_id,
          status,
          contributing_api_url,
          contributing_html_url,
          code_of_conduct_api_url,
          code_of_conduct_html_url,
          issue_template_api_url,
          issue_template_html_url,
          pull_request_template_api_url,
          pull_request_template_html_url,
          security_source_ref,
          security_path,
          security_sha,
          security_size_bytes,
          community_profile_updated_at,
          observed_at,
          created_at,
          updated_at
        FROM repository_contribution_evidence
        WHERE repository_id = $1
      `,
      [repositoryId],
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }
}
