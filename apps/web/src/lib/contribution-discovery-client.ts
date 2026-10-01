/**
 * B1: typed HTTP boundary for the already-shipped Phase 8 Contribution API.
 * No model calls, account access, or local ranking/suitability predictions.
 */

export type ContributionProcessFilter =
  | 'present' | 'absent' | 'missing' | 'not_applicable';

export type ContributionFilters = Readonly<{
  unassigned: boolean | null;
  unlocked: boolean | null;
  goodFirstIssue: boolean | null;
  helpWanted: boolean | null;
  language: string | null;
  updatedWithinDays: number | null;
  contributing: ContributionProcessFilter | null;
}>;

export const EMPTY_CONTRIBUTION_FILTERS: ContributionFilters = Object.freeze({
  unassigned: null,
  unlocked: null,
  goodFirstIssue: null,
  helpWanted: null,
  language: null,
  updatedWithinDays: null,
  contributing: null,
});

export type ContributionSignalId =
  | 'entry.good_first_issue_label'
  | 'entry.help_wanted_label'
  | 'process.contributing_present'
  | 'process.code_of_conduct_present'
  | 'process.issue_template_present'
  | 'process.pull_request_template_present'
  | 'availability.open'
  | 'availability.unassigned'
  | 'availability.unlocked'
  | 'activity.issue_age_days'
  | 'activity.days_since_update'
  | 'discussion.comment_count';

export type ContributionSignal =
  | Readonly<{
      id: ContributionSignalId;
      availability: 'available';
      value: number | boolean;
    }>
  | Readonly<{
      id: ContributionSignalId;
      availability: 'missing';
      reason: 'not_collected' | 'not_applicable';
    }>;

export type ContributionEvidenceCode =
  | 'issue_open' | 'issue_unassigned' | 'discussion_unlocked'
  | 'good_first_issue_hint' | 'help_wanted_hint'
  | 'recently_updated' | 'contributing_guidance_present';

export type ContributionCautionCode =
  | 'issue_closed' | 'issue_assigned' | 'discussion_locked' | 'no_entry_hint'
  | 'stale_update' | 'contributing_guidance_absent'
  | 'contributing_evidence_missing' | 'contributing_not_applicable';

export type ContributionLimitationCode =
  | 'issue_complexity_not_measured'
  | 'maintainer_responsiveness_not_measured'
  | 'linked_pr_outcomes_not_measured'
  | 'external_contributor_success_not_measured'
  | 'required_domain_expertise_not_measured';

export type ContributionExplanation<TCode extends string> = Readonly<{
  code: TCode;
  signalIds: ContributionSignalId[];
  message: string;
}>;

export type ContributionDiscoveryItem = Readonly<{
  repository: Readonly<{
    id: string;
    fullName: string;
    githubUrl: string;
    primaryLanguage: string | null;
  }>;
  issue: Readonly<{
    githubIssueId: string;
    number: number;
    title: string;
    githubUrl: string;
    state: 'open';
    locked: boolean;
    assigneeCount: number;
    commentCount: number;
    labels: string[];
    createdAtGithub: string;
    updatedAtGithub: string;
    observedAt: string;
  }>;
  evidence: Readonly<{
    normalizedLabels: string[];
    signals: Readonly<Record<ContributionSignalId, ContributionSignal>>;
  }>;
  recommendation: Readonly<{
    contractVersion: 'contribution-recommendation-v1';
    status: 'consider' | 'needs_review';
    evidence: ContributionExplanation<ContributionEvidenceCode>[];
    cautions: ContributionExplanation<ContributionCautionCode>[];
    limitations: ContributionLimitationCode[];
  }>;
}>;

export type ContributionDiscoveryPage = Readonly<{
  data: ContributionDiscoveryItem[];
  discovery: Readonly<{
    contractVersion: 'contribution-signals-v1';
    evaluatedAt: string;
    state: 'open';
    filters: ContributionFilters;
  }>;
  pagination: Readonly<{
    limit: number;
    nextCursor: string | null;
  }>;
}>;

export class ContributionDiscoveryError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly code: string | null,
  ) {
    super(message);
    this.name = 'ContributionDiscoveryError';
  }
}

const SIGNAL_IDS: readonly ContributionSignalId[] = [
  'entry.good_first_issue_label',
  'entry.help_wanted_label',
  'process.contributing_present',
  'process.code_of_conduct_present',
  'process.issue_template_present',
  'process.pull_request_template_present',
  'availability.open',
  'availability.unassigned',
  'availability.unlocked',
  'activity.issue_age_days',
  'activity.days_since_update',
  'discussion.comment_count',
];

