import {
  runEmbeddingProvider,
  type RepositoryEmbeddingProvider,
} from '../repositories/repository-embedding-provider.js';
import {
  semanticRetrievalBenchmark,
  type SemanticRetrievalBenchmark,
  type SemanticRetrievalBenchmarkRepository,
} from './repository-semantic-retrieval-benchmark.js';

export const SEMANTIC_RETRIEVAL_EVALUATION_SCHEMA_VERSION =
  'semantic-retrieval-evaluation-v1' as const;

export type RetrievalMetrics = Readonly<{
  top1Accuracy: number;
  meanReciprocalRank: number;
  recallAt3: number;
}>;

export type SemanticRetrievalEvaluationReport = Readonly<{
  schemaVersion:
    typeof SEMANTIC_RETRIEVAL_EVALUATION_SCHEMA_VERSION;
  benchmarkVersion: string;
  embedding: Readonly<{
    provider: string;
    model: string;
    dimensions: number;
  }>;
  lexical: RetrievalMetrics;
  semantic: RetrievalMetrics;
  delta: Readonly<{
    top1Accuracy: number;
    meanReciprocalRank: number;
    recallAt3: number;
  }>;
  queries: readonly Readonly<{
    id: string;
    expectedRepositoryIds: readonly string[];
    lexicalTop3: readonly string[];
    semanticTop3: readonly string[];
    lexicalFirstRelevantRank: number | null;
    semanticFirstRelevantRank: number | null;
  }>[];
}>;

type RankedRepository = Readonly<{
  repositoryId: string;
  score: number;
}>;

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

function round(value: number): number {
  return Number(value.toFixed(6));
}

function tokenize(text: string): readonly string[] {
  return [...text.toLowerCase().matchAll(TOKEN_PATTERN)]
    .map((match) => match[0]!)
    .filter(Boolean);
}

function repositoryText(
  repository: SemanticRetrievalBenchmarkRepository,
): string {
  return [
    repository.fullName,
    repository.description,
    repository.primaryLanguage,
    repository.topics.join(' '),
    repository.readmeExcerpt,
  ].join('\n');
}

function lexicalScore(query: string, document: string): number {
  const queryTokens = new Set(tokenize(query));
  const documentTokens = new Set(tokenize(document));

  if (queryTokens.size === 0 || documentTokens.size === 0) {
    return 0;
  }

  let overlap = 0;

  for (const token of queryTokens) {
    if (documentTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.sqrt(queryTokens.size * documentTokens.size);
}

function cosineSimilarity(
  left: readonly number[],
  right: readonly number[],
): number {
  if (left.length !== right.length || left.length === 0) {
    throw new Error(
      'Cosine similarity requires equal non-empty vector dimensions.',
    );
  }

  let dot = 0;
  let leftSquared = 0;
  let rightSquared = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index]!;
    const rightValue = right[index]!;

    dot += leftValue * rightValue;
    leftSquared += leftValue * leftValue;
    rightSquared += rightValue * rightValue;
  }

  if (leftSquared === 0 || rightSquared === 0) {
    throw new Error(
      'Cosine similarity does not accept zero vectors.',
    );
  }

  return dot / Math.sqrt(leftSquared * rightSquared);
}

