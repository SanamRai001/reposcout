export type RepositoryCatalogItem = Readonly<{
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

export type RepositoryCatalogPage = Readonly<{
  data: RepositoryCatalogItem[];
  pagination: Readonly<{
    limit: number;
    nextCursor: string | null;
  }>;
}>;

export type RepositoryDiscoveryFilters = Readonly<{
  language: string | null;
  license: string | null;
  topics: string[];
  minStars: number | null;
  maxStars: number | null;
  fork: boolean | null;
  archived: boolean | null;
}>;

export type RepositoryDiscoveryScope = Readonly<{
  query: string | null;
  filters: RepositoryDiscoveryFilters;
}>;

export type RepositoryDiscoveryPage = RepositoryCatalogPage &
  Readonly<{
    search: RepositoryDiscoveryScope;
  }>;

export const EMPTY_DISCOVERY_FILTERS: RepositoryDiscoveryFilters = {
  language: null,
  license: null,
  topics: [],
  minStars: null,
  maxStars: null,
  fork: null,
  archived: null,
};

export class RepositoryCatalogError extends Error {
  public constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = 'RepositoryCatalogError';
  }
}

type CatalogErrorBody = Readonly<{
  error?: unknown;
  message?: unknown;
}>;

function isRepositoryMetadata(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  const metadata = value as Record<string, unknown>;

  return (
    typeof metadata.stars === 'number' &&
    Number.isSafeInteger(metadata.stars) &&
    metadata.stars >= 0 &&
    typeof metadata.forks === 'number' &&
    Number.isSafeInteger(metadata.forks) &&
    metadata.forks >= 0 &&
    typeof metadata.openIssues === 'number' &&
    Number.isSafeInteger(metadata.openIssues) &&
    metadata.openIssues >= 0 &&
    (typeof metadata.primaryLanguage === 'string' ||
      metadata.primaryLanguage === null) &&
    (typeof metadata.licenseSpdx === 'string' ||
      metadata.licenseSpdx === null) &&
    Array.isArray(metadata.topics) &&
    metadata.topics.every(
      (topic) => typeof topic === 'string' && topic.length > 0,
    ) &&
    typeof metadata.observedAt === 'string'
  );
}

function isCatalogItem(value: unknown): value is RepositoryCatalogItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === 'string' &&
    typeof item.githubRepositoryId === 'string' &&
    typeof item.owner === 'string' &&
    typeof item.name === 'string' &&
    typeof item.fullName === 'string' &&
    typeof item.githubUrl === 'string' &&
    (typeof item.defaultBranch === 'string' || item.defaultBranch === null) &&
    (typeof item.description === 'string' || item.description === null) &&
    typeof item.isArchived === 'boolean' &&
    typeof item.isFork === 'boolean' &&
    typeof item.createdAtGithub === 'string' &&
    typeof item.updatedAtGithub === 'string' &&
    (typeof item.pushedAtGithub === 'string' || item.pushedAtGithub === null) &&
    typeof item.lastSyncedAt === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string' &&
    isRepositoryMetadata(item.metadata)
  );
}

function parsePagination(
  body: Record<string, unknown>,
): RepositoryCatalogPage['pagination'] {
  const pagination =
    body.pagination && typeof body.pagination === 'object'
      ? (body.pagination as Record<string, unknown>)
      : null;

  if (
    !pagination ||
    typeof pagination.limit !== 'number' ||
    !Number.isInteger(pagination.limit) ||
    pagination.limit < 1 ||
    (typeof pagination.nextCursor !== 'string' &&
      pagination.nextCursor !== null)
  ) {
    throw new RepositoryCatalogError(
      'RepoScout returned an invalid pagination response.',
      null,
    );
  }

  return {
    limit: pagination.limit,
    nextCursor: pagination.nextCursor,
  };
}

function parseCatalogPage(value: unknown): RepositoryCatalogPage {
  if (!value || typeof value !== 'object') {
    throw new RepositoryCatalogError(
      'RepoScout returned an invalid catalog response.',
      null,
    );
  }

  const body = value as Record<string, unknown>;
  if (
    !Array.isArray(body.data) ||
    !body.data.every(isCatalogItem)
  ) {
    throw new RepositoryCatalogError(
      'RepoScout returned an invalid catalog response.',
      null,
    );
  }

  return {
    data: body.data,
    pagination: parsePagination(body),
  };
}

export async function fetchRepositoryCatalogPage(
  input: Readonly<{
    cursor?: string | null;
    limit?: number;
    signal?: AbortSignal;
    fetchImplementation?: typeof fetch;
  }> = {},
): Promise<RepositoryCatalogPage> {
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const parameters = new URLSearchParams();

  if (input.limit !== undefined) {
    parameters.set('limit', String(input.limit));
  }

  if (input.cursor) {
    parameters.set('cursor', input.cursor);
  }

  const query = parameters.toString();
  const requestInit: RequestInit = {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  };

  if (input.signal) {
    requestInit.signal = input.signal;
  }

  const response = await fetchImplementation(
    `/api/repositories${query ? `?${query}` : ''}`,
    requestInit,
  );

  const body = (await response.json().catch(() => null)) as
    | CatalogErrorBody
    | unknown;

  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'Unable to load repositories right now.';

    throw new RepositoryCatalogError(message, response.status);
  }

  return parseCatalogPage(body);
}


function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return typeof value === 'boolean' || value === null;
}

function isNullableNonnegativeInteger(
  value: unknown,
): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0)
  );
}

