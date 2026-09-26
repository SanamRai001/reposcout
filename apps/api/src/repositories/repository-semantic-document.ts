import type { RepositoryCatalogRecord } from './repository-catalog.js';
import type { RepositoryReadmeRecord } from './repository-readme.js';

export const REPOSITORY_SEMANTIC_DOCUMENT_CONTRACT_VERSION =
  'repository-semantic-document-v1' as const;

export const REPOSITORY_SEMANTIC_README_MAX_CHARS = 6_000;

export type RepositorySemanticFieldId =
  | 'identity'
  | 'description'
  | 'primary_language'
  | 'topics'
  | 'readme_excerpt';

export type RepositorySemanticFieldSource =
  | 'repository'
  | 'github_metadata'
  | 'readme_evidence';

export type RepositorySemanticMissingReason =
  | 'not_provided'
  | 'not_collected'
  | 'not_found'
  | 'too_large';

export type RepositorySemanticField =
  | Readonly<{
      id: RepositorySemanticFieldId;
      source: RepositorySemanticFieldSource;
      availability: 'available';
      text: string;
      truncated: boolean;
    }>
  | Readonly<{
      id: RepositorySemanticFieldId;
      source: RepositorySemanticFieldSource;
      availability: 'missing';
      reason: RepositorySemanticMissingReason;
    }>;

export type RepositorySemanticDocument = Readonly<{
  contractVersion:
    typeof REPOSITORY_SEMANTIC_DOCUMENT_CONTRACT_VERSION;
  repositoryId: string;
  fullName: string;
  source: Readonly<{
    repositoryUpdatedAt: Date;
    metadataObservedAt: Date | null;
    readmeObservedAt: Date | null;
    readmeSha: string | null;
  }>;
  fields: Readonly<Record<RepositorySemanticFieldId, RepositorySemanticField>>;
  text: string;
}>;

export type BuildRepositorySemanticDocumentInput = Readonly<{
  repository: RepositoryCatalogRecord;
  readme: RepositoryReadmeRecord | null;
}>;

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

function truncateCodePoints(
  value: string,
  maxCharacters: number,
): Readonly<{ text: string; truncated: boolean }> {
  const codePoints = Array.from(value);

  if (codePoints.length <= maxCharacters) {
    return {
      text: value,
      truncated: false,
    };
  }

  return {
    text: codePoints.slice(0, maxCharacters).join(''),
    truncated: true,
  };
}

function availableField(
  id: RepositorySemanticFieldId,
  source: RepositorySemanticFieldSource,
  text: string,
  truncated = false,
): RepositorySemanticField {
  const normalized = normalizeText(text);

  if (!normalized) {
    throw new Error(`${id} semantic field must be non-empty when available.`);
  }

  return {
    id,
    source,
    availability: 'available',
    text: normalized,
    truncated,
  };
}

function missingField(
  id: RepositorySemanticFieldId,
  source: RepositorySemanticFieldSource,
  reason: RepositorySemanticMissingReason,
): RepositorySemanticField {
  return {
    id,
    source,
    availability: 'missing',
    reason,
  };
}

function buildReadmeField(
  readme: RepositoryReadmeRecord | null,
): RepositorySemanticField {
  if (!readme) {
    return missingField(
      'readme_excerpt',
      'readme_evidence',
      'not_collected',
    );
  }

  if (readme.status === 'NOT_FOUND') {
    return missingField(
      'readme_excerpt',
      'readme_evidence',
      'not_found',
    );
  }

  if (readme.status === 'TOO_LARGE') {
    return missingField(
      'readme_excerpt',
      'readme_evidence',
      'too_large',
    );
  }

  if (readme.content === null) {
    throw new Error(
      'PRESENT README evidence requires content for semantic-document-v1.',
    );
  }

  const normalized = normalizeText(readme.content);

  if (!normalized) {
    throw new Error(
      'PRESENT README content must remain non-empty after normalization.',
    );
  }

  const excerpt = truncateCodePoints(
    normalized,
    REPOSITORY_SEMANTIC_README_MAX_CHARS,
  );

  return availableField(
    'readme_excerpt',
    'readme_evidence',
    excerpt.text,
    excerpt.truncated,
  );
}

function formatSemanticText(
  fields: Readonly<Record<RepositorySemanticFieldId, RepositorySemanticField>>,
): string {
  const sections: string[] = [];

  const push = (label: string, field: RepositorySemanticField) => {
    if (field.availability === 'available') {
      sections.push(`${label}: ${field.text}`);
    }
  };

  push('Repository', fields.identity);
  push('Description', fields.description);
  push('Primary language', fields.primary_language);
  push('Topics', fields.topics);
  push('README excerpt', fields.readme_excerpt);

  return sections.join('\n');
}

export function buildRepositorySemanticDocument(
  input: BuildRepositorySemanticDocumentInput,
): RepositorySemanticDocument {
  const repository = input.repository;
  const fullName = normalizeText(repository.fullName);

  if (!fullName) {
    throw new Error(
      'Repository fullName must be non-empty for semantic-document-v1.',
    );
  }

  if (
    input.readme !== null &&
    input.readme.repositoryId !== repository.id
  ) {
    throw new Error(
      'README repositoryId must match the repository semantic document.',
    );
  }

  const description = repository.description
    ? normalizeText(repository.description)
    : '';
  const primaryLanguage = repository.metadata?.primaryLanguage
    ? normalizeText(repository.metadata.primaryLanguage)
    : '';
  const normalizedTopics =
    repository.metadata?.topics
      .map((topic) => normalizeText(topic))
      .filter(Boolean)
      .map((topic) => topic.toLowerCase()) ?? [];
  const topics = [...new Set(normalizedTopics)].sort((left, right) =>
    left.localeCompare(right),
  );

  const fields: Record<RepositorySemanticFieldId, RepositorySemanticField> = {
    identity: availableField(
      'identity',
      'repository',
      `${fullName} ${normalizeText(repository.name)}`,
    ),
    description: description
      ? availableField(
          'description',
          'repository',
          description,
        )
      : missingField(
          'description',
          'repository',
          'not_provided',
        ),
    primary_language: repository.metadata
      ? primaryLanguage
        ? availableField(
            'primary_language',
            'github_metadata',
            primaryLanguage,
          )
        : missingField(
            'primary_language',
            'github_metadata',
            'not_provided',
          )
      : missingField(
          'primary_language',
          'github_metadata',
          'not_collected',
        ),
    topics: repository.metadata
      ? topics.length > 0
        ? availableField(
            'topics',
            'github_metadata',
            topics.join(', '),
          )
        : missingField(
            'topics',
            'github_metadata',
            'not_provided',
          )
      : missingField(
          'topics',
          'github_metadata',
          'not_collected',
        ),
    readme_excerpt: buildReadmeField(input.readme),
  };

  return {
    contractVersion:
      REPOSITORY_SEMANTIC_DOCUMENT_CONTRACT_VERSION,
    repositoryId: repository.id,
    fullName,
    source: {
      repositoryUpdatedAt: repository.updatedAt,
      metadataObservedAt:
        repository.metadata?.observedAt ?? null,
      readmeObservedAt: input.readme?.observedAt ?? null,
      readmeSha:
        input.readme?.status === 'PRESENT'
          ? input.readme.sha
          : null,
    },
    fields,
    text: formatSemanticText(fields),
  };
}
