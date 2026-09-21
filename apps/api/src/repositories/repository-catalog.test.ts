import { describe, expect, it } from 'vitest';

import type { RepositoryRecord } from './repository.js';
import {
  encodeRepositoryCursor,
  parseRepositoryCursor,
  parseRepositoryPageLimit,
  toRepositoryResponse,
} from './repository-catalog.js';

const repository: RepositoryRecord = {
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

  it('round-trips an opaque repository cursor', () => {
    const cursor = encodeRepositoryCursor(repository);
    const parsed = parseRepositoryCursor(cursor);

    expect(parsed?.id).toBe(repository.id);
    expect(parsed?.createdAt.toISOString()).toBe(
      repository.createdAt.toISOString(),
    );
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
  });
});
