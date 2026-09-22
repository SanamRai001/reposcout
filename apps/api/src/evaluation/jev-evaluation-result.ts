import type { ProjectType } from './jev-evaluation-benchmark.js';

export type Probability = number;

export type JevRepositoryAssessment = Readonly<{
  caseId: string;
  projectType: Readonly<{
    choice: ProjectType;
    confidence: Probability;
  }>;
  tutorialDemo: Readonly<{
    probability: Probability;
  }>;
  beginnerSuitability: Readonly<{
    score: number;
    confidence: Probability;
  }>;
}>;

export type JevRelevanceAssessment = Readonly<{
  caseId: string;
  score: number;
  confidence: Probability;
}>;

export type JevEvaluationRun = Readonly<{
  schemaVersion: '3e1-v1';
  benchmarkVersion: string;
  provider: string;
  model: string;
  runId: string;
  startedAt: string;
  completedAt: string;
  repositoryAssessments: readonly JevRepositoryAssessment[];
  relevanceAssessments: readonly JevRelevanceAssessment[];
}>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(
  source: Record<string, unknown>,
  field: string,
): string {
  const value = source[field];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Evaluation run field "${field}" must be a non-empty string.`);
  }

  return value;
}

function requiredNumber(
  source: Record<string, unknown>,
  field: string,
): number {
  const value = source[field];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Evaluation run field "${field}" must be a finite number.`);
  }

  return value;
}

function parseRepositoryAssessment(
  value: unknown,
  index: number,
): JevRepositoryAssessment {
  if (!isObject(value)) {
    throw new Error(
      `repositoryAssessments[${index}] must be an object.`,
    );
  }

  const projectType = value.projectType;
  const tutorialDemo = value.tutorialDemo;
  const beginnerSuitability = value.beginnerSuitability;

  if (!isObject(projectType)) {
    throw new Error(
      `repositoryAssessments[${index}].projectType must be an object.`,
    );
  }

  if (!isObject(tutorialDemo)) {
    throw new Error(
      `repositoryAssessments[${index}].tutorialDemo must be an object.`,
    );
  }

  if (!isObject(beginnerSuitability)) {
    throw new Error(
      `repositoryAssessments[${index}].beginnerSuitability must be an object.`,
    );
  }

  return {
    caseId: requiredString(value, 'caseId'),
    projectType: {
      choice: requiredString(projectType, 'choice') as ProjectType,
      confidence: requiredNumber(projectType, 'confidence'),
    },
    tutorialDemo: {
      probability: requiredNumber(tutorialDemo, 'probability'),
    },
    beginnerSuitability: {
      score: requiredNumber(beginnerSuitability, 'score'),
      confidence: requiredNumber(beginnerSuitability, 'confidence'),
    },
  };
}

function parseRelevanceAssessment(
  value: unknown,
  index: number,
): JevRelevanceAssessment {
  if (!isObject(value)) {
    throw new Error(
      `relevanceAssessments[${index}] must be an object.`,
    );
  }

  return {
    caseId: requiredString(value, 'caseId'),
    score: requiredNumber(value, 'score'),
    confidence: requiredNumber(value, 'confidence'),
  };
}

export function parseJevEvaluationRun(value: unknown): JevEvaluationRun {
  if (!isObject(value)) {
    throw new Error('Evaluation run must be a JSON object.');
  }

  const schemaVersion = requiredString(value, 'schemaVersion');

  if (schemaVersion !== '3e1-v1') {
    throw new Error('Unsupported evaluation run schemaVersion.');
  }

  const repositoryAssessments = value.repositoryAssessments;
  const relevanceAssessments = value.relevanceAssessments;

  if (!Array.isArray(repositoryAssessments)) {
    throw new Error(
      'Evaluation run field "repositoryAssessments" must be an array.',
    );
  }

  if (!Array.isArray(relevanceAssessments)) {
    throw new Error(
      'Evaluation run field "relevanceAssessments" must be an array.',
    );
  }

  return {
    schemaVersion,
    benchmarkVersion: requiredString(value, 'benchmarkVersion'),
    provider: requiredString(value, 'provider'),
    model: requiredString(value, 'model'),
    runId: requiredString(value, 'runId'),
    startedAt: requiredString(value, 'startedAt'),
    completedAt: requiredString(value, 'completedAt'),
    repositoryAssessments: repositoryAssessments.map(
      parseRepositoryAssessment,
    ),
    relevanceAssessments: relevanceAssessments.map(
      parseRelevanceAssessment,
    ),
  };
}
