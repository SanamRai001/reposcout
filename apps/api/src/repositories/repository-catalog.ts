import type { RepositoryMetadataRecord } from './repository-metadata.js';
import type { RepositoryRecord } from './repository.js';

export type RepositoryCatalogRecord = RepositoryRecord &
  Readonly<{
    metadata: RepositoryMetadataRecord | null;
  }>;

export const DEFAULT_REPOSITORY_PAGE_SIZE = 20;
export const MAX_REPOSITORY_PAGE_SIZE = 50;
export const MIN_REPOSITORY_SEARCH_QUERY_LENGTH = 2;
export const MAX_REPOSITORY_SEARCH_QUERY_LENGTH = 120;
export const MAX_REPOSITORY_SEARCH_FILTER_LENGTH = 64;
export const MAX_REPOSITORY_SEARCH_TOPICS = 10;

export type RepositoryCursor = Readonly<{
  id: string;
}>;

export type RepositoryPageInput = Readonly<{
  limit: number;
  cursor: RepositoryCursor | null;
}>;

export type RepositorySearchFilters = Readonly<{
  primaryLanguage: string | null;
  licenseSpdx: string | null;
  topics: readonly string[];
  minStars: number | null;
  maxStars: number | null;
  isFork: boolean | null;
  isArchived: boolean | null;
}>;

export const EMPTY_REPOSITORY_SEARCH_FILTERS: RepositorySearchFilters = {
  primaryLanguage: null,
  licenseSpdx: null,
  topics: [],
  minStars: null,
  maxStars: null,
  isFork: null,
  isArchived: null,
};

export type RepositorySearchCursor = Readonly<{
  id: string;
  query: string | null;
  filters: RepositorySearchFilters;
}>;

export type RepositorySearchPageInput = Readonly<{
  query: string | null;
  filters: RepositorySearchFilters;
  limit: number;
  cursor: RepositorySearchCursor | null;
}>;

export type RepositoryPage = Readonly<{
  items: RepositoryCatalogRecord[];
  hasMore: boolean;
}>;

export type RepositoryCatalogReader = Readonly<{
  listPage(input: RepositoryPageInput): Promise<RepositoryPage>;
  searchPage(input: RepositorySearchPageInput): Promise<RepositoryPage>;
  findDiscoverableById(id: string): Promise<RepositoryCatalogRecord | null>;
}>;

export type RepositoryResponse = Readonly<{
  id: string;
  githubRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  githubUrl: string;
  defaultBranch: string | null;
  description: string | null;
  isArchived: boolean;
  isFork: boolean;
  createdAtGithub: string;
  updatedAtGithub: string;
  pushedAtGithub: string | null;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
  metadata: null | Readonly<{
    stars: number;
    forks: number;
    openIssues: number;
    primaryLanguage: string | null;
    licenseSpdx: string | null;
    topics: string[];
    observedAt: string;
  }>;
}>;

type EncodedCursor = Readonly<{
  id: string;
}>;

type EncodedSearchCursor = Readonly<{
  id: string;
  query: string | null;
  filters: RepositorySearchFilters;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRepositoryId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function parseRepositoryPageLimit(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_REPOSITORY_PAGE_SIZE;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error('limit must be an integer between 1 and 50.');
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_REPOSITORY_PAGE_SIZE
  ) {
    throw new Error('limit must be an integer between 1 and 50.');
  }

  return parsed;
}

export function parseRepositorySearchQuery(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('q must be a string between 2 and 120 characters.');
  }

  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();

  if (
    normalized.length < MIN_REPOSITORY_SEARCH_QUERY_LENGTH ||
    normalized.length > MAX_REPOSITORY_SEARCH_QUERY_LENGTH ||
    !/[\p{L}\p{N}]/u.test(normalized)
  ) {
    throw new Error('q must be a string between 2 and 120 characters.');
  }

  return normalized;
}

function parseOptionalSearchTextFilter(
  value: unknown,
  field: 'language' | 'license' | 'topic',
): string | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(
      `filter ${field} must be a string between 1 and 64 characters.`,
    );
  }

  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();

  if (
    normalized.length < 1 ||
    normalized.length > MAX_REPOSITORY_SEARCH_FILTER_LENGTH ||
    !/[\p{L}\p{N}]/u.test(normalized)
  ) {
    throw new Error(
      `filter ${field} must be a string between 1 and 64 characters.`,
    );
  }

  return normalized;
}

function parseOptionalSearchBooleanFilter(
  value: unknown,
  field: 'fork' | 'archived',
): boolean | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`filter ${field} must be true or false.`);
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`filter ${field} must be true or false.`);
}

function parseSearchTopics(value: unknown): readonly string[] {
  if (value === undefined) {
    return [];
  }

  const rawValues = Array.isArray(value) ? value : [value];

  if (
    rawValues.length === 0 ||
    rawValues.length > MAX_REPOSITORY_SEARCH_TOPICS
  ) {
    throw new Error(
      `filter topic may be provided at most ${MAX_REPOSITORY_SEARCH_TOPICS} times.`,
    );
  }

  const topics = rawValues.map((item) => {
    const topic = parseOptionalSearchTextFilter(item, 'topic');

    if (topic === null) {
      throw new Error('filter topic must be non-empty.');
    }

    return topic;
  });

  return [...new Set(topics)].sort((left, right) =>
    left.localeCompare(right),
  );
}

