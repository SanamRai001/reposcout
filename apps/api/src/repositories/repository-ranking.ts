import {
  HIDDEN_GEM_FORMULA_VERSION,
  type HiddenGemScoreResult,
} from './repository-hidden-gem-score.js';
import {
  RISING_FORMULA_VERSION,
  type RisingScoreResult,
} from './repository-rising-score.js';
import type { RepositoryCatalogRecord } from './repository-catalog.js';

export type RepositoryRankingMode = 'hidden_gems' | 'rising';

export type RepositoryRankingCursor = Readonly<{
  mode: RepositoryRankingMode;
  formulaVersion:
    | typeof HIDDEN_GEM_FORMULA_VERSION
    | typeof RISING_FORMULA_VERSION;
  evaluatedAt: Date;
  score: number;
  repositoryId: string;
}>;

type EncodedRepositoryRankingCursor = Readonly<{
  mode: RepositoryRankingMode;
  formulaVersion: string;
  evaluatedAt: string;
  score: number;
  repositoryId: string;
}>;

export type RepositoryRankedItem =
  | Readonly<{
      mode: 'hidden_gems';
      repository: RepositoryCatalogRecord;
      score: Extract<HiddenGemScoreResult, { status: 'eligible' }>;
    }>
  | Readonly<{
      mode: 'rising';
      repository: RepositoryCatalogRecord;
      score: Extract<RisingScoreResult, { status: 'eligible' }>;
    }>;

export type RepositoryRankingPage = Readonly<{
  mode: RepositoryRankingMode;
  formulaVersion:
    | typeof HIDDEN_GEM_FORMULA_VERSION
    | typeof RISING_FORMULA_VERSION;
  evaluatedAt: Date;
  items: readonly RepositoryRankedItem[];
  hasMore: boolean;
  evaluatedCount: number;
  eligibleCount: number;
}>;

export type RepositoryRankingPageInput = Readonly<{
  mode: RepositoryRankingMode;
  limit: number;
  cursor: RepositoryRankingCursor | null;
}>;

export type RepositoryRankingReader = Readonly<{
  rankPage(input: RepositoryRankingPageInput): Promise<RepositoryRankingPage>;
}>;

export function parseRepositoryRankingMode(
  value: unknown,
): RepositoryRankingMode {
  if (value === 'hidden_gems' || value === 'rising') {
    return value;
  }

  throw new Error(
    'ranking mode must be hidden_gems or rising.',
  );
}

export function rankingFormulaVersion(
  mode: RepositoryRankingMode,
):
  | typeof HIDDEN_GEM_FORMULA_VERSION
  | typeof RISING_FORMULA_VERSION {
  return mode === 'hidden_gems'
    ? HIDDEN_GEM_FORMULA_VERSION
    : RISING_FORMULA_VERSION;
}

export function encodeRepositoryRankingCursor(
  item: RepositoryRankedItem,
  evaluatedAt: Date,
): string {
  const payload: EncodedRepositoryRankingCursor = {
    mode: item.mode,
    formulaVersion: item.score.formulaVersion,
    evaluatedAt: evaluatedAt.toISOString(),
    score: item.score.score,
    repositoryId: item.repository.id,
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
}

export function parseRepositoryRankingCursor(
  value: unknown,
  mode: RepositoryRankingMode,
): RepositoryRankingCursor | null {
  if (value === undefined) {
    return null;
  }

  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 1024
  ) {
    throw new Error('ranking cursor is invalid.');
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<EncodedRepositoryRankingCursor>;
    const expectedFormulaVersion = rankingFormulaVersion(mode);
    const evaluatedAt =
      typeof parsed.evaluatedAt === 'string'
        ? new Date(parsed.evaluatedAt)
        : new Date(Number.NaN);

    if (
      parsed.mode !== mode ||
      parsed.formulaVersion !== expectedFormulaVersion ||
      !Number.isFinite(parsed.score) ||
      parsed.score! < 0 ||
      parsed.score! > 100 ||
      typeof parsed.repositoryId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        parsed.repositoryId,
      ) ||
      Number.isNaN(evaluatedAt.getTime())
    ) {
      throw new Error('invalid ranking cursor fields');
    }

    return {
      mode,
      formulaVersion: expectedFormulaVersion,
      evaluatedAt,
      score: parsed.score!,
      repositoryId: parsed.repositoryId,
    };
  } catch {
    throw new Error('ranking cursor is invalid.');
  }
}

export type RepositoryRankingResponseItem = Readonly<{
  repository: RepositoryCatalogRecord;
  ranking:
    | Readonly<{
        mode: 'hidden_gems';
        formulaVersion: typeof HIDDEN_GEM_FORMULA_VERSION;
        score: number;
        explanation: Readonly<{
          components: Extract<
            HiddenGemScoreResult,
            { status: 'eligible' }
          >['components'];
          positivePoints: number;
          popularityPenalty: Extract<
            HiddenGemScoreResult,
            { status: 'eligible' }
          >['popularityPenalty'];
          optionalMomentumCoverage: Extract<
            HiddenGemScoreResult,
            { status: 'eligible' }
          >['optionalMomentumCoverage'];
        }>;
      }>
    | Readonly<{
        mode: 'rising';
        formulaVersion: typeof RISING_FORMULA_VERSION;
        score: number;
        explanation: Readonly<{
          components: Extract<
            RisingScoreResult,
            { status: 'eligible' }
          >['components'];
          historyCoverage: Extract<
            RisingScoreResult,
            { status: 'eligible' }
          >['historyCoverage'];
          visibilityContext: Extract<
            RisingScoreResult,
            { status: 'eligible' }
          >['visibilityContext'];
          maintenanceCoverage: Extract<
            RisingScoreResult,
            { status: 'eligible' }
          >['maintenanceCoverage'];
        }>;
      }>;
}>;

export function toRepositoryRankingResponseItem(
  item: RepositoryRankedItem,
): RepositoryRankingResponseItem {
  if (item.mode === 'hidden_gems') {
    return {
      repository: item.repository,
      ranking: {
        mode: item.mode,
        formulaVersion: item.score.formulaVersion,
        score: item.score.score,
        explanation: {
          components: item.score.components,
          positivePoints: item.score.positivePoints,
          popularityPenalty: item.score.popularityPenalty,
          optionalMomentumCoverage:
            item.score.optionalMomentumCoverage,
        },
      },
    };
  }

  return {
    repository: item.repository,
    ranking: {
      mode: item.mode,
      formulaVersion: item.score.formulaVersion,
      score: item.score.score,
      explanation: {
        components: item.score.components,
        historyCoverage: item.score.historyCoverage,
        visibilityContext: item.score.visibilityContext,
        maintenanceCoverage: item.score.maintenanceCoverage,
      },
    },
  };
}
