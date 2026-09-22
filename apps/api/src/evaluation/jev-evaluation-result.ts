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
