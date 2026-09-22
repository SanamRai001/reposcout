export const JEV_EVALUATION_BENCHMARK_VERSION = '3e1-v1';

export type ProjectType =
  | 'library'
  | 'application'
  | 'framework'
  | 'developer_tool'
  | 'educational'
  | 'infrastructure'
  | 'other';

export type RepositoryEvaluationInput = Readonly<{
  fullName: string;
  description: string;
  primaryLanguage: string | null;
  topics: string[];
  readmeExcerpt: string;
  hasContributing: boolean;
  hasCodeOfConduct: boolean;
  hasIssueTemplate: boolean;
  hasPullRequestTemplate: boolean;
  hasSecurityPolicy: boolean;
}>;

export type RepositoryEvaluationCase = Readonly<{
  id: string;
  input: RepositoryEvaluationInput;
  expected: Readonly<{
    projectType: ProjectType;
    tutorialDemo: boolean;
    beginnerSuitability: 1 | 2 | 3 | 4 | 5;
  }>;
  rationale: string;
}>;

export type QueryRelevanceCase = Readonly<{
  id: string;
  query: string;
  repositoryCaseId: string;
  expectedScore: 1 | 2 | 3 | 4 | 5;
  rationale: string;
}>;

export type JevEvaluationBenchmark = Readonly<{
  version: string;
  repositories: readonly RepositoryEvaluationCase[];
  relevance: readonly QueryRelevanceCase[];
}>;

