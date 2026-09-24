import {
  GithubApiError,
  type GithubApiErrorKind,
} from '../github/github-client.js';
import type { RepositorySubmissionRecord } from './repository-submission.js';

export const DEFAULT_SUBMISSION_VALIDATION_BATCH_LIMIT = 10;
export const MAX_SUBMISSION_VALIDATION_BATCH_LIMIT = 50;

type PendingValidationReader = Readonly<{
  listPendingValidationCandidates(
    limit: number,
  ): Promise<RepositorySubmissionRecord[]>;
}>;

type SubmissionValidator = Readonly<{
  validate(submissionId: string): Promise<RepositorySubmissionRecord>;
}>;

export type RepositorySubmissionValidationBatchItem =
  | Readonly<{
      kind: 'validated';
      submissionId: string;
      status: RepositorySubmissionRecord['status'];
      validationOutcome: NonNullable<
        RepositorySubmissionRecord['validationOutcome']
      >;
    }>
  | Readonly<{
      kind: 'retryable';
      submissionId: string;
      errorKind: Exclude<GithubApiErrorKind, 'not_found'>;
      message: string;
      retryAt: string | null;
    }>;

export type RepositorySubmissionValidationBatchReport = Readonly<{
  selected: number;
  processed: number;
  remainingSelected: number;
  stoppedEarly: boolean;
  summary: Readonly<{
    valid: number;
    duplicate: number;
    invalid: number;
    retryable: number;
  }>;
  items: readonly RepositorySubmissionValidationBatchItem[];
}>;

export function parseSubmissionValidationBatchLimit(
  value: unknown,
): number {
  if (value === undefined) {
    return DEFAULT_SUBMISSION_VALIDATION_BATCH_LIMIT;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(
      'Validation batch limit must be an integer between 1 and 50.',
    );
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_SUBMISSION_VALIDATION_BATCH_LIMIT
  ) {
    throw new Error(
      'Validation batch limit must be an integer between 1 and 50.',
    );
  }

  return parsed;
}

function isRetryableGithubError(
  error: unknown,
): error is GithubApiError & {
  kind: Exclude<GithubApiErrorKind, 'not_found'>;
} {
  return (
    error instanceof GithubApiError &&
    error.kind !== 'not_found'
  );
}

export class RepositorySubmissionValidationOrchestrator {
  public constructor(
    private readonly candidateReader: PendingValidationReader,
    private readonly validator: SubmissionValidator,
  ) {}

  async runBatch(
    limit: number = DEFAULT_SUBMISSION_VALIDATION_BATCH_LIMIT,
  ): Promise<RepositorySubmissionValidationBatchReport> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new Error(
        'Validation batch limit must be an integer between 1 and 50.',
      );
    }

    const candidates =
      await this.candidateReader.listPendingValidationCandidates(limit);
    const items: RepositorySubmissionValidationBatchItem[] = [];
    let stoppedEarly = false;

    for (const candidate of candidates) {
      try {
        const result = await this.validator.validate(candidate.id);

        if (!result.validationOutcome) {
          throw new Error(
            'Validation completed without a deterministic outcome.',
          );
        }

        items.push({
          kind: 'validated',
          submissionId: result.id,
          status: result.status,
          validationOutcome: result.validationOutcome,
        });
      } catch (error) {
        if (!isRetryableGithubError(error)) {
          throw error;
        }

        items.push({
          kind: 'retryable',
          submissionId: candidate.id,
          errorKind: error.kind,
          message: error.message,
          retryAt: error.retryAt?.toISOString() ?? null,
        });

        if (error.kind === 'rate_limited') {
          stoppedEarly = true;
          break;
        }
      }
    }

    const summary = {
      valid: 0,
      duplicate: 0,
      invalid: 0,
      retryable: 0,
    };

    for (const item of items) {
      if (item.kind === 'retryable') {
        summary.retryable += 1;
        continue;
      }

      if (item.validationOutcome === 'VALID') {
        summary.valid += 1;
      } else if (item.validationOutcome === 'DUPLICATE') {
        summary.duplicate += 1;
      } else {
        summary.invalid += 1;
      }
    }

    return {
      selected: candidates.length,
      processed: items.length,
      remainingSelected: candidates.length - items.length,
      stoppedEarly,
      summary,
      items,
    };
  }
}
