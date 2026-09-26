export type RepositoryContributionIssueState = 'open' | 'closed';

export type RepositoryContributionIssueRecord = Readonly<{
  id: string;
  repositoryId: string;
  githubIssueId: string;
  number: number;
  title: string;
  githubUrl: string;
  state: RepositoryContributionIssueState;
  locked: boolean;
  assigneeCount: number;
  commentCount: number;
  labels: string[];
  createdAtGithub: Date;
  updatedAtGithub: Date;
  observedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}>;

export type UpsertRepositoryContributionIssueInput = Readonly<{
  repositoryId: string;
  githubIssueId: string;
  number: number;
  title: string;
  githubUrl: string;
  state: RepositoryContributionIssueState;
  locked: boolean;
  assigneeCount: number;
  commentCount: number;
  labels: readonly string[];
  createdAtGithub: Date;
  updatedAtGithub: Date;
  observedAt: Date;
}>;
