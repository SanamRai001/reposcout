import {
  GithubApiError,
} from './github-client.js';
import { RepositoryIngestionService } from './repository-ingestion-service.js';
import {
  decideRetry,
  evaluateRefreshEligibility,
} from './repository-refresh-policy.js';
import { parseGithubRepositoryReference } from './github-repository-reference.js';
import { logger } from '../logger.js';
import type { RepositoryRecord } from '../repositories/repository.js';

type RepositoryLookup = Readonly<{
  findByFullName(fullName: string): Promise<RepositoryRecord[]>;
}>;

type IngestionRunner = Pick<RepositoryIngestionService, 'ingest'>;

export type RepositoryRefreshResult =
  | Readonly<{
      status: 'refreshed';
      repository: RepositoryRecord;
    }>
  | Readonly<{
      status: 'skipped';
      repository: RepositoryRecord;
      nextEligibleAt: Date;
    }>
  | Readonly<{
      status: 'unavailable';
      repository: RepositoryRecord | null;
      retryAt: Date;
    }>
  | Readonly<{
      status: 'retry_later';
      repository: RepositoryRecord | null;
      retryAt: Date;
    }>
  | Readonly<{
      status: 'manual_review';
      repository: RepositoryRecord | null;
      retryAt: null;
    }>;

export class RepositoryRefreshService {
  public constructor(
    private readonly repositoryStore: RepositoryLookup,
    private readonly ingestionService: IngestionRunner,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async refresh(
    referenceValue: string,
    options: Readonly<{ force?: boolean }> = {},
  ): Promise<RepositoryRefreshResult> {
    const reference = parseGithubRepositoryReference(referenceValue);
    const fullName = `${reference.owner}/${reference.name}`;
    const now = this.now();
    const matches = await this.repositoryStore.findByFullName(fullName);
    const existing = matches.length === 1 ? matches[0] ?? null : null;

    if (existing && !options.force) {
      const eligibility = evaluateRefreshEligibility(existing, now);

      if (!eligibility.shouldRefresh) {
        logger.info('ingestion.refresh_skipped', {
          githubRepositoryId: existing.githubRepositoryId,
          fullName: existing.fullName,
          nextEligibleAt: eligibility.nextEligibleAt.toISOString(),
        });

        return {
          status: 'skipped',
          repository: existing,
          nextEligibleAt: eligibility.nextEligibleAt,
        };
      }
    }

    logger.info('ingestion.refresh_started', {
      fullName,
      forced: options.force === true,
    });

    try {
      const repository = await this.ingestionService.ingest(referenceValue);

      logger.info('ingestion.refresh_succeeded', {
        githubRepositoryId: repository.githubRepositoryId,
        fullName: repository.fullName,
      });

      return {
        status: 'refreshed',
        repository,
      };
    } catch (error) {
      if (error instanceof GithubApiError) {
        const decision = decideRetry(error, now);

        logger.error('ingestion.refresh_failed', {
          fullName,
          kind: error.kind,
          status: error.status,
          retryAt: decision.retryAt?.toISOString() ?? null,
          preservedRepository: existing !== null,
        });

        if (decision.kind === 'unavailable') {
          return {
            status: 'unavailable',
            repository: existing,
            retryAt: decision.retryAt as Date,
          };
        }

        if (decision.kind === 'retry_later') {
          return {
            status: 'retry_later',
            repository: existing,
            retryAt: decision.retryAt as Date,
          };
        }

        return {
          status: 'manual_review',
          repository: existing,
          retryAt: null,
        };
      }

      logger.error('ingestion.refresh_unexpected_error', {
        fullName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }
}
