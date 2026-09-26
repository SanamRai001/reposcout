import { describe, expect, it } from 'vitest';

import {
  runEmbeddingProvider,
  validateEmbeddingBatch,
  type RepositoryEmbeddingProvider,
} from './repository-embedding-provider.js';

const inputs = [
  { id: 'a', text: 'database migration tool' },
  { id: 'b', text: 'accessible React components' },
] as const;

describe('repository embedding provider contract', () => {
  it('accepts a complete finite batch with exact provider/model/dimension provenance', async () => {
    const provider: RepositoryEmbeddingProvider = {
      providerName: 'fixture',
      modelName: 'fixture-v1',
      embed: async () => ({
        provider: 'fixture',
        model: 'fixture-v1',
        dimensions: 3,
        vectors: [
          { id: 'a', vector: [1, 0, 0] },
          { id: 'b', vector: [0, 1, 0] },
        ],
      }),
    };

    await expect(runEmbeddingProvider(provider, inputs)).resolves.toEqual(
      expect.objectContaining({
        provider: 'fixture',
        model: 'fixture-v1',
        dimensions: 3,
      }),
    );
  });

  it.each([
    [
      'provider mismatch',
      {
        provider: 'wrong',
        model: 'fixture-v1',
        dimensions: 2,
        vectors: [
          { id: 'a', vector: [1, 0] },
          { id: 'b', vector: [0, 1] },
        ],
      },
    ],
    [
      'model mismatch',
      {
        provider: 'fixture',
        model: 'wrong',
        dimensions: 2,
        vectors: [
          { id: 'a', vector: [1, 0] },
          { id: 'b', vector: [0, 1] },
        ],
      },
    ],
    [
      'wrong dimension length',
      {
        provider: 'fixture',
        model: 'fixture-v1',
        dimensions: 2,
        vectors: [
          { id: 'a', vector: [1] },
          { id: 'b', vector: [0, 1] },
        ],
      },
    ],
    [
      'zero vector',
      {
        provider: 'fixture',
        model: 'fixture-v1',
        dimensions: 2,
        vectors: [
          { id: 'a', vector: [0, 0] },
          { id: 'b', vector: [0, 1] },
        ],
      },
    ],
    [
      'unknown id',
      {
        provider: 'fixture',
        model: 'fixture-v1',
        dimensions: 2,
        vectors: [
          { id: 'a', vector: [1, 0] },
          { id: 'c', vector: [0, 1] },
        ],
      },
    ],
  ])('rejects invalid batch: %s', (_name, batch) => {
    expect(() =>
      validateEmbeddingBatch(
        inputs,
        {
          providerName: 'fixture',
          modelName: 'fixture-v1',
        },
        batch,
      ),
    ).toThrow();
  });

  it('rejects duplicate inputs before calling the provider', async () => {
    let called = false;
    const provider: RepositoryEmbeddingProvider = {
      providerName: 'fixture',
      modelName: 'fixture-v1',
      embed: async () => {
        called = true;
        throw new Error('must not be called');
      },
    };

    await expect(
      runEmbeddingProvider(provider, [
        { id: 'same', text: 'first' },
        { id: 'same', text: 'second' },
      ]),
    ).rejects.toThrow('duplicate id');
    expect(called).toBe(false);
  });

  it('rejects non-finite vector values', () => {
    expect(() =>
      validateEmbeddingBatch(
        [{ id: 'a', text: 'query' }],
        {
          providerName: 'fixture',
          modelName: 'fixture-v1',
        },
        {
          provider: 'fixture',
          model: 'fixture-v1',
          dimensions: 2,
          vectors: [{ id: 'a', vector: [1, Number.NaN] }],
        },
      ),
    ).toThrow('non-finite');
  });
});
