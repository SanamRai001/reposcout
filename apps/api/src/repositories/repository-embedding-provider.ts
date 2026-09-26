export const MAX_EMBEDDING_DIMENSIONS = 32_768;

export type RepositoryEmbeddingInput = Readonly<{
  id: string;
  text: string;
}>;

export type RepositoryEmbeddingVector = Readonly<{
  id: string;
  vector: readonly number[];
}>;

export type RepositoryEmbeddingBatch = Readonly<{
  provider: string;
  model: string;
  dimensions: number;
  vectors: readonly RepositoryEmbeddingVector[];
}>;

export type RepositoryEmbeddingProvider = Readonly<{
  providerName: string;
  modelName: string;
  embed(
    inputs: readonly RepositoryEmbeddingInput[],
  ): Promise<RepositoryEmbeddingBatch>;
}>;

function assertNonEmpty(name: string, value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${name} must be non-empty.`);
  }

  return normalized;
}

function validateInputs(
  inputs: readonly RepositoryEmbeddingInput[],
): void {
  if (inputs.length === 0) {
    throw new Error('Embedding input batch must not be empty.');
  }

  const ids = new Set<string>();

  for (const input of inputs) {
    const id = assertNonEmpty('embedding input id', input.id);
    assertNonEmpty(`embedding input text for ${id}`, input.text);

    if (ids.has(id)) {
      throw new Error(
        `Embedding input batch contains duplicate id "${id}".`,
      );
    }

    ids.add(id);
  }
}

function vectorNorm(vector: readonly number[]): number {
  return Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0),
  );
}

export function validateEmbeddingBatch(
  inputs: readonly RepositoryEmbeddingInput[],
  provider: Pick<
    RepositoryEmbeddingProvider,
    'providerName' | 'modelName'
  >,
  batch: RepositoryEmbeddingBatch,
): RepositoryEmbeddingBatch {
  validateInputs(inputs);

  const providerName = assertNonEmpty(
    'embedding providerName',
    provider.providerName,
  );
  const modelName = assertNonEmpty(
    'embedding modelName',
    provider.modelName,
  );

  if (batch.provider !== providerName) {
    throw new Error(
      `Embedding provider provenance mismatch: expected "${providerName}", received "${batch.provider}".`,
    );
  }

  if (batch.model !== modelName) {
    throw new Error(
      `Embedding model provenance mismatch: expected "${modelName}", received "${batch.model}".`,
    );
  }

  if (
    !Number.isInteger(batch.dimensions) ||
    batch.dimensions < 1 ||
    batch.dimensions > MAX_EMBEDDING_DIMENSIONS
  ) {
    throw new Error(
      `Embedding dimensions must be an integer between 1 and ${MAX_EMBEDDING_DIMENSIONS}.`,
    );
  }

  if (batch.vectors.length !== inputs.length) {
    throw new Error(
      'Embedding provider must return exactly one vector per input.',
    );
  }

  const expectedIds = new Set(inputs.map((input) => input.id));
  const seenIds = new Set<string>();

  for (const item of batch.vectors) {
    if (!expectedIds.has(item.id)) {
      throw new Error(
        `Embedding provider returned unknown id "${item.id}".`,
      );
    }

    if (seenIds.has(item.id)) {
      throw new Error(
        `Embedding provider returned duplicate id "${item.id}".`,
      );
    }

    seenIds.add(item.id);

    if (item.vector.length !== batch.dimensions) {
      throw new Error(
        `Embedding vector "${item.id}" must have exactly ${batch.dimensions} dimensions.`,
      );
    }

    for (const value of item.vector) {
      if (!Number.isFinite(value)) {
        throw new Error(
          `Embedding vector "${item.id}" contains a non-finite value.`,
        );
      }
    }

    if (vectorNorm(item.vector) === 0) {
      throw new Error(
        `Embedding vector "${item.id}" must not be a zero vector.`,
      );
    }
  }

  for (const input of inputs) {
    if (!seenIds.has(input.id)) {
      throw new Error(
        `Embedding provider omitted input id "${input.id}".`,
      );
    }
  }

  return batch;
}

export async function runEmbeddingProvider(
  provider: RepositoryEmbeddingProvider,
  inputs: readonly RepositoryEmbeddingInput[],
): Promise<RepositoryEmbeddingBatch> {
  validateInputs(inputs);
  assertNonEmpty('embedding providerName', provider.providerName);
  assertNonEmpty('embedding modelName', provider.modelName);

  const batch = await provider.embed(inputs);

  return validateEmbeddingBatch(inputs, provider, batch);
}
