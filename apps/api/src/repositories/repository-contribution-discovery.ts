import type { RepositoryContributionIssueRecord } from './repository-contribution-issue.js';
import type { ContributionDiscoverySignalSnapshot } from './repository-contribution-signals.js';

export const DEFAULT_CONTRIBUTION_DISCOVERY_PAGE_SIZE = 20;
export const MAX_CONTRIBUTION_DISCOVERY_PAGE_SIZE = 50;
export const MAX_CONTRIBUTION_DISCOVERY_LANGUAGE_LENGTH = 64;
export const MAX_CONTRIBUTION_DISCOVERY_RECENCY_DAYS = 3650;

export type ContributionProcessEvidenceFilter =
  | 'present'
  | 'absent'
  | 'missing'
  | 'not_applicable';

export type ContributionDiscoveryFilters = Readonly<{
  unassigned: boolean | null;
  unlocked: boolean | null;
  goodFirstIssue: boolean | null;
  helpWanted: boolean | null;
  primaryLanguage: string | null;
  updatedWithinDays: number | null;
  contributing: ContributionProcessEvidenceFilter | null;
}>;

export const EMPTY_CONTRIBUTION_DISCOVERY_FILTERS: ContributionDiscoveryFilters =
  Object.freeze({
    unassigned: null,
    unlocked: null,
    goodFirstIssue: null,
    helpWanted: null,
    primaryLanguage: null,
    updatedWithinDays: null,
    contributing: null,
  });

export type ContributionDiscoveryPosition = Readonly<{
  issueId: string;
  updatedAtGithub: Date;
}>;

export type ContributionDiscoveryCursor = Readonly<{
  position: ContributionDiscoveryPosition;
  evaluatedAt: Date;
  filters: ContributionDiscoveryFilters;
}>;

export type ContributionDiscoveryRepository = Readonly<{
  id: string;
  fullName: string;
  githubUrl: string;
  primaryLanguage: string | null;
}>;

export type ContributionDiscoveryItem = Readonly<{
  repository: ContributionDiscoveryRepository;
  issue: RepositoryContributionIssueRecord;
  signalSnapshot: ContributionDiscoverySignalSnapshot;
}>;

export type ContributionDiscoveryPageInput = Readonly<{
  filters: ContributionDiscoveryFilters;
  limit: number;
  position: ContributionDiscoveryPosition | null;
  evaluatedAt: Date;
}>;

export type ContributionDiscoveryPage = Readonly<{
  items: ContributionDiscoveryItem[];
  hasMore: boolean;
}>;

export type ContributionDiscoveryReader = Readonly<{
  discoverPage(
    input: ContributionDiscoveryPageInput,
  ): Promise<ContributionDiscoveryPage>;
}>;

type EncodedContributionDiscoveryCursor = Readonly<{
  issueId: string;
  updatedAtGithub: string;
  evaluatedAt: string;
  filters: ContributionDiscoveryFilters;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseOptionalBooleanFilter(
  value: unknown,
  field: 'unassigned' | 'unlocked' | 'goodFirstIssue' | 'helpWanted',
): boolean | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`filter ${field} must be true or false.`);
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`filter ${field} must be true or false.`);
}

function parseOptionalLanguageFilter(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(
      'filter language must be a string between 1 and 64 characters.',
    );
  }

  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();

  if (
    normalized.length < 1 ||
    normalized.length > MAX_CONTRIBUTION_DISCOVERY_LANGUAGE_LENGTH ||
    !/[\p{L}\p{N}]/u.test(normalized)
  ) {
    throw new Error(
      'filter language must be a string between 1 and 64 characters.',
    );
  }

  return normalized;
}

function parseOptionalRecencyFilter(value: unknown): number | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(
      `filter updatedWithinDays must be an integer between 1 and ${MAX_CONTRIBUTION_DISCOVERY_RECENCY_DAYS}.`,
    );
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_CONTRIBUTION_DISCOVERY_RECENCY_DAYS
  ) {
    throw new Error(
      `filter updatedWithinDays must be an integer between 1 and ${MAX_CONTRIBUTION_DISCOVERY_RECENCY_DAYS}.`,
    );
  }

  return parsed;
}

function parseOptionalProcessFilter(
  value: unknown,
): ContributionProcessEvidenceFilter | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(
      'filter contributing must be present, absent, missing, or not_applicable.',
    );
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === 'present' ||
    normalized === 'absent' ||
    normalized === 'missing' ||
    normalized === 'not_applicable'
  ) {
    return normalized;
  }

  throw new Error(
    'filter contributing must be present, absent, missing, or not_applicable.',
  );
}

