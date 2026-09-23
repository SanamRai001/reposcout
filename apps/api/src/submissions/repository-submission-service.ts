import {
  parseGithubRepositoryReference,
  type GithubRepositoryReference,
} from '../github/github-repository-reference.js';
import type {
  CreateRepositorySubmissionInput,
  RepositorySubmissionRecord,
} from './repository-submission.js';

export class InvalidRepositorySubmissionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidRepositorySubmissionError';
  }
}

export class RepositoryAlreadyIndexedError extends Error {
  public constructor() {
    super('Repository is already indexed by RepoScout.');
    this.name = 'RepositoryAlreadyIndexedError';
  }
}

export class RepositorySubmissionAlreadyPendingError extends Error {
  public constructor() {
    super('A pending submission already exists for this repository.');
    this.name = 'RepositorySubmissionAlreadyPendingError';
  }
}

type RepositoryLookup = Readonly<{
  existsByNormalizedFullName(
    normalizedFullName: string,
  ): Promise<boolean>;
}>;

type SubmissionWriter = Readonly<{
  createPending(
    input: CreateRepositorySubmissionInput,
  ): Promise<
    | Readonly<{
        kind: 'created';
        submission: RepositorySubmissionRecord;
      }>
    | Readonly<{
        kind: 'pending_duplicate';
        submission: RepositorySubmissionRecord;
      }>
  >;
}>;

export type NormalizedRepositorySubmission = Readonly<{
  submittedUrl: string;
  normalizedOwner: string;
  normalizedName: string;
  normalizedFullName: string;
}>;

export function normalizeRepositorySubmissionUrl(
  value: unknown,
): NormalizedRepositorySubmission {
  if (typeof value !== 'string') {
    throw new InvalidRepositorySubmissionError(
      'repositoryUrl must be a GitHub repository URL.',
    );
  }

  const candidate = value.trim();

  if (!candidate.includes('://')) {
    throw new InvalidRepositorySubmissionError(
      'repositoryUrl must be a GitHub repository URL.',
    );
  }

  let reference: GithubRepositoryReference;

  try {
    reference = parseGithubRepositoryReference(candidate);
  } catch (error) {
    throw new InvalidRepositorySubmissionError(
      error instanceof Error
        ? error.message
        : 'repositoryUrl must be a valid GitHub repository URL.',
    );
  }

  const normalizedOwner = reference.owner.toLowerCase();
  const normalizedName = reference.name.toLowerCase();
  const normalizedFullName = `${normalizedOwner}/${normalizedName}`;

  return {
    submittedUrl: `https://github.com/${normalizedFullName}`,
    normalizedOwner,
    normalizedName,
    normalizedFullName,
  };
}

export class RepositorySubmissionService {
  public constructor(
    private readonly repositoryLookup: RepositoryLookup,
    private readonly submissionWriter: SubmissionWriter,
  ) {}

  async submit(repositoryUrl: unknown): Promise<RepositorySubmissionRecord> {
    const normalized = normalizeRepositorySubmissionUrl(repositoryUrl);

    if (
      await this.repositoryLookup.existsByNormalizedFullName(
        normalized.normalizedFullName,
      )
    ) {
      throw new RepositoryAlreadyIndexedError();
    }

    const result = await this.submissionWriter.createPending(normalized);

    if (result.kind === 'pending_duplicate') {
      throw new RepositorySubmissionAlreadyPendingError();
    }

    return result.submission;
  }
}
