import { describe, expect, it } from 'vitest';

import type { RepositoryCatalogRecord } from './repository-catalog.js';
import {
  assertRepositoryDiscoveryScope,
  encodeRepositoryCursor,
  encodeRepositorySearchCursor,
  parseRepositoryCursor,
  parseRepositoryPageLimit,
  parseRepositorySearchCursor,
  parseRepositorySearchFilters,
  parseRepositorySearchQuery,
  toRepositoryResponse,
} from './repository-catalog.js';

const repository: RepositoryCatalogRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  githubRepositoryId: '123456789',
  owner: 'openai',
  name: 'openai-node',
  fullName: 'openai/openai-node',
  githubUrl: 'https://github.com/openai/openai-node',
  defaultBranch: 'main',
  description: 'OpenAI Node SDK',
  isArchived: false,
  isFork: false,
  createdAtGithub: new Date('2023-04-19T00:00:00Z'),
  updatedAtGithub: new Date('2026-09-20T00:00:00Z'),
  pushedAtGithub: new Date('2026-09-20T01:00:00Z'),
  lastSyncedAt: new Date('2026-09-21T08:00:00Z'),
  createdAt: new Date('2026-09-21T08:00:01Z'),
  updatedAt: new Date('2026-09-21T08:00:01Z'),
  metadata: {
    repositoryId: '11111111-1111-4111-8111-111111111111',
    stars: 1250,
    forks: 210,
    openIssues: 34,
    primaryLanguage: 'TypeScript',
    licenseSpdx: 'Apache-2.0',
    topics: ['openai', 'sdk', 'typescript'],
    observedAt: new Date('2026-09-21T08:00:00Z'),
    createdAt: new Date('2026-09-21T08:00:01Z'),
    updatedAt: new Date('2026-09-21T08:00:01Z'),
  },
};