export function parseContributionDiscoveryFilters(input: Readonly<{
  unassigned: unknown;
  unlocked: unknown;
  goodFirstIssue: unknown;
  helpWanted: unknown;
  language: unknown;
  updatedWithinDays: unknown;
  contributing: unknown;
}>): ContributionDiscoveryFilters {
  return {
    unassigned: parseOptionalBooleanFilter(
      input.unassigned,
      'unassigned',
    ),
    unlocked: parseOptionalBooleanFilter(input.unlocked, 'unlocked'),
    goodFirstIssue: parseOptionalBooleanFilter(
      input.goodFirstIssue,
      'goodFirstIssue',
    ),
    helpWanted: parseOptionalBooleanFilter(
      input.helpWanted,
      'helpWanted',
    ),
    primaryLanguage: parseOptionalLanguageFilter(input.language),
    updatedWithinDays: parseOptionalRecencyFilter(
      input.updatedWithinDays,
    ),
    contributing: parseOptionalProcessFilter(input.contributing),
  };
}

export function contributionDiscoveryFiltersEqual(
  left: ContributionDiscoveryFilters,
  right: ContributionDiscoveryFilters,
): boolean {
  return (
    left.unassigned === right.unassigned &&
    left.unlocked === right.unlocked &&
    left.goodFirstIssue === right.goodFirstIssue &&
    left.helpWanted === right.helpWanted &&
    left.primaryLanguage === right.primaryLanguage &&
    left.updatedWithinDays === right.updatedWithinDays &&
    left.contributing === right.contributing
  );
}

function isEncodedFilters(
  value: unknown,
): value is ContributionDiscoveryFilters {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const filters = value as Partial<ContributionDiscoveryFilters>;
  const nullableBoolean = (item: unknown) =>
    item === null || typeof item === 'boolean';

  return (
    nullableBoolean(filters.unassigned) &&
    nullableBoolean(filters.unlocked) &&
    nullableBoolean(filters.goodFirstIssue) &&
    nullableBoolean(filters.helpWanted) &&
    (
      filters.primaryLanguage === null ||
      (
        typeof filters.primaryLanguage === 'string' &&
        filters.primaryLanguage.length >= 1 &&
        filters.primaryLanguage.length <=
          MAX_CONTRIBUTION_DISCOVERY_LANGUAGE_LENGTH
      )
    ) &&
    (
      filters.updatedWithinDays === null ||
      (
        Number.isSafeInteger(filters.updatedWithinDays) &&
        (filters.updatedWithinDays as number) >= 1 &&
        (filters.updatedWithinDays as number) <=
          MAX_CONTRIBUTION_DISCOVERY_RECENCY_DAYS
      )
    ) &&
    (
      filters.contributing === null ||
      filters.contributing === 'present' ||
      filters.contributing === 'absent' ||
      filters.contributing === 'missing' ||
      filters.contributing === 'not_applicable'
    )
  );
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function encodeContributionDiscoveryCursor(
  item: Pick<ContributionDiscoveryItem, 'issue'>,
  evaluatedAt: Date,
  filters: ContributionDiscoveryFilters,
): string {
  const payload: EncodedContributionDiscoveryCursor = {
    issueId: item.issue.id,
    updatedAtGithub: item.issue.updatedAtGithub.toISOString(),
    evaluatedAt: evaluatedAt.toISOString(),
    filters,
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
}

export function parseContributionDiscoveryCursor(
  value: unknown,
  filters: ContributionDiscoveryFilters,
): ContributionDiscoveryCursor | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) {
    throw new Error('cursor is invalid.');
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<EncodedContributionDiscoveryCursor>;

    const updatedAtGithub = parseDate(parsed.updatedAtGithub);
    const evaluatedAt = parseDate(parsed.evaluatedAt);

    if (
      typeof parsed.issueId !== 'string' ||
      !UUID_PATTERN.test(parsed.issueId) ||
      !updatedAtGithub ||
      !evaluatedAt ||
      !isEncodedFilters(parsed.filters) ||
      !contributionDiscoveryFiltersEqual(parsed.filters, filters)
    ) {
      throw new Error('invalid contribution discovery cursor fields');
    }

    return {
      position: {
        issueId: parsed.issueId,
        updatedAtGithub,
      },
      evaluatedAt,
      filters: parsed.filters,
    };
  } catch {
    throw new Error('cursor is invalid.');
  }
}

export function toContributionDiscoveryResponseItem(
  item: ContributionDiscoveryItem,
) {
  return {
    repository: {
      id: item.repository.id,
      fullName: item.repository.fullName,
      githubUrl: item.repository.githubUrl,
      primaryLanguage: item.repository.primaryLanguage,
    },
    issue: {
      githubIssueId: item.issue.githubIssueId,
      number: item.issue.number,
      title: item.issue.title,
      githubUrl: item.issue.githubUrl,
      state: item.issue.state,
      locked: item.issue.locked,
      assigneeCount: item.issue.assigneeCount,
      commentCount: item.issue.commentCount,
      labels: item.issue.labels,
      createdAtGithub: item.issue.createdAtGithub.toISOString(),
      updatedAtGithub: item.issue.updatedAtGithub.toISOString(),
      observedAt: item.issue.observedAt.toISOString(),
    },
    evidence: {
      normalizedLabels: item.signalSnapshot.normalizedLabels,
      signals: item.signalSnapshot.signals,
    },
  };
}
