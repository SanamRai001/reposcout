import {
  isCatalogItem,
  type RepositoryCatalogItem,
} from './repository-catalog-client.js';

export type RepositoryRankingMode = 'hidden_gems' | 'rising';

export type RankingScoreComponent = Readonly<{
  id: string;
  points: number;
  maxPoints: number;
  signalIds: readonly string[];
  normalizedDelta?: number | null;
}>;

export type RankingTrendProvenance = Readonly<{
  requestedWindowDays: 7 | 30;
  actualWindowDays: number;
  baselineCapturedOn: string;
  latestCapturedOn: string;
}>;

export type RankingSignalObservation =
  | Readonly<{
      id: string;
      availability: 'available';
      value: number | boolean;
      provenance: RankingTrendProvenance | null;
    }>
  | Readonly<{
      id: string;
      availability: 'missing';
      reason: string;
      provenance: null;
    }>;

export type HiddenGemExplanation = Readonly<{
  components: RankingScoreComponent[];
  positivePoints: number;
  popularityPenalty: Readonly<{
    id: 'popularity_saturation';
    points: number;
    maxPoints: number;
    stars: number;
    freeStars: number;
    saturationStars: number;
  }>;
  optionalMomentumCoverage: Readonly<{
    available: number;
    expected: number;
    missingSignalIds: string[];
  }>;
}>;

export type RisingExplanation = Readonly<{
  components: RankingScoreComponent[];
  historyCoverage: Readonly<{
    stars7d: RankingTrendProvenance;
    stars30d: RankingTrendProvenance;
    forks30d: RankingTrendProvenance;
  }>;
  visibilityContext: Readonly<{
    stars: RankingSignalObservation;
    forks: RankingSignalObservation;
  }>;
  maintenanceCoverage:
    | Readonly<{ availability: 'available'; daysSincePush: number }>
    | Readonly<{ availability: 'missing'; reason: string }>;
}>;

export type RepositoryRankingItem =
  | Readonly<{
      repository: RepositoryCatalogItem;
      ranking: Readonly<{
        mode: 'hidden_gems';
        formulaVersion: 'hidden-gem-v1';
        score: number;
        explanation: HiddenGemExplanation;
      }>;
    }>
  | Readonly<{
      repository: RepositoryCatalogItem;
      ranking: Readonly<{
        mode: 'rising';
        formulaVersion: 'rising-v1';
        score: number;
        explanation: RisingExplanation;
      }>;
    }>;

export type RepositoryRankingPage = Readonly<{
  data: RepositoryRankingItem[];
  ranking: Readonly<{
    mode: RepositoryRankingMode;
    formulaVersion: 'hidden-gem-v1' | 'rising-v1';
    evaluatedAt: string;
    evaluatedCount: number;
    eligibleCount: number;
  }>;
  pagination: Readonly<{ limit: number; nextCursor: string | null }>;
}>;

export class RepositoryRankingError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly code: string | null,
  ) {
    super(message);
    this.name = 'RepositoryRankingError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) && value >= 0;
}

