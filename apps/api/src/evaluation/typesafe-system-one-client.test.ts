import { describe, expect, it, vi } from 'vitest';

import {
  TypeSafeApiError,
  TypeSafeSystemOneClient,
} from './typesafe-system-one-client.js';

describe('TypeSafeSystemOneClient', () => {
  it('lists available models with bearer authentication', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            {
              name: 'jev-latest',
              description: 'General-purpose system one model.',
              release_date: '2026-09-15',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = new TypeSafeSystemOneClient(
      'secret-key',
      8_000,
      fetchImplementation,
    );

    await expect(client.listModels()).resolves.toEqual([
      {
        name: 'jev-latest',
        description: 'General-purpose system one model.',
        releaseDate: '2026-09-15',
      },
    ]);

    const [url, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(url).toBe('https://api.typesafe.ai/v1/models');
    expect(init?.method).toBe('GET');
    expect(init?.redirect).toBe('error');

    const headers = init?.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer secret-key');
  });

  it('sends exact System One state/model/questions and validates response types', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'jev-1.13.0',
          answers: {
            tutorial_demo: {
              type: 'noul',
              noul: 0.82,
            },
            project_type: {
              type: 'choice',
              choice: 'educational',
              confidence: 0.91,
              probabilities: {
                educational: 0.91,
                library: 0.09,
              },
            },
            beginner_suitability: {
              type: 'score',
              score: 3.4,
              confidence: 0.77,
              legend: {
                '0': 'hard',
                '1': 'less hard',
                '2': 'moderate',
                '3': 'good',
                '4': 'excellent',
              },
              probabilities: {
                '0': 0.01,
                '1': 0.04,
                '2': 0.15,
                '3': 0.4,
                '4': 0.4,
              },
            },
          },
          usage: {
            input_tokens: 123,
            output_tokens: 9,
          },
        }),
        { status: 200 },
      ),
    );
    const client = new TypeSafeSystemOneClient(
      'secret-key',
      8_000,
      fetchImplementation,
    );

    const request = {
      state: {
        repository: 'example/project',
      },
      model: 'jev-latest',
      questions: {
        tutorial_demo: {
          type: 'noul' as const,
          instructions: 'Is this a tutorial?',
        },
      },
    };

    const result = await client.systemOne(request);

    expect(result).toEqual({
      model: 'jev-1.13.0',
      answers: {
        tutorial_demo: {
          type: 'noul',
          noul: 0.82,
        },
        project_type: {
          type: 'choice',
          choice: 'educational',
          confidence: 0.91,
          probabilities: {
            educational: 0.91,
            library: 0.09,
          },
        },
        beginner_suitability: {
          type: 'score',
          score: 3.4,
          confidence: 0.77,
          legend: {
            '0': 'hard',
            '1': 'less hard',
            '2': 'moderate',
            '3': 'good',
            '4': 'excellent',
          },
          probabilities: {
            '0': 0.01,
            '1': 0.04,
            '2': 0.15,
            '3': 0.4,
            '4': 0.4,
          },
        },
      },
      usage: {
        inputTokens: 123,
        outputTokens: 9,
      },
    });

    const [, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(request);
  });

  it('rejects out-of-range probabilities from the provider', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'jev-1.13.0',
          answers: {
            tutorial_demo: {
              type: 'noul',
              noul: 1.2,
            },
          },
          usage: {
            input_tokens: 10,
            output_tokens: 1,
          },
        }),
        { status: 200 },
      ),
    );
    const client = new TypeSafeSystemOneClient(
      'secret-key',
      8_000,
      fetchImplementation,
    );

    await expect(
      client.systemOne({
        state: 'test',
        model: 'jev-latest',
        questions: {
          tutorial_demo: {
            type: 'noul',
          },
        },
      }),
    ).rejects.toMatchObject({
      kind: 'invalid_response',
    } satisfies Partial<TypeSafeApiError>);
  });

  it('classifies HTTP 422 as provider validation failure', async () => {
    const client = new TypeSafeSystemOneClient(
      'secret-key',
      8_000,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status: 422 })),
    );

    await expect(
      client.systemOne({
        state: 'test',
        model: 'jev-latest',
        questions: {
          tutorial_demo: {
            type: 'noul',
          },
        },
      }),
    ).rejects.toMatchObject({
      kind: 'validation_error',
      status: 422,
    });
  });
});
