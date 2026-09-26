export const SEMANTIC_RETRIEVAL_BENCHMARK_VERSION =
  'semantic-retrieval-benchmark-v1' as const;

export type SemanticRetrievalBenchmarkRepository = Readonly<{
  id: string;
  fullName: string;
  description: string;
  primaryLanguage: string;
  topics: readonly string[];
  readmeExcerpt: string;
}>;

export type SemanticRetrievalBenchmarkQuery = Readonly<{
  id: string;
  query: string;
  expectedRepositoryIds: readonly string[];
  rationale: string;
}>;

export type SemanticRetrievalBenchmark = Readonly<{
  version: typeof SEMANTIC_RETRIEVAL_BENCHMARK_VERSION;
  repositories: readonly SemanticRetrievalBenchmarkRepository[];
  queries: readonly SemanticRetrievalBenchmarkQuery[];
}>;

export const semanticRetrievalBenchmark: SemanticRetrievalBenchmark = {
  version: SEMANTIC_RETRIEVAL_BENCHMARK_VERSION,
  repositories: [
    {
      id: 'schema-change-guard',
      fullName: 'example/schema-guard',
      description:
        'CLI for validating database migrations and detecting schema drift in CI.',
      primaryLanguage: 'TypeScript',
      topics: ['database', 'migrations', 'cli', 'ci'],
      readmeExcerpt:
        'Compare expected and actual database structures before deployment and generate machine-readable migration reports.',
    },
    {
      id: 'self-hosted-observability',
      fullName: 'example/lantern-monitor',
      description:
        'Self-hosted monitoring application with dashboards, alerts, and Docker deployment.',
      primaryLanguage: 'Go',
      topics: ['monitoring', 'self-hosted', 'docker'],
      readmeExcerpt:
        'Run the server with Docker Compose, collect service metrics, create dashboards, and route alert notifications.',
    },
    {
      id: 'accessible-ui-kit',
      fullName: 'example/a11y-components',
      description:
        'Accessible React component library with keyboard interaction patterns and design tokens.',
      primaryLanguage: 'TypeScript',
      topics: ['react', 'components', 'accessibility'],
      readmeExcerpt:
        'Reusable interface primitives include documented focus behavior, ARIA guidance, Storybook examples, and automated tests.',
    },
    {
      id: 'workflow-automation',
      fullName: 'example/flow-engine',
      description:
        'Visual workflow automation platform for connecting APIs, schedules, and event triggers.',
      primaryLanguage: 'TypeScript',
      topics: ['automation', 'workflows', 'integrations'],
      readmeExcerpt:
        'Create trigger-action flows, connect external services, schedule jobs, and run event-driven automations.',
    },
    {
      id: 'vector-search-engine',
      fullName: 'example/vector-store',
      description:
        'Vector similarity search service for embeddings and nearest-neighbor retrieval.',
      primaryLanguage: 'Rust',
      topics: ['vector-search', 'embeddings', 'database'],
      readmeExcerpt:
        'Store dense vectors, build indexes, and retrieve nearest neighbors for semantic search workloads.',
    },
    {
      id: 'react-learning-demo',
      fullName: 'example/react-todo-course',
      description:
        'Small React todo application used as a step-by-step beginner course exercise.',
      primaryLanguage: 'TypeScript',
      topics: ['react', 'tutorial', 'beginner'],
      readmeExcerpt:
        'Follow the lesson to practice components, forms, state updates, and simple client-side persistence.',
    },
  ],
  queries: [
    {
      id: 'database-change-safety',
      query:
        'tool to catch unsafe database changes before I deploy them',
      expectedRepositoryIds: ['schema-change-guard'],
      rationale:
        'The intent is migration/schema validation even though the query does not repeat the repository name.',
    },
    {
      id: 'run-monitoring-yourself',
      query:
        'monitor my own services on infrastructure I control with containers',
      expectedRepositoryIds: ['self-hosted-observability'],
      rationale:
        'Self-hosted observability intent should resolve to the monitoring application.',
    },
    {
      id: 'keyboard-friendly-react-ui',
      query:
        'React UI primitives with strong keyboard and screen-reader support',
      expectedRepositoryIds: ['accessible-ui-kit'],
      rationale:
        'Accessibility intent should match the component library rather than a generic React tutorial.',
    },
    {
      id: 'connect-apps-with-triggers',
      query:
        'connect different apps and make actions run when events happen',
      expectedRepositoryIds: ['workflow-automation'],
      rationale:
        'Natural-language workflow intent should map to trigger/action automation terminology.',
    },
    {
      id: 'embedding-nearest-neighbor',
      query:
        'database for finding similar items from machine learning vectors',
      expectedRepositoryIds: ['vector-search-engine'],
      rationale:
        'Semantic similarity/vector-database intent should match the vector search service.',
    },
    {
      id: 'learn-react-basics',
      query:
        'small project for practicing React state and forms as a beginner',
      expectedRepositoryIds: ['react-learning-demo'],
      rationale:
        'Learning intent should separate the tutorial from production component infrastructure.',
    },
  ],
};
