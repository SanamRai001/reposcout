import { describe, expect, it } from 'vitest';

import {
  loadOpenAiEmbeddingEvaluationEnvironment,
} from './openai-embedding-env.js';

describe('OpenAI embedding evaluation environment', () => {
  it('uses the current small embedding model defaults', () => {
    expect(
      loadOpenAiEmbeddingEvaluationEnvironment({
        OPENAI_API_KEY: 'test-key',
      }),
    ).toEqual({
      apiKey: 'test-key',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      requestTimeoutMs: 15000,
    });
  });

  it('supports the large model and bounded dimensions', () => {
    expect(
      loadOpenAiEmbeddingEvaluationEnvironment({
        OPENAI_API_KEY: 'test-key',
        OPENAI_EMBEDDING_MODEL:
          'text-embedding-3-large',
        OPENAI_EMBEDDING_DIMENSIONS: '1024',
        OPENAI_EMBEDDING_TIMEOUT_MS: '9000',
      }),
    ).toEqual({
      apiKey: 'test-key',
      model: 'text-embedding-3-large',
      dimensions: 1024,
      requestTimeoutMs: 9000,
    });
  });

  it('rejects missing credentials and invalid model dimensions', () => {
    expect(() =>
      loadOpenAiEmbeddingEvaluationEnvironment({}),
    ).toThrow('OPENAI_API_KEY is required');

    expect(() =>
      loadOpenAiEmbeddingEvaluationEnvironment({
        OPENAI_API_KEY: 'test-key',
        OPENAI_EMBEDDING_MODEL:
          'text-embedding-3-small',
        OPENAI_EMBEDDING_DIMENSIONS: '1537',
      }),
    ).toThrow(
      'OPENAI_EMBEDDING_DIMENSIONS must be an integer between 1 and 1536',
    );
  });
});
