import {
  GithubApiError,
  type GithubApiErrorKind,
} from '../github/github-client.js';
import type {
  RepositoryIngestionOptions,
} from '../github/repository-ingestion-service.js';
import type { RepositoryRecord } from '../repositories/repository.js';
import type {
  RecordRepositorySubmissionEvidenceHandoffInput,
  RepositorySubmissionRecord,
} from './repository-submission.js';

export type RepositorySubmissionEvidenceHandoffStageName =
  | 'ingestion'
  | 'readme'
  | 'contribution';

export type RepositorySubmissionEvidenceHandoffStage =
  | Readonly<{
      stage: RepositorySubmissionEvidenceHandoffStageName;
      kind: 'completed';
    }>
  | Readonly<{
      stage: RepositorySubmissionEvidenceHandoffStageName;
      kind: 'retryable';
      errorKind: GithubApiErrorKind;
      message: string;
      retryAt: string | null;
    }>
  | Readonly<{
      stage: RepositorySubmissionEvidenceHandoffStageName;
      kind: 'skipped';
      reason: 'prerequisite_failed' | 'rate_limited';
    }>;

export type RepositorySubmissionEvidenceHandoffResult =
  | Readonly<{
      kind: 'completed';
      submissionId: string;
      repositoryId: string;
      alreadyCompleted: boolean;
      rateLimited: false;
      stages: readonly RepositorySubmissionEvidenceHandoffStage[];
    }>
  | Readonly<{
      kind: 'incomplete';
      submissionId: string;
      repositoryId: string | null;
      alreadyCompleted: false;
      rateLimited: boolean;
      stages: readonly RepositorySubmissionEvidenceHandoffStage[];
    }>;

type SubmissionHandoffStore = Readonly<{
  findById(id: string): Promise<RepositorySubmissionRecord | null>;
  recordEvidenceHandoffComplete(
    input: RecordRepositorySubmissionEvidenceHandoffInput,
  ): Promise<RepositorySubmissionRecord>;
}>;

type RepositoryIngester = Readonly<{
  ingest(
    referenceValue: string,
    options?: RepositoryIngestionOptions,
  ): Promise<RepositoryRecord>;
}>;

type RepositoryEvidenceRefresher = Readonly<{
  refresh(repository: RepositoryRecord): Promise<unknown>;
}>;

export class RepositorySubmissionEvidenceHandoffNotFoundError extends Error {
  public constructor() {
    super('Repository submission was not found.');
    this.name = 'RepositorySubmissionEvidenceHandoffNotFoundError';
  }
}

export class RepositorySubmissionNotEligibleForEvidenceHandoffError extends Error {
  public constructor() {
    super('Repository submission is not eligible for evidence handoff.');
    this.name =
      'RepositorySubmissionNotEligibleForEvidenceHandoffError';
  }
}

function retryableStage(
  stage: RepositorySubmissionEvidenceHandoffStageName,
  error: GithubApiError,
): RepositorySubmissionEvidenceHandoffStage {
  return {
    stage,
    kind: 'retryable',
    errorKind: error.kind,
    message: error.message,
    retryAt: error.retryAt?.toISOString() ?? null,
  };
}

function skippedStage(
  stage: RepositorySubmissionEvidenceHandoffStageName,
  reason: 'prerequisite_failed' | 'rate_limited',
): RepositorySubmissionEvidenceHandoffStage {
  return {
    stage,
    kind: 'skipped',
    reason,
  };
}

async function runEvidenceStage(
  stage: Exclude<
    RepositorySubmissionEvidenceHandoffStageName,
    'ingestion'
  >,
  refresh: () => Promise<unknown>,
): Promise<RepositorySubmissionEvidenceHandoffStage> {
  try {
    await refresh();
    return {
      stage,
      kind: 'completed',
    };
  } catch (error) {
    if (error instanceof GithubApiError) {
      return retryableStage(stage, error);
    }

    throw error;
  }
}

