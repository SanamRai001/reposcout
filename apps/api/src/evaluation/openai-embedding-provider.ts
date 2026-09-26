import type {
  RepositoryEmbeddingBatch,
  RepositoryEmbeddingInput,
  RepositoryEmbeddingProvider,
} from '../repositories/repository-embedding-provider.js';
import type { OpenAiEmbeddingModel } from './openai-embedding-env.js';

export const OPENAI_EMBEDDING_API_ORIGIN =
  'https://api.openai.com' as const;

type JsonObject = Record<string, unknown>;

export type OpenAiEmbeddingUsage = Readonly<{
  promptTokens: number;
  totalTokens: number;
}>;

export class OpenAiEmbeddingApiError extends Error {
  public constructor(
    public readonly kind:
      | 'request_failed'
      | 'rate_limited'
      | 'unauthorized'
      | 'validation_error'
      | 'invalid_response',
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'OpenAiEmbeddingApiError';
  }
}

function isObject(value: unknown): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function requiredString(
  source: JsonObject,
  field: string,
): string {
  const value = source[field];

  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    throw new OpenAiEmbeddingApiError(
      'invalid_response',
      `OpenAI embeddings response field "${field}" is invalid.`,
    );
  }

  return value;
}

function requiredInteger(
  source: JsonObject,
  field: string,
): number {
  const value = source[field];

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new OpenAiEmbeddingApiError(
      'invalid_response',
      `OpenAI embeddings response field "${field}" is invalid.`,
    );
  }

  return value;
}

function parseVector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new OpenAiEmbeddingApiError(
      'invalid_response',
      'OpenAI embedding vector must be a non-empty array.',
    );
  }

  return value.map((item) => {
    if (
      typeof item !== 'number' ||
      !Number.isFinite(item)
    ) {
      throw new OpenAiEmbeddingApiError(
        'invalid_response',
        'OpenAI embedding vector contains an invalid value.',
      );
    }

    return item;
  });
}

function parseResponse(
  value: unknown,
  inputs: readonly RepositoryEmbeddingInput[],
): Readonly<{
  model: string;
  vectors: readonly Readonly<{
    id: string;
    vector: readonly number[];
  }>[];
  usage: OpenAiEmbeddingUsage;
}> {
  if (!isObject(value) || !Array.isArray(value.data)) {
    throw new OpenAiEmbeddingApiError(
      'invalid_response',
      'OpenAI embeddings response is invalid.',
    );
  }

  const seenIndexes = new Set<number>();
  const vectors: Array<{
    id: string;
    vector: readonly number[];
  }> = [];

  for (const item of value.data) {
    if (!isObject(item)) {
      throw new OpenAiEmbeddingApiError(
        'invalid_response',
        'OpenAI embeddings data item is invalid.',
      );
    }

    const index = requiredInteger(item, 'index');

    if (
      index >= inputs.length ||
      seenIndexes.has(index)
    ) {
      throw new OpenAiEmbeddingApiError(
        'invalid_response',
        'OpenAI embeddings response contains an invalid or duplicate index.',
      );
    }

    seenIndexes.add(index);
    vectors.push({
      id: inputs[index]!.id,
      vector: parseVector(item.embedding),
    });
  }

  if (vectors.length !== inputs.length) {
    throw new OpenAiEmbeddingApiError(
      'invalid_response',
      'OpenAI embeddings response did not include every input.',
    );
  }

  if (!isObject(value.usage)) {
    throw new OpenAiEmbeddingApiError(
      'invalid_response',
      'OpenAI embeddings response usage is invalid.',
    );
  }

  return {
    model: requiredString(value, 'model'),
    vectors,
    usage: {
      promptTokens: requiredInteger(
        value.usage,
        'prompt_tokens',
      ),
      totalTokens: requiredInteger(
        value.usage,
        'total_tokens',
      ),
    },
  };
}

export class OpenAiEmbeddingProvider
  implements RepositoryEmbeddingProvider
{
  readonly providerName = 'openai' as const;
  readonly modelName: OpenAiEmbeddingModel;
  private lastUsageValue: OpenAiEmbeddingUsage | null = null;
  private lastLatencyMsValue: number | null = null;

  public constructor(
    private readonly apiKey: string,
    model: OpenAiEmbeddingModel,
    private readonly dimensions: number,
    private readonly requestTimeoutMs: number = 15_000,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) {
      throw new Error(
        'OpenAI API key must be non-empty.',
      );
    }

    if (
      !Number.isInteger(dimensions) ||
      dimensions < 1
    ) {
      throw new Error(
        'OpenAI embedding dimensions must be a positive integer.',
      );
    }

    this.modelName = model;
  }

  get lastUsage(): OpenAiEmbeddingUsage | null {
    return this.lastUsageValue;
  }

  get lastLatencyMs(): number | null {
    return this.lastLatencyMsValue;
  }

  async embed(
    inputs: readonly RepositoryEmbeddingInput[],
  ): Promise<RepositoryEmbeddingBatch> {
    const startedAt = performance.now();
    let response: Response;

    try {
      response = await this.fetchImplementation(
        `${OPENAI_EMBEDDING_API_ORIGIN}/v1/embeddings`,
        {
          method: 'POST',
          headers: new Headers({
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'User-Agent': 'RepoScout',
          }),
          redirect: 'error',
          signal: AbortSignal.timeout(
            this.requestTimeoutMs,
          ),
          body: JSON.stringify({
            model: this.modelName,
            input: inputs.map((input) => input.text),
            encoding_format: 'float',
            dimensions: this.dimensions,
          }),
        },
      );
    } catch (error) {
      throw new OpenAiEmbeddingApiError(
        'request_failed',
        error instanceof Error
          ? `OpenAI embeddings request failed: ${error.message}`
          : 'OpenAI embeddings request failed.',
      );
    } finally {
      this.lastLatencyMsValue = Math.max(
        0,
        performance.now() - startedAt,
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new OpenAiEmbeddingApiError(
        'unauthorized',
        'OpenAI embeddings request was not authorized.',
        response.status,
      );
    }

    if (response.status === 429) {
      throw new OpenAiEmbeddingApiError(
        'rate_limited',
        'OpenAI embeddings API rate limit was reached.',
        response.status,
      );
    }

    if (response.status === 400 || response.status === 422) {
      throw new OpenAiEmbeddingApiError(
        'validation_error',
        `OpenAI rejected the embeddings request with HTTP ${response.status}.`,
        response.status,
      );
    }

    if (!response.ok) {
      throw new OpenAiEmbeddingApiError(
        'request_failed',
        `OpenAI embeddings request failed with HTTP ${response.status}.`,
        response.status,
      );
    }

    let json: unknown;

    try {
      json = await response.json();
    } catch {
      throw new OpenAiEmbeddingApiError(
        'invalid_response',
        'OpenAI embeddings API returned invalid JSON.',
        response.status,
      );
    }

    const parsed = parseResponse(json, inputs);
    this.lastUsageValue = parsed.usage;

    return {
      provider: this.providerName,
      model: parsed.model,
      dimensions: this.dimensions,
      vectors: parsed.vectors,
    };
  }
}
