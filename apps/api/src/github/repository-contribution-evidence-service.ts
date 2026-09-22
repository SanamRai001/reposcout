import type {
  GithubClient,
  GithubCommunityProfileSnapshot,
  GithubSecurityPolicySnapshot,
} from './github-client.js';
import type {
  RepositoryContributionEvidenceRecord,
  UpsertRepositoryContributionEvidenceInput,
} from '../repositories/repository-contribution-evidence.js';
import type { RepositoryRecord } from '../repositories/repository.js';

type ContributionEvidenceReader = Pick<
  GithubClient,
  'fetchCommunityProfile' | 'fetchSecurityPolicy'
>;

type ContributionEvidenceWriter = Readonly<{
  upsert(
    input: UpsertRepositoryContributionEvidenceInput,
  ): Promise<RepositoryContributionEvidenceRecord>;
}>;

function toObservedInput(
  repository: RepositoryRecord,
  profile: GithubCommunityProfileSnapshot,
  securityPolicy: GithubSecurityPolicySnapshot,
  observedAt: Date,
): UpsertRepositoryContributionEvidenceInput {
  return {
    repositoryId: repository.id,
    status: 'OBSERVED',
    contributing: profile.contributing,
    codeOfConduct: profile.codeOfConduct,
    issueTemplate: profile.issueTemplate,
    pullRequestTemplate: profile.pullRequestTemplate,
    securityPolicy:
      securityPolicy && repository.defaultBranch
        ? {
            sourceRef: repository.defaultBranch,
            path: securityPolicy.path,
            sha: securityPolicy.sha,
            sizeBytes: securityPolicy.sizeBytes,
          }
        : null,
    communityProfileUpdatedAt: profile.updatedAt,
    observedAt,
  };
}

function unsupportedForkInput(
  repository: RepositoryRecord,
  observedAt: Date,
): UpsertRepositoryContributionEvidenceInput {
  return {
    repositoryId: repository.id,
    status: 'UNSUPPORTED_FORK',
    contributing: null,
    codeOfConduct: null,
    issueTemplate: null,
    pullRequestTemplate: null,
    securityPolicy: null,
    communityProfileUpdatedAt: null,
    observedAt,
  };
}

export class RepositoryContributionEvidenceService {
  public constructor(
    private readonly githubClient: ContributionEvidenceReader,
    private readonly store: ContributionEvidenceWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async refresh(
    repository: RepositoryRecord,
  ): Promise<RepositoryContributionEvidenceRecord> {
    const observedAt = this.now();

    if (repository.isFork) {
      return this.store.upsert(
        unsupportedForkInput(repository, observedAt),
      );
    }

    const profile = await this.githubClient.fetchCommunityProfile({
      owner: repository.owner,
      name: repository.name,
    });

    const securityPolicy = repository.defaultBranch
      ? await this.githubClient.fetchSecurityPolicy(
          {
            owner: repository.owner,
            name: repository.name,
          },
          repository.defaultBranch,
        )
      : null;

    return this.store.upsert(
      toObservedInput(
        repository,
        profile,
        securityPolicy,
        observedAt,
      ),
    );
  }
}
