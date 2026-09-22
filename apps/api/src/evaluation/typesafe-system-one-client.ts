const TYPESAFE_API_ORIGIN = 'https://api.typesafe.ai';

type JsonObject = Record<string, unknown>;

export type TypeSafeNoulQuestion = Readonly<{
  type: 'noul';
  instructions?: unknown;
  criteria?: Readonly<{
    true?: unknown;
    false?: unknown;
  }> | null;
}>;

export type TypeSafeChoiceQuestion = Readonly<{
  type: 'choice';
  instructions?: unknown;
  criteria: Readonly<Record<string, unknown>>;
}>;

export type TypeSafeScoreQuestion = Readonly<{
  type: 'score';
  instructions?: unknown;
  criteria: readonly unknown[];
}>;

export type TypeSafeQuestion =
  | TypeSafeNoulQuestion
  | TypeSafeChoiceQuestion
  | TypeSafeScoreQuestion;

export type TypeSafeSystemOneRequest = Readonly<{
  state: unknown;
  model: string;
  questions: Readonly<Record<string, TypeSafeQuestion>>;
}>;

export type TypeSafeNoulAnswer = Readonly<{
  type: 'noul';
  noul: number;
}>;

export type TypeSafeChoiceAnswer = Readonly<{
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Readonly<Record<string, number>>;
}>;

export type TypeSafeScoreAnswer = Readonly<{
  type: 'score';
  score: number;
  confidence: number;
  legend: Readonly<Record<string, unknown>>;
  probabilities: Readonly<Record<string, number>>;
}>;

export type TypeSafeAnswer =
  | TypeSafeNoulAnswer
  | TypeSafeChoiceAnswer
  | TypeSafeScoreAnswer;

export type TypeSafeSystemOneResponse = Readonly<{
  model: string;
  answers: Readonly<Record<string, TypeSafeAnswer>>;
  usage: Readonly<{
    inputTokens: number;
    outputTokens: number;
  }>;
}>;

export type TypeSafeModelMetadata = Readonly<{
  name: string;
  description: string;
  releaseDate: string;
}>;

export class TypeSafeApiError extends Error {
  public constructor(
    public readonly kind:
      | 'request_failed'
      | 'rate_limited'
      | 'invalid_response'
      | 'validation_error',
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'TypeSafeApiError';
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(source: JsonObject, field: string): string {
  const value = source[field];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeSafeApiError(
      'invalid_response',
      `TypeSafe response field "${field}" is invalid.`,
    );
  }

  return value;
}

function requiredNumber(source: JsonObject, field: string): number {
  const value = source[field];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeSafeApiError(
      'invalid_response',
      `TypeSafe response field "${field}" is invalid.`,
    );
  }

  return value;
}

function probability(value: number, label: string): number {
  if (value < 0 || value > 1) {
    throw new TypeSafeApiError(
      'invalid_response',
      `${label} must be between 0 and 1.`,
    );
  }

  return value;
}

function numberMap(value: unknown, label: string): Record<string, number> {
  if (!isObject(value)) {
    throw new TypeSafeApiError(
      'invalid_response',
      `${label} must be an object.`,
    );
  }

  const result: Record<string, number> = {};

  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      throw new TypeSafeApiError(
        'invalid_response',
        `${label} contains an invalid probability.`,
      );
    }

    result[key] = probability(item, `${label}.${key}`);
  }

  return result;
}

function parseAnswer(value: unknown): TypeSafeAnswer {
  if (!isObject(value)) {
    throw new TypeSafeApiError(
      'invalid_response',
      'TypeSafe answer must be an object.',
    );
  }

  const type = requiredString(value, 'type');

  if (type === 'noul') {
    return {
      type,
      noul: probability(requiredNumber(value, 'noul'), 'noul'),
    };
  }

  if (type === 'choice') {
    return {
      type,
      choice: requiredString(value, 'choice'),
      confidence: probability(
        requiredNumber(value, 'confidence'),
        'choice.confidence',
      ),
      probabilities: numberMap(
        value.probabilities,
        'choice.probabilities',
      ),
    };
  }

  if (type === 'score') {
    if (!isObject(value.legend)) {
      throw new TypeSafeApiError(
        'invalid_response',
        'score.legend must be an object.',
      );
    }

    return {
      type,
      score: requiredNumber(value, 'score'),
      confidence: probability(
        requiredNumber(value, 'confidence'),
        'score.confidence',
      ),
      legend: value.legend,
      probabilities: numberMap(
        value.probabilities,
        'score.probabilities',
      ),
    };
  }

  throw new TypeSafeApiError(
    'invalid_response',
    `Unsupported TypeSafe answer type "${type}".`,
  );
}

