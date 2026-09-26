import { describe, expect, it } from 'vitest';

import { DeterministicSemanticFixtureProvider } from './deterministic-semantic-fixture-provider.js';
import {
  runSemanticRetrievalEvaluation,
  SEMANTIC_RETRIEVAL_EVALUATION_SCHEMA_VERSION,
} from './repository-semantic-retrieval-evaluator.js';

describe('semantic retrieval offline evaluation', () => {
  it('compares the lexical baseline and deterministic semantic fixture on the frozen benchmark', async () => {
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

    expect(report.semantic.top1Accuracy).toBe(1);
    expect(report.semantic.meanReciprocalRank).toBe(1);
    expect(report.semantic.recallAt3).toBe(1);
    expect(report.semantic.top1Accuracy).toBeGreaterThan(
      report.lexical.top1Accuracy,
    );
    expect(report.delta.top1Accuracy).toBeGreaterThan(0);
  });

  it('captures the natural-language case that exact token overlap misses', async () => {
    const report = await runSemanticRetrievalEvaluation(
      new DeterministicSemanticFixtureProvider(),
    );
    const result = report.queries.find(
      (item) => item.id === 'run-monitoring-yourself',
    );

    expect(result).toEqual(
      expect.objectContaining({
        expectedRepositoryIds: ['self-hosted-observability'],
        semanticFirstRelevantRank: 1,
      }),
    );
    expect(result?.lexicalFirstRelevantRank).not.toBe(1);
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
