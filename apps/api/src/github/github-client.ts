import type { GithubRepositoryReference } from './github-repository-reference.js';
import { REPOSITORY_README_MAX_BYTES } from '../repositories/repository-readme.js';

const GITHUB_API_ORIGIN = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';

export type GithubClientOptions = Readonly<{
  token?: string | undefined;
  requestTimeoutMs?: number | undefined;
  fetchImplementation?: typeof fetch | undefined;
}>;

export type GithubRepositoryMetadataSnapshot = Readonly<{
  stars: number;
  forks: number;
  openIssues: number;
  primaryLanguage: string | null;
  licenseSpdx: string | null;
  topics: string[];
}>;

export type GithubReadmeSnapshot =
  | Readonly<{
      status: 'present';
      path: string;
      sha: string;
      sizeBytes: number;
      content: string;
    }>
  | Readonly<{
      status: 'not_found';
    }>
  | Readonly<{
      status: 'too_large';
      path: string;
      sha: string;
      sizeBytes: number;
    }>;

export type GithubLinkedEvidence = Readonly<{
  apiUrl: string;
  htmlUrl: string;
}>;

export type GithubCommunityProfileSnapshot = Readonly<{
  contributing: GithubLinkedEvidence | null;
  codeOfConduct: GithubLinkedEvidence | null;
  issueTemplate: GithubLinkedEvidence | null;
  pullRequestTemplate: GithubLinkedEvidence | null;
  updatedAt: Date | null;
}>;

export type GithubSecurityPolicySnapshot = Readonly<{
  path: string;
  sha: string;
  sizeBytes: number;
}> | null;

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
  metadata: GithubRepositoryMetadataSnapshot;
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

function requiredNonnegativeSafeInteger(
  source: JsonObject,
  field: string,
): number {
  const value = source[field];

  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new GithubApiError(
      'invalid_response',
      `GitHub response field "${field}" is invalid.`,
    );
  }

  return value;
}

function stringArray(source: JsonObject, field: string): string[] {
  const value = source[field];

  if (
    !Array.isArray(value) ||
    !value.every(
      (item) => typeof item === 'string' && item.trim().length > 0,
    )
  ) {
    throw new GithubApiError(
      'invalid_response',
      `GitHub response field "${field}" is invalid.`,
    );
  }

  return [...new Set(value)].sort((left, right) =>
    left.localeCompare(right),
  );
}

function licenseSpdx(source: JsonObject): string | null {
  const value = source.license;

  if (value === null) {
    return null;
  }

  if (!isObject(value)) {
    throw new GithubApiError(
      'invalid_response',
      'GitHub response field "license" is invalid.',
    );
  }

  return nullableString(value, 'spdx_id');
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

function validateTrustedUrl(
  value: string,
  hostname: 'github.com' | 'api.github.com',
  label: string,
): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new GithubApiError(
      'invalid_response',
      `${label} is invalid.`,
    );
  }

  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== hostname) {
    throw new GithubApiError(
      'invalid_response',
      `${label} must use https://${hostname}.`,
    );
  }

  return value;
}

function validateGithubUrl(value: string): string {
  return validateTrustedUrl(
    value,
    'github.com',
    'GitHub repository html_url',
  );
}

function decodeReadmeContent(
  payload: JsonObject,
  expectedSizeBytes: number,
): string {
  const encoding = requiredString(payload, 'encoding');

  if (encoding !== 'base64') {
    throw new GithubApiError(
      'invalid_response',
      'GitHub README encoding must be base64.',
    );
  }

  const encoded = requiredString(payload, 'content', {
    allowEmpty: true,
  }).replace(/\s+/g, '');

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new GithubApiError(
      'invalid_response',
      'GitHub README content is not valid base64.',
    );
  }

  const bytes = Buffer.from(encoded, 'base64');

  if (bytes.byteLength !== expectedSizeBytes) {
    throw new GithubApiError(
      'invalid_response',
      'GitHub README byte size does not match the response metadata.',
    );
  }

  let content: string;

  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new GithubApiError(
      'invalid_response',
      'GitHub README content is not valid UTF-8 text.',
    );
  }

  if (content.includes('\u0000')) {
    throw new GithubApiError(
      'invalid_response',
      'GitHub README content contains unsupported null bytes.',
    );
  }

  return content;
}

function nullableLinkedEvidence(
  files: JsonObject,
  field: string,
): GithubLinkedEvidence | null {
  const value = files[field];

  if (value === null || value === undefined) {
    return null;
  }

  if (!isObject(value)) {
    throw new GithubApiError(
      'invalid_response',
      `GitHub community profile field "${field}" is invalid.`,
    );
  }

  return {
    apiUrl: validateTrustedUrl(
      requiredString(value, 'url'),
      'api.github.com',
      `GitHub community profile ${field} API URL`,
    ),
    htmlUrl: validateTrustedUrl(
      requiredString(value, 'html_url'),
      'github.com',
      `GitHub community profile ${field} HTML URL`,
    ),
  };
}

function normalizeCommunityProfile(
  payload: unknown,
): GithubCommunityProfileSnapshot {
  if (!isObject(payload)) {
    throw new GithubApiError(
      'invalid_response',
      'GitHub community profile response must be an object.',
    );
  }

  const files = payload.files;

  if (!isObject(files)) {
    throw new GithubApiError(
      'invalid_response',
      'GitHub community profile files are invalid.',
    );
  }

  return {
    contributing: nullableLinkedEvidence(files, 'contributing'),
    codeOfConduct: nullableLinkedEvidence(files, 'code_of_conduct_file'),
    issueTemplate: nullableLinkedEvidence(files, 'issue_template'),
    pullRequestTemplate: nullableLinkedEvidence(
      files,
      'pull_request_template',
    ),
    updatedAt: nullableDate(payload, 'updated_at'),
  };
}

