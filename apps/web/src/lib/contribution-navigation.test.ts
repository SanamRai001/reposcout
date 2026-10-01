import { describe, expect, it } from 'vitest';
import {
  contributionFiltersFromSearch,
  contributionFiltersToSearch,
} from './contribution-navigation.js';
import { EMPTY_CONTRIBUTION_FILTERS } from './contribution-discovery-client.js';

describe('shareable Contribution Explorer navigation', () => {
  it('loads an unscoped page from a blank URL', () => {
    expect(contributionFiltersFromSearch('')).toEqual(EMPTY_CONTRIBUTION_FILTERS);
    expect(contributionFiltersToSearch(EMPTY_CONTRIBUTION_FILTERS)).toBe('');
  });

  it('round-trips all supported filters without including private state', () => {
    const original = {
      unassigned: true,
      unlocked: false,
      goodFirstIssue: true,
      helpWanted: false,
      language: 'typescript',
      updatedWithinDays: 30,
      contributing: 'present' as const,
    };
    const url = contributionFiltersToSearch(original);
    expect(url).toBe(
      'unassigned=true&unlocked=false&goodFirstIssue=true&helpWanted=false&language=typescript&updatedWithinDays=30&contributing=present',
    );
    expect(contributionFiltersFromSearch('?' + url)).toEqual(original);
  });

  it('normalizes uppercase/spaced language and preserves false filters', () => {
    expect(contributionFiltersFromSearch('?language=%20TypeScript%20&unlocked=false')).toEqual({
      ...EMPTY_CONTRIBUTION_FILTERS,
      language: 'typescript',
      unlocked: false,
    });
  });

  it.each([
    '?unassigned=perhaps',
    '?unlocked=TRUE',
    '?updatedWithinDays=-10',
    '?updatedWithinDays=0',
    '?updatedWithinDays=3651',
    '?updatedWithinDays=not-a-number',
    '?contributing=unknown',
    '?language=%20%20',
  ])('rejects an invalid shared URL rather than silently broadening the request: %s', (search) => {
    expect(() => contributionFiltersFromSearch(search)).toThrow();
  });
});
