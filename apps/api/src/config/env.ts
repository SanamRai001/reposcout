const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export type DatabaseEnvironment = Readonly<{
  url: string;
  ssl: boolean;
  poolMax: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
}>;

export type AppEnvironment = Readonly<{
  nodeEnv: NodeEnvironment;
  port: number;
  database: DatabaseEnvironment;
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
  });
}
