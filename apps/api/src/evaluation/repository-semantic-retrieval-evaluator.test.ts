import { describe, expect, it } from 'vitest';

import { DeterministicSemanticFixtureProvider } from './deterministic-semantic-fixture-provider.js';
import {
  semanticRetrievalBenchmark,
  type SemanticRetrievalBenchmark,
} from './repository-semantic-retrieval-benchmark.js';
import {
  runSemanticRetrievalEvaluation,
  SEMANTIC_RETRIEVAL_EVALUATION_SCHEMA_VERSION,
} from './repository-semantic-retrieval-evaluator.js';

describe('semantic retrieval offline evaluation', () => {
  it('reports the lexical baseline and deterministic semantic fixture without forcing an artificial winner', async () => {
    const report = await runSemanticRetrievalEvaluation(
      new DeterministicSemanticFixtureProvider(),
    );

    expect(report.schemaVersion).toBe(
      SEMANTIC_RETRIEVAL_EVALUATION_SCHEMA_VERSION,
    );
    expect(report.benchmarkVersion).toBe(
      'semantic-retrieval-benchmark-v1',
    );
    expect(report.embedding).toEqual({
      provider: 'reposcout-fixture',
      model: 'concept-axes-v1',
      dimensions: 6,
    });

    expect(report.lexical.top1Accuracy).toBe(1);
    expect(report.semantic.top1Accuracy).toBe(1);
    expect(report.lexical.meanReciprocalRank).toBe(1);
    expect(report.semantic.meanReciprocalRank).toBe(1);
    expect(report.delta.top1Accuracy).toBe(0);
    expect(report.delta.meanReciprocalRank).toBe(0);
  });

  it('can detect semantic improvement on a controlled lexical-hard evaluation case', async () => {
    const challenge: SemanticRetrievalBenchmark = {
      ...semanticRetrievalBenchmark,
      queries: [
        {
          id: 'lexical-hard-monitoring',
          query: 'containers for things I operate',
          expectedRepositoryIds: ['self-hosted-observability'],
          rationale:
            'The deterministic fixture maps container intent to monitoring, while exact lexical token overlap has no repository match.',
        },
      ],
    };

    const report = await runSemanticRetrievalEvaluation(
      new DeterministicSemanticFixtureProvider(),
      challenge,
    );
    const result = report.queries[0];

    expect(result).toEqual(
      expect.objectContaining({
        expectedRepositoryIds: ['self-hosted-observability'],
        semanticFirstRelevantRank: 1,
      }),
    );
    expect(result?.lexicalFirstRelevantRank).not.toBe(1);
    expect(report.semantic.top1Accuracy).toBeGreaterThan(
      report.lexical.top1Accuracy,
    );
  });

  it('keeps evaluation deterministic for the same provider and benchmark', async () => {
    const provider = new DeterministicSemanticFixtureProvider();

    await expect(
      runSemanticRetrievalEvaluation(provider),
    ).resolves.toEqual(
      await runSemanticRetrievalEvaluation(provider),
    );
  });

  it('does not produce an adoption decision or persistence contract', async () => {
    const report = await runSemanticRetrievalEvaluation(
      new DeterministicSemanticFixtureProvider(),
    );
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain('adopt');
    expect(serialized).not.toContain('persist');
    expect(serialized).not.toContain('pgvector');
  });
});
