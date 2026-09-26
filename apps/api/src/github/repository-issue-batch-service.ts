import {
  GithubApiError,
} from './github-client.js';
import {
  decideRetry,
} from './repository-refresh-policy.js';
import type { RepositoryIssueIngestionService } from './repository-issue-ingestion-service.js';
import type {
  RepositoryCatalogReader,
  RepositoryCursor,
} from '../repositories/repository-catalog.js';

export const DEFAULT_ISSUE_REPOSITORY_BATCH_LIMIT = 10;
export const MAX_ISSUE_REPOSITORY_BATCH_LIMIT = 50;
export const DEFAULT_ISSUES_PER_REPOSITORY_LIMIT = 50;
export const MAX_ISSUES_PER_REPOSITORY_LIMIT = 100;

export type RepositoryIssueBatchItem =
  | Readonly<{
      repositoryId: string;
      fullName: string;
      status: 'refreshed';
      fetchedItems: number;
      storedIssues: number;
      excludedPullRequests: number;
    }>
  | Readonly<{
      repositoryId: string;
      fullName: string;
      status: 'unavailable' | 'retry_later' | 'manual_review';
      retryAt: string | null;
    }>;

export type RepositoryIssueBatchReport = Readonly<{
  status: 'completed' | 'halted';
  repositoryLimit: number;
  issuesPerRepositoryLimit: number;
  selected: number;
  processed: number;
  refreshedRepositories: number;
  storedIssues: number;
  excludedPullRequests: number;
  haltedReason: 'retry_later' | 'manual_review' | null;
  retryAt: string | null;
  nextCursor: RepositoryCursor | null;
  items: readonly RepositoryIssueBatchItem[];
}>;

type IssueRefreshRunner = Pick<
  RepositoryIssueIngestionService,
  'refresh'
>;

function assertLimit(
  name: string,
  value: number,
  maximum: number,
): void {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(
      `${name} must be an integer between 1 and ${maximum}.`,
    );
  }
}

export function parseIssueBatchLimit(
  name: 'repositoryLimit' | 'issuesPerRepositoryLimit',
  value: unknown,
): number {
  const defaults = {
    repositoryLimit: DEFAULT_ISSUE_REPOSITORY_BATCH_LIMIT,
    issuesPerRepositoryLimit:
      DEFAULT_ISSUES_PER_REPOSITORY_LIMIT,
  } as const;
  const maximums = {
    repositoryLimit: MAX_ISSUE_REPOSITORY_BATCH_LIMIT,
    issuesPerRepositoryLimit:
      MAX_ISSUES_PER_REPOSITORY_LIMIT,
  } as const;

  if (value === undefined) {
    return defaults[name];
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(
      `${name} must be an integer between 1 and ${maximums[name]}.`,
    );
  }

  const parsed = Number(value);
  assertLimit(name, parsed, maximums[name]);
  return parsed;
}

export class RepositoryIssueBatchService {
  public constructor(
    private readonly catalog: RepositoryCatalogReader,
    private readonly ingestion: IssueRefreshRunner,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(input: Readonly<{
    repositoryLimit?: number;
    issuesPerRepositoryLimit?: number;
    cursor?: RepositoryCursor | null;
  }> = {}): Promise<RepositoryIssueBatchReport> {
    const repositoryLimit =
      input.repositoryLimit ?? DEFAULT_ISSUE_REPOSITORY_BATCH_LIMIT;
    const issuesPerRepositoryLimit =
      input.issuesPerRepositoryLimit ??
      DEFAULT_ISSUES_PER_REPOSITORY_LIMIT;

    assertLimit(
      'repositoryLimit',
      repositoryLimit,
      MAX_ISSUE_REPOSITORY_BATCH_LIMIT,
    );
    assertLimit(
      'issuesPerRepositoryLimit',
      issuesPerRepositoryLimit,
      MAX_ISSUES_PER_REPOSITORY_LIMIT,
    );

    const page = await this.catalog.listPage({
      limit: repositoryLimit,
      cursor: input.cursor ?? null,
    });
    const items: RepositoryIssueBatchItem[] = [];
    let haltedReason: 'retry_later' | 'manual_review' | null = null;
    let retryAt: string | null = null;
    let lastCompletedRepositoryId =
      input.cursor?.id ?? null;

    for (const repository of page.items) {
      try {
        const result = await this.ingestion.refresh(
          repository,
          issuesPerRepositoryLimit,
        );

        items.push({
          repositoryId: repository.id,
          fullName: repository.fullName,
          status: 'refreshed',
          fetchedItems: result.fetchedItems,
          storedIssues: result.issues.length,
          excludedPullRequests: result.excludedPullRequests,
        });
        lastCompletedRepositoryId = repository.id;
      } catch (error) {
        if (!(error instanceof GithubApiError)) {
          throw error;
        }

        const decision = decideRetry(error, this.now());

        if (decision.kind === 'unavailable') {
          items.push({
            repositoryId: repository.id,
            fullName: repository.fullName,
            status: 'unavailable',
            retryAt: decision.retryAt?.toISOString() ?? null,
          });
          lastCompletedRepositoryId = repository.id;
          continue;
        }

        if (decision.kind === 'retry_later') {
          haltedReason = 'retry_later';
          retryAt = decision.retryAt?.toISOString() ?? null;
          items.push({
            repositoryId: repository.id,
            fullName: repository.fullName,
            status: 'retry_later',
            retryAt,
          });
          break;
        }

        haltedReason = 'manual_review';
        items.push({
          repositoryId: repository.id,
          fullName: repository.fullName,
          status: 'manual_review',
          retryAt: null,
        });
        break;
      }
    }

    const refreshed = items.filter(
      (item) => item.status === 'refreshed',
    );
    const completedAllSelected = items.length === page.items.length;
    const nextCursor =
      haltedReason !== null
        ? lastCompletedRepositoryId
          ? { id: lastCompletedRepositoryId }
          : null
        : page.hasMore && completedAllSelected && lastCompletedRepositoryId
          ? { id: lastCompletedRepositoryId }
          : null;

    return {
      status: haltedReason === null ? 'completed' : 'halted',
      repositoryLimit,
      issuesPerRepositoryLimit,
      selected: page.items.length,
      processed: items.length,
      refreshedRepositories: refreshed.length,
      storedIssues: refreshed.reduce(
        (sum, item) =>
          sum +
          (item.status === 'refreshed'
            ? item.storedIssues
            : 0),
        0,
      ),
      excludedPullRequests: refreshed.reduce(
        (sum, item) =>
          sum +
          (item.status === 'refreshed'
            ? item.excludedPullRequests
            : 0),
        0,
      ),
      haltedReason,
      retryAt,
      nextCursor,
      items,
    };
  }
}
