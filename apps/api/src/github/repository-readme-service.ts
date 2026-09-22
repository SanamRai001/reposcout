import type {
  GithubClient,
  GithubReadmeSnapshot,
} from './github-client.js';
import type {
  RepositoryReadmeRecord,
  UpsertRepositoryReadmeInput,
} from '../repositories/repository-readme.js';
import type { RepositoryRecord } from '../repositories/repository.js';

type ReadmeReader = Pick<GithubClient, 'fetchReadme'>;

type ReadmeWriter = Readonly<{
  upsert(
    input: UpsertRepositoryReadmeInput,
  ): Promise<RepositoryReadmeRecord>;
}>;

function toPersistenceInput(
  repository: RepositoryRecord,
  snapshot: GithubReadmeSnapshot,
  observedAt: Date,
): UpsertRepositoryReadmeInput {
  const sourceRef = repository.defaultBranch;

  if (snapshot.status === 'present') {
    if (!sourceRef) {
      throw new Error(
        'A present README cannot be attributed without a repository default branch.',
      );
    }

    return {
      repositoryId: repository.id,
      status: 'PRESENT',
      sourceRef,
      path: snapshot.path,
      sha: snapshot.sha,
      sizeBytes: snapshot.sizeBytes,
      content: snapshot.content,
      observedAt,
    };
  }

  if (snapshot.status === 'too_large') {
    if (!sourceRef) {
      throw new Error(
        'An oversized README cannot be attributed without a repository default branch.',
      );
    }

    return {
      repositoryId: repository.id,
      status: 'TOO_LARGE',
      sourceRef,
      path: snapshot.path,
      sha: snapshot.sha,
      sizeBytes: snapshot.sizeBytes,
      content: null,
      observedAt,
    };
  }

  return {
    repositoryId: repository.id,
    status: 'NOT_FOUND',
    sourceRef,
    path: null,
    sha: null,
    sizeBytes: null,
    content: null,
    observedAt,
  };
}

export class RepositoryReadmeService {
  public constructor(
    private readonly githubClient: ReadmeReader,
    private readonly readmeStore: ReadmeWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async refresh(
    repository: RepositoryRecord,
  ): Promise<RepositoryReadmeRecord> {
    const snapshot = repository.defaultBranch
      ? await this.githubClient.fetchReadme(
          {
            owner: repository.owner,
            name: repository.name,
          },
          repository.defaultBranch,
        )
      : ({ status: 'not_found' } as const);

    return this.readmeStore.upsert(
      toPersistenceInput(repository, snapshot, this.now()),
    );
  }
}
