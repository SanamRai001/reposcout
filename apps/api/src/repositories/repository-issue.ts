export type RepositoryIssueState = 'open' | 'closed';

export type RepositoryIssueRecord = Readonly<{
  id: string;
  repositoryId: string;
  githubIssueId: string;
  number: number;
  title: string;
  htmlUrl: string;
  state: RepositoryIssueState;
  locked: boolean;
  assigneeCount: number;
  commentCount: number;
  labels: readonly string[];
  createdAtGithub: Date;
  updatedAtGithub: Date;
  observedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}>;

export type UpsertRepositoryIssueInput = Readonly<{
  repositoryId: string;
  githubIssueId: string;
  number: number;
  title: string;
  htmlUrl: string;
  state: RepositoryIssueState;
  locked: boolean;
  assigneeCount: number;
  commentCount: number;
  labels: readonly string[];
  createdAtGithub: Date;
  updatedAtGithub: Date;
  observedAt: Date;
}>;