function isScore(value: unknown): value is number {
  return typeof value === 'number' &&
    Number.isFinite(value) && value >= 0 && value <= 100;
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isDate(value: unknown): value is string {
  return isText(value) && Number.isFinite(Date.parse(value));
}

function isComponent(value: unknown): value is RankingScoreComponent {
  if (!isRecord(value)) return false;
  return isText(value.id) &&
    isScore(value.points) &&
    isScore(value.maxPoints) &&
    value.points <= value.maxPoints &&
    Array.isArray(value.signalIds) &&
    value.signalIds.every(isText) &&
    (value.normalizedDelta === undefined ||
      value.normalizedDelta === null ||
      (typeof value.normalizedDelta === 'number' &&
        Number.isFinite(value.normalizedDelta)));
}

function isComponents(value: unknown): value is RankingScoreComponent[] {
  return Array.isArray(value) && value.length > 0 &&
    value.every(isComponent);
}

function isTrendProvenance(
  value: unknown,
  requested: 7 | 30,
): value is RankingTrendProvenance {
  if (!isRecord(value)) return false;
  return value.requestedWindowDays === requested &&
    isCount(value.actualWindowDays) &&
    value.actualWindowDays >= requested &&
    isDate(value.baselineCapturedOn) &&
    isDate(value.latestCapturedOn);
}

function isObservation(value: unknown): value is RankingSignalObservation {
  if (!isRecord(value) || !isText(value.id)) return false;
  if (value.availability === 'missing') {
    return isText(value.reason) && value.provenance === null;
  }
  return value.availability === 'available' &&
    (typeof value.value === 'boolean' ||
      (typeof value.value === 'number' && Number.isFinite(value.value))) &&
    (value.provenance === null ||
      (isRecord(value.provenance) &&
        (isTrendProvenance(value.provenance, 7) ||
         isTrendProvenance(value.provenance, 30))));
}

function isHiddenExplanation(value: unknown): value is HiddenGemExplanation {
  if (!isRecord(value) || !isComponents(value.components) ||
      !isScore(value.positivePoints)) return false;
  const penalty = value.popularityPenalty;
  const coverage = value.optionalMomentumCoverage;
  return isRecord(penalty) &&
    penalty.id === 'popularity_saturation' &&
    isScore(penalty.points) && isScore(penalty.maxPoints) &&
    penalty.points <= penalty.maxPoints &&
    isCount(penalty.stars) && isCount(penalty.freeStars) &&
    isCount(penalty.saturationStars) &&
    isRecord(coverage) &&
    isCount(coverage.available) && isCount(coverage.expected) &&
    coverage.available <= coverage.expected &&
    Array.isArray(coverage.missingSignalIds) &&
    coverage.missingSignalIds.every(isText);
}

function isRisingExplanation(value: unknown): value is RisingExplanation {
  if (!isRecord(value) || !isComponents(value.components) ||
      !value.components.every((component) =>
        component.normalizedDelta !== undefined)) return false;

  const history = value.historyCoverage;
  const visibility = value.visibilityContext;
  const maintenance = value.maintenanceCoverage;
  return isRecord(history) &&
    isTrendProvenance(history.stars7d, 7) &&
    isTrendProvenance(history.stars30d, 30) &&
    isTrendProvenance(history.forks30d, 30) &&
    isRecord(visibility) &&
    isObservation(visibility.stars) &&
    isObservation(visibility.forks) &&
    isRecord(maintenance) &&
    (maintenance.availability === 'missing'
      ? isText(maintenance.reason)
      : maintenance.availability === 'available' &&
        isCount(maintenance.daysSincePush));
}

function isRankingItem(
  value: unknown,
  mode: RepositoryRankingMode,
  formulaVersion: string,
): value is RepositoryRankingItem {
  if (!isRecord(value) || !isCatalogItem(value.repository) ||
      !isRecord(value.ranking)) return false;

  const ranking = value.ranking;
  if (ranking.mode !== mode ||
      ranking.formulaVersion !== formulaVersion ||
      !isScore(ranking.score)) return false;

  return mode === 'hidden_gems'
    ? isHiddenExplanation(ranking.explanation)
    : isRisingExplanation(ranking.explanation);
}

function parseRankingPage(
  value: unknown,
  requestedMode: RepositoryRankingMode,
): RepositoryRankingPage {
  const invalid = () => new RepositoryRankingError(
    'RepoScout returned an invalid ranking response.',
    null,
    'invalid_response',
  );
  if (!isRecord(value) || !isRecord(value.ranking) ||
      !isRecord(value.pagination)) throw invalid();

  const expectedVersion = requestedMode === 'hidden_gems'
    ? 'hidden-gem-v1'
    : 'rising-v1';
  const ranking = value.ranking;
  const pagination = value.pagination;
  if (ranking.mode !== requestedMode ||
      ranking.formulaVersion !== expectedVersion ||
      !isDate(ranking.evaluatedAt) ||
      !isCount(ranking.evaluatedCount) ||
      !isCount(ranking.eligibleCount) ||
      ranking.eligibleCount > ranking.evaluatedCount ||
      !isCount(pagination.limit) || pagination.limit < 1 ||
      pagination.limit > 50 ||
      !(pagination.nextCursor === null || isText(pagination.nextCursor)) ||
      !Array.isArray(value.data) ||
      value.data.length > pagination.limit ||
      value.data.length > ranking.eligibleCount ||
      !value.data.every((item) =>
        isRankingItem(item, requestedMode, expectedVersion))
  ) throw invalid();

  return value as RepositoryRankingPage;
}

export async function fetchRepositoryRankingPage(input: Readonly<{
  mode: RepositoryRankingMode;
  limit?: number;
  cursor?: string | null;
  signal?: AbortSignal;
  fetchImplementation?: typeof fetch;
}>): Promise<RepositoryRankingPage> {
  if (input.limit !== undefined &&
      (!Number.isSafeInteger(input.limit) ||
       input.limit < 1 || input.limit > 50)) {
    throw new RepositoryRankingError(
      'Ranking page size must be between 1 and 50.',
      null,
      'invalid_pagination',
    );
  }

  const parameters = new URLSearchParams();
  if (input.limit !== undefined) parameters.set('limit', String(input.limit));
  if (input.cursor) parameters.set('cursor', input.cursor);
  const query = parameters.toString();
  const url = `/api/repositories/rankings/${input.mode}${query ? `?${query}` : ''}`;

  let response: Response;
  try {
    response = await (input.fetchImplementation ?? fetch)(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      ...(input.signal ? { signal: input.signal } : {}),
    });
  } catch (error) {
    if (input.signal?.aborted) throw error;
    throw new RepositoryRankingError(
      'Unable to load rankings right now.',
      null,
      'network_error',
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = isRecord(body) ? body : {};
    throw new RepositoryRankingError(
      typeof error.message === 'string'
        ? error.message
        : 'Unable to load rankings right now.',
      response.status,
      typeof error.error === 'string' ? error.error : null,
    );
  }

  return parseRankingPage(body, input.mode);
}
