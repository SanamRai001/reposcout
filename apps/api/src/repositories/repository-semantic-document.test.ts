import { describe, expect, it } from 'vitest';

import type { RepositoryCatalogRecord } from './repository-catalog.js';
import {
  buildRepositorySemanticDocument,
  REPOSITORY_SEMANTIC_DOCUMENT_CONTRACT_VERSION,
  REPOSITORY_SEMANTIC_README_MAX_CHARS,
} from './repository-semantic-document.js';
import type { RepositoryReadmeRecord } from './repository-readme.js';

function repository(
  overrides: Partial<RepositoryCatalogRecord> = {},
): RepositoryCatalogRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    githubRepositoryId: '12345',
    owner: 'example',
    name: 'schema-scout',
    fullName: 'example/schema-scout',
    githubUrl: 'https://github.com/example/schema-scout',
    defaultBranch: 'main',
    description:
      'Validate database schema changes and generate migration reports.',
    isArchived: false,
    isFork: false,
    createdAtGithub: new Date('2025-01-01T00:00:00.000Z'),
    updatedAtGithub: new Date('2026-09-20T00:00:00.000Z'),
    pushedAtGithub: new Date('2026-09-25T00:00:00.000Z'),
    lastSyncedAt: new Date('2026-09-26T08:00:00.000Z'),
    createdAt: new Date('2026-09-26T08:00:00.000Z'),
    updatedAt: new Date('2026-09-26T08:00:00.000Z'),
    metadata: {
      repositoryId: '11111111-1111-4111-8111-111111111111',
      stars: 120,
      forks: 8,
      openIssues: 4,
      primaryLanguage: 'TypeScript',
      licenseSpdx: 'MIT',
      topics: ['Database', 'schema', 'database', 'developer tools'],
      observedAt: new Date('2026-09-26T08:00:00.000Z'),
      createdAt: new Date('2026-09-26T08:00:00.000Z'),
      updatedAt: new Date('2026-09-26T08:00:00.000Z'),
    },
    ...overrides,
  };
}

function readme(
  overrides: Partial<RepositoryReadmeRecord> = {},
): RepositoryReadmeRecord {
  const content =
    '# Schema Scout\n\nCheck schema drift before deployment. ' +
    'Use it in CI to validate migrations.';

  return {
    repositoryId: '11111111-1111-4111-8111-111111111111',
    status: 'PRESENT',
    sourceRef: 'main',
    path: 'README.md',
    sha: 'abc123',
    sizeBytes: Buffer.byteLength(content, 'utf8'),
    content,
    observedAt: new Date('2026-09-26T08:00:00.000Z'),
    createdAt: new Date('2026-09-26T08:00:00.000Z'),
    updatedAt: new Date('2026-09-26T08:00:00.000Z'),
    ...overrides,
  };
}

describe('repository semantic document contract', () => {
  it('builds a versioned deterministic document from existing repository evidence', () => {
    const document = buildRepositorySemanticDocument({
      repository: repository(),
      readme: readme(),
    });

    expect(document.contractVersion).toBe(
      REPOSITORY_SEMANTIC_DOCUMENT_CONTRACT_VERSION,
    );
    expect(document.fullName).toBe('example/schema-scout');
    expect(document.fields.primary_language).toEqual({
      id: 'primary_language',
      source: 'github_metadata',
      availability: 'available',
      text: 'TypeScript',
      truncated: false,
    });
    expect(document.fields.topics).toEqual({
      id: 'topics',
      source: 'github_metadata',
      availability: 'available',
      text: 'database, developer tools, schema',
      truncated: false,
    });
    expect(document.text).toContain(
      'Description: Validate database schema changes',
    );
    expect(document.text).toContain(
      'README excerpt: # Schema Scout Check schema drift before deployment.',
    );
  });

  it('preserves missing metadata and README reasons instead of inventing empty semantic content', () => {
    const document = buildRepositorySemanticDocument({
      repository: repository({
        description: null,
        metadata: null,
      }),
      readme: null,
    });

    expect(document.fields.description).toEqual({
      id: 'description',
      source: 'repository',
      availability: 'missing',
      reason: 'not_provided',
    });
    expect(document.fields.primary_language).toEqual({
      id: 'primary_language',
      source: 'github_metadata',
      availability: 'missing',
      reason: 'not_collected',
    });
    expect(document.fields.topics).toEqual({
      id: 'topics',
      source: 'github_metadata',
      availability: 'missing',
      reason: 'not_collected',
    });
    expect(document.fields.readme_excerpt).toEqual({
      id: 'readme_excerpt',
      source: 'readme_evidence',
      availability: 'missing',
      reason: 'not_collected',
    });
    expect(document.text).toBe(
      'Repository: example/schema-scout schema-scout',
    );
  });

  it.each([
    ['NOT_FOUND', 'not_found'],
    ['TOO_LARGE', 'too_large'],
  ] as const)(
    'maps README status %s to semantic missing reason %s',
    (status, reason) => {
      const document = buildRepositorySemanticDocument({
        repository: repository(),
        readme: readme({
          status,
          content: null,
          sha: status === 'TOO_LARGE' ? 'large-sha' : null,
          path: status === 'TOO_LARGE' ? 'README.md' : null,
          sizeBytes:
            status === 'TOO_LARGE'
              ? REPOSITORY_SEMANTIC_README_MAX_CHARS * 10
              : null,
        }),
      });

      expect(document.fields.readme_excerpt).toEqual({
        id: 'readme_excerpt',
        source: 'readme_evidence',
        availability: 'missing',
        reason,
      });
    },
  );

  it('bounds the normalized README excerpt without splitting Unicode code points', () => {
    const content =
      '🧭'.repeat(REPOSITORY_SEMANTIC_README_MAX_CHARS + 5);
    const document = buildRepositorySemanticDocument({
      repository: repository(),
      readme: readme({
        content,
        sizeBytes: Buffer.byteLength(content, 'utf8'),
      }),
    });
    const field = document.fields.readme_excerpt;

    expect(field.availability).toBe('available');

    if (field.availability !== 'available') {
      throw new Error('Expected README semantic field to be available.');
    }

    expect(Array.from(field.text)).toHaveLength(
      REPOSITORY_SEMANTIC_README_MAX_CHARS,
    );
    expect(field.truncated).toBe(true);
    expect(field.text.endsWith('🧭')).toBe(true);
  });

  it('rejects README evidence from another repository', () => {
    expect(() =>
      buildRepositorySemanticDocument({
        repository: repository(),
        readme: readme({
          repositoryId:
            '22222222-2222-4222-8222-222222222222',
        }),
      }),
    ).toThrow(
      'README repositoryId must match the repository semantic document.',
    );
  });

  it('does not put popularity or contribution-suitability judgments into semantic text', () => {
    const document = buildRepositorySemanticDocument({
      repository: repository(),
      readme: readme(),
    });
    const serialized = JSON.stringify(document);

    expect(serialized).not.toContain('"stars"');
    expect(serialized).not.toContain('"forks"');
    expect(serialized).not.toContain('beginnerFriendly');
    expect(serialized).not.toContain('"score"');
  });
});
