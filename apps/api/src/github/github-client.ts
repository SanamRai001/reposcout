import type { GithubRepositoryReference } from './github-repository-reference.js';

const GITHUB_API_ORIGIN = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';

export type GithubClientOptions = Readonly<{
  token?: string;
  requestTimeoutMs?: number;
  fetchImplementation?: typeof fetch;
}>;

export type GithubRepositorySnapshot = Readonly<{
  githubRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  githubUrl: string;
  defaultBranch: string | null;
  description: string | null;
  isArchived: boolean;
  isFork: boolean;
  createdAtGithub: Date;
  updatedAtGithub: Date;
  pushedAtGithub: Date | null;
}>;

export type GithubApiErrorKind =
  | 'not_found'
  | 'rate_limited'
  | 'request_failed'
  | 'invalid_response';

export class GithubApiError extends Error {
  public constructor(
    public readonly kind: GithubApiErrorKind,
    message: string,
    public readonly status: number | null = null,
    public readonly retryAt: Date | null = null,
  ) {
    super(message);
    this.name = 'GithubApiError';
  }
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(
  source: JsonObject,
  field: string,
  options: { allowEmpty?: boolean } = {},
): string {
  const value = source[field];

  if (
    typeof value !== 'string' ||
    (!options.allowEmpty && value.trim().length === 0)
  ) {
    throw new GithubApiError(
      'invalid_response',
      `GitHub response field "${field}" is invalid.`,
    );
  }

  return value;
}

function nullableString(source: JsonObject, field: string): string | null {
  const value = source[field];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new GithubApiError(
      'invalid_response',
      `GitHub response field "${field}" is invalid.`,
    );
  }

  return value;
}

function requiredBoolean(source: JsonObject, field: string): boolean {
  const value = source[field];

  if (typeof value !== 'boolean') {
    throw new GithubApiError(
      'invalid_response',
      `GitHub response field "${field}" is invalid.`,
    );
  }

  return value;
}

function requiredDate(source: JsonObject, field: string): Date {
  const value = requiredString(source, field);
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new GithubApiError(
      'invalid_response',
      `GitHub response field "${field}" is not a valid date.`,
    );
  }

  return date;
}

function nullableDate(source: JsonObject, field: string): Date | null {
  if (source[field] === null) {
    return null;
  }

  return requiredDate(source, field);
}

function repositoryId(source: JsonObject): string {
  const value = source.id;

  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new GithubApiError(
      'invalid_response',
      'GitHub repository id is invalid or exceeds safe JSON integer precision.',
    );
  }

  return String(value);
}

function validateGithubUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new GithubApiError(
      'invalid_response',
      'GitHub repository html_url is invalid.',
    );
  }

  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') {
    throw new GithubApiError(
      'invalid_response',
      'GitHub repository html_url must use https://github.com.',
    );
  }

  return value;
}

function normalizeRepository(payload: unknown): GithubRepositorySnapshot {
  if (!isObject(payload)) {
    throw new GithubApiError(
      'invalid_response',
      'GitHub repository response must be an object.',
    );
  }

  const ownerValue = payload.owner;

  if (!isObject(ownerValue)) {
    throw new GithubApiError(
      'invalid_response',
      'GitHub repository owner is invalid.',
    );
  }

  const owner = requiredString(ownerValue, 'login');
  const name = requiredString(payload, 'name');
  const fullName = requiredString(payload, 'full_name');

  if (fullName.toLowerCase() !== `${owner}/${name}`.toLowerCase()) {
    throw new GithubApiError(
      'invalid_response',
      'GitHub repository identity fields are inconsistent.',
    );
  }

  return {
    githubRepositoryId: repositoryId(payload),
    owner,
    name,
    fullName,
    githubUrl: validateGithubUrl(requiredString(payload, 'html_url')),
    defaultBranch: nullableString(payload, 'default_branch'),
    description: nullableString(payload, 'description'),
    isArchived: requiredBoolean(payload, 'archived'),
    isFork: requiredBoolean(payload, 'fork'),
    createdAtGithub: requiredDate(payload, 'created_at'),
    updatedAtGithub: requiredDate(payload, 'updated_at'),
    pushedAtGithub: nullableDate(payload, 'pushed_at'),
  };
}

function parseRateLimitReset(headers: Headers): Date | null {
  const raw = headers.get('x-ratelimit-reset');

  if (!raw) {
    return null;
  }

  const seconds = Number(raw);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export class GithubClient {
  private readonly token: string | undefined;
  private readonly requestTimeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  public constructor(options: GithubClientOptions = {}) {
    this.token = options.token?.trim() || undefined;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 8_000;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async fetchRepository(
    reference: GithubRepositoryReference,
  ): Promise<GithubRepositorySnapshot> {
    const owner = encodeURIComponent(reference.owner);
    const name = encodeURIComponent(reference.name);
    const url = `${GITHUB_API_ORIGIN}/repos/${owner}/${name}`;

    const headers = new Headers({
      Accept: 'application/vnd.github+json',
      'User-Agent': 'RepoScout',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    });

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    let response: Response;

    try {
      response = await this.fetchImplementation(url, {
        method: 'GET',
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      throw new GithubApiError(
        'request_failed',
        error instanceof Error
          ? `GitHub request failed: ${error.message}`
          : 'GitHub request failed.',
      );
    }

    if (response.status === 404) {
      throw new GithubApiError(
        'not_found',
        'GitHub repository was not found or is not publicly accessible.',
        404,
      );
    }

    const rateLimited =
      response.status === 429 ||
      (response.status === 403 &&
        response.headers.get('x-ratelimit-remaining') === '0');

    if (rateLimited) {
      throw new GithubApiError(
        'rate_limited',
        'GitHub API rate limit was reached.',
        response.status,
        parseRateLimitReset(response.headers),
      );
    }

    if (!response.ok) {
      throw new GithubApiError(
        'request_failed',
        `GitHub API request failed with HTTP ${response.status}.`,
        response.status,
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new GithubApiError(
        'invalid_response',
        'GitHub API returned invalid JSON.',
        response.status,
      );
    }

    return normalizeRepository(payload);
  }
}
