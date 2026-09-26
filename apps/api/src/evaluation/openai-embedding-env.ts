export const OPENAI_EMBEDDING_MODELS = [
  'text-embedding-3-small',
  'text-embedding-3-large',
] as const;

export type OpenAiEmbeddingModel =
  (typeof OPENAI_EMBEDDING_MODELS)[number];

export type OpenAiEmbeddingEvaluationEnvironment = Readonly<{
  apiKey: string;
  model: OpenAiEmbeddingModel;
  dimensions: number;
  requestTimeoutMs: number;
}>;

function requiredSecret(name: string, value: string | undefined): string {
  const candidate = value?.trim();

  if (!candidate) {
    throw new Error(
      `${name} is required for live semantic retrieval evaluation.`,
    );
  }

  return candidate;
}

function model(value: string | undefined): OpenAiEmbeddingModel {
  const candidate =
    value?.trim() || 'text-embedding-3-small';

  if (
    !OPENAI_EMBEDDING_MODELS.includes(
      candidate as OpenAiEmbeddingModel,
    )
  ) {
    throw new Error(
      `OPENAI_EMBEDDING_MODEL must be one of: ${OPENAI_EMBEDDING_MODELS.join(', ')}.`,
    );
  }

  return candidate as OpenAiEmbeddingModel;
}

function dimensions(
  value: string | undefined,
  selectedModel: OpenAiEmbeddingModel,
): number {
  const maximum =
    selectedModel === 'text-embedding-3-small'
      ? 1_536
      : 3_072;
  const fallback = maximum;

  if (!value || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    throw new Error(
      `OPENAI_EMBEDDING_DIMENSIONS must be an integer between 1 and ${maximum} for ${selectedModel}.`,
    );
  }

  return parsed;
}

function timeout(value: string | undefined): number {
  if (!value || value.trim() === '') {
    return 15_000;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 500 ||
    parsed > 60_000
  ) {
    throw new Error(
      'OPENAI_EMBEDDING_TIMEOUT_MS must be an integer between 500 and 60000.',
    );
  }

  return parsed;
}

export function loadOpenAiEmbeddingEvaluationEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): OpenAiEmbeddingEvaluationEnvironment {
  const selectedModel = model(
    source.OPENAI_EMBEDDING_MODEL,
  );

  return Object.freeze({
    apiKey: requiredSecret(
      'OPENAI_API_KEY',
      source.OPENAI_API_KEY,
    ),
    model: selectedModel,
    dimensions: dimensions(
      source.OPENAI_EMBEDDING_DIMENSIONS,
      selectedModel,
    ),
    requestTimeoutMs: timeout(
      source.OPENAI_EMBEDDING_TIMEOUT_MS,
    ),
  });
}
