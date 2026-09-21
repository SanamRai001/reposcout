const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export type AppEnvironment = Readonly<{
  nodeEnv: NodeEnvironment;
  port: number;
}>;

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return 4000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
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

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): AppEnvironment {
  return Object.freeze({
    nodeEnv: parseNodeEnvironment(source.NODE_ENV),
    port: parsePort(source.PORT),
  });
}
