import { describe, expect, it } from 'vitest';

import {
  parseRepositoryRankingCursor,
  parseRepositoryRankingMode,
  rankingFormulaVersion,
} from './repository-ranking.js';

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

describe('repository ranking HTTP contract', () => {
  it('accepts only named public ranking modes', () => {
    expect(parseRepositoryRankingMode('hidden_gems')).toBe('hidden_gems');
    expect(parseRepositoryRankingMode('rising')).toBe('rising');
    expect(() => parseRepositoryRankingMode('popular')).toThrow(
      'ranking mode must be hidden_gems or rising.',
    );
  });

  it('binds cursors to mode, formula version, evaluation time, score, and repository', () => {
    const cursor = parseRepositoryRankingCursor(
      encode({
        mode: 'hidden_gems',
        formulaVersion: 'hidden-gem-v1',
        evaluatedAt: '2026-09-26T08:00:00.000Z',
        score: 72.5,
        repositoryId: '11111111-1111-4111-8111-111111111111',
      }),
      'hidden_gems',
    );

    expect(cursor).toEqual({
      mode: 'hidden_gems',
      formulaVersion: 'hidden-gem-v1',
      evaluatedAt: new Date('2026-09-26T08:00:00.000Z'),
      score: 72.5,
      repositoryId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('rejects a cursor from another ranking mode', () => {
    const cursor = encode({
      mode: 'hidden_gems',
      formulaVersion: 'hidden-gem-v1',
      evaluatedAt: '2026-09-26T08:00:00.000Z',
      score: 72.5,
      repositoryId: '11111111-1111-4111-8111-111111111111',
    });

    expect(() =>
      parseRepositoryRankingCursor(cursor, 'rising'),
    ).toThrow('ranking cursor is invalid.');
  });

  it('rejects stale formula versions instead of silently reusing a cursor', () => {
    const cursor = encode({
      mode: 'rising',
      formulaVersion: 'rising-v0',
      evaluatedAt: '2026-09-26T08:00:00.000Z',
      score: 55,
      repositoryId: '11111111-1111-4111-8111-111111111111',
    });

    expect(() =>
      parseRepositoryRankingCursor(cursor, 'rising'),
    ).toThrow('ranking cursor is invalid.');
  });

  it('resolves the active formula version per mode', () => {
    expect(rankingFormulaVersion('hidden_gems')).toBe('hidden-gem-v1');
    expect(rankingFormulaVersion('rising')).toBe('rising-v1');
  });
});