export const jevEvaluationBenchmark: JevEvaluationBenchmark = {
  version: JEV_EVALUATION_BENCHMARK_VERSION,
  repositories: [
    {
      id: 'typed-sdk-library',
      input: {
        fullName: 'example/typed-sdk',
        description:
          'A production TypeScript SDK with generated clients, tests, releases, and API documentation.',
        primaryLanguage: 'TypeScript',
        topics: ['sdk', 'typescript', 'api-client'],
        readmeExcerpt:
          'Install the package, configure a client, and call the typed API. The repository documents releases, testing, generated types, and compatibility guarantees.',
        hasContributing: true,
        hasCodeOfConduct: true,
        hasIssueTemplate: true,
        hasPullRequestTemplate: true,
        hasSecurityPolicy: true,
      },
      expected: {
        projectType: 'library',
        tutorialDemo: false,
        beginnerSuitability: 3,
      },
      rationale:
        'Reusable SDK/library with mature contribution process; approachable but not a beginner tutorial.',
    },
    {
      id: 'todo-learning-project',
      input: {
        fullName: 'example/react-todo-tutorial',
        description:
          'Step-by-step React todo application built for beginners following a course.',
        primaryLanguage: 'TypeScript',
        topics: ['react', 'tutorial', 'beginner'],
        readmeExcerpt:
          'This repository follows lesson 6 of the course. Clone it, compare your solution, and experiment with components, state, and forms.',
        hasContributing: false,
        hasCodeOfConduct: false,
        hasIssueTemplate: false,
        hasPullRequestTemplate: false,
        hasSecurityPolicy: false,
      },
      expected: {
        projectType: 'educational',
        tutorialDemo: true,
        beginnerSuitability: 5,
      },
      rationale:
        'Explicit tutorial/course repository intended for beginners.',
    },
    {
      id: 'self-hosted-application',
      input: {
        fullName: 'example/self-hosted-monitor',
        description:
          'Self-hosted monitoring application with Docker deployment, PostgreSQL, alerting, and dashboards.',
        primaryLanguage: 'Go',
        topics: ['self-hosted', 'monitoring', 'docker'],
        readmeExcerpt:
          'Deploy with Docker Compose or Kubernetes. Includes migrations, authentication, alert rules, dashboards, and upgrade notes.',
        hasContributing: true,
        hasCodeOfConduct: true,
        hasIssueTemplate: true,
        hasPullRequestTemplate: true,
        hasSecurityPolicy: true,
      },
      expected: {
        projectType: 'application',
        tutorialDemo: false,
        beginnerSuitability: 2,
      },
      rationale:
        'Operational application with real deployment complexity; useful software but not especially beginner-oriented.',
    },
    {
      id: 'kubernetes-operator',
      input: {
        fullName: 'example/cloud-operator',
        description:
          'Kubernetes operator managing distributed database clusters with custom resources and controllers.',
        primaryLanguage: 'Go',
        topics: ['kubernetes', 'operator', 'infrastructure'],
        readmeExcerpt:
          'Defines CRDs, reconciliation loops, upgrade orchestration, failover, leader election, integration tests, and cluster lifecycle management.',
        hasContributing: true,
        hasCodeOfConduct: true,
        hasIssueTemplate: true,
        hasPullRequestTemplate: true,
        hasSecurityPolicy: true,
      },
      expected: {
        projectType: 'infrastructure',
        tutorialDemo: false,
        beginnerSuitability: 1,
      },
      rationale:
        'Infrastructure/operator codebase with substantial distributed-systems and Kubernetes complexity.',
    },
    {
      id: 'component-library',
      input: {
        fullName: 'example/ui-components',
        description:
          'Accessible React component library with Storybook, tests, design tokens, and package releases.',
        primaryLanguage: 'TypeScript',
        topics: ['react', 'components', 'accessibility'],
        readmeExcerpt:
          'Reusable components are published as packages. Storybook documents behavior, tokens, keyboard interactions, and accessibility requirements.',
        hasContributing: true,
        hasCodeOfConduct: true,
        hasIssueTemplate: true,
        hasPullRequestTemplate: true,
        hasSecurityPolicy: false,
      },
      expected: {
        projectType: 'library',
        tutorialDemo: false,
        beginnerSuitability: 3,
      },
      rationale:
        'Reusable library with contribution guidance; moderate domain complexity.',
    },
    {
      id: 'cli-developer-tool',
      input: {
        fullName: 'example/schema-cli',
        description:
          'Command-line developer tool for validating database schemas and generating migration reports.',
        primaryLanguage: 'Rust',
        topics: ['cli', 'database', 'developer-tools'],
        readmeExcerpt:
          'Install the binary, point it at schema files, run validation, and export machine-readable reports for CI.',
        hasContributing: true,
        hasCodeOfConduct: false,
        hasIssueTemplate: true,
        hasPullRequestTemplate: true,
        hasSecurityPolicy: false,
      },
      expected: {
        projectType: 'developer_tool',
        tutorialDemo: false,
        beginnerSuitability: 2,
      },
      rationale:
        'Standalone developer utility rather than a reusable library or end-user application.',
    },
  ],
  relevance: [
    {
      id: 'relevance-typescript-backend-sdk',
      query: 'TypeScript backend libraries worth studying',
      repositoryCaseId: 'typed-sdk-library',
      expectedScore: 5,
      rationale:
        'A mature TypeScript SDK is highly relevant to studying production library structure.',
    },
    {
      id: 'relevance-typescript-backend-tutorial',
      query: 'TypeScript backend libraries worth studying',
      repositoryCaseId: 'todo-learning-project',
      expectedScore: 1,
      rationale:
        'A React todo tutorial is not a backend library.',
    },
    {
      id: 'relevance-self-hosted-monitor',
      query: 'self-hosted monitoring software with Docker',
      repositoryCaseId: 'self-hosted-application',
      expectedScore: 5,
      rationale:
        'Direct match for the requested self-hosted monitoring use case.',
    },
    {
      id: 'relevance-self-hosted-operator',
      query: 'self-hosted monitoring software with Docker',
      repositoryCaseId: 'kubernetes-operator',
      expectedScore: 2,
      rationale:
        'Infrastructure software, but not primarily monitoring software.',
    },
    {
      id: 'relevance-first-contribution-ui',
      query: 'React project that could be a realistic first open-source contribution',
      repositoryCaseId: 'component-library',
      expectedScore: 4,
      rationale:
        'Relevant stack and contribution process, though a real beginner fit still needs issue-level evidence.',
    },
  ],
};
