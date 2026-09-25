export type RepositorySubmissionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'DUPLICATE'
  | 'INVALID';

export type RepositorySubmissionValidationOutcome =
  | 'VALID'
  | 'DUPLICATE'
  | 'INVALID';

export type ResolvedRepositoryIdentity = Readonly<{
  githubRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  githubUrl: string;
}>;

export type RepositorySubmissionRecord = Readonly<{
  id: string;
  submittedUrl: string;
  normalizedOwner: string;
  normalizedName: string;
  normalizedFullName: string;
  status: RepositorySubmissionStatus;
  validationOutcome: RepositorySubmissionValidationOutcome | null;
  resolvedRepository: ResolvedRepositoryIdentity | null;
  duplicateRepositoryId: string | null;
  validatedAt: Date | null;
  handoffRepositoryId: string | null;
  evidenceHandoffCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CreateRepositorySubmissionInput = Readonly<{
  submittedUrl: string;
  normalizedOwner: string;
  normalizedName: string;
  normalizedFullName: string;
}>;

export type CreateRepositorySubmissionPolicy = Readonly<{
  requestedAt: Date;
  resubmissionCooldownMs: number;
}>;

export type CreateRepositorySubmissionResult =
  | Readonly<{
      kind: 'created';
      submission: RepositorySubmissionRecord;
    }>
  | Readonly<{
      kind: 'pending_duplicate';
      submission: RepositorySubmissionRecord;
    }>
  | Readonly<{
      kind: 'recent_terminal';
      submission: RepositorySubmissionRecord;
      retryAt: Date;
    }>;

export type RecordRepositorySubmissionValidationInput =
  | Readonly<{
      kind: 'valid';
      submissionId: string;
      repository: ResolvedRepositoryIdentity;
      validatedAt: Date;
    }>
  | Readonly<{
      kind: 'duplicate';
      submissionId: string;
      repository: ResolvedRepositoryIdentity;
      duplicateRepositoryId: string;
      validatedAt: Date;
    }>
  | Readonly<{
      kind: 'invalid';
      submissionId: string;
      validatedAt: Date;
    }>;


export type RecordRepositorySubmissionEvidenceHandoffInput = Readonly<{
  submissionId: string;
  repositoryId: string;
  completedAt: Date;
}>;
