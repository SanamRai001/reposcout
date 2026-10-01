import { describe, expect, it } from 'vitest';

import type { LiveSemanticRetrievalResult } from './openai-semantic-retrieval-live.js';
import { summarizeLiveSemanticEvaluations } from './semantic-live-evaluation-summary.js';

function result(
  overrides: Partial<LiveSemanticRetrievalResult> = {},
): LiveSemanticRetrievalResult {
  return {
    status: 'evaluated',
    benchmarkVersion: 'semantic-retrieval-benchmark-v2',
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    elapsedMs: 100,
    providerRequestLatencyMs: 80,
    usage: {
      promptTokens: 1000,
      totalTokens: 1000,
    },
    report: {
      schemaVersion: 'semantic-retrieval-evaluation-v1',
      benchmarkVersion: 'semantic-retrieval-benchmark-v2',
      embedding: {
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536,
      },
      lexical: {
        top1Accuracy: 0.5,
        meanReciprocalRank: 0.7,
        recallAt3: 0.8,
      },
      semantic: {
        top1Accuracy: 0.8,
        meanReciprocalRank: 0.9,
        recallAt3: 1,
      },
      delta: {
        top1Accuracy: 0.3,
        meanReciprocalRank: 0.2,
        recallAt3: 0.2,
      },
      queries: [
        {
          id: 'q1',
          expectedRepositoryIds: ['a'],
          lexicalTop3: ['b', 'a', 'c'],
          semanticTop3: ['a', 'b', 'c'],
          lexicalFirstRelevantRank: 2,
          semanticFirstRelevantRank: 1,
        },
        {
          id: 'q2',
          expectedRepositoryIds: ['b'],
          lexicalTop3: ['a', 'b', 'c'],
          semanticTop3: ['b', 'a', 'c'],
          lexicalFirstRelevantRank: 2,
          semanticFirstRelevantRank: 1,
        },
      ],
    },
    ...overrides,
  };
}

describe('summarizeLiveSemanticEvaluations', () => {
  it('summarizes metric spread, consistency, latency, and usage', () => {
    const first = result();
    const second = result({
      elapsedMs: 120,
      providerRequestLatencyMs: 90,
      usage: {
        promptTokens: 1100,
        totalTokens: 1100,
      },
      report: {
        ...first.report,
        semantic: {
          top1Accuracy: 0.7,
          meanReciprocalRank: 0.85,
          recallAt3: 1,
        },
        delta: {
          top1Accuracy: 0.2,
          meanReciprocalRank: 0.15,
          recallAt3: 0.2,
        },
        queries: [
          first.report.queries[0]!,
          {
            ...first.report.queries[1]!,
            semanticTop3: ['b', 'c', 'a'],
          },
        ],
      },
    });

    const summary = summarizeLiveSemanticEvaluations([
      first,
      second,
    ]);

    expect(summary.runCount).toBe(2);
    expect(summary.semantic.top1Accuracy).toEqual({
      min: 0.7,
      max: 0.8,
      mean: 0.75,
      standardDeviation: 0.05,
    });
    expect(summary.consistency).toEqual({
      exactSemanticMetricsAgreement: false,
      semanticTop1AgreementRate: 1,
      semanticTop3AgreementRate: 0.5,
    });
    expect(summary.latency.elapsedMs).toEqual({
      min: 100,
      max: 120,
      mean: 110,
      standardDeviation: 10,
    });
    expect(summary.usage).toEqual(
      expect.objectContaining({
        promptTokensTotal: 2100,
        totalTokensTotal: 2100,
      }),
    );
  });

  it('rejects mixed embedding configurations', () => {
    expect(() =>
      summarizeLiveSemanticEvaluations([
        result(),
        result({
          model: 'text-embedding-3-large',
          report: {
            ...result().report,
            embedding: {
              provider: 'openai',
              model: 'text-embedding-3-large',
              dimensions: 1536,
            },
          },
        }),
      ]),
    ).toThrow(
      'Live semantic evaluation runs use different embedding configurations.',
    );
  });

  it('rejects lexical baseline drift across repeats', () => {
    const first = result();

    expect(() =>
      summarizeLiveSemanticEvaluations([
        first,
        result({
          report: {
            ...first.report,
            lexical: {
              ...first.report.lexical,
              top1Accuracy: 0.4,
            },
          },
        }),
      ]),
    ).toThrow(
      'Lexical baseline changed across repeated semantic evaluation runs.',
    );
  });
});