function parseDiscoveryPage(value: unknown): RepositoryDiscoveryPage {
  if (!value || typeof value !== 'object') {
    throw new RepositoryCatalogError(
      'RepoScout returned an invalid discovery response.',
      null,
    );
  }

  const body = value as Record<string, unknown>;
  const search =
    body.search && typeof body.search === 'object'
      ? (body.search as Record<string, unknown>)
      : null;
  const filters =
    search?.filters && typeof search.filters === 'object'
      ? (search.filters as Record<string, unknown>)
      : null;

  if (
    !Array.isArray(body.data) ||
    !body.data.every(isCatalogItem) ||
    !search ||
    !isNullableString(search.query) ||
    !filters ||
    !isNullableString(filters.language) ||
    !isNullableString(filters.license) ||
    !Array.isArray(filters.topics) ||
    !filters.topics.every(
      (topic) => typeof topic === 'string' && topic.length > 0,
    ) ||
    !isNullableNonnegativeInteger(filters.minStars) ||
    !isNullableNonnegativeInteger(filters.maxStars) ||
    !isNullableBoolean(filters.fork) ||
    !isNullableBoolean(filters.archived)
  ) {
    throw new RepositoryCatalogError(
      'RepoScout returned an invalid discovery response.',
      null,
    );
  }

  return {
    data: body.data,
    search: {
      query: search.query,
      filters: {
        language: filters.language,
        license: filters.license,
        topics: filters.topics,
        minStars: filters.minStars,
        maxStars: filters.maxStars,
        fork: filters.fork,
        archived: filters.archived,
      },
    },
    pagination: parsePagination(body),
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalized || null;
}

export function normalizeRepositoryDiscoveryScope(
  input: Readonly<{
    query?: string | null;
    language?: string | null;
    license?: string | null;
    topics?: readonly string[];
    minStars?: number | null;
    maxStars?: number | null;
    fork?: boolean | null;
    archived?: boolean | null;
  }>,
): RepositoryDiscoveryScope | null {
  const topics = [
    ...new Set(
      (input.topics ?? [])
        .map((topic) => normalizeOptionalText(topic))
        .filter((topic): topic is string => topic !== null),
    ),
  ].sort((left, right) => left.localeCompare(right));

  const scope: RepositoryDiscoveryScope = {
    query: normalizeOptionalText(input.query),
    filters: {
      language: normalizeOptionalText(input.language),
      license: normalizeOptionalText(input.license),
      topics,
      minStars: input.minStars ?? null,
      maxStars: input.maxStars ?? null,
      fork: input.fork ?? null,
      archived: input.archived ?? null,
    },
  };

  const hasFilters =
    scope.filters.language !== null ||
    scope.filters.license !== null ||
    scope.filters.topics.length > 0 ||
    scope.filters.minStars !== null ||
    scope.filters.maxStars !== null ||
    scope.filters.fork !== null ||
    scope.filters.archived !== null;

  return scope.query !== null || hasFilters ? scope : null;
}

export function repositoryDiscoveryScopeFromSearch(
  search: string,
): RepositoryDiscoveryScope | null {
  const parameters = new URLSearchParams(search);
  const parseInteger = (name: string): number | null => {
    const value = parameters.get(name);

    if (value === null || !/^\d+$/.test(value)) {
      return null;
    }

    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  };
  const parseBoolean = (name: string): boolean | null => {
    const value = parameters.get(name)?.toLowerCase();
    return value === 'true' ? true : value === 'false' ? false : null;
  };

  return normalizeRepositoryDiscoveryScope({
    query: parameters.get('q'),
    language: parameters.get('language'),
    license: parameters.get('license'),
    topics: parameters.getAll('topic'),
    minStars: parseInteger('minStars'),
    maxStars: parseInteger('maxStars'),
    fork: parseBoolean('fork'),
    archived: parseBoolean('archived'),
  });
}

export function repositoryDiscoveryScopeToSearch(
  scope: RepositoryDiscoveryScope | null,
): string {
  if (!scope) {
    return '';
  }

  const parameters = new URLSearchParams();

  if (scope.query) {
    parameters.set('q', scope.query);
  }

  if (scope.filters.language) {
    parameters.set('language', scope.filters.language);
  }

  if (scope.filters.license) {
    parameters.set('license', scope.filters.license);
  }

  for (const topic of scope.filters.topics) {
    parameters.append('topic', topic);
  }

  if (scope.filters.minStars !== null) {
    parameters.set('minStars', String(scope.filters.minStars));
  }

  if (scope.filters.maxStars !== null) {
    parameters.set('maxStars', String(scope.filters.maxStars));
  }

  if (scope.filters.fork !== null) {
    parameters.set('fork', String(scope.filters.fork));
  }

  if (scope.filters.archived !== null) {
    parameters.set('archived', String(scope.filters.archived));
  }

  return parameters.toString();
}

export async function fetchRepositoryDiscoveryPage(
  input: Readonly<{
    scope: RepositoryDiscoveryScope;
    cursor?: string | null;
    limit?: number;
    signal?: AbortSignal;
    fetchImplementation?: typeof fetch;
  }>,
): Promise<RepositoryDiscoveryPage> {
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const parameters = new URLSearchParams(
    repositoryDiscoveryScopeToSearch(input.scope),
  );

  if (input.limit !== undefined) {
    parameters.set('limit', String(input.limit));
  }

  if (input.cursor) {
    parameters.set('cursor', input.cursor);
  }

  const requestInit: RequestInit = {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  };

  if (input.signal) {
    requestInit.signal = input.signal;
  }

  const response = await fetchImplementation(
    `/api/repositories/search?${parameters.toString()}`,
    requestInit,
  );

  const body = (await response.json().catch(() => null)) as
    | CatalogErrorBody
    | unknown;

  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'Unable to search repositories right now.';

    throw new RepositoryCatalogError(message, response.status);
  }

  return parseDiscoveryPage(body);
}
