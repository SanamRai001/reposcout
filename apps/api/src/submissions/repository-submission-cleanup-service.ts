export type RepositorySubmissionCleanupStatus =
  | 'INVALID'
  | 'DUPLICATE';

export type RepositorySubmissionCleanupCandidate = Readonly<{
  id: string;
  status: RepositorySubmissionCleanupStatus;
  updatedAt: Date;
}>;

type CleanupStore = Readonly<{
  listCleanupCandidates(
    cutoff: Date,
    limit: number,
  ): Promise<RepositorySubmissionCleanupCandidate[]>;
  deleteCleanupCandidates(
    cutoff: Date,
    limit: number,
  ): Promise<RepositorySubmissionCleanupCandidate[]>;
}>;

export type RepositorySubmissionCleanupMode = 'preview' | 'apply';

export type RepositorySubmissionCleanupReport = Readonly<{
  mode: RepositorySubmissionCleanupMode;
  cutoff: Date;
  retentionDays: number;
  selected: number;
  deleted: number;
  summary: Readonly<{
    invalid: number;
    duplicate: number;
  }>;
  items: readonly RepositorySubmissionCleanupCandidate[];
}>;

type RepositorySubmissionCleanupServiceOptions = Readonly<{
  retentionDays: number;
  now?: () => Date;
}>;

const MILLISECONDS_PER_DAY = 86_400_000;
const DEFAULT_BATCH_LIMIT = 100;
const MAX_BATCH_LIMIT = 1_000;

export function parseSubmissionCleanupBatchLimit(
  value: string | undefined,
): number {
  if (value === undefined) {
    return DEFAULT_BATCH_LIMIT;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Cleanup batch limit must be an integer between 1 and ${MAX_BATCH_LIMIT}.`,
    );
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_BATCH_LIMIT
  ) {
    throw new Error(
      `Cleanup batch limit must be an integer between 1 and ${MAX_BATCH_LIMIT}.`,
    );
  }

  return parsed;
}

export class RepositorySubmissionCleanupService {
  private readonly retentionDays: number;
  private readonly now: () => Date;

  public constructor(
    private readonly store: CleanupStore,
    options: RepositorySubmissionCleanupServiceOptions,
  ) {
    this.retentionDays = options.retentionDays;
    this.now = options.now ?? (() => new Date());

    if (
      !Number.isInteger(this.retentionDays) ||
      this.retentionDays < 31 ||
      this.retentionDays > 3_650
    ) {
      throw new Error(
        'retentionDays must be an integer between 31 and 3650.',
      );
    }
  }

  async run(
    mode: RepositorySubmissionCleanupMode,
    limit: number,
  ): Promise<RepositorySubmissionCleanupReport> {
    const batchLimit = parseSubmissionCleanupBatchLimit(String(limit));
    const now = this.now();

    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
      throw new Error('Cleanup clock must return a valid date.');
    }

    const cutoff = new Date(
      now.getTime() - this.retentionDays * MILLISECONDS_PER_DAY,
    );

    const items =
      mode === 'apply'
        ? await this.store.deleteCleanupCandidates(cutoff, batchLimit)
        : await this.store.listCleanupCandidates(cutoff, batchLimit);

    const summary = {
      invalid: items.filter((item) => item.status === 'INVALID').length,
      duplicate: items.filter((item) => item.status === 'DUPLICATE').length,
    };

    return {
      mode,
      cutoff,
      retentionDays: this.retentionDays,
      selected: items.length,
      deleted: mode === 'apply' ? items.length : 0,
      summary,
      items,
    };
  }
}