function parseSystemOneResponse(
  value: unknown,
): TypeSafeSystemOneResponse {
  if (!isObject(value)) {
    throw new TypeSafeApiError(
      'invalid_response',
      'TypeSafe System One response must be an object.',
    );
  }

  const answersValue = value.answers;
  const usageValue = value.usage;

  if (!isObject(answersValue) || !isObject(usageValue)) {
    throw new TypeSafeApiError(
      'invalid_response',
      'TypeSafe System One response is missing answers or usage.',
    );
  }

  const answers: Record<string, TypeSafeAnswer> = {};

  for (const [key, answer] of Object.entries(answersValue)) {
    answers[key] = parseAnswer(answer);
  }

  const inputTokens = requiredNumber(usageValue, 'input_tokens');
  const outputTokens = requiredNumber(usageValue, 'output_tokens');

  if (
    !Number.isInteger(inputTokens) ||
    inputTokens < 0 ||
    !Number.isInteger(outputTokens) ||
    outputTokens < 0
  ) {
    throw new TypeSafeApiError(
      'invalid_response',
      'TypeSafe usage token counts must be nonnegative integers.',
    );
  }

  return {
    model: requiredString(value, 'model'),
    answers,
    usage: {
      inputTokens,
      outputTokens,
    },
  };
}

function parseModels(value: unknown): TypeSafeModelMetadata[] {
  if (!isObject(value) || !Array.isArray(value.models)) {
    throw new TypeSafeApiError(
      'invalid_response',
      'TypeSafe models response is invalid.',
    );
  }

  return value.models.map((item) => {
    if (!isObject(item)) {
      throw new TypeSafeApiError(
        'invalid_response',
        'TypeSafe model metadata is invalid.',
      );
    }

    return {
      name: requiredString(item, 'name'),
      description: requiredString(item, 'description'),
      releaseDate: requiredString(item, 'release_date'),
    };
  });
}

export class TypeSafeSystemOneClient {
  public constructor(
    private readonly apiKey: string,
    private readonly requestTimeoutMs: number = 8_000,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) {
      throw new Error('TypeSafe API key must be non-empty.');
    }
  }

  private headers(): Headers {
    return new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'User-Agent': 'RepoScout',
    });
  }

  private async request(
    path: '/v1/models' | '/v1/systemone',
    init: RequestInit,
  ): Promise<unknown> {
    let response: Response;

    try {
      response = await this.fetchImplementation(
        `${TYPESAFE_API_ORIGIN}${path}`,
        {
          ...init,
          headers: this.headers(),
          redirect: 'error',
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        },
      );
    } catch (error) {
      throw new TypeSafeApiError(
        'request_failed',
        error instanceof Error
          ? `TypeSafe request failed: ${error.message}`
          : 'TypeSafe request failed.',
      );
    }

    if (response.status === 429) {
      throw new TypeSafeApiError(
        'rate_limited',
        'TypeSafe API rate limit was reached.',
        response.status,
      );
    }

    if (response.status === 422) {
      throw new TypeSafeApiError(
        'validation_error',
        'TypeSafe rejected the evaluation request.',
        response.status,
      );
    }

    if (!response.ok) {
      throw new TypeSafeApiError(
        'request_failed',
        `TypeSafe request failed with HTTP ${response.status}.`,
        response.status,
      );
    }

    try {
      return await response.json();
    } catch {
      throw new TypeSafeApiError(
        'invalid_response',
        'TypeSafe API returned invalid JSON.',
        response.status,
      );
    }
  }

  async listModels(): Promise<TypeSafeModelMetadata[]> {
    return parseModels(
      await this.request('/v1/models', {
        method: 'GET',
      }),
    );
  }

  async systemOne(
    request: TypeSafeSystemOneRequest,
  ): Promise<TypeSafeSystemOneResponse> {
    return parseSystemOneResponse(
      await this.request('/v1/systemone', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
    );
  }
}
