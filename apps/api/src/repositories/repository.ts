export type RepositoryDiscoveryStatus =
  | 'DISCOVERABLE'
  | 'PENDING_MODERATION'
  | 'REJECTED';

export type RepositoryRecord = Readonly<{
  id: string;
  githubRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  githubUrl: string;
  defaultBranch: string | null;
  description: string | null;
  isArchived: boolean;
  isFork: boolean;
  discoveryStatus: RepositoryDiscoveryStatus;
  createdAtGithub: Date;
  updatedAtGithub: Date;
  pushedAtGithub: Date | null;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}>;

export type UpsertRepositoryInput = Readonly<{
  githubRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  githubUrl: string;
  defaultBranch: string | null;
  description: string | null;
  isArchived: boolean;
  isFork: boolean;
  discoveryStatus: RepositoryDiscoveryStatus;
  createdAtGithub: Date;
  updatedAtGithub: Date;
  pushedAtGithub: Date | null;
  lastSyncedAt: Date;
}>;
