import {
  GithubApiError,
  type GithubClient,
  type GithubRepositorySnapshot,
} from '../github/github-client.js';
import type { RepositoryRecord } from '../repositories/repository.js';
import type {
  RecordRepositorySubmissionValidationInput,
  RepositorySubmissionRecord,
  ResolvedRepositoryIdentity,
} from './repository-submission.js';

type RepositoryResolver = Pick<GithubClient, 'fetchRepository'>;

type RepositoryIdentityLookup = Readonly<{
  findListedByGithubRepositoryId(
    githubRepositoryId: string,
  ): Promise<RepositoryRecord | null>;
}>;

type SubmissionValidationStore = Readonly<{
  findById(id: string): Promise<RepositorySubmissionRecord | null>;
  recordValidation(
    input: RecordRepositorySubmissionValidationInput,
  ): Promise<RepositorySubmissionRecord>;
}>;

export class RepositorySubmissionNotFoundError extends Error {
  public constructor() {
    super('Repository submission was not found.');
    this.name = 'RepositorySubmissionNotFoundError';
  }
}

export class RepositorySubmissionNotEligibleForValidationError extends Error {
  public constructor() {
    super('Repository submission is not eligible for validation.');
    this.name = 'RepositorySubmissionNotEligibleForValidationError';
  }
}

function resolvedIdentity(
  snapshot: GithubRepositorySnapshot,
): ResolvedRepositoryIdentity {
  return {
    githubRepositoryId: snapshot.githubRepositoryId,
    owner: snapshot.owner,
    name: snapshot.name,
    fullName: snapshot.fullName,
    githubUrl: snapshot.githubUrl,
  };
}

export class RepositorySubmissionValidationService {
  public constructor(
    private readonly githubClient: RepositoryResolver,
    private readonly repositoryLookup: RepositoryIdentityLookup,
    private readonly submissionStore: SubmissionValidationStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async validate(
    submissionId: string,
  ): Promise<RepositorySubmissionRecord> {
    const submission = await this.submissionStore.findById(submissionId);

    if (!submission) {
      throw new RepositorySubmissionNotFoundError();
    }

    if (submission.validationOutcome !== null) {
      return submission;
    }

    if (submission.status !== 'PENDING') {
      throw new RepositorySubmissionNotEligibleForValidationError();
    }

    let snapshot: GithubRepositorySnapshot;

    try {
      snapshot = await this.githubClient.fetchRepository({
        owner: submission.normalizedOwner,
        name: submission.normalizedName,
      });
    } catch (error) {
      if (error instanceof GithubApiError && error.kind === 'not_found') {
        return this.submissionStore.recordValidation({
          kind: 'invalid',
          submissionId: submission.id,
          validatedAt: this.now(),
        });
      }

      throw error;
    }

    if (snapshot.isPrivate) {
      return this.submissionStore.recordValidation({
        kind: 'invalid',
        submissionId: submission.id,
        validatedAt: this.now(),
      });
    }

    const repository = resolvedIdentity(snapshot);
    const indexed =
      await this.repositoryLookup.findListedByGithubRepositoryId(
        snapshot.githubRepositoryId,
      );

    if (indexed) {
      return this.submissionStore.recordValidation({
        kind: 'duplicate',
        submissionId: submission.id,
        repository,
        duplicateRepositoryId: indexed.id,
        validatedAt: this.now(),
      });
    }

    return this.submissionStore.recordValidation({
      kind: 'valid',
      submissionId: submission.id,
      repository,
      validatedAt: this.now(),
    });
  }
}
