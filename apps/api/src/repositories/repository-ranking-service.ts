import type {
  RepositoryCatalogReader,
  RepositoryCatalogRecord,
} from './repository-catalog.js';
import {
  scoreHiddenGemV1,
} from './repository-hidden-gem-score.js';
import type {
  RepositoryContributionEvidenceRecord,
} from './repository-contribution-evidence.js';
import {
  buildRepositoryRankingSignalSnapshot,
} from './repository-ranking-signals.js';
import {
  type RepositoryRankedItem,
  type RepositoryRankingPage,
  type RepositoryRankingPageInput,
  rankingFormulaVersion,
} from './repository-ranking.js';
import {
  scoreRisingV1,
} from './repository-rising-score.js';
import type { RepositoryReadmeRecord } from './repository-readme.js';
import type { RepositoryTrendReader } from './repository-trend.js';

const CATALOG_BATCH_SIZE = 50;

type RepositoryReadmeReader = Readonly<{
  findByRepositoryId(
    repositoryId: string,
  ): Promise<RepositoryReadmeRecord | null>;
}>;

type RepositoryContributionEvidenceReader = Readonly<{
  findByRepositoryId(
    repositoryId: string,
  ): Promise<RepositoryContributionEvidenceRecord | null>;
}>;

function compareRankedItems(
  left: RepositoryRankedItem,
  right: RepositoryRankedItem,
): number {
  if (left.score.score !== right.score.score) {
    return right.score.score - left.score.score;
  }

  return left.repository.id.localeCompare(right.repository.id);
}

function isAfterCursor(
  item: RepositoryRankedItem,
  cursor: NonNullable<RepositoryRankingPageInput['cursor']>,
): boolean {
  return (
    item.score.score < cursor.score ||
    (item.score.score === cursor.score &&
      item.repository.id.localeCompare(cursor.repositoryId) > 0)
  );
}

export class RepositoryRankingService {
  public constructor(
    private readonly catalog: RepositoryCatalogReader,
    private readonly readmeReader: RepositoryReadmeReader,
    private readonly contributionEvidenceReader: RepositoryContributionEvidenceReader,
    private readonly trendReader: RepositoryTrendReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async listAllListedRepositories(): Promise<
    RepositoryCatalogRecord[]
  > {
    const repositories: RepositoryCatalogRecord[] = [];
    let cursor: { id: string } | null = null;

    while (true) {
      const page = await this.catalog.listPage({
        limit: CATALOG_BATCH_SIZE,
        cursor,
      });
      repositories.push(...page.items);

      if (!page.hasMore || page.items.length === 0) {
        break;
      }

      cursor = {
        id: page.items[page.items.length - 1]!.id,
      };
    }

    return repositories;
  }

  private async scoreRepository(
    repository: RepositoryCatalogRecord,
    mode: RepositoryRankingPageInput['mode'],
    evaluatedAt: Date,
  ): Promise<RepositoryRankedItem | null> {
    const [readme, contributionEvidence, trend7d, trend30d] =
      await Promise.all([
        this.readmeReader.findByRepositoryId(repository.id),
        this.contributionEvidenceReader.findByRepositoryId(
          repository.id,
        ),
        this.trendReader.readTrend(repository.id, 7),
        this.trendReader.readTrend(repository.id, 30),
      ]);

    const signalSnapshot = buildRepositoryRankingSignalSnapshot({
      evaluatedAt,
      repository,
      metadata: repository.metadata,
      readme,
      contributionEvidence,
      trend7d,
      trend30d,
    });

    if (mode === 'hidden_gems') {
      const score = scoreHiddenGemV1(signalSnapshot);

      return score.status === 'eligible'
        ? {
            mode,
            repository,
            score,
          }
        : null;
    }

    const score = scoreRisingV1(signalSnapshot);

    return score.status === 'eligible'
      ? {
          mode,
          repository,
          score,
        }
      : null;
  }

  async rankPage(
    input: RepositoryRankingPageInput,
  ): Promise<RepositoryRankingPage> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) {
      throw new Error('limit must be an integer between 1 and 50.');
    }

    if (input.cursor && input.cursor.mode !== input.mode) {
      throw new Error('ranking cursor mode does not match request mode.');
    }

    const formulaVersion = rankingFormulaVersion(input.mode);

    if (
      input.cursor &&
      input.cursor.formulaVersion !== formulaVersion
    ) {
      throw new Error(
        'ranking cursor formula does not match current ranking formula.',
      );
    }

    const evaluatedAt = input.cursor?.evaluatedAt ?? this.now();

    if (
      !(evaluatedAt instanceof Date) ||
      Number.isNaN(evaluatedAt.getTime())
    ) {
      throw new Error('ranking evaluation time is invalid.');
    }

    const repositories = await this.listAllListedRepositories();
    const ranked: RepositoryRankedItem[] = [];

    for (const repository of repositories) {
      const item = await this.scoreRepository(
        repository,
        input.mode,
        evaluatedAt,
      );

      if (item) {
        ranked.push(item);
      }
    }

    ranked.sort(compareRankedItems);

    const afterCursor = input.cursor
      ? ranked.filter((item) => isAfterCursor(item, input.cursor!))
      : ranked;
    const hasMore = afterCursor.length > input.limit;
    const items = afterCursor.slice(0, input.limit);

    return {
      mode: input.mode,
      formulaVersion,
      evaluatedAt,
      items,
      hasMore,
      evaluatedCount: repositories.length,
      eligibleCount: ranked.length,
    };
  }
}
