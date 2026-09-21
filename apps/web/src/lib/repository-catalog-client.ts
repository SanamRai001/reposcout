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
}>;

export type RepositoryCatalogPage = Readonly<{
  data: RepositoryCatalogItem[];
  pagination: Readonly<{
    limit: number;
    nextCursor: string | null;
  }>;
}>;

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
    typeof item.updatedAt === 'string'
  );
}

function parseCatalogPage(value: unknown): RepositoryCatalogPage {
  if (!value || typeof value !== 'object') {
    throw new RepositoryCatalogError(
      'RepoScout returned an invalid catalog response.',
      null,
    );
  }

  const body = value as Record<string, unknown>;
  const pagination =
    body.pagination && typeof body.pagination === 'object'
      ? (body.pagination as Record<string, unknown>)
      : null;

  if (
    !Array.isArray(body.data) ||
    !body.data.every(isCatalogItem) ||
    !pagination ||
    typeof pagination.limit !== 'number' ||
    !Number.isInteger(pagination.limit) ||
    pagination.limit < 1 ||
    (typeof pagination.nextCursor !== 'string' &&
      pagination.nextCursor !== null)
  ) {
    throw new RepositoryCatalogError(
      'RepoScout returned an invalid catalog response.',
      null,
    );
  }

  return {
    data: body.data,
    pagination: {
      limit: pagination.limit,
      nextCursor: pagination.nextCursor,
    },
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
