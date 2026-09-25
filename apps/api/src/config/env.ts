const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export type DatabaseEnvironment = Readonly<{
  url: string;
  ssl: boolean;
  poolMax: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
}>;

export type GithubEnvironment = Readonly<{
  token: string | undefined;
  requestTimeoutMs: number;
}>;

export type ModerationReviewerEnvironment = Readonly<{
  reviewerRef: string;
  token: string;
}>;

export type ModerationEnvironment = Readonly<{
  reviewers: readonly ModerationReviewerEnvironment[];
}>;

export type AppEnvironment = Readonly<{
  nodeEnv: NodeEnvironment;
  port: number;
  database: DatabaseEnvironment;
  github: GithubEnvironment;
  moderation: ModerationEnvironment;
}>;

function parseInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }

  return parsed;
}

function parseBoolean(
  name: string,
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`${name} must be either "true" or "false".`);
}

function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  const candidate = value ?? 'development';

  if (!NODE_ENVIRONMENTS.includes(candidate as NodeEnvironment)) {
    throw new Error(
      `NODE_ENV must be one of: ${NODE_ENVIRONMENTS.join(', ')}.`,
    );
  }

  return candidate as NodeEnvironment;
}

function requireDatabaseUrl(value: string | undefined): string {
  const candidate = value?.trim();

  if (!candidate) {
    throw new Error('DATABASE_URL is required.');
  }

  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres:// or postgresql:// protocol.');
  }

  return candidate;
}

function optionalSecret(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  return candidate ? candidate : undefined;
}

function parseModerationReviewers(
  value: string | undefined,
): readonly ModerationReviewerEnvironment[] {
  if (value === undefined || value.trim() === '') {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(
      'MODERATION_REVIEWERS_JSON must be a JSON object mapping reviewer references to bearer tokens.',
    );
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      'MODERATION_REVIEWERS_JSON must be a JSON object mapping reviewer references to bearer tokens.',
    );
  }

  const entries = Object.entries(parsed);

  if (entries.length > 20) {
    throw new Error(
      'MODERATION_REVIEWERS_JSON may configure at most 20 reviewers.',
    );
  }

  return entries.map(([rawReviewerRef, rawToken]) => {
    const reviewerRef = rawReviewerRef.trim();

    if (reviewerRef.length < 1 || reviewerRef.length > 200) {
      throw new Error(
        'Moderation reviewer references must be between 1 and 200 characters.',
      );
    }

    if (
      typeof rawToken !== 'string' ||
      rawToken.length < 32 ||
      rawToken.length > 512 ||
      /\s/.test(rawToken)
    ) {
      throw new Error(
        'Moderation reviewer tokens must be 32-512 non-whitespace characters.',
      );
    }

    return Object.freeze({
      reviewerRef,
      token: rawToken,
    });
  });
}

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): AppEnvironment {
  return Object.freeze({
    nodeEnv: parseNodeEnvironment(source.NODE_ENV),
    port: parseInteger('PORT', source.PORT, 4000, 1, 65_535),
    database: Object.freeze({
      url: requireDatabaseUrl(source.DATABASE_URL),
      ssl: parseBoolean('DATABASE_SSL', source.DATABASE_SSL, false),
      poolMax: parseInteger(
        'DATABASE_POOL_MAX',
        source.DATABASE_POOL_MAX,
        10,
        1,
        100,
      ),
      connectionTimeoutMs: parseInteger(
        'DATABASE_CONNECTION_TIMEOUT_MS',
        source.DATABASE_CONNECTION_TIMEOUT_MS,
        5_000,
        100,
        60_000,
      ),
      idleTimeoutMs: parseInteger(
        'DATABASE_IDLE_TIMEOUT_MS',
        source.DATABASE_IDLE_TIMEOUT_MS,
        10_000,
        1_000,
        300_000,
      ),
    }),
    github: Object.freeze({
      token: optionalSecret(source.GITHUB_TOKEN),
      requestTimeoutMs: parseInteger(
        'GITHUB_REQUEST_TIMEOUT_MS',
        source.GITHUB_REQUEST_TIMEOUT_MS,
        8_000,
        500,
        60_000,
      ),
    }),
    moderation: Object.freeze({
      reviewers: Object.freeze(
        parseModerationReviewers(source.MODERATION_REVIEWERS_JSON),
      ),
    }),
  });
}