function normalizeFileMetadata(
  payload: unknown,
  label: string,
): Exclude<GithubSecurityPolicySnapshot, null> {
  if (!isObject(payload)) {
    throw new GithubApiError(
      'invalid_response',
      `GitHub ${label} response must be an object.`,
    );
  }

  if (requiredString(payload, 'type') !== 'file') {
    throw new GithubApiError(
      'invalid_response',
      `GitHub ${label} response must describe a file.`,
    );
  }

  return {
    path: requiredString(payload, 'path'),
    sha: requiredString(payload, 'sha'),
    sizeBytes: requiredNonnegativeSafeInteger(payload, 'size'),
  };
}

function normalizeReadme(payload: unknown): GithubReadmeSnapshot {
  if (!isObject(payload)) {
    throw new GithubApiError(
      'invalid_response',
      'GitHub README response must be an object.',
    );
  }

  if (requiredString(payload, 'type') !== 'file') {
    throw new GithubApiError(
      'invalid_response',
      'GitHub README response must describe a file.',
    );
  }

  const path = requiredString(payload, 'path');
  const sha = requiredString(payload, 'sha');
  const sizeBytes = requiredNonnegativeSafeInteger(payload, 'size');

  if (sizeBytes > REPOSITORY_README_MAX_BYTES) {
    return {
      status: 'too_large',
      path,
      sha,
      sizeBytes,
    };
  }

  return {
    status: 'present',
    path,
    sha,
    sizeBytes,
    content: decodeReadmeContent(payload, sizeBytes),
  };
}

function createGithubHeaders(token: string | undefined): Headers {
  const headers = new Headers({
    Accept: 'application/vnd.github+json',
    'User-Agent': 'RepoScout',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  });

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
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
    metadata: {
      stars: requiredNonnegativeSafeInteger(payload, 'stargazers_count'),
      forks: requiredNonnegativeSafeInteger(payload, 'forks_count'),
      openIssues: requiredNonnegativeSafeInteger(payload, 'open_issues_count'),
      primaryLanguage: nullableString(payload, 'language'),
      licenseSpdx: licenseSpdx(payload),
      topics: stringArray(payload, 'topics'),
    },
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

    const headers = createGithubHeaders(this.token);

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

  async fetchCommunityProfile(
    reference: GithubRepositoryReference,
  ): Promise<GithubCommunityProfileSnapshot> {
    const owner = encodeURIComponent(reference.owner);
    const name = encodeURIComponent(reference.name);
    const url =
      `${GITHUB_API_ORIGIN}/repos/${owner}/${name}/community/profile`;
    const headers = createGithubHeaders(this.token);

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
          ? `GitHub community profile request failed: ${error.message}`
          : 'GitHub community profile request failed.',
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
        response.status === 404 ? 'not_found' : 'request_failed',
        `GitHub community profile request failed with HTTP ${response.status}.`,
        response.status,
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new GithubApiError(
        'invalid_response',
        'GitHub community profile API returned invalid JSON.',
        response.status,
      );
    }

    return normalizeCommunityProfile(payload);
  }

  async fetchSecurityPolicy(
    reference: GithubRepositoryReference,
    sourceRef: string,
  ): Promise<GithubSecurityPolicySnapshot> {
    const owner = encodeURIComponent(reference.owner);
    const name = encodeURIComponent(reference.name);
    const headers = createGithubHeaders(this.token);
    const paths = [
      '.github/SECURITY.md',
      'SECURITY.md',
      'docs/SECURITY.md',
    ] as const;

    for (const path of paths) {
      const encodedPath = path
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      const url =
        `${GITHUB_API_ORIGIN}/repos/${owner}/${name}/contents/${encodedPath}` +
        `?ref=${encodeURIComponent(sourceRef)}`;

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
            ? `GitHub security policy request failed: ${error.message}`
            : 'GitHub security policy request failed.',
        );
      }

      if (response.status === 404) {
        continue;
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
          `GitHub security policy request failed with HTTP ${response.status}.`,
          response.status,
        );
      }

      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        throw new GithubApiError(
          'invalid_response',
          'GitHub security policy API returned invalid JSON.',
          response.status,
        );
      }

      return normalizeFileMetadata(payload, 'security policy');
    }

    return null;
  }

  async fetchReadme(
    reference: GithubRepositoryReference,
    sourceRef: string | null,
  ): Promise<GithubReadmeSnapshot> {
    const owner = encodeURIComponent(reference.owner);
    const name = encodeURIComponent(reference.name);
    const query = sourceRef
      ? `?ref=${encodeURIComponent(sourceRef)}`
      : '';
    const url = `${GITHUB_API_ORIGIN}/repos/${owner}/${name}/readme${query}`;
    const headers = createGithubHeaders(this.token);

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
          ? `GitHub README request failed: ${error.message}`
          : 'GitHub README request failed.',
      );
    }

    if (response.status === 404) {
      return {
        status: 'not_found',
      };
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
        `GitHub README request failed with HTTP ${response.status}.`,
        response.status,
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new GithubApiError(
        'invalid_response',
        'GitHub README API returned invalid JSON.',
        response.status,
      );
    }

    return normalizeReadme(payload);
  }
}