const NUMERIC_SIGNALS: readonly string[] = [
  'activity.issue_age_days',
  'activity.days_since_update',
  'discussion.comment_count',
];

const EVIDENCE_CODES: readonly ContributionEvidenceCode[] = [
  'issue_open', 'issue_unassigned', 'discussion_unlocked',
  'good_first_issue_hint', 'help_wanted_hint', 'recently_updated',
  'contributing_guidance_present',
];

const CAUTION_CODES: readonly ContributionCautionCode[] = [
  'issue_closed', 'issue_assigned', 'discussion_locked', 'no_entry_hint',
  'stale_update', 'contributing_guidance_absent', 'contributing_evidence_missing',
  'contributing_not_applicable',
];

const LIMITATION_CODES: readonly ContributionLimitationCode[] = [
  'issue_complexity_not_measured',
  'maintainer_responsiveness_not_measured',
  'linked_pr_outcomes_not_measured',
  'external_contributor_success_not_measured',
  'required_domain_expertise_not_measured',
];

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function date(value: unknown): value is string {
  return text(value) && Number.isFinite(Date.parse(value));
}

function booleanOrNull(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean';
}

function processFilter(value: unknown): value is ContributionProcessFilter | null {
  return value === null || value === 'present' || value === 'absent' ||
    value === 'missing' || value === 'not_applicable';
}

function isFilters(value: unknown): value is ContributionFilters {
  if (!record(value)) return false;
  return booleanOrNull(value.unassigned) && booleanOrNull(value.unlocked) &&
    booleanOrNull(value.goodFirstIssue) && booleanOrNull(value.helpWanted) &&
    (value.language === null || (text(value.language) && value.language.length <= 64)) &&
    (value.updatedWithinDays === null ||
      (count(value.updatedWithinDays) && value.updatedWithinDays >= 1 &&
       value.updatedWithinDays <= 3650)) &&
    processFilter(value.contributing);
}

function sameFilters(a: ContributionFilters, b: ContributionFilters): boolean {
  return a.unassigned === b.unassigned &&
    a.unlocked === b.unlocked &&
    a.goodFirstIssue === b.goodFirstIssue &&
    a.helpWanted === b.helpWanted &&
    a.language === b.language &&
    a.updatedWithinDays === b.updatedWithinDays &&
    a.contributing === b.contributing;
}

export function normalizeContributionFilters(
  filters: Partial<ContributionFilters> = {},
): ContributionFilters {
  const language = filters.language?.trim().replace(/\s+/g, ' ').toLowerCase() ?? null;
  const result: ContributionFilters = {
    unassigned: filters.unassigned ?? null,
    unlocked: filters.unlocked ?? null,
    goodFirstIssue: filters.goodFirstIssue ?? null,
    helpWanted: filters.helpWanted ?? null,
    language,
    updatedWithinDays: filters.updatedWithinDays ?? null,
    contributing: filters.contributing ?? null,
  };
  if (!isFilters(result) || (language !== null && !/[\p{L}\p{N}]/u.test(language))) {
    throw new ContributionDiscoveryError(
      'Contribution filters are invalid.',
      null,
      'invalid_contribution_filter',
    );
  }
  return result;
}

function isSignal(value: unknown, key: ContributionSignalId): value is ContributionSignal {
  if (!record(value) || value.id !== key) return false;
  if (value.availability === 'missing') {
    return value.reason === 'not_collected' || value.reason === 'not_applicable';
  }
  if (value.availability !== 'available') return false;
  return NUMERIC_SIGNALS.includes(key)
    ? count(value.value)
    : typeof value.value === 'boolean';
}

function isExplanation<TCode extends string>(
  value: unknown,
  acceptedCodes: readonly TCode[],
): value is ContributionExplanation<TCode> {
  return record(value) && acceptedCodes.includes(value.code as TCode) &&
    text(value.message) && Array.isArray(value.signalIds) &&
    value.signalIds.length > 0 &&
    value.signalIds.every((id: unknown) =>
      SIGNAL_IDS.includes(id as ContributionSignalId));
}

