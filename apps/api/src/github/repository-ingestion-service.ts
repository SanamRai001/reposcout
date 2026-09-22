import type {
  GithubClient,
  GithubRepositorySnapshot,
} from './github-client.js';
import {
  parseGithubRepositoryReference,
  type GithubRepositoryReference,
} from './github-repository-reference.js';
import type {
  UpsertRepositoryMetadataInput,
} from '../repositories/repository-metadata.js';
import type {
  RepositoryRecord,
  UpsertRepositoryInput,
} from '../repositories/repository.js';

type RepositoryWriter = Readonly<{
  upsertWithMetadata(
    input: UpsertRepositoryInput,
    metadata: UpsertRepositoryMetadataInput,
  ): Promise<RepositoryRecord>;
}>;

type GithubRepositoryReader = Pick<GithubClient, 'fetchRepository'>;

function toUpsertInput(
  repository: GithubRepositorySnapshot,
  syncedAt: Date,
): UpsertRepositoryInput {
  return {
    githubRepositoryId: repository.githubRepositoryId,
    owner: repository.owner,
    name: repository.name,
    fullName: repository.fullName,
    githubUrl: repository.githubUrl,
    defaultBranch: repository.defaultBranch,
    description: repository.description,
    isArchived: repository.isArchived,
    isFork: repository.isFork,
    createdAtGithub: repository.createdAtGithub,
    updatedAtGithub: repository.updatedAtGithub,
    pushedAtGithub: repository.pushedAtGithub,
    lastSyncedAt: syncedAt,
  };
}

export class RepositoryIngestionService {
  public constructor(
    private readonly githubClient: GithubRepositoryReader,
    private readonly repositoryStore: RepositoryWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async ingest(referenceValue: string): Promise<RepositoryRecord> {
    const reference: GithubRepositoryReference =
      parseGithubRepositoryReference(referenceValue);
    const fetchedAt = this.now();
    const repository = await this.githubClient.fetchRepository(reference);

    return this.repositoryStore.upsertWithMetadata(
      toUpsertInput(repository, fetchedAt),
      {
        stars: repository.metadata.stars,
        forks: repository.metadata.forks,
        openIssues: repository.metadata.openIssues,
        primaryLanguage: repository.metadata.primaryLanguage,
        licenseSpdx: repository.metadata.licenseSpdx,
        topics: repository.metadata.topics,
        observedAt: fetchedAt,
      },
    );
  }
}
