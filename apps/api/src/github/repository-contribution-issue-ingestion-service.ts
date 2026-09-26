import {
  GithubApiError,
  type GithubClient,
  type GithubIssueSnapshot,
} from './github-client.js';
import { decideRetry } from './repository-refresh-policy.js';
import { logger } from '../logger.js';
import type { RepositoryCatalogReader } from '../repositories/repository-catalog.js';
import type {
  RepositoryContributionIssueRecord,
  UpsertRepositoryContributionIssueInput,
} from '../repositories/repository-contribution-issue.js';

type GithubIssueReader = Pick<GithubClient, 'fetchRepositoryIssues'>;

type ContributionIssueWriter = Readonly<{
  upsert(
    input: UpsertRepositoryContributionIssueInput,
  ): Promise<RepositoryContributionIssueRecord>;
}>;

export type RepositoryContributionIssueIngestionResult =
  | Readonly<{
      status: 'ingested';
      repositoryId: string;
      fullName: string;
      fetchedCount: number;
      persistedCount: number;
    }>
  | Readonly<{
      status: 'not_listed';
      repositoryId: string;
    }>
  | Readonly<{
      status: 'unavailable';
      repositoryId: string;
      fullName: string;
      retryAt: Date;
    }>
  | Readonly<{
      status: 'retry_later';
      repositoryId: string;
      fullName: string;
      retryAt: Date;
    }>
  | Readonly<{
      status: 'manual_review';
      repositoryId: string;
      fullName: string;
      retryAt: null;
    }>;

function toUpsertInput(
  repositoryId: string,
  issue: GithubIssueSnapshot,
  observedAt: Date,
): UpsertRepositoryContributionIssueInput {
  return {
    repositoryId,
    githubIssueId: issue.githubIssueId,
    number: issue.number,
    title: issue.title,
    githubUrl: issue.githubUrl,
    state: issue.state,
    locked: issue.locked,
    assigneeCount: issue.assigneeCount,
    commentCount: issue.commentCount,
    labels: issue.labels,
    createdAtGithub: issue.createdAt,
    updatedAtGithub: issue.updatedAt,
    observedAt,
  };
}

export class RepositoryContributionIssueIngestionService {
  public constructor(
    private readonly catalog: Pick<RepositoryCatalogReader, 'findById'>,
    private readonly githubClient: GithubIssueReader,
    private readonly issueStore: ContributionIssueWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async ingestRepository(
    repositoryId: string,
    issueLimit = 50,
  ): Promise<RepositoryContributionIssueIngestionResult> {
    if (!Number.isInteger(issueLimit) || issueLimit < 1 || issueLimit > 100) {
      throw new Error('issueLimit must be an integer between 1 and 100.');
    }

    const repository = await this.catalog.findById(repositoryId);

    if (!repository) {
      return {
        status: 'not_listed',
        repositoryId,
      };
    }

    const observedAt = this.now();

    logger.info('contribution_issues.ingestion_started', {
      repositoryId,
      fullName: repository.fullName,
      issueLimit,
    });

    try {
      const issues = await this.githubClient.fetchRepositoryIssues(
        {
          owner: repository.owner,
          name: repository.name,
        },
        issueLimit,
      );

      for (const issue of issues) {
        await this.issueStore.upsert(
          toUpsertInput(repository.id, issue, observedAt),
        );
      }

      logger.info('contribution_issues.ingestion_succeeded', {
        repositoryId,
        fullName: repository.fullName,
        fetchedCount: issues.length,
        persistedCount: issues.length,
      });

      return {
        status: 'ingested',
        repositoryId,
        fullName: repository.fullName,
        fetchedCount: issues.length,
        persistedCount: issues.length,
      };
    } catch (error) {
      if (error instanceof GithubApiError) {
        const decision = decideRetry(error, observedAt);

        logger.error('contribution_issues.ingestion_failed', {
          repositoryId,
          fullName: repository.fullName,
          kind: error.kind,
          status: error.status,
          retryAt: decision.retryAt?.toISOString() ?? null,
        });

        if (decision.kind === 'unavailable') {
          return {
            status: 'unavailable',
            repositoryId,
            fullName: repository.fullName,
            retryAt: decision.retryAt as Date,
          };
        }

        if (decision.kind === 'retry_later') {
          return {
            status: 'retry_later',
            repositoryId,
            fullName: repository.fullName,
            retryAt: decision.retryAt as Date,
          };
        }

        return {
          status: 'manual_review',
          repositoryId,
          fullName: repository.fullName,
          retryAt: null,
        };
      }

      throw error;
    }
  }
}
