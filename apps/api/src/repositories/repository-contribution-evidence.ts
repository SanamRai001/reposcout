export type ContributionEvidenceStatus =
  | 'OBSERVED'
  | 'UNSUPPORTED_FORK';

export type LinkedContributionEvidence = Readonly<{
  apiUrl: string;
  htmlUrl: string;
}>;

export type SecurityPolicyEvidence = Readonly<{
  sourceRef: string;
  path: string;
  sha: string;
  sizeBytes: number;
}>;

export type RepositoryContributionEvidenceRecord = Readonly<{
  repositoryId: string;
  status: ContributionEvidenceStatus;
  contributing: LinkedContributionEvidence | null;
  codeOfConduct: LinkedContributionEvidence | null;
  issueTemplate: LinkedContributionEvidence | null;
  pullRequestTemplate: LinkedContributionEvidence | null;
  securityPolicy: SecurityPolicyEvidence | null;
  communityProfileUpdatedAt: Date | null;
  observedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}>;

export type UpsertRepositoryContributionEvidenceInput = Readonly<{
  repositoryId: string;
  status: ContributionEvidenceStatus;
  contributing: LinkedContributionEvidence | null;
  codeOfConduct: LinkedContributionEvidence | null;
  issueTemplate: LinkedContributionEvidence | null;
  pullRequestTemplate: LinkedContributionEvidence | null;
  securityPolicy: SecurityPolicyEvidence | null;
  communityProfileUpdatedAt: Date | null;
  observedAt: Date;
}>;
