import {
  ContributionDiscoveryError,
  normalizeContributionFilters,
  type ContributionFilters,
} from './contribution-discovery-client.js';

const BOOLEAN_KEYS = [
  'unassigned', 'unlocked', 'goodFirstIssue', 'helpWanted',
] as const;

function booleanFilter(parameters: URLSearchParams, key: typeof BOOLEAN_KEYS[number]): boolean | null {
  const value = parameters.get(key);
  if (value === null) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ContributionDiscoveryError(
    'The shared URL contains an invalid ' + key + ' filter.',
    null,
    'invalid_contribution_filter',
  );
}

export function contributionFiltersFromSearch(search: string): ContributionFilters {
  const parameters = new URLSearchParams(search);
  const recency = parameters.get('updatedWithinDays');
  if (recency !== null && !/^\d+$/.test(recency)) {
    throw new ContributionDiscoveryError(
      'The shared URL contains an invalid update window.',
      null,
      'invalid_contribution_filter',
    );
  }
  return normalizeContributionFilters({
    unassigned: booleanFilter(parameters, 'unassigned'),
    unlocked: booleanFilter(parameters, 'unlocked'),
    goodFirstIssue: booleanFilter(parameters, 'goodFirstIssue'),
    helpWanted: booleanFilter(parameters, 'helpWanted'),
    language: parameters.get('language'),
    updatedWithinDays: recency === null ? null : Number(recency),
    contributing: parameters.get('contributing') as ContributionFilters['contributing'],
  });
}

export function contributionFiltersToSearch(filters: ContributionFilters): string {
  const valid = normalizeContributionFilters(filters);
  const parameters = new URLSearchParams();
  for (const key of BOOLEAN_KEYS) {
    if (valid[key] !== null) parameters.set(key, String(valid[key]));
  }
  if (valid.language !== null) parameters.set('language', valid.language);
  if (valid.updatedWithinDays !== null) {
    parameters.set('updatedWithinDays', String(valid.updatedWithinDays));
  }
  if (valid.contributing !== null) parameters.set('contributing', valid.contributing);
  return parameters.toString();
}
