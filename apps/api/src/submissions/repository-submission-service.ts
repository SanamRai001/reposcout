import {
  parseGithubRepositoryReference,
  type GithubRepositoryReference,
} from '../github/github-repository-reference.js';
import type {
  CreateRepositorySubmissionInput,
  CreateRepositorySubmissionPolicy,
  CreateRepositorySubmissionResult,
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

export class RepositorySubmissionCooldownError extends Error {
  public constructor(public readonly retryAfterSeconds: number) {
    super(
      'This repository was recently processed. Please wait before submitting it again.',
    );
    this.name = 'RepositorySubmissionCooldownError';
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
    policy: CreateRepositorySubmissionPolicy,
  ): Promise<CreateRepositorySubmissionResult>;
}>;

type RepositorySubmissionServiceOptions = Readonly<{
  resubmissionCooldownMs?: number;
  now?: () => Date;
}>;

const DEFAULT_RESUBMISSION_COOLDOWN_MS = 86_400_000;

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
  private readonly resubmissionCooldownMs: number;
  private readonly now: () => Date;

  public constructor(
    private readonly repositoryLookup: RepositoryLookup,
    private readonly submissionWriter: SubmissionWriter,
    options: RepositorySubmissionServiceOptions = {},
  ) {
    this.resubmissionCooldownMs =
      options.resubmissionCooldownMs ?? DEFAULT_RESUBMISSION_COOLDOWN_MS;
    this.now = options.now ?? (() => new Date());

    if (
      !Number.isInteger(this.resubmissionCooldownMs) ||
      this.resubmissionCooldownMs < 60_000 ||
      this.resubmissionCooldownMs > 2_592_000_000
    ) {
      throw new Error(
        'resubmissionCooldownMs must be an integer between 60000 and 2592000000.',
      );
    }
  }

  async submit(repositoryUrl: unknown): Promise<RepositorySubmissionRecord> {
    const normalized = normalizeRepositorySubmissionUrl(repositoryUrl);

    if (
      await this.repositoryLookup.existsByNormalizedFullName(
        normalized.normalizedFullName,
      )
    ) {
      throw new RepositoryAlreadyIndexedError();
    }

    const requestedAt = this.now();
    const result = await this.submissionWriter.createPending(normalized, {
      requestedAt,
      resubmissionCooldownMs: this.resubmissionCooldownMs,
    });

    if (result.kind === 'pending_duplicate') {
      throw new RepositorySubmissionAlreadyPendingError();
    }

    if (result.kind === 'recent_terminal') {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (result.retryAt.getTime() - requestedAt.getTime()) / 1_000,
        ),
      );

      throw new RepositorySubmissionCooldownError(retryAfterSeconds);
    }

    return result.submission;
  }
}
