import type {
  SemanticRetrievalBenchmarkQuery,
  SemanticRetrievalBenchmarkRepository,
} from './repository-semantic-retrieval-benchmark.js';

export const SEMANTIC_RETRIEVAL_BENCHMARK_V2_VERSION =
  'semantic-retrieval-benchmark-v2' as const;

export type SemanticRetrievalBenchmarkV2Query =
  SemanticRetrievalBenchmarkQuery &
    Readonly<{
      difficulty: 'lexical_hard' | 'ambiguous';
    }>;

export type SemanticRetrievalBenchmarkV2 = Readonly<{
  version: typeof SEMANTIC_RETRIEVAL_BENCHMARK_V2_VERSION;
  observedAt: string;
  repositories: readonly SemanticRetrievalBenchmarkRepository[];
  queries: readonly SemanticRetrievalBenchmarkV2Query[];
  sources: Readonly<
    Record<
      string,
      Readonly<{
        repository: string;
        readmeRef: string;
        readmeSha: string;
      }>
    >
  >;
}>;

export const semanticRetrievalBenchmarkV2:
  SemanticRetrievalBenchmarkV2 = {
    version: SEMANTIC_RETRIEVAL_BENCHMARK_V2_VERSION,
    observedAt: '2026-09-26',
    repositories: [
      {
        id: 'immich',
        fullName: 'immich-app/immich',
        description:
          'High performance self-hosted photo and video management solution.',
        primaryLanguage: 'TypeScript',
        topics: ['self-hosted', 'photos', 'videos', 'backup'],
        readmeExcerpt:
          'High performance self-hosted photo and video management solution. Documentation includes installation, backup guidance, features, and deployment requirements.',
      },
      {
        id: 'n8n',
        fullName: 'n8n-io/n8n',
        description:
          'Platform for AI agents and workflow automation with visual building, custom code, self-hosting, cloud deployment, and many integrations.',
        primaryLanguage: 'TypeScript',
        topics: [
          'automation',
          'workflow',
          'integrations',
          'self-hosted',
          'ai',
        ],
        readmeExcerpt:
          'Build and deploy AI agents and workflows. Combine a visual canvas with custom code, self-host or use the cloud, and connect to many integrations.',
      },
      {
        id: 'pgvector',
        fullName: 'pgvector/pgvector',
        description:
          'Open-source vector similarity search for Postgres.',
        primaryLanguage: 'C',
        topics: [
          'postgres',
          'vector-search',
          'nearest-neighbor',
          'embeddings',
        ],
        readmeExcerpt:
          'Store vectors with the rest of your Postgres data. Supports exact and approximate nearest neighbor search, cosine distance, inner product, and multiple vector representations.',
      },
      {
        id: 'shadcn-ui',
        fullName: 'shadcn-ui/ui',
        description:
          'Composable accessible UI components designed to be customized, extended, and owned by the application using them.',
        primaryLanguage: 'TypeScript',
        topics: [
          'react',
          'components',
          'accessibility',
          'tailwindcss',
          'ui',
        ],
        readmeExcerpt:
          'A set of beautifully designed components that you can customize, extend, and build on. Use this to build your own component library.',
      },
      {
        id: 'fastapi',
        fullName: 'fastapi/fastapi',
        description:
          'High-performance Python web framework for building APIs from standard Python type hints.',
        primaryLanguage: 'Python',
        topics: [
          'python',
          'api',
          'web-framework',
          'openapi',
          'type-hints',
        ],
        readmeExcerpt:
          'FastAPI is a modern high-performance web framework for building APIs with Python type hints. It provides automatic interactive documentation, validation, editor support, and OpenAPI compatibility.',
      },
      {
        id: 'supabase',
        fullName: 'supabase/supabase',
        description:
          'Postgres development platform with database, authentication, APIs, realtime, functions, storage, and AI/vector tooling.',
        primaryLanguage: 'TypeScript',
        topics: [
          'postgres',
          'authentication',
          'realtime',
          'storage',
          'firebase-alternative',
        ],
        readmeExcerpt:
          'Build web, mobile, and AI applications on a dedicated Postgres database with authentication, generated APIs, realtime subscriptions, functions, file storage, and vector tooling.',
      },
    ],
    queries: [
      {
        id: 'private-photo-cloud',
        difficulty: 'lexical_hard',
        query:
          'I want something like a private Google Photos that I can keep on infrastructure I control',
        expectedRepositoryIds: ['immich'],
        rationale:
          'The intent is self-hosted personal photo/video management even though the query avoids the repository terminology.',
      },
      {
        id: 'event-driven-saas-glue',
        difficulty: 'lexical_hard',
        query:
          'I need glue between different SaaS tools so one action can kick off work in other systems',
        expectedRepositoryIds: ['n8n'],
        rationale:
          'The intent is event-driven workflow automation and integrations without directly saying workflow automation.',
      },
      {
        id: 'vectors-inside-relational-db',
        difficulty: 'lexical_hard',
        query:
          'I want nearest-neighbor retrieval inside my relational database instead of running a separate search service',
        expectedRepositoryIds: ['pgvector'],
        rationale:
          'The intent is vector similarity directly inside Postgres without naming Postgres or pgvector.',
      },
      {
        id: 'own-the-component-source',
        difficulty: 'lexical_hard',
        query:
          'I want interface building blocks whose source lives in my app so I can change the design instead of treating the library as a black box',
        expectedRepositoryIds: ['shadcn-ui'],
        rationale:
          'The intent is source-owned customizable UI components without using the repository name or Tailwind terminology.',
      },
      {
        id: 'typed-python-service',
        difficulty: 'lexical_hard',
        query:
          'Python service framework where function annotations drive request validation and interactive API documentation',
        expectedRepositoryIds: ['fastapi'],
        rationale:
          'The intent is FastAPI-style type-hint-driven API development without naming FastAPI.',
      },
      {
        id: 'firebase-style-postgres-backend',
        difficulty: 'lexical_hard',
        query:
          'I want a Firebase-style backend but with a relational database plus login, file uploads, and live data updates',
        expectedRepositoryIds: ['supabase'],
        rationale:
          'The intent is a Postgres-backed Firebase alternative using synonyms for auth, storage, and realtime.',
      },
      {
        id: 'postgres-vector-ambiguous',
        difficulty: 'ambiguous',
        query:
          'Postgres project for building an application that needs embeddings and similarity search',
        expectedRepositoryIds: ['pgvector', 'supabase'],
        rationale:
          'Both the focused vector extension and the broader Postgres platform are legitimately relevant.',
      },
      {
        id: 'self-hosted-product-ambiguous',
        difficulty: 'ambiguous',
        query:
          'self-hosted product with a web interface that I can run for my own data',
        expectedRepositoryIds: ['immich', 'n8n'],
        rationale:
          'The query is intentionally broad enough that multiple self-hosted products are relevant.',
      },
      {
        id: 'typescript-platform-ambiguous',
        difficulty: 'ambiguous',
        query:
          'large TypeScript platform with integrations and server-side capabilities',
        expectedRepositoryIds: ['n8n', 'supabase'],
        rationale:
          'The wording is intentionally broad across two TypeScript platforms with integration/backend capabilities.',
      },
      {
        id: 'developer-ui-vs-api',
        difficulty: 'ambiguous',
        query:
          'developer framework with strong defaults, documentation, and reusable building blocks',
        expectedRepositoryIds: ['shadcn-ui', 'fastapi'],
        rationale:
          'The wording intentionally spans UI and API framework interpretations.',
      },
    ],
    sources: {
      immich: {
        repository: 'immich-app/immich',
        readmeRef: 'main',
        readmeSha:
          'ba774d44cdd7b9e9baed4cc4166d4c317e3ebae8',
      },
      n8n: {
        repository: 'n8n-io/n8n',
        readmeRef: 'master',
        readmeSha:
          '21909fae00cbad4f18af84d2948752445051a915',
      },
      pgvector: {
        repository: 'pgvector/pgvector',
        readmeRef: 'master',
        readmeSha:
          'bcb7edaf91d2bb005675d378bb0ed495cc279c82',
      },
      'shadcn-ui': {
        repository: 'shadcn-ui/ui',
        readmeRef: 'main',
        readmeSha:
          '35657b37e0ef00aa7b477896d51a8fd0d5af8f49',
      },
      fastapi: {
        repository: 'fastapi/fastapi',
        readmeRef: 'master',
        readmeSha:
          'bd7e9e96b015b92f219c596710c96a89068488c8',
      },
      supabase: {
        repository: 'supabase/supabase',
        readmeRef: 'master',
        readmeSha:
          'cb933a7ef6022e616fca4e23bde0f0d10138cf3b',
      },
    },
  };
