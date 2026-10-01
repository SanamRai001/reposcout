import { describe, expect, it } from 'vitest';

import {
  rankingModeFromSearch,
  rankingModeToSearch,
} from './repository-ranking-navigation.js';

describe('ranking URL navigation', () => {
  it('falls back to the ordinary catalog for absent and unrecognized views', () => {
    expect(rankingModeFromSearch('')).toBeNull();
    expect(rankingModeFromSearch('?q=backend&language=typescript')).toBeNull();
    expect(rankingModeFromSearch('?view=unknown')).toBeNull();
  });

  it.each(['hidden_gems', 'rising'] as const)(
    'preserves %s as an explicit shareable view',
    (mode) => {
      const search = rankingModeToSearch(mode);
      expect(search).toBe('view=' + mode);
      expect(rankingModeFromSearch('?' + search)).toBe(mode);
    },
  );

  it('returns an unscoped URL when navigating back to catalog', () => {
    expect(rankingModeToSearch(null)).toBe('');
  });
});
