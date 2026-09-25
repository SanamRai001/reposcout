export type RepositorySubmissionModerationDecision =
  | 'APPROVED'
  | 'REJECTED';

export type RepositorySubmissionModerationEvent = Readonly<{
  id: string;
  submissionId: string;
  decision: RepositorySubmissionModerationDecision;
  reviewerRef: string;
  reason: string;
  createdAt: Date;
}>;

export type ModerateRepositorySubmissionInput = Readonly<{
  submissionId: string;
  decision: RepositorySubmissionModerationDecision;
  reviewerRef: string;
  reason: string;
  decidedAt: Date;
}>;

export type RepositorySubmissionModerationResult = Readonly<{
  submissionId: string;
  repositoryId: string;
  status: RepositorySubmissionModerationDecision;
  event: RepositorySubmissionModerationEvent;
}>;
