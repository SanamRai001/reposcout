export type RepositorySnapshotRecord = Readonly<{
  id: string;
  repositoryId: string;
  capturedOn: string;
  capturedAt: Date;
  stars: number;
  forks: number;
  openIssues: number;
  createdAt: Date;
}>;

export type CaptureRepositorySnapshotInput = Readonly<{
  repositoryId: string;
  capturedAt: Date;
  stars: number;
  forks: number;
  openIssues: number;
}>;

export type CaptureRepositorySnapshotResult =
  | Readonly<{
      kind: 'created';
      snapshot: RepositorySnapshotRecord;
    }>
  | Readonly<{
      kind: 'existing';
      snapshot: RepositorySnapshotRecord;
    }>;
