import { describe, expect, it, vi } from 'vitest';

import {
  OpenAiEmbeddingApiError,
  OpenAiEmbeddingProvider,
} from './openai-embedding-provider.js';
import { runEmbeddingProvider } from '../repositories/repository-embedding-provider.js';

describe('OpenAiEmbeddingProvider', () => {
  it('calls the fixed embeddings endpoint and maps response indexes back to input ids', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            object: 'list',
            data: [
              {
                object: 'embedding',
                index: 1,
                embedding: [0, 1, 0],
              },
              {
                object: 'embedding',
                index: 0,
                embedding: [1, 0, 0],
              },
            ],
            model: 'text-embedding-3-small',
            usage: {
              prompt_tokens: 12,
              total_tokens: 12,
            },
          }),
          { status: 200 },
        ),
      );

    const provider = new OpenAiEmbeddingProvider(
      'secret-key',
      'text-embedding-3-small',
      3,
      8000,
      fetchImplementation,
    );

    const batch = await runEmbeddingProvider(provider, [
      { id: 'repo:a', text: 'first document' },
      { id: 'query:q', text: 'search query' },
    ]);

    expect(batch).toEqual({
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 3,
      vectors: [
        { id: 'query:q', vector: [0, 1, 0] },
        { id: 'repo:a', vector: [1, 0, 0] },
      ],
    });
    expect(provider.lastUsage).toEqual({
      promptTokens: 12,
      totalTokens: 12,
    });
    expect(provider.lastLatencyMs).toBeTypeOf('number');

    const [url, init] =
      fetchImplementation.mock.calls[0] ?? [];

    expect(url).toBe(
      'https://api.openai.com/v1/embeddings',
    );
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('error');

    const headers = init?.headers as Headers;
    expect(headers.get('authorization')).toBe(
      'Bearer secret-key',
    );

    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'text-embedding-3-small',
      input: ['first document', 'search query'],
      encoding_format: 'float',
      dimensions: 3,
    });
  });

  it.each([
    [401, 'unauthorized'],
    [429, 'rate_limited'],
    [400, 'validation_error'],
    [500, 'request_failed'],
  ] as const)(
    'classifies HTTP %s as %s',
    async (status, kind) => {
      const provider = new OpenAiEmbeddingProvider(
        'secret-key',
        'text-embedding-3-small',
        3,
        8000,
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            new Response('{}', { status }),
          ),
      );

      await expect(
        provider.embed([
          { id: 'a', text: 'document' },
        ]),
      ).rejects.toMatchObject({
        kind,
        status,
      } satisfies Partial<OpenAiEmbeddingApiError>);
    },
  );

  it('rejects malformed or incomplete provider responses', async () => {
    const provider = new OpenAiEmbeddingProvider(
      'secret-key',
      'text-embedding-3-small',
      3,
      8000,
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                index: 0,
                embedding: [1, 0, 0],
              },
            ],
            model: 'text-embedding-3-small',
            usage: {
              prompt_tokens: 5,
              total_tokens: 5,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      provider.embed([
        { id: 'a', text: 'one' },
        { id: 'b', text: 'two' },
      ]),
    ).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('lets the generic contract reject model provenance drift', async () => {
    const provider = new OpenAiEmbeddingProvider(
      'secret-key',
      'text-embedding-3-small',
      3,
      8000,
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                index: 0,
                embedding: [1, 0, 0],
              },
            ],
            model: 'different-model',
            usage: {
              prompt_tokens: 5,
              total_tokens: 5,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      runEmbeddingProvider(provider, [
        { id: 'a', text: 'one' },
      ]),
    ).rejects.toThrow(
      'Embedding model provenance mismatch',
    );
  });
});
