import type {
  JevEvaluationBenchmark,
  ProjectType,
  RepositoryEvaluationInput,
} from './jev-evaluation-benchmark.js';
import type {
  JevEvaluationProvider,
  JevProviderEvaluation,
} from './jev-evaluation-provider.js';
import type {
  JevRelevanceAssessment,
  JevRepositoryAssessment,
} from './jev-evaluation-result.js';
import type {
  TypeSafeChoiceAnswer,
  TypeSafeNoulAnswer,
  TypeSafeScoreAnswer,
  TypeSafeSystemOneClient,
} from './typesafe-system-one-client.js';

const PROJECT_TYPE_CRITERIA: Readonly<Record<ProjectType, string>> = {
  library: 'Reusable package or SDK consumed by other software.',
  application: 'Runnable end-user or operator-facing application.',
  framework: 'Extensible framework that structures applications or systems.',
  developer_tool: 'Tool used primarily by software developers.',
  educational: 'Tutorial, course companion, demo, example, or learning repository.',
  infrastructure: 'Infrastructure, orchestration, operator, platform, or systems software.',
  other: 'Does not fit the other project categories.',
};

const BEGINNER_CRITERIA = [
  'Very difficult first contribution: specialist knowledge and complex architecture are central.',
  'Difficult first contribution: substantial domain or systems knowledge is likely required.',
  'Moderate first contribution: reasonable onboarding but meaningful codebase complexity.',
  'Good first-contribution fit: clear structure and contribution evidence reduce onboarding difficulty.',
  'Excellent beginner fit: explicitly beginner-oriented with very approachable scope and guidance.',
] as const;

const RELEVANCE_CRITERIA = [
  'Not relevant to the query.',
  'Weakly relevant; only peripheral overlap.',
  'Moderately relevant with some meaningful overlap.',
  'Strongly relevant and likely useful for the query.',
  'Direct, excellent match for the query.',
] as const;

function repositoryState(input: RepositoryEvaluationInput): unknown {
  return {
    repository: input.fullName,
    description: input.description,
    primary_language: input.primaryLanguage,
    topics: input.topics,
    readme_excerpt: input.readmeExcerpt,
    contribution_evidence: {
      contributing: input.hasContributing,
      code_of_conduct: input.hasCodeOfConduct,
      issue_template: input.hasIssueTemplate,
      pull_request_template: input.hasPullRequestTemplate,
      security_policy: input.hasSecurityPolicy,
    },
  };
}

function requireChoice(
  value: unknown,
  name: string,
): TypeSafeChoiceAnswer {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    throw new Error(`Missing TypeSafe answer "${name}".`);
  }

  if ((value as { type?: unknown }).type !== 'choice') {
    throw new Error(`TypeSafe answer "${name}" must be choice.`);
  }

  return value as TypeSafeChoiceAnswer;
}

function requireNoul(
  value: unknown,
  name: string,
): TypeSafeNoulAnswer {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    throw new Error(`Missing TypeSafe answer "${name}".`);
  }

  if ((value as { type?: unknown }).type !== 'noul') {
    throw new Error(`TypeSafe answer "${name}" must be noul.`);
  }

  return value as TypeSafeNoulAnswer;
}

function requireScore(
  value: unknown,
  name: string,
): TypeSafeScoreAnswer {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    throw new Error(`Missing TypeSafe answer "${name}".`);
  }

  if ((value as { type?: unknown }).type !== 'score') {
    throw new Error(`TypeSafe answer "${name}" must be score.`);
  }

  return value as TypeSafeScoreAnswer;
}

function assertProjectType(value: string): ProjectType {
  if (!(value in PROJECT_TYPE_CRITERIA)) {
    throw new Error(
      `TypeSafe returned unsupported project type "${value}".`,
    );
  }

  return value as ProjectType;
}

function benchmarkScore(value: number, name: string): number {
  const converted = value + 1;

  if (!Number.isFinite(converted) || converted < 1 || converted > 5) {
    throw new Error(
      `TypeSafe score "${name}" is outside RepoScout's 1-5 scale.`,
    );
  }

  return converted;
}

