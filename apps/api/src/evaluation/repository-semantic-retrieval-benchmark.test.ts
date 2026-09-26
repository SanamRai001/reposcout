import { describe, expect, it } from 'vitest';

import {
  semanticRetrievalBenchmark,
  SEMANTIC_RETRIEVAL_BENCHMARK_VERSION,
} from './repository-semantic-retrieval-benchmark.js';

describe('semantic retrieval benchmark foundation', () => {
  it('uses a versioned benchmark with unique repository and query identifiers', () => {
    expect(semanticRetrievalBenchmark.version).toBe(
      SEMANTIC_RETRIEVAL_BENCHMARK_VERSION,
    );

    const repositoryIds = semanticRetrievalBenchmark.repositories.map(
      (item) => item.id,
    );
    const queryIds = semanticRetrievalBenchmark.queries.map(
      (item) => item.id,
    );

    expect(new Set(repositoryIds).size).toBe(repositoryIds.length);
    expect(new Set(queryIds).size).toBe(queryIds.length);
  });

  it('keeps every expected relevance target inside the frozen repository corpus', () => {
    const repositoryIds = new Set(
      semanticRetrievalBenchmark.repositories.map((item) => item.id),
    );

    for (const query of semanticRetrievalBenchmark.queries) {
      expect(query.query.trim().length).toBeGreaterThanOrEqual(2);
      expect(query.expectedRepositoryIds.length).toBeGreaterThan(0);

      for (const repositoryId of query.expectedRepositoryIds) {
        expect(repositoryIds.has(repositoryId)).toBe(true);
      }
    }
  });

  it('contains natural-language intent cases rather than repository-name lookups', () => {
    for (const query of semanticRetrievalBenchmark.queries) {
      for (const repository of semanticRetrievalBenchmark.repositories) {
        expect(query.query.toLowerCase()).not.toContain(
          repository.fullName.toLowerCase(),
        );
      }
    }
  });

  it('does not define embedding scores or claim a production semantic winner yet', () => {
    const serialized = JSON.stringify(semanticRetrievalBenchmark);

    expect(serialized).not.toContain('"score"');
    expect(serialized).not.toContain('"embedding"');
    expect(serialized).not.toContain('"distance"');
  });
});
