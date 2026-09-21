import type {
  GithubClient,
  GithubRepositorySnapshot,
} from './github-client.js';
import {
  parseGithubRepositoryReference,
  type GithubRepositoryReference,
} from './github-repository-reference.js';
import type {
  RepositoryRecord,
  UpsertRepositoryInput,
} from '../repositories/repository.js';

type RepositoryWriter = Readonly<{
  upsert(input: UpsertRepositoryInput): Promise<RepositoryRecord>;
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

    return this.repositoryStore.upsert(toUpsertInput(repository, fetchedAt));
  }
}
