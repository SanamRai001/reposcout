export type RepositoryMetadataRecord = Readonly<{
  repositoryId: string;
  stars: number;
  forks: number;
  openIssues: number;
  primaryLanguage: string | null;
  licenseSpdx: string | null;
  topics: string[];
  observedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}>;

export type UpsertRepositoryMetadataInput = Readonly<{
  stars: number;
  forks: number;
  openIssues: number;
  primaryLanguage: string | null;
  licenseSpdx: string | null;
  topics: string[];
  observedAt: Date;
}>;