function isContributionItem(value: unknown): value is ContributionDiscoveryItem {
  if (!record(value) || !record(value.repository) || !record(value.issue) ||
      !record(value.evidence) || !record(value.recommendation)) return false;
  const repo = value.repository;
  const issue = value.issue;
  const evidence = value.evidence;
  const rec = value.recommendation;

  return text(repo.id) && text(repo.fullName) && text(repo.githubUrl) &&
    (repo.primaryLanguage === null || text(repo.primaryLanguage)) &&
    text(issue.githubIssueId) && count(issue.number) && issue.number >= 1 &&
    text(issue.title) && text(issue.githubUrl) && issue.state === 'open' &&
    typeof issue.locked === 'boolean' && count(issue.assigneeCount) &&
    count(issue.commentCount) &&
    Array.isArray(issue.labels) && issue.labels.every(text) &&
    date(issue.createdAtGithub) && date(issue.updatedAtGithub) &&
    date(issue.observedAt) &&
    Array.isArray(evidence.normalizedLabels) && evidence.normalizedLabels.every(text) &&
    record(evidence.signals) &&
    SIGNAL_IDS.every((id) => isSignal((evidence.signals as Record<string, unknown>)[id], id)) &&
    rec.contractVersion === 'contribution-recommendation-v1' &&
    (rec.status === 'consider' || rec.status === 'needs_review') &&
    Array.isArray(rec.evidence) &&
    rec.evidence.every((value: unknown) => isExplanation(value, EVIDENCE_CODES)) &&
    Array.isArray(rec.cautions) &&
    rec.cautions.every((value: unknown) => isExplanation(value, CAUTION_CODES)) &&
    Array.isArray(rec.limitations) &&
    rec.limitations.every((value: unknown) =>
      LIMITATION_CODES.includes(value as ContributionLimitationCode));
}

function invalidResponse(): ContributionDiscoveryError {
  return new ContributionDiscoveryError(
    'RepoScout returned an invalid contribution discovery response.',
    null,
    'invalid_response',
  );
}

function parsePage(value: unknown, expectedFilters: ContributionFilters): ContributionDiscoveryPage {
  if (!record(value) || !record(value.discovery) || !record(value.pagination)) {
    throw invalidResponse();
  }
  const discovery = value.discovery;
  const pagination = value.pagination;
  if (discovery.contractVersion !== 'contribution-signals-v1' ||
      discovery.state !== 'open' ||
      !date(discovery.evaluatedAt) ||
      !isFilters(discovery.filters) || !sameFilters(discovery.filters, expectedFilters) ||
      !count(pagination.limit) || pagination.limit < 1 || pagination.limit > 50 ||
      !(pagination.nextCursor === null || text(pagination.nextCursor)) ||
      !Array.isArray(value.data) || value.data.length > pagination.limit ||
      !value.data.every(isContributionItem)) {
    throw invalidResponse();
  }
  return value as unknown as ContributionDiscoveryPage;
}

export async function fetchContributionDiscoveryPage(input: Readonly<{
  filters?: Partial<ContributionFilters>;
  limit?: number;
  cursor?: string | null;
  signal?: AbortSignal;
  fetchImplementation?: typeof fetch;
}> = {}): Promise<ContributionDiscoveryPage> {
  const filters = normalizeContributionFilters(input.filters);
  if (input.limit !== undefined &&
      (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 50)) {
    throw new ContributionDiscoveryError(
      'Contribution page size must be between 1 and 50.',
      null,
      'invalid_pagination',
    );
  }

  const params = new URLSearchParams();
  for (const key of ['unassigned', 'unlocked', 'goodFirstIssue', 'helpWanted'] as const) {
    if (filters[key] !== null) params.set(key, String(filters[key]));
  }
  if (filters.language !== null) params.set('language', filters.language);
  if (filters.updatedWithinDays !== null) {
    params.set('updatedWithinDays', String(filters.updatedWithinDays));
  }
  if (filters.contributing !== null) params.set('contributing', filters.contributing);
  if (input.limit !== undefined) params.set('limit', String(input.limit));
  if (input.cursor) params.set('cursor', input.cursor);

  const query = params.toString();
  let response: Response;
  try {
    response = await (input.fetchImplementation ?? fetch)(
      '/api/contributions/issues' + (query ? '?' + query : ''),
      {
        method: 'GET',
        headers: { accept: 'application/json' },
        ...(input.signal ? { signal: input.signal } : {}),
      },
    );
  } catch (error) {
    if (input.signal?.aborted) throw error;
    throw new ContributionDiscoveryError(
      'Unable to load contribution issues right now.',
      null,
      'network_error',
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure: Record<string, unknown> = record(body) ? body : {};
    throw new ContributionDiscoveryError(
      typeof failure.message === 'string'
        ? failure.message
        : 'Unable to load contribution issues right now.',
      response.status,
      typeof failure.error === 'string' ? failure.error : null,
    );
  }

  return parsePage(body, filters);
}