function parseOptionalSearchIntegerFilter(
  value: unknown,
  field: 'minStars' | 'maxStars',
): number | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(
      `filter ${field} must be a nonnegative safe integer.`,
    );
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(
      `filter ${field} must be a nonnegative safe integer.`,
    );
  }

  return parsed;
}

export function parseRepositorySearchFilters(input: Readonly<{
  language: unknown;
  license: unknown;
  topic: unknown;
  minStars: unknown;
  maxStars: unknown;
  fork: unknown;
  archived: unknown;
}>): RepositorySearchFilters {
  const minStars = parseOptionalSearchIntegerFilter(
    input.minStars,
    'minStars',
  );
  const maxStars = parseOptionalSearchIntegerFilter(
    input.maxStars,
    'maxStars',
  );

  if (
    minStars !== null &&
    maxStars !== null &&
    minStars > maxStars
  ) {
    throw new Error(
      'filter minStars must be less than or equal to maxStars.',
    );
  }

  return {
    primaryLanguage: parseOptionalSearchTextFilter(
      input.language,
      'language',
    ),
    licenseSpdx: parseOptionalSearchTextFilter(
      input.license,
      'license',
    ),
    topics: parseSearchTopics(input.topic),
    minStars,
    maxStars,
    isFork: parseOptionalSearchBooleanFilter(input.fork, 'fork'),
    isArchived: parseOptionalSearchBooleanFilter(
      input.archived,
      'archived',
    ),
  };
}

export function hasRepositorySearchFilters(
  filters: RepositorySearchFilters,
): boolean {
  return (
    filters.primaryLanguage !== null ||
    filters.licenseSpdx !== null ||
    filters.topics.length > 0 ||
    filters.minStars !== null ||
    filters.maxStars !== null ||
    filters.isFork !== null ||
    filters.isArchived !== null
  );
}

export function assertRepositoryDiscoveryScope(
  query: string | null,
  filters: RepositorySearchFilters,
): void {
  if (query === null && !hasRepositorySearchFilters(filters)) {
    throw new Error('search requires q or at least one filter.');
  }
}

function repositorySearchFiltersEqual(
  left: RepositorySearchFilters,
  right: RepositorySearchFilters,
): boolean {
  return (
    left.primaryLanguage === right.primaryLanguage &&
    left.licenseSpdx === right.licenseSpdx &&
    left.topics.length === right.topics.length &&
    left.topics.every((topic, index) => topic === right.topics[index]) &&
    left.minStars === right.minStars &&
    left.maxStars === right.maxStars &&
    left.isFork === right.isFork &&
    left.isArchived === right.isArchived
  );
}

export function encodeRepositoryCursor(
  repository: Pick<RepositoryRecord, 'id'>,
): string {
  const payload: EncodedCursor = {
    id: repository.id,
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function parseRepositoryCursor(value: unknown): RepositoryCursor | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    throw new Error('cursor is invalid.');
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<EncodedCursor>;

    if (typeof parsed.id !== 'string' || !isRepositoryId(parsed.id)) {
      throw new Error('invalid cursor fields');
    }

    return {
      id: parsed.id,
    };
  } catch {
    throw new Error('cursor is invalid.');
  }
}

export function encodeRepositorySearchCursor(
  repository: Pick<RepositoryRecord, 'id'>,
  query: string | null,
  filters: RepositorySearchFilters,
): string {
  const payload: EncodedSearchCursor = {
    id: repository.id,
    query,
    filters,
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function parseRepositorySearchCursor(
  value: unknown,
  query: string | null,
  filters: RepositorySearchFilters,
): RepositorySearchCursor | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
    throw new Error('cursor is invalid.');
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<EncodedSearchCursor>;

    if (
      typeof parsed.id !== 'string' ||
      !isRepositoryId(parsed.id) ||
      parsed.query !== query ||
      !parsed.filters ||
      !repositorySearchFiltersEqual(parsed.filters, filters)
    ) {
      throw new Error('invalid search cursor fields');
    }

    return {
      id: parsed.id,
      query,
      filters: parsed.filters,
    };
  } catch {
    throw new Error('cursor is invalid.');
  }
}

export function toRepositoryResponse(
  repository: RepositoryCatalogRecord,
): RepositoryResponse {
  return {
    id: repository.id,
    githubRepositoryId: repository.githubRepositoryId,
    owner: repository.owner,
    name: repository.name,
    fullName: repository.fullName,
    githubUrl: repository.githubUrl,
    defaultBranch: repository.defaultBranch,
    description: repository.description,
    isArchived: repository.isArchived,
    isFork: repository.isFork,
    createdAtGithub: repository.createdAtGithub.toISOString(),
    updatedAtGithub: repository.updatedAtGithub.toISOString(),
    pushedAtGithub: repository.pushedAtGithub?.toISOString() ?? null,
    lastSyncedAt: repository.lastSyncedAt.toISOString(),
    createdAt: repository.createdAt.toISOString(),
    updatedAt: repository.updatedAt.toISOString(),
    metadata: repository.metadata
      ? {
          stars: repository.metadata.stars,
          forks: repository.metadata.forks,
          openIssues: repository.metadata.openIssues,
          primaryLanguage: repository.metadata.primaryLanguage,
          licenseSpdx: repository.metadata.licenseSpdx,
          topics: repository.metadata.topics,
          observedAt: repository.metadata.observedAt.toISOString(),
        }
      : null,
  };
}
