import type { RepositoryCatalogReader } from '../repositories/repository-catalog.js';
import type {
  RepositoryContributionIssueIngestionResult,
} from './repository-contribution-issue-ingestion-service.js';

type IngestionRunner = Readonly<{
  ingestRepository(
    repositoryId: string,
    issueLimit: number,
  ): Promise<RepositoryContributionIssueIngestionResult>;
}>;

export const DEFAULT_CONTRIBUTION_REPOSITORY_BATCH_LIMIT = 20;
export const MAX_CONTRIBUTION_REPOSITORY_BATCH_LIMIT = 50;
export const DEFAULT_CONTRIBUTION_ISSUE_LIMIT = 50;
export const MAX_CONTRIBUTION_ISSUE_LIMIT = 100;

export type ContributionIssueBatchReport = Readonly<{
  status: 'completed' | 'halted';
  selected: number;
  processed: number;
  persistedIssues: number;
  items: readonly RepositoryContributionIssueIngestionResult[];
  haltedReason: 'retry_later' | 'manual_review' | null;
  retryAt: string | null;
  nextCursorRepositoryId: string | null;
}>;

export class RepositoryContributionIssueBatchService {
  public constructor(
    private readonly catalog: Pick<RepositoryCatalogReader, 'listPage'>,
    private readonly ingestion: IngestionRunner,
  ) {}

  async run(input: Readonly<{
    repositoryLimit?: number;
    issueLimit?: number;
    cursorRepositoryId?: string | null;
  }> = {}): Promise<ContributionIssueBatchReport> {
    const repositoryLimit =
      input.repositoryLimit ?? DEFAULT_CONTRIBUTION_REPOSITORY_BATCH_LIMIT;
    const issueLimit =
      input.issueLimit ?? DEFAULT_CONTRIBUTION_ISSUE_LIMIT;

    if (
      !Number.isInteger(repositoryLimit) ||
      repositoryLimit < 1 ||
      repositoryLimit > MAX_CONTRIBUTION_REPOSITORY_BATCH_LIMIT
    ) {
      throw new Error(
        'repositoryLimit must be an integer between 1 and 50.',
      );
    }

    if (
      !Number.isInteger(issueLimit) ||
      issueLimit < 1 ||
      issueLimit > MAX_CONTRIBUTION_ISSUE_LIMIT
    ) {
      throw new Error(
        'issueLimit must be an integer between 1 and 100.',
      );
    }

    const page = await this.catalog.listPage({
      limit: repositoryLimit,
      cursor: input.cursorRepositoryId
        ? { id: input.cursorRepositoryId }
        : null,
    });
    const items: RepositoryContributionIssueIngestionResult[] = [];
    let persistedIssues = 0;
    let haltedReason: 'retry_later' | 'manual_review' | null = null;
    let retryAt: string | null = null;
    let resumeAfterRepositoryId =
      input.cursorRepositoryId ?? null;

    for (const repository of page.items) {
      const result = await this.ingestion.ingestRepository(
        repository.id,
        issueLimit,
      );
      items.push(result);

      if (result.status === 'ingested') {
        persistedIssues += result.persistedCount;
        resumeAfterRepositoryId = repository.id;
        continue;
      }

      if (
        result.status === 'not_listed' ||
        result.status === 'unavailable'
      ) {
        resumeAfterRepositoryId = repository.id;
        continue;
      }

      haltedReason = result.status;
      retryAt =
        result.status === 'retry_later'
          ? result.retryAt.toISOString()
          : null;
      break;
    }

    const processed = items.length;
    const completedSelection = processed === page.items.length;
    const nextCursorRepositoryId =
      haltedReason !== null
        ? resumeAfterRepositoryId
        : page.hasMore && completedSelection
          ? page.items[page.items.length - 1]?.id ?? null
          : null;

    return {
      status: haltedReason === null ? 'completed' : 'halted',
      selected: page.items.length,
      processed,
      persistedIssues,
      items,
      haltedReason,
      retryAt,
      nextCursorRepositoryId,
    };
  }
}
