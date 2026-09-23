export type RepositorySubmissionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'DUPLICATE'
  | 'INVALID';

export type RepositorySubmissionRecord = Readonly<{
  id: string;
  submittedUrl: string;
  normalizedOwner: string;
  normalizedName: string;
  normalizedFullName: string;
  status: RepositorySubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CreateRepositorySubmissionInput = Readonly<{
  submittedUrl: string;
  normalizedOwner: string;
  normalizedName: string;
  normalizedFullName: string;
}>;

export type CreateRepositorySubmissionResult =
  | Readonly<{
      kind: 'created';
      submission: RepositorySubmissionRecord;
    }>
  | Readonly<{
      kind: 'pending_duplicate';
      submission: RepositorySubmissionRecord;
    }>;
