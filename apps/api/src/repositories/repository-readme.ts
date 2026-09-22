export const REPOSITORY_README_MAX_BYTES = 256 * 1024;

export type RepositoryReadmeStatus =
  | 'PRESENT'
  | 'NOT_FOUND'
  | 'TOO_LARGE';

export type RepositoryReadmeRecord = Readonly<{
  repositoryId: string;
  status: RepositoryReadmeStatus;
  sourceRef: string | null;
  path: string | null;
  sha: string | null;
  sizeBytes: number | null;
  content: string | null;
  observedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}>;

export type UpsertRepositoryReadmeInput = Readonly<{
  repositoryId: string;
  status: RepositoryReadmeStatus;
  sourceRef: string | null;
  path: string | null;
  sha: string | null;
  sizeBytes: number | null;
  content: string | null;
  observedAt: Date;
}>;
