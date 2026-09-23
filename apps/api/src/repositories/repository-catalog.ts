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
  isFork: boolean | null;
  isArchived: boolean | null;
}>;

export const EMPTY_REPOSITORY_SEARCH_FILTERS: RepositorySearchFilters = {
  primaryLanguage: null,
  licenseSpdx: null,
  isFork: null,
  isArchived: null,
};

export type RepositorySearchCursor = Readonly<{
  id: string;
  query: string;
  filters: RepositorySearchFilters;
}>;

export type RepositorySearchPageInput = Readonly<{
  query: string;
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
  findById(id: string): Promise<RepositoryCatalogRecord | null>;
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
  query: string;
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

export function parseRepositorySearchQuery(value: unknown): string {
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
  field: 'language' | 'license',
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

export function parseRepositorySearchFilters(input: Readonly<{
  language: unknown;
  license: unknown;
  fork: unknown;
  archived: unknown;
}>): RepositorySearchFilters {
  return {
    primaryLanguage: parseOptionalSearchTextFilter(
      input.language,
      'language',
    ),
    licenseSpdx: parseOptionalSearchTextFilter(
      input.license,
      'license',
    ),
    isFork: parseOptionalSearchBooleanFilter(input.fork, 'fork'),
    isArchived: parseOptionalSearchBooleanFilter(
      input.archived,
      'archived',
    ),
  };
}

function repositorySearchFiltersEqual(
  left: RepositorySearchFilters,
  right: RepositorySearchFilters,
): boolean {
  return (
    left.primaryLanguage === right.primaryLanguage &&
    left.licenseSpdx === right.licenseSpdx &&
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
  query: string,
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
  query: string,
  filters: RepositorySearchFilters,
): RepositorySearchCursor | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || value.length === 0 || value.length > 768) {
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
      query: parsed.query,
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
