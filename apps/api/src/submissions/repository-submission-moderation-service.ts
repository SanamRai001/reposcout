import type {
  ModerateRepositorySubmissionInput,
  RepositorySubmissionModerationDecision,
  RepositorySubmissionModerationResult,
} from './repository-submission-moderation.js';

type ModerationStoreResult =
  | Readonly<{
      kind: 'moderated';
      result: RepositorySubmissionModerationResult;
    }>
  | Readonly<{
      kind: 'not_found';
    }>
  | Readonly<{
      kind: 'not_eligible';
    }>
  | Readonly<{
      kind: 'already_moderated';
      decision: RepositorySubmissionModerationDecision;
    }>;

type ModerationStore = Readonly<{
  moderate(
    input: ModerateRepositorySubmissionInput,
  ): Promise<ModerationStoreResult>;
}>;

export class InvalidRepositorySubmissionModerationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidRepositorySubmissionModerationError';
  }
}

export class RepositorySubmissionModerationNotFoundError extends Error {
  public constructor() {
    super('Repository submission was not found.');
    this.name = 'RepositorySubmissionModerationNotFoundError';
  }
}

export class RepositorySubmissionNotEligibleForModerationError extends Error {
  public constructor() {
    super(
      'Repository submission is not eligible for moderation.',
    );
    this.name = 'RepositorySubmissionNotEligibleForModerationError';
  }
}

export class RepositorySubmissionAlreadyModeratedError extends Error {
  public constructor(
    public readonly decision: RepositorySubmissionModerationDecision,
  ) {
    super(
      `Repository submission was already moderated as ${decision}.`,
    );
    this.name = 'RepositorySubmissionAlreadyModeratedError';
  }
}

function normalizeReviewerRef(value: unknown): string {
  if (typeof value !== 'string') {
    throw new InvalidRepositorySubmissionModerationError(
      'reviewerRef must be a string between 1 and 200 characters.',
    );
  }

  const normalized = value.trim();

  if (normalized.length < 1 || normalized.length > 200) {
    throw new InvalidRepositorySubmissionModerationError(
      'reviewerRef must be a string between 1 and 200 characters.',
    );
  }

  return normalized;
}

function normalizeReason(value: unknown): string {
  if (typeof value !== 'string') {
    throw new InvalidRepositorySubmissionModerationError(
      'reason must be a string between 1 and 2000 characters.',
    );
  }

  const normalized = value.trim().replace(/\s+/g, ' ');

  if (normalized.length < 1 || normalized.length > 2000) {
    throw new InvalidRepositorySubmissionModerationError(
      'reason must be a string between 1 and 2000 characters.',
    );
  }

  return normalized;
}

function parseDecision(
  value: unknown,
): RepositorySubmissionModerationDecision {
  if (value === 'APPROVED' || value === 'REJECTED') {
    return value;
  }

  throw new InvalidRepositorySubmissionModerationError(
    'decision must be APPROVED or REJECTED.',
  );
}

export class RepositorySubmissionModerationService {
  public constructor(
    private readonly store: ModerationStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async moderate(input: Readonly<{
    submissionId: string;
    decision: unknown;
    reviewerRef: unknown;
    reason: unknown;
  }>): Promise<RepositorySubmissionModerationResult> {
    const decision = parseDecision(input.decision);
    const reviewerRef = normalizeReviewerRef(input.reviewerRef);
    const reason = normalizeReason(input.reason);

    const result = await this.store.moderate({
      submissionId: input.submissionId,
      decision,
      reviewerRef,
      reason,
      decidedAt: this.now(),
    });

    if (result.kind === 'moderated') {
      return result.result;
    }

    if (result.kind === 'not_found') {
      throw new RepositorySubmissionModerationNotFoundError();
    }

    if (result.kind === 'not_eligible') {
      throw new RepositorySubmissionNotEligibleForModerationError();
    }

    throw new RepositorySubmissionAlreadyModeratedError(
      result.decision,
    );
  }
}
