import type { RetrievalMetrics } from './repository-semantic-retrieval-evaluator.js';
import type { LiveSemanticRetrievalResult } from './openai-semantic-retrieval-live.js';

export const SEMANTIC_LIVE_EVALUATION_SUMMARY_VERSION =
  'semantic-live-evaluation-summary-v1' as const;

type NumericStats = Readonly<{
  min: number;
  max: number;
  mean: number;
  standardDeviation: number;
}>;

export type SemanticLiveEvaluationSummary = Readonly<{
  schemaVersion: typeof SEMANTIC_LIVE_EVALUATION_SUMMARY_VERSION;
  benchmarkVersion: string;
  provider: string;
  model: string;
  dimensions: number;
  runCount: number;
  lexical: RetrievalMetrics;
  semantic: Readonly<{
    top1Accuracy: NumericStats;
    meanReciprocalRank: NumericStats;
    recallAt3: NumericStats;
  }>;
  delta: Readonly<{
    top1Accuracy: NumericStats;
    meanReciprocalRank: NumericStats;
    recallAt3: NumericStats;
  }>;
  consistency: Readonly<{
    exactSemanticMetricsAgreement: boolean;
    semanticTop1AgreementRate: number;
    semanticTop3AgreementRate: number;
  }>;
  latency: Readonly<{
    elapsedMs: NumericStats;
    providerRequestLatencyMs: NumericStats | null;
  }>;
  usage: Readonly<{
    promptTokensPerRun: NumericStats;
    totalTokensPerRun: NumericStats;
    promptTokensTotal: number;
    totalTokensTotal: number;
  }> | null;
}>;

function round(value: number): number {
  return Number(value.toFixed(6));
}

function stats(values: readonly number[]): NumericStats {
  if (values.length === 0) {
    throw new Error('Cannot summarize an empty numeric series.');
  }

  for (const value of values) {
    if (!Number.isFinite(value)) {
      throw new Error('Summary input contains a non-finite number.');
    }
  }

  const mean =
    values.reduce((total, value) => total + value, 0) /
    values.length;
  const variance =
    values.reduce(
      (total, value) => total + (value - mean) ** 2,
      0,
    ) / values.length;

  return {
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
    mean: round(mean),
    standardDeviation: round(Math.sqrt(variance)),
  };
}

function sameMetrics(
  left: RetrievalMetrics,
  right: RetrievalMetrics,
): boolean {
  return (
    left.top1Accuracy === right.top1Accuracy &&
    left.meanReciprocalRank === right.meanReciprocalRank &&
    left.recallAt3 === right.recallAt3
  );
}

function sameArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function validateRunCompatibility(
  first: LiveSemanticRetrievalResult,
  candidate: LiveSemanticRetrievalResult,
): void {
  if (candidate.benchmarkVersion !== first.benchmarkVersion) {
    throw new Error(
      'Live semantic evaluation runs use different benchmark versions.',
    );
  }

  if (
    candidate.provider !== first.provider ||
    candidate.model !== first.model ||
    candidate.dimensions !== first.dimensions
  ) {
    throw new Error(
      'Live semantic evaluation runs use different embedding configurations.',
    );
  }

  if (!sameMetrics(candidate.report.lexical, first.report.lexical)) {
    throw new Error(
      'Lexical baseline changed across repeated semantic evaluation runs.',
    );
  }

  const firstQueryIds = first.report.queries.map((query) => query.id);
  const candidateQueryIds = candidate.report.queries.map(
    (query) => query.id,
  );

  if (!sameArray(firstQueryIds, candidateQueryIds)) {
    throw new Error(
      'Semantic evaluation query sets differ across repeated runs.',
    );
  }
}

function agreementRate(
  runs: readonly LiveSemanticRetrievalResult[],
  selector: (
    run: LiveSemanticRetrievalResult,
    queryIndex: number,
  ) => readonly string[],
): number {
  const queryCount = runs[0]!.report.queries.length;

  if (queryCount === 0) {
    return 1;
  }

  let agreements = 0;

  for (let queryIndex = 0; queryIndex < queryCount; queryIndex += 1) {
    const first = selector(runs[0]!, queryIndex);

    if (
      runs.every((run) =>
        sameArray(first, selector(run, queryIndex)),
      )
    ) {
      agreements += 1;
    }
  }

  return round(agreements / queryCount);
}

export function summarizeLiveSemanticEvaluations(
  runs: readonly LiveSemanticRetrievalResult[],
): SemanticLiveEvaluationSummary {
  if (runs.length === 0) {
    throw new Error(
      'At least one live semantic evaluation run is required.',
    );
  }

  const first = runs[0]!;

  for (const run of runs) {
    validateRunCompatibility(first, run);
  }

  const semanticTop1 = runs.map(
    (run) => run.report.semantic.top1Accuracy,
  );
  const semanticMrr = runs.map(
    (run) => run.report.semantic.meanReciprocalRank,
  );
  const semanticRecall = runs.map(
    (run) => run.report.semantic.recallAt3,
  );
  const deltaTop1 = runs.map(
    (run) => run.report.delta.top1Accuracy,
  );
  const deltaMrr = runs.map(
    (run) => run.report.delta.meanReciprocalRank,
  );
  const deltaRecall = runs.map(
    (run) => run.report.delta.recallAt3,
  );

  const requestLatencies = runs
    .map((run) => run.providerRequestLatencyMs)
    .filter((value): value is number => value !== null);

  const usages = runs
    .map((run) => run.usage)
    .filter(
      (
        value,
      ): value is NonNullable<
        LiveSemanticRetrievalResult['usage']
      > => value !== null,
    );

  const allHaveUsage = usages.length === runs.length;

  return {
    schemaVersion: SEMANTIC_LIVE_EVALUATION_SUMMARY_VERSION,
    benchmarkVersion: first.benchmarkVersion,
    provider: first.provider,
    model: first.model,
    dimensions: first.dimensions,
    runCount: runs.length,
    lexical: first.report.lexical,
    semantic: {
      top1Accuracy: stats(semanticTop1),
      meanReciprocalRank: stats(semanticMrr),
      recallAt3: stats(semanticRecall),
    },
    delta: {
      top1Accuracy: stats(deltaTop1),
      meanReciprocalRank: stats(deltaMrr),
      recallAt3: stats(deltaRecall),
    },
    consistency: {
      exactSemanticMetricsAgreement: runs.every((run) =>
        sameMetrics(run.report.semantic, first.report.semantic),
      ),
      semanticTop1AgreementRate: agreementRate(
        runs,
        (run, queryIndex) =>
          run.report.queries[queryIndex]?.semanticTop3.slice(0, 1) ??
          [],
      ),
      semanticTop3AgreementRate: agreementRate(
        runs,
        (run, queryIndex) =>
          run.report.queries[queryIndex]?.semanticTop3 ?? [],
      ),
    },
    latency: {
      elapsedMs: stats(runs.map((run) => run.elapsedMs)),
      providerRequestLatencyMs:
        requestLatencies.length === runs.length
          ? stats(requestLatencies)
          : null,
    },
    usage: allHaveUsage
      ? {
          promptTokensPerRun: stats(
            usages.map((usage) => usage.promptTokens),
          ),
          totalTokensPerRun: stats(
            usages.map((usage) => usage.totalTokens),
          ),
          promptTokensTotal: usages.reduce(
            (total, usage) => total + usage.promptTokens,
            0,
          ),
          totalTokensTotal: usages.reduce(
            (total, usage) => total + usage.totalTokens,
            0,
          ),
        }
      : null,
  };
}
