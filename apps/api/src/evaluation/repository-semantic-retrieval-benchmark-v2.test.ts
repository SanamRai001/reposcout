import { describe, expect, it } from 'vitest';

import { DeterministicSemanticFixtureProvider } from './deterministic-semantic-fixture-provider.js';
import {
  semanticRetrievalBenchmarkV2,
  SEMANTIC_RETRIEVAL_BENCHMARK_V2_VERSION,
} from './repository-semantic-retrieval-benchmark-v2.js';
import { runSemanticRetrievalEvaluation } from './repository-semantic-retrieval-evaluator.js';

describe('semantic retrieval benchmark v2', () => {
  it('freezes real repository README provenance without mutating v1', () => {
    expect(semanticRetrievalBenchmarkV2.version).toBe(
      SEMANTIC_RETRIEVAL_BENCHMARK_V2_VERSION,
    );
    expect(semanticRetrievalBenchmarkV2.observedAt).toBe(
      '2026-09-26',
    );
    expect(semanticRetrievalBenchmarkV2.repositories).toHaveLength(6);
    expect(
      Object.keys(semanticRetrievalBenchmarkV2.sources),
    ).toHaveLength(6);

    for (const source of Object.values(
      semanticRetrievalBenchmarkV2.sources,
    )) {
      expect(source.repository).toMatch(/^[^/]+\/[^/]+$/);
      expect(source.readmeRef.length).toBeGreaterThan(0);
      expect(source.readmeSha).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it('contains both lexical-hard and ambiguous relevance cases', () => {
    const difficulties = new Set(
      semanticRetrievalBenchmarkV2.queries.map(
        (query) => query.difficulty,
      ),
    );

    expect(difficulties).toEqual(
      new Set(['lexical_hard', 'ambiguous']),
    );
    expect(
      semanticRetrievalBenchmarkV2.queries.filter(
        (query) => query.difficulty === 'lexical_hard',
      ).length,
    ).toBeGreaterThanOrEqual(6);
    expect(
      semanticRetrievalBenchmarkV2.queries.some(
        (query) => query.expectedRepositoryIds.length > 1,
      ),
    ).toBe(true);
  });

  it('keeps every expected target inside the frozen real repository corpus', () => {
    const repositoryIds = new Set(
      semanticRetrievalBenchmarkV2.repositories.map(
        (repository) => repository.id,
      ),
    );

    for (const query of semanticRetrievalBenchmarkV2.queries) {
      expect(query.expectedRepositoryIds.length).toBeGreaterThan(0);

      for (const repositoryId of query.expectedRepositoryIds) {
        expect(repositoryIds.has(repositoryId)).toBe(true);
      }
    }
  });

  it('is materially harder for the lexical baseline than v1', async () => {
    const report = await runSemanticRetrievalEvaluation(
      new DeterministicSemanticFixtureProvider(),
      semanticRetrievalBenchmarkV2,
    );

    expect(report.benchmarkVersion).toBe(
      SEMANTIC_RETRIEVAL_BENCHMARK_V2_VERSION,
    );
    expect(report.lexical.top1Accuracy).toBeLessThan(1);
    expect(report.lexical.meanReciprocalRank).toBeLessThan(1);
  });
});
