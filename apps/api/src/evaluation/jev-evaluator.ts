import {
  jevEvaluationBenchmark,
  type JevEvaluationBenchmark,
  type ProjectType,
} from './jev-evaluation-benchmark.js';
import type {
  JevEvaluationRun,
  JevRelevanceAssessment,
  JevRepositoryAssessment,
} from './jev-evaluation-result.js';

const PROJECT_TYPES = new Set<ProjectType>([
  'library',
  'application',
  'framework',
  'developer_tool',
  'educational',
  'infrastructure',
  'other',
]);

export type JevEvaluationReport = Readonly<{
  benchmarkVersion: string;
  provider: string;
  model: string;
  runId: string;
  coverage: Readonly<{
    repositoryAssessments: number;
    relevanceAssessments: number;
  }>;
  metrics: Readonly<{
    projectTypeAccuracy: number;
    tutorialDemoAccuracy: number;
    tutorialDemoBrierScore: number;
    beginnerSuitabilityMae: number;
    relevanceMae: number;
    meanConfidence: number;
  }>;
  latencyMs: number;
}>;

function assertProbability(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a probability between 0 and 1.`);
  }
}

function assertScore(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 1 || value > 5) {
    throw new Error(`${name} must be a score between 1 and 5.`);
  }
}

function assertUniqueIds(
  name: string,
  values: readonly { caseId: string }[],
): void {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value.caseId)) {
      throw new Error(`${name} contains duplicate caseId "${value.caseId}".`);
    }

    seen.add(value.caseId);
  }
}

function validateRepositoryAssessment(
  value: JevRepositoryAssessment,
): void {
  if (!PROJECT_TYPES.has(value.projectType.choice)) {
    throw new Error(
      `Unknown project type "${value.projectType.choice}".`,
    );
  }

  assertProbability(
    'projectType.confidence',
    value.projectType.confidence,
  );
  assertProbability(
    'tutorialDemo.probability',
    value.tutorialDemo.probability,
  );
  assertScore(
    'beginnerSuitability.score',
    value.beginnerSuitability.score,
  );
  assertProbability(
    'beginnerSuitability.confidence',
    value.beginnerSuitability.confidence,
  );
}

function validateRelevanceAssessment(
  value: JevRelevanceAssessment,
): void {
  assertScore('relevance.score', value.score);
  assertProbability('relevance.confidence', value.confidence);
}

function parseTimestamp(name: string, value: string): number {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`${name} must be a valid timestamp.`);
  }

  return timestamp;
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function rounded(value: number): number {
  return Number(value.toFixed(6));
}

function assertCompleteCoverage(
  run: JevEvaluationRun,
  benchmark: JevEvaluationBenchmark,
): void {
  assertUniqueIds('repositoryAssessments', run.repositoryAssessments);
  assertUniqueIds('relevanceAssessments', run.relevanceAssessments);

  const repositoryIds = new Set(
    benchmark.repositories.map((item) => item.id),
  );
  const relevanceIds = new Set(
    benchmark.relevance.map((item) => item.id),
  );

  for (const assessment of run.repositoryAssessments) {
    if (!repositoryIds.has(assessment.caseId)) {
      throw new Error(
        `Unknown repository assessment caseId "${assessment.caseId}".`,
      );
    }
  }

  for (const assessment of run.relevanceAssessments) {
    if (!relevanceIds.has(assessment.caseId)) {
      throw new Error(
        `Unknown relevance assessment caseId "${assessment.caseId}".`,
      );
    }
  }

  if (run.repositoryAssessments.length !== benchmark.repositories.length) {
    throw new Error(
      'Repository assessment coverage is incomplete for this benchmark.',
    );
  }

  if (run.relevanceAssessments.length !== benchmark.relevance.length) {
    throw new Error(
      'Relevance assessment coverage is incomplete for this benchmark.',
    );
  }
}

export function evaluateJevRun(
  run: JevEvaluationRun,
  benchmark: JevEvaluationBenchmark = jevEvaluationBenchmark,
): JevEvaluationReport {
  if (run.schemaVersion !== '3e1-v1') {
    throw new Error('Unsupported evaluation run schemaVersion.');
  }

  if (run.benchmarkVersion !== benchmark.version) {
    throw new Error(
      `Benchmark version mismatch: expected ${benchmark.version}, received ${run.benchmarkVersion}.`,
    );
  }

  if (!run.provider.trim() || !run.model.trim() || !run.runId.trim()) {
    throw new Error('provider, model, and runId must be non-empty.');
  }

  assertCompleteCoverage(run, benchmark);

  for (const assessment of run.repositoryAssessments) {
    validateRepositoryAssessment(assessment);
  }

  for (const assessment of run.relevanceAssessments) {
    validateRelevanceAssessment(assessment);
  }

  const repositoryById = new Map(
    run.repositoryAssessments.map((assessment) => [
      assessment.caseId,
      assessment,
    ]),
  );
  const relevanceById = new Map(
    run.relevanceAssessments.map((assessment) => [
      assessment.caseId,
      assessment,
    ]),
  );

  const projectTypeHits: number[] = [];
  const tutorialHits: number[] = [];
  const tutorialBrier: number[] = [];
  const beginnerErrors: number[] = [];
  const relevanceErrors: number[] = [];
  const confidences: number[] = [];

  for (const item of benchmark.repositories) {
    const assessment = repositoryById.get(item.id)!;

    projectTypeHits.push(
      assessment.projectType.choice === item.expected.projectType ? 1 : 0,
    );

    const predictedTutorial =
      assessment.tutorialDemo.probability >= 0.5;
    tutorialHits.push(
      predictedTutorial === item.expected.tutorialDemo ? 1 : 0,
    );

    const tutorialTarget = item.expected.tutorialDemo ? 1 : 0;
    tutorialBrier.push(
      (assessment.tutorialDemo.probability - tutorialTarget) ** 2,
    );

    beginnerErrors.push(
      Math.abs(
        assessment.beginnerSuitability.score -
          item.expected.beginnerSuitability,
      ),
    );

    confidences.push(
      assessment.projectType.confidence,
      assessment.beginnerSuitability.confidence,
    );
  }

  for (const item of benchmark.relevance) {
    const assessment = relevanceById.get(item.id)!;
    relevanceErrors.push(
      Math.abs(assessment.score - item.expectedScore),
    );
    confidences.push(assessment.confidence);
  }

  const startedAt = parseTimestamp('startedAt', run.startedAt);
  const completedAt = parseTimestamp('completedAt', run.completedAt);

  if (completedAt < startedAt) {
    throw new Error('completedAt must not be earlier than startedAt.');
  }

  return {
    benchmarkVersion: benchmark.version,
    provider: run.provider,
    model: run.model,
    runId: run.runId,
    coverage: {
      repositoryAssessments: run.repositoryAssessments.length,
      relevanceAssessments: run.relevanceAssessments.length,
    },
    metrics: {
      projectTypeAccuracy: rounded(mean(projectTypeHits)),
      tutorialDemoAccuracy: rounded(mean(tutorialHits)),
      tutorialDemoBrierScore: rounded(mean(tutorialBrier)),
      beginnerSuitabilityMae: rounded(mean(beginnerErrors)),
      relevanceMae: rounded(mean(relevanceErrors)),
      meanConfidence: rounded(mean(confidences)),
    },
    latencyMs: completedAt - startedAt,
  };
}
