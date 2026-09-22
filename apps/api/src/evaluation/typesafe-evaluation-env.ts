export type TypeSafeEvaluationEnvironment = Readonly<{
  apiKey: string;
  model: string;
  requestTimeoutMs: number;
}>;

function requiredSecret(name: string, value: string | undefined): string {
  const candidate = value?.trim();

  if (!candidate) {
    throw new Error(`${name} is required for live Jev evaluation.`);
  }

  return candidate;
}

function optionalModel(value: string | undefined): string {
  const candidate = value?.trim();
  return candidate || 'jev-latest';
}

function timeout(value: string | undefined): number {
  if (!value || value.trim() === '') {
    return 8_000;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 500 || parsed > 60_000) {
    throw new Error(
      'TYPESAFE_REQUEST_TIMEOUT_MS must be an integer between 500 and 60000.',
    );
  }

  return parsed;
}

export function loadTypeSafeEvaluationEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): TypeSafeEvaluationEnvironment {
  return Object.freeze({
    apiKey: requiredSecret('TYPESAFE_API_KEY', source.TYPESAFE_API_KEY),
    model: optionalModel(source.TYPESAFE_MODEL),
    requestTimeoutMs: timeout(source.TYPESAFE_REQUEST_TIMEOUT_MS),
  });
}