export class RepositorySubmissionEvidenceHandoffService {
  public constructor(
    private readonly submissionStore: SubmissionHandoffStore,
    private readonly repositoryIngester: RepositoryIngester,
    private readonly readmeRefresher: RepositoryEvidenceRefresher,
    private readonly contributionRefresher: RepositoryEvidenceRefresher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handoff(
    submissionId: string,
  ): Promise<RepositorySubmissionEvidenceHandoffResult> {
    const submission = await this.submissionStore.findById(submissionId);

    if (!submission) {
      throw new RepositorySubmissionEvidenceHandoffNotFoundError();
    }

    if (
      submission.handoffRepositoryId !== null &&
      submission.evidenceHandoffCompletedAt !== null
    ) {
      return {
        kind: 'completed',
        submissionId: submission.id,
        repositoryId: submission.handoffRepositoryId,
        alreadyCompleted: true,
        rateLimited: false,
        stages: [],
      };
    }

    if (
      submission.status !== 'PENDING' ||
      submission.validationOutcome !== 'VALID' ||
      !submission.resolvedRepository
    ) {
      throw new RepositorySubmissionNotEligibleForEvidenceHandoffError();
    }

    const stages: RepositorySubmissionEvidenceHandoffStage[] = [];
    let repository: RepositoryRecord;

    try {
      repository = await this.repositoryIngester.ingest(
        submission.resolvedRepository.githubUrl,
        {
          expectedGithubRepositoryId:
            submission.resolvedRepository.githubRepositoryId,
          initialListing: 'unlisted',
        },
      );
      stages.push({
        stage: 'ingestion',
        kind: 'completed',
      });
    } catch (error) {
      if (!(error instanceof GithubApiError)) {
        throw error;
      }

      stages.push(retryableStage('ingestion', error));

      const reason =
        error.kind === 'rate_limited'
          ? 'rate_limited'
          : 'prerequisite_failed';

      stages.push(skippedStage('readme', reason));
      stages.push(skippedStage('contribution', reason));

      return {
        kind: 'incomplete',
        submissionId: submission.id,
        repositoryId: null,
        alreadyCompleted: false,
        rateLimited: error.kind === 'rate_limited',
        stages,
      };
    }

    const readme = await runEvidenceStage(
      'readme',
      () => this.readmeRefresher.refresh(repository),
    );
    stages.push(readme);

    if (
      readme.kind === 'retryable' &&
      readme.errorKind === 'rate_limited'
    ) {
      stages.push(skippedStage('contribution', 'rate_limited'));

      return {
        kind: 'incomplete',
        submissionId: submission.id,
        repositoryId: repository.id,
        alreadyCompleted: false,
        rateLimited: true,
        stages,
      };
    }

    const contribution = await runEvidenceStage(
      'contribution',
      () => this.contributionRefresher.refresh(repository),
    );
    stages.push(contribution);

    if (
      readme.kind === 'retryable' ||
      contribution.kind === 'retryable'
    ) {
      return {
        kind: 'incomplete',
        submissionId: submission.id,
        repositoryId: repository.id,
        alreadyCompleted: false,
        rateLimited:
          contribution.kind === 'retryable' &&
          contribution.errorKind === 'rate_limited',
        stages,
      };
    }

    const completed = await this.submissionStore.recordEvidenceHandoffComplete({
      submissionId: submission.id,
      repositoryId: repository.id,
      completedAt: this.now(),
    });

    if (
      !completed.handoffRepositoryId ||
      !completed.evidenceHandoffCompletedAt
    ) {
      throw new Error(
        'Evidence handoff completion did not persist expected state.',
      );
    }

    return {
      kind: 'completed',
      submissionId: completed.id,
      repositoryId: completed.handoffRepositoryId,
      alreadyCompleted: false,
      rateLimited: false,
      stages,
    };
  }
}
