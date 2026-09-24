import type { RepositorySubmissionRecord } from './repository-submission.js';
import type {
  RepositorySubmissionEvidenceHandoffResult,
} from './repository-submission-evidence-handoff-service.js';

export const DEFAULT_SUBMISSION_EVIDENCE_HANDOFF_BATCH_LIMIT = 10;
export const MAX_SUBMISSION_EVIDENCE_HANDOFF_BATCH_LIMIT = 50;

type PendingEvidenceHandoffReader = Readonly<{
  listPendingEvidenceHandoffCandidates(
    limit: number,
  ): Promise<RepositorySubmissionRecord[]>;
}>;

type SubmissionEvidenceHandoff = Readonly<{
  handoff(
    submissionId: string,
  ): Promise<RepositorySubmissionEvidenceHandoffResult>;
}>;

export type RepositorySubmissionEvidenceHandoffBatchReport = Readonly<{
  selected: number;
  processed: number;
  remainingSelected: number;
  stoppedEarly: boolean;
  summary: Readonly<{
    completed: number;
    incomplete: number;
  }>;
  items: readonly RepositorySubmissionEvidenceHandoffResult[];
}>;

export function parseSubmissionEvidenceHandoffBatchLimit(
  value: unknown,
): number {
  if (value === undefined) {
    return DEFAULT_SUBMISSION_EVIDENCE_HANDOFF_BATCH_LIMIT;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(
      'Evidence handoff batch limit must be an integer between 1 and 50.',
    );
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_SUBMISSION_EVIDENCE_HANDOFF_BATCH_LIMIT
  ) {
    throw new Error(
      'Evidence handoff batch limit must be an integer between 1 and 50.',
    );
  }

  return parsed;
}

export class RepositorySubmissionEvidenceHandoffOrchestrator {
  public constructor(
    private readonly candidateReader: PendingEvidenceHandoffReader,
    private readonly handoffService: SubmissionEvidenceHandoff,
  ) {}

  async runBatch(
    limit: number = DEFAULT_SUBMISSION_EVIDENCE_HANDOFF_BATCH_LIMIT,
  ): Promise<RepositorySubmissionEvidenceHandoffBatchReport> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new Error(
        'Evidence handoff batch limit must be an integer between 1 and 50.',
      );
    }

    const candidates =
      await this.candidateReader.listPendingEvidenceHandoffCandidates(
        limit,
      );
    const items: RepositorySubmissionEvidenceHandoffResult[] = [];
    let stoppedEarly = false;

    for (const candidate of candidates) {
      const result = await this.handoffService.handoff(candidate.id);
      items.push(result);

      if (result.rateLimited) {
        stoppedEarly = true;
        break;
      }
    }

    let completed = 0;
    let incomplete = 0;

    for (const item of items) {
      if (item.kind === 'completed') {
        completed += 1;
      } else {
        incomplete += 1;
      }
    }

    return {
      selected: candidates.length,
      processed: items.length,
      remainingSelected: candidates.length - items.length,
      stoppedEarly,
      summary: {
        completed,
        incomplete,
      },
      items,
    };
  }
}