function rank(
  repositories: readonly SemanticRetrievalBenchmarkRepository[],
  score: (repository: SemanticRetrievalBenchmarkRepository) => number,
): readonly RankedRepository[] {
  return repositories
    .map((repository) => ({
      repositoryId: repository.id,
      score: score(repository),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.repositoryId.localeCompare(right.repositoryId),
    );
}

function firstRelevantRank(
  ranking: readonly RankedRepository[],
  expectedRepositoryIds: readonly string[],
): number | null {
  const expected = new Set(expectedRepositoryIds);
  const index = ranking.findIndex((item) =>
    expected.has(item.repositoryId),
  );

  return index < 0 ? null : index + 1;
}

function calculateMetrics(
  results: readonly Readonly<{
    ranking: readonly RankedRepository[];
    expectedRepositoryIds: readonly string[];
  }>[],
): RetrievalMetrics {
  if (results.length === 0) {
    return {
      top1Accuracy: 0,
      meanReciprocalRank: 0,
      recallAt3: 0,
    };
  }

  let top1Hits = 0;
  let reciprocalRankTotal = 0;
  let recallAt3Total = 0;

  for (const result of results) {
    const expected = new Set(result.expectedRepositoryIds);
    const first = result.ranking[0];

    if (first && expected.has(first.repositoryId)) {
      top1Hits += 1;
    }

    const rankValue = firstRelevantRank(
      result.ranking,
      result.expectedRepositoryIds,
    );

    if (rankValue !== null) {
      reciprocalRankTotal += 1 / rankValue;
    }

    const top3 = result.ranking
      .slice(0, 3)
      .filter((item) => expected.has(item.repositoryId))
      .length;

    recallAt3Total +=
      result.expectedRepositoryIds.length === 0
        ? 0
        : top3 / result.expectedRepositoryIds.length;
  }

  return {
    top1Accuracy: round(top1Hits / results.length),
    meanReciprocalRank: round(
      reciprocalRankTotal / results.length,
    ),
    recallAt3: round(recallAt3Total / results.length),
  };
}

export async function runSemanticRetrievalEvaluation(
  provider: RepositoryEmbeddingProvider,
  benchmark: SemanticRetrievalBenchmark =
    semanticRetrievalBenchmark,
): Promise<SemanticRetrievalEvaluationReport> {
  const repositoryInputs = benchmark.repositories.map((repository) => ({
    id: `repository:${repository.id}`,
    text: repositoryText(repository),
  }));
  const queryInputs = benchmark.queries.map((query) => ({
    id: `query:${query.id}`,
    text: query.query,
  }));
  const embeddingBatch = await runEmbeddingProvider(provider, [
    ...repositoryInputs,
    ...queryInputs,
  ]);
  const vectors = new Map(
    embeddingBatch.vectors.map((item) => [item.id, item.vector]),
  );

  const lexicalResults = benchmark.queries.map((query) => ({
    expectedRepositoryIds: query.expectedRepositoryIds,
    ranking: rank(benchmark.repositories, (repository) =>
      lexicalScore(query.query, repositoryText(repository)),
    ),
  }));

  const semanticResults = benchmark.queries.map((query) => {
    const queryVector = vectors.get(`query:${query.id}`);

    if (!queryVector) {
      throw new Error(
        `Embedding batch is missing query vector for ${query.id}.`,
      );
    }

    return {
      expectedRepositoryIds: query.expectedRepositoryIds,
      ranking: rank(benchmark.repositories, (repository) => {
        const repositoryVector = vectors.get(
          `repository:${repository.id}`,
        );

        if (!repositoryVector) {
          throw new Error(
            `Embedding batch is missing repository vector for ${repository.id}.`,
          );
        }

        return cosineSimilarity(queryVector, repositoryVector);
      }),
    };
  });

  const lexical = calculateMetrics(lexicalResults);
  const semantic = calculateMetrics(semanticResults);

  return {
    schemaVersion:
      SEMANTIC_RETRIEVAL_EVALUATION_SCHEMA_VERSION,
    benchmarkVersion: benchmark.version,
    embedding: {
      provider: embeddingBatch.provider,
      model: embeddingBatch.model,
      dimensions: embeddingBatch.dimensions,
    },
    lexical,
    semantic,
    delta: {
      top1Accuracy: round(
        semantic.top1Accuracy - lexical.top1Accuracy,
      ),
      meanReciprocalRank: round(
        semantic.meanReciprocalRank -
          lexical.meanReciprocalRank,
      ),
      recallAt3: round(
        semantic.recallAt3 - lexical.recallAt3,
      ),
    },
    queries: benchmark.queries.map((query, index) => {
      const lexicalResult = lexicalResults[index]!;
      const semanticResult = semanticResults[index]!;

      return {
        id: query.id,
        expectedRepositoryIds: query.expectedRepositoryIds,
        lexicalTop3: lexicalResult.ranking
          .slice(0, 3)
          .map((item) => item.repositoryId),
        semanticTop3: semanticResult.ranking
          .slice(0, 3)
          .map((item) => item.repositoryId),
        lexicalFirstRelevantRank: firstRelevantRank(
          lexicalResult.ranking,
          query.expectedRepositoryIds,
        ),
        semanticFirstRelevantRank: firstRelevantRank(
          semanticResult.ranking,
          query.expectedRepositoryIds,
        ),
      };
    }),
  };
}
