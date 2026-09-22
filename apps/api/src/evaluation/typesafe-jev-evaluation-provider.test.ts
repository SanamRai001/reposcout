import { describe, expect, it, vi } from 'vitest';

import {
  jevEvaluationBenchmark,
  type JevEvaluationBenchmark,
} from './jev-evaluation-benchmark.js';
import { TypeSafeJevEvaluationProvider } from './typesafe-jev-evaluation-provider.js';
import type {
  TypeSafeSystemOneClient,
  TypeSafeSystemOneResponse,
} from './typesafe-system-one-client.js';

function repositoryResponse(
  projectType: string,
  tutorialProbability: number,
  beginnerScoreZeroBased: number,
  model = 'jev-1.13.0',
): TypeSafeSystemOneResponse {
  return {
    model,
    answers: {
      project_type: {
        type: 'choice',
        choice: projectType,
        confidence: 0.8,
        probabilities: {
          [projectType]: 0.8,
        },
      },
      tutorial_demo: {
        type: 'noul',
        noul: tutorialProbability,
      },
      beginner_suitability: {
        type: 'score',
        score: beginnerScoreZeroBased,
        confidence: 0.7,
        legend: {
          '0': 'one',
          '1': 'two',
          '2': 'three',
          '3': 'four',
          '4': 'five',
        },
        probabilities: {
          '0': 0.1,
          '1': 0.1,
          '2': 0.2,
          '3': 0.3,
          '4': 0.3,
        },
      },
    },
    usage: {
      inputTokens: 100,
      outputTokens: 10,
    },
  };
}

function relevanceResponse(
  scoreZeroBased: number,
  model = 'jev-1.13.0',
): TypeSafeSystemOneResponse {
  return {
    model,
    answers: {
      relevance: {
        type: 'score',
        score: scoreZeroBased,
        confidence: 0.9,
        legend: {
          '0': 'one',
          '1': 'two',
          '2': 'three',
          '3': 'four',
          '4': 'five',
        },
        probabilities: {
          '0': 0.05,
          '1': 0.05,
          '2': 0.1,
          '3': 0.2,
          '4': 0.6,
        },
      },
    },
    usage: {
      inputTokens: 50,
      outputTokens: 5,
    },
  };
}

function tinyBenchmark(): JevEvaluationBenchmark {
  return {
    version: 'test',
    repositories: [jevEvaluationBenchmark.repositories[0]!],
    relevance: [jevEvaluationBenchmark.relevance[0]!],
  };
}

describe('TypeSafeJevEvaluationProvider', () => {
  it('maps native Jev choice/noul/score answers into RepoScout assessments', async () => {
    const systemOne = vi
      .fn<Pick<TypeSafeSystemOneClient, 'systemOne'>['systemOne']>()
      .mockResolvedValueOnce(
        repositoryResponse('library', 0.08, 2.1),
      )
      .mockResolvedValueOnce(relevanceResponse(3.2));

    const provider = new TypeSafeJevEvaluationProvider(
      'jev-latest',
      { systemOne },
    );

    const result = await provider.evaluate(tinyBenchmark());

    expect(result).toEqual({
      repositoryAssessments: [
        {
          caseId: 'typed-sdk-library',
          projectType: {
            choice: 'library',
            confidence: 0.8,
          },
          tutorialDemo: {
            probability: 0.08,
          },
          beginnerSuitability: {
            score: 3.1,
            confidence: 0.7,
          },
        },
      ],
      relevanceAssessments: [
        {
          caseId: 'relevance-typescript-backend-sdk',
          score: 4.2,
          confidence: 0.9,
        },
      ],
      resolvedModelName: 'jev-1.13.0',
    });

    expect(systemOne).toHaveBeenCalledTimes(2);

    const firstRequest = systemOne.mock.calls[0]?.[0];
    expect(firstRequest?.model).toBe('jev-latest');
    expect(firstRequest?.questions.project_type).toMatchObject({
      type: 'choice',
    });
    expect(firstRequest?.questions.tutorial_demo).toMatchObject({
      type: 'noul',
    });
    expect(firstRequest?.questions.beginner_suitability).toMatchObject({
      type: 'score',
    });

    const secondRequest = systemOne.mock.calls[1]?.[0];
    expect(secondRequest?.questions.relevance).toMatchObject({
      type: 'score',
    });
  });

  it('rejects a provider answer with the wrong question type', async () => {
    const systemOne = vi
      .fn<Pick<TypeSafeSystemOneClient, 'systemOne'>['systemOne']>()
      .mockResolvedValueOnce({
        ...repositoryResponse('library', 0.1, 2),
        answers: {
          ...repositoryResponse('library', 0.1, 2).answers,
          project_type: {
            type: 'noul',
            noul: 0.9,
          },
        },
      });

    const provider = new TypeSafeJevEvaluationProvider(
      'jev-latest',
      { systemOne },
    );

    await expect(
      provider.evaluate({
        version: 'test',
        repositories: [jevEvaluationBenchmark.repositories[0]!],
        relevance: [],
      }),
    ).rejects.toThrow(
      'TypeSafe answer "project_type" must be choice.',
    );
  });

  it('rejects inconsistent resolved model names within one run', async () => {
    const systemOne = vi
      .fn<Pick<TypeSafeSystemOneClient, 'systemOne'>['systemOne']>()
      .mockResolvedValueOnce(
        repositoryResponse('library', 0.1, 2, 'jev-1.13.0'),
      )
      .mockResolvedValueOnce(
        relevanceResponse(4, 'jev-preview'),
      );

    const provider = new TypeSafeJevEvaluationProvider(
      'jev-latest',
      { systemOne },
    );

    await expect(provider.evaluate(tinyBenchmark())).rejects.toThrow(
      /resolved multiple models/,
    );
  });

  it('rejects Jev score values outside the expected zero-based rubric range', async () => {
    const systemOne = vi
      .fn<Pick<TypeSafeSystemOneClient, 'systemOne'>['systemOne']>()
      .mockResolvedValueOnce(
        repositoryResponse('library', 0.1, 5.5),
      );

    const provider = new TypeSafeJevEvaluationProvider(
      'jev-latest',
      { systemOne },
    );

    await expect(
      provider.evaluate({
        version: 'test',
        repositories: [jevEvaluationBenchmark.repositories[0]!],
        relevance: [],
      }),
    ).rejects.toThrow(/outside RepoScout's 1-5 scale/);
  });
});
