import type {
  RepositoryEmbeddingBatch,
  RepositoryEmbeddingInput,
  RepositoryEmbeddingProvider,
} from '../repositories/repository-embedding-provider.js';

export const DETERMINISTIC_SEMANTIC_FIXTURE_PROVIDER =
  'reposcout-fixture' as const;
export const DETERMINISTIC_SEMANTIC_FIXTURE_MODEL =
  'concept-axes-v1' as const;

const CONCEPT_TERMS = Object.freeze([
  Object.freeze([
    'database',
    'schema',
    'schemas',
    'migration',
    'migrations',
    'drift',
    'deploy',
    'deployment',
    'unsafe',
    'change',
    'changes',
    'validate',
    'validating',
  ]),
  Object.freeze([
    'monitor',
    'monitoring',
    'observability',
    'service',
    'services',
    'container',
    'containers',
    'docker',
    'dashboard',
    'dashboards',
    'alert',
    'alerts',
    'metrics',
    'infrastructure',
    'self',
    'hosted',
  ]),
  Object.freeze([
    'accessible',
    'accessibility',
    'keyboard',
    'screen',
    'reader',
    'aria',
    'focus',
    'ui',
    'component',
    'components',
    'primitives',
  ]),
  Object.freeze([
    'connect',
    'connecting',
    'apps',
    'actions',
    'event',
    'events',
    'trigger',
    'triggers',
    'workflow',
    'workflows',
    'automation',
    'automations',
    'integrations',
    'schedule',
    'schedules',
    'jobs',
  ]),
  Object.freeze([
    'vector',
    'vectors',
    'embedding',
    'embeddings',
    'nearest',
    'neighbor',
    'neighbors',
    'similar',
    'similarity',
    'machine',
    'learning',
    'semantic',
    'search',
    'dense',
    'index',
    'indexes',
  ]),
  Object.freeze([
    'beginner',
    'tutorial',
    'course',
    'lesson',
    'practice',
    'practicing',
    'learn',
    'learning',
    'state',
    'forms',
    'form',
    'todo',
    'small',
    'project',
  ]),
] as const);

function tokens(text: string): readonly string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function vectorize(text: string): readonly number[] {
  const inputTokens = tokens(text);
  const tokenCounts = new Map<string, number>();

  for (const token of inputTokens) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }

  const vector = CONCEPT_TERMS.map((terms) =>
    terms.reduce(
      (sum, term) => sum + (tokenCounts.get(term) ?? 0),
      0,
    ),
  );

  if (vector.every((value) => value === 0)) {
    return [1, 1, 1, 1, 1, 1];
  }

  return vector;
}

export class DeterministicSemanticFixtureProvider
  implements RepositoryEmbeddingProvider
{
  readonly providerName = DETERMINISTIC_SEMANTIC_FIXTURE_PROVIDER;
  readonly modelName = DETERMINISTIC_SEMANTIC_FIXTURE_MODEL;

  async embed(
    inputs: readonly RepositoryEmbeddingInput[],
  ): Promise<RepositoryEmbeddingBatch> {
    return {
      provider: this.providerName,
      model: this.modelName,
      dimensions: CONCEPT_TERMS.length,
      vectors: inputs.map((input) => ({
        id: input.id,
        vector: vectorize(input.text),
      })),
    };
  }
}
