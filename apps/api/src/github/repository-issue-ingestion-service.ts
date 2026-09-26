import type {
  GithubClient,
  GithubIssuePageSnapshot,
} from './github-client.js';
import type { RepositoryIssueRecord } from '../repositories/repository-issue.js';
import type { RepositoryIssueStore } from '../repositories/repository-issue-store.js';
import type { RepositoryRecord } from '../repositories/repository.js';

type IssueReader = Pick<GithubClient, 'fetchIssues'>;
type IssueWriter = Pick<RepositoryIssueStore, 'upsertMany'>;

export type RepositoryIssueIngestionReport = Readonly<{
  repositoryId: string;
  fullName: string;
  requestedLimit: number;
  fetchedItems: number;
  excludedPullRequests: number;
  issues: readonly RepositoryIssueRecord[];
}>;

export class RepositoryIssueIngestionService {
  public constructor(
    private readonly githubClient: IssueReader,
    private readonly issueStore: IssueWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async refresh(
    repository: RepositoryRecord,
    limit: number,
  ): Promise<RepositoryIssueIngestionReport> {
    const page: GithubIssuePageSnapshot =
      await this.githubClient.fetchIssues(
        {
          owner: repository.owner,
          name: repository.name,
        },
        limit,
      );
    const observedAt = this.now();

    const issues = await this.issueStore.upsertMany(
      page.issues.map((issue) => ({
        repositoryId: repository.id,
        githubIssueId: issue.githubIssueId,
        number: issue.number,
        title: issue.title,
        htmlUrl: issue.htmlUrl,
        state: issue.state,
        locked: issue.locked,
        assigneeCount: issue.assigneeCount,
        commentCount: issue.commentCount,
        labels: issue.labels,
        createdAtGithub: issue.createdAt,
        updatedAtGithub: issue.updatedAt,
        observedAt,
      })),
    );

    return {
      repositoryId: repository.id,
      fullName: repository.fullName,
      requestedLimit: limit,
      fetchedItems: page.fetchedItems,
      excludedPullRequests: page.excludedPullRequests,
      issues,
    };
  }
}