export class TypeSafeJevEvaluationProvider
  implements JevEvaluationProvider
{
  public readonly providerName = 'typesafe-system-one';

  public constructor(
    public readonly modelName: string,
    private readonly client: Pick<TypeSafeSystemOneClient, 'systemOne'>,
  ) {
    if (!modelName.trim()) {
      throw new Error('TypeSafe model name must be non-empty.');
    }
  }

  async evaluate(
    benchmark: JevEvaluationBenchmark,
  ): Promise<JevProviderEvaluation> {
    const repositoryAssessments: JevRepositoryAssessment[] = [];
    const relevanceAssessments: JevRelevanceAssessment[] = [];
    let resolvedModelName: string | null = null;

    const recordResolvedModel = (value: string): void => {
      if (!resolvedModelName) {
        resolvedModelName = value;
        return;
      }

      if (resolvedModelName !== value) {
        throw new Error(
          `TypeSafe resolved multiple models in one evaluation run: "${resolvedModelName}" and "${value}".`,
        );
      }
    };

    for (const item of benchmark.repositories) {
      const response = await this.client.systemOne({
        model: this.modelName,
        state: repositoryState(item.input),
        questions: {
          project_type: {
            type: 'choice',
            instructions:
              'Classify the repository by its primary software/project type.',
            criteria: PROJECT_TYPE_CRITERIA,
          },
          tutorial_demo: {
            type: 'noul',
            instructions:
              'Is this repository primarily a tutorial, demo, course/example project, or learning artifact rather than reusable/operational software?',
            criteria: {
              true:
                'The repository is primarily educational, a tutorial, demo, example, or course companion.',
              false:
                'The repository is primarily reusable or operational software, even if it also includes examples.',
            },
          },
          beginner_suitability: {
            type: 'score',
            instructions:
              'Rate how suitable this repository appears for a realistic first open-source code contribution, based only on the supplied evidence.',
            criteria: BEGINNER_CRITERIA,
          },
        },
      });

      recordResolvedModel(response.model);

      const projectType = requireChoice(
        response.answers.project_type,
        'project_type',
      );
      const tutorialDemo = requireNoul(
        response.answers.tutorial_demo,
        'tutorial_demo',
      );
      const beginnerSuitability = requireScore(
        response.answers.beginner_suitability,
        'beginner_suitability',
      );

      repositoryAssessments.push({
        caseId: item.id,
        projectType: {
          choice: assertProjectType(projectType.choice),
          confidence: projectType.confidence,
        },
        tutorialDemo: {
          probability: tutorialDemo.noul,
        },
        beginnerSuitability: {
          score: benchmarkScore(
            beginnerSuitability.score,
            'beginner_suitability',
          ),
          confidence: beginnerSuitability.confidence,
        },
      });
    }

    const repositoryById = new Map(
      benchmark.repositories.map((item) => [item.id, item]),
    );

    for (const item of benchmark.relevance) {
      const repository = repositoryById.get(item.repositoryCaseId);

      if (!repository) {
        throw new Error(
          `Relevance case "${item.id}" references an unknown repository case.`,
        );
      }

      const response = await this.client.systemOne({
        model: this.modelName,
        state: {
          query: item.query,
          repository: repositoryState(repository.input),
        },
        questions: {
          relevance: {
            type: 'score',
            instructions:
              'Rate how relevant this repository is to the discovery query.',
            criteria: RELEVANCE_CRITERIA,
          },
        },
      });

      recordResolvedModel(response.model);

      const relevance = requireScore(
        response.answers.relevance,
        'relevance',
      );

      relevanceAssessments.push({
        caseId: item.id,
        score: benchmarkScore(relevance.score, 'relevance'),
        confidence: relevance.confidence,
      });
    }

    if (!resolvedModelName) {
      throw new Error('TypeSafe evaluation produced no model responses.');
    }

    return {
      repositoryAssessments,
      relevanceAssessments,
      resolvedModelName,
    };
  }
}
