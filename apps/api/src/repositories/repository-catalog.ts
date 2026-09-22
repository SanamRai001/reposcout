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

export type RepositoryCursor = Readonly<{
  id: string;
}>;

export type RepositoryPageInput = Readonly<{
  limit: number;
  cursor: RepositoryCursor | null;
}>;

export type RepositorySearchPageInput = Readonly<{
  query: string;
  limit: number;
  cursor: RepositoryCursor | null;
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
): string {
  const payload: EncodedSearchCursor = {
    id: repository.id,
    query,
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function parseRepositorySearchCursor(
  value: unknown,
  query: string,
): RepositoryCursor | null {
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
      parsed.query !== query
    ) {
      throw new Error('invalid search cursor fields');
    }

    return {
      id: parsed.id,
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