describe('repository catalog contract', () => {
  it('uses bounded page sizes', () => {
    expect(parseRepositoryPageLimit(undefined)).toBe(20);
    expect(parseRepositoryPageLimit('1')).toBe(1);
    expect(parseRepositoryPageLimit('50')).toBe(50);

    expect(() => parseRepositoryPageLimit('0')).toThrow();
    expect(() => parseRepositoryPageLimit('51')).toThrow();
    expect(() => parseRepositoryPageLimit('1.5')).toThrow();
  });

  it('normalizes and bounds lexical search queries', () => {
    expect(parseRepositorySearchQuery('  TypeScript   BACKEND  ')).toBe(
      'typescript backend',
    );

    expect(parseRepositorySearchQuery(undefined)).toBeNull();
    expect(parseRepositorySearchQuery(null)).toBeNull();
    expect(() => parseRepositorySearchQuery('a')).toThrow();
    expect(() => parseRepositorySearchQuery('---')).toThrow();
    expect(() => parseRepositorySearchQuery('x'.repeat(121))).toThrow();
  });

  it('requires either a lexical query or at least one structured filter', () => {
    expect(() =>
      assertRepositoryDiscoveryScope(null, {
        primaryLanguage: null,
        licenseSpdx: null,
        topics: [],
        minStars: null,
        maxStars: null,
        isFork: null,
        isArchived: null,
      }),
    ).toThrow('search requires q or at least one filter.');

    expect(() =>
      assertRepositoryDiscoveryScope('backend', {
        primaryLanguage: null,
        licenseSpdx: null,
        topics: [],
        minStars: null,
        maxStars: null,
        isFork: null,
        isArchived: null,
      }),
    ).not.toThrow();

    expect(() =>
      assertRepositoryDiscoveryScope(null, {
        primaryLanguage: 'typescript',
        licenseSpdx: null,
        topics: [],
        minStars: null,
        maxStars: null,
        isFork: null,
        isArchived: null,
      }),
    ).not.toThrow();
  });

  it('normalizes scalar search filters', () => {
    expect(
      parseRepositorySearchFilters({
        language: ' TypeScript ',
        license: ' Apache-2.0 ',
        topic: [' SDK ', 'backend', 'sdk'],
        minStars: '100',
        maxStars: '5000',
        fork: 'FALSE',
        archived: 'true',
      }),
    ).toEqual({
      primaryLanguage: 'typescript',
      licenseSpdx: 'apache-2.0',
      topics: ['backend', 'sdk'],
      minStars: 100,
      maxStars: 5000,
      isFork: false,
      isArchived: true,
    });

    expect(
      parseRepositorySearchFilters({
        language: undefined,
        license: undefined,
        topic: undefined,
        minStars: undefined,
        maxStars: undefined,
        fork: undefined,
        archived: undefined,
      }),
    ).toEqual({
      primaryLanguage: null,
      licenseSpdx: null,
      topics: [],
      minStars: null,
      maxStars: null,
      isFork: null,
      isArchived: null,
    });

    expect(() =>
      parseRepositorySearchFilters({
        language: '---',
        license: undefined,
        topic: undefined,
        minStars: undefined,
        maxStars: undefined,
        fork: undefined,
        archived: undefined,
      }),
    ).toThrow('filter language');

    expect(() =>
      parseRepositorySearchFilters({
        language: undefined,
        license: undefined,
        topic: undefined,
        minStars: undefined,
        maxStars: undefined,
        fork: 'yes',
        archived: undefined,
      }),
    ).toThrow('filter fork must be true or false.');

    expect(() =>
      parseRepositorySearchFilters({
        language: undefined,
        license: undefined,
        topic: ['backend'],
        minStars: '500',
        maxStars: '100',
        fork: undefined,
        archived: undefined,
      }),
    ).toThrow(
      'filter minStars must be less than or equal to maxStars.',
    );

    expect(() =>
      parseRepositorySearchFilters({
        language: undefined,
        license: undefined,
        topic: Array.from({ length: 11 }, () => 'backend'),
        minStars: undefined,
        maxStars: undefined,
        fork: undefined,
        archived: undefined,
      }),
    ).toThrow('filter topic may be provided at most 10 times.');
  });

  it('binds opaque search cursors to the normalized query and filters', () => {
    const filters = {
      primaryLanguage: 'typescript',
      licenseSpdx: 'mit',
      topics: ['backend', 'typescript'],
      minStars: 100,
      maxStars: 10000,
      isFork: false,
      isArchived: false,
    };
    const cursor = encodeRepositorySearchCursor(
      repository,
      'typescript backend',
      filters,
    );

    expect(
      parseRepositorySearchCursor(
        cursor,
        'typescript backend',
        filters,
      ),
    ).toEqual({
      id: repository.id,
      query: 'typescript backend',
      filters,
    });

    expect(() =>
      parseRepositorySearchCursor(
        cursor,
        'react frontend',
        filters,
      ),
    ).toThrow('cursor is invalid.');

    expect(() =>
      parseRepositorySearchCursor(
        cursor,
        'typescript backend',
        {
          ...filters,
          topics: ['backend'],
          licenseSpdx: 'apache-2.0',
        },
      ),
    ).toThrow('cursor is invalid.');
  });

  it('binds filter-only cursors to null query plus normalized filters', () => {
    const filters = {
      primaryLanguage: 'typescript',
      licenseSpdx: null,
      topics: ['backend'],
      minStars: 100,
      maxStars: null,
      isFork: false,
      isArchived: false,
    };
    const cursor = encodeRepositorySearchCursor(
      repository,
      null,
      filters,
    );

    expect(
      parseRepositorySearchCursor(cursor, null, filters),
    ).toEqual({
      id: repository.id,
      query: null,
      filters,
    });

    expect(() =>
      parseRepositorySearchCursor(
        cursor,
        'backend',
        filters,
      ),
    ).toThrow('cursor is invalid.');
  });

  it('round-trips an opaque repository cursor', () => {
    const cursor = encodeRepositoryCursor(repository);
    const parsed = parseRepositoryCursor(cursor);

    expect(parsed).toEqual({
      id: repository.id,
    });
  });

  it('rejects malformed cursors', () => {
    expect(() => parseRepositoryCursor('not-a-cursor')).toThrow(
      'cursor is invalid.',
    );
  });

  it('serializes dates into stable JSON values', () => {
    const response = toRepositoryResponse(repository);

    expect(response.id).toBe(repository.id);
    expect(response.githubRepositoryId).toBe('123456789');
    expect(response.createdAtGithub).toBe('2023-04-19T00:00:00.000Z');
    expect(response.pushedAtGithub).toBe('2026-09-20T01:00:00.000Z');
    expect(response.lastSyncedAt).toBe('2026-09-21T08:00:00.000Z');
    expect(response.metadata).toEqual({
      stars: 1250,
      forks: 210,
      openIssues: 34,
      primaryLanguage: 'TypeScript',
      licenseSpdx: 'Apache-2.0',
      topics: ['openai', 'sdk', 'typescript'],
      observedAt: '2026-09-21T08:00:00.000Z',
    });
  });
});
