import { describe, expect, it, vi } from 'vitest';

import {
  ContributionDiscoveryError,
  EMPTY_CONTRIBUTION_FILTERS,
  fetchContributionDiscoveryPage,
  normalizeContributionFilters,
} from './contribution-discovery-client.js';

const evaluatedAt = '2026-09-26T12:00:00.000Z';

function signals() {
  return Object.fromEntries([
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
  ].map((id) => [id, {
    id,
    availability: 'available',
    value: id === 'activity.issue_age_days' ? 21
      : id === 'activity.days_since_update' ? 2
      : id === 'discussion.comment_count' ? 4
      : true,
  }]));
}

function issueItem() {
  return {
    repository: {
      id: '11111111-1111-4111-8111-111111111111',
      fullName: 'sample/public-repository',
      githubUrl: 'https://github.com/sample/public-repository',
      primaryLanguage: 'TypeScript',
    },
    issue: {
      githubIssueId: '112233445566',
      number: 42,
      title: 'Add keyboard navigation',
      githubUrl: 'https://github.com/sample/public-repository/issues/42',
      state: 'open',
      locked: false,
      assigneeCount: 0,
      commentCount: 4,
      labels: ['good first issue', 'help wanted'],
      createdAtGithub: '2026-09-05T12:00:00.000Z',
      updatedAtGithub: '2026-09-24T12:00:00.000Z',
      observedAt: evaluatedAt,
    },
    evidence: {
      normalizedLabels: ['good first issue', 'help wanted'],
      signals: signals(),
    },
    recommendation: {
      contractVersion: 'contribution-recommendation-v1',
      status: 'consider',
      evidence: [{
        code: 'good_first_issue_hint',
        signalIds: ['entry.good_first_issue_label'],
        message: 'The observed issue has an entry label hint.',
      }],
      cautions: [{
        code: 'contributing_evidence_missing',
        signalIds: ['process.contributing_present'],
        message: 'Contribution evidence has not yet been collected.',
      }],
      limitations: ['issue_complexity_not_measured'],
    },
  };
}

function makePage(filters: unknown = EMPTY_CONTRIBUTION_FILTERS) {
  return {
    data: [issueItem()],
    discovery: {
      contractVersion: 'contribution-signals-v1',
      evaluatedAt,
      state: 'open',
      filters,
    },
    pagination: {
      limit: 1,
      nextCursor: 'opaque + scope',
    },
  };
}

function respond(payload: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(payload), { status }),
  );
}

describe('contribution discovery frontend client B1', () => {
  it('loads open issues and preserves explanation evidence', async () => {
    const fetchImplementation = respond(makePage());
    const page = await fetchContributionDiscoveryPage({ fetchImplementation });

    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/contributions/issues',
      { method: 'GET', headers: { accept: 'application/json' } },
    );
    expect(page.discovery.state).toBe('open');
    expect(page.discovery.contractVersion).toBe('contribution-signals-v1');
    expect(page.data[0]?.issue.githubUrl).toBe(
      'https://github.com/sample/public-repository/issues/42',
    );
    expect(page.data[0]?.recommendation.status).toBe('consider');
    expect(page.data[0]?.recommendation.evidence[0]?.code).toBe('good_first_issue_hint');
    expect(page.pagination.nextCursor).toBe('opaque + scope');
  });

  it('normalizes filters and encodes an opaque cursor without changing its contents', async () => {
    const filters = normalizeContributionFilters({
      unassigned: true,
      unlocked: false,
      goodFirstIssue: true,
      helpWanted: false,
      language: ' TypeScript  ',
      updatedWithinDays: 30,
      contributing: 'missing',
    });
    const fetchImplementation = respond(makePage(filters));
    const page = await fetchContributionDiscoveryPage({
      filters,
      limit: 1,
      cursor: 'opaque + scope',
      fetchImplementation,
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/contributions/issues?unassigned=true&unlocked=false&goodFirstIssue=true&helpWanted=false&language=typescript&updatedWithinDays=30&contributing=missing&limit=1&cursor=opaque+%2B+scope',
      { method: 'GET', headers: { accept: 'application/json' } },
    );
    expect(page.discovery.filters).toEqual(filters);
  });

  it('supports legitimate no-result open issue discovery', async () => {
    const body = makePage();
    const page = await fetchContributionDiscoveryPage({
      fetchImplementation: respond({
        ...body,
        data: [],
        pagination: { limit: 20, nextCursor: null },
      }),
    });
    expect(page.data).toEqual([]);
    expect(page.pagination.nextCursor).toBeNull();
  });

  it('accepts missing source evidence instead of inventing contributor guidance', async () => {
    const item = issueItem();
    item.evidence.signals['process.contributing_present'] = {
      id: 'process.contributing_present',
      availability: 'missing',
      reason: 'not_collected',
    } as never;
    item.recommendation.status = 'needs_review';
    const page = await fetchContributionDiscoveryPage({
      fetchImplementation: respond({ ...makePage(), data: [item] }),
    });
    expect(
      page.data[0]?.evidence.signals['process.contributing_present'].availability,
    ).toBe('missing');
    expect(page.data[0]?.recommendation.status).toBe('needs_review');
  });

  it('passes an AbortSignal to the fetch implementation', async () => {
    const controller = new AbortController();
    const transport = respond(makePage());
    await fetchContributionDiscoveryPage({
      signal: controller.signal,
      fetchImplementation: transport,
    });
    expect(transport.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it.each([
    [{ language: ' ' }, 'invalid_contribution_filter'],
    [{ updatedWithinDays: 0 }, 'invalid_contribution_filter'],
    [{ updatedWithinDays: 3651 }, 'invalid_contribution_filter'],
    [{ contributing: 'unknown' }, 'invalid_contribution_filter'],
  ] as const)('rejects a malformed filter before the API request', async (filters, code) => {
    const fetchImplementation = respond(makePage());
    await expect(fetchContributionDiscoveryPage({
      filters: filters as never,
      fetchImplementation,
    })).rejects.toMatchObject({ code, status: null });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range page size before calling the API', async () => {
    const fetchImplementation = respond(makePage());
    await expect(fetchContributionDiscoveryPage({
      limit: 51, fetchImplementation,
    })).rejects.toMatchObject({ code: 'invalid_pagination', status: null });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('preserves filter-scoped API cursor errors', async () => {
    await expect(fetchContributionDiscoveryPage({
      fetchImplementation: respond({
        error: 'invalid_pagination',
        message: 'cursor is invalid.',
      }, 400),
    })).rejects.toMatchObject({
      name: 'ContributionDiscoveryError',
      status: 400,
      code: 'invalid_pagination',
      message: 'cursor is invalid.',
    });
  });

  it('uses a safe fallback for a non-JSON HTTP failure', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('Service unavailable', { status: 503 }),
    );
    await expect(fetchContributionDiscoveryPage({
      fetchImplementation,
    })).rejects.toMatchObject({
      status: 503,
      code: null,
      message: 'Unable to load contribution issues right now.',
    });
  });

  it('converts network failures to a stable retryable state', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockRejectedValue(
      new TypeError('Network request failed'),
    );
    await expect(fetchContributionDiscoveryPage({
      fetchImplementation,
    })).rejects.toBeInstanceOf(ContributionDiscoveryError);
    await expect(fetchContributionDiscoveryPage({
      fetchImplementation,
    })).rejects.toMatchObject({ code: 'network_error', status: null });
  });

  it('does not disguise an intentional abort as a network outage', async () => {
    const controller = new AbortController();
    controller.abort();
    const original = new Error('request aborted');
    const fetchImplementation = vi.fn<typeof fetch>().mockRejectedValue(original);
    await expect(fetchContributionDiscoveryPage({
      signal: controller.signal,
      fetchImplementation,
    })).rejects.toBe(original);
  });

  it.each([
    ['contract mismatch', () => ({
      ...makePage(),
      discovery: { ...makePage().discovery, contractVersion: 'unknown-version' },
    })],
    ['filter echo mismatch', () => ({
      ...makePage(),
      discovery: {
        ...makePage().discovery,
        filters: { ...EMPTY_CONTRIBUTION_FILTERS, unassigned: true },
      },
    })],
    ['closed issue returned by open-only endpoint', () => ({
      ...makePage(),
      data: [{ ...issueItem(), issue: { ...issueItem().issue, state: 'closed' } }],
    })],
    ['malformed observed signal', () => ({
      ...makePage(),
      data: [{
        ...issueItem(),
        evidence: {
          ...issueItem().evidence,
          signals: {
            ...signals(),
            'activity.days_since_update': {
              id: 'activity.days_since_update',
              availability: 'available',
              value: -3,
            },
          },
        },
      }],
    })],
    ['missing recommendation provenance', () => ({
      ...makePage(),
      data: [{
        ...issueItem(),
        recommendation: {
          ...issueItem().recommendation,
          contractVersion: 'unknown-recommendation-v1',
        },
      }],
    })],
    ['invalid cursor', () => ({
      ...makePage(),
      pagination: { limit: 1, nextCursor: 42 },
    })],
  ])('rejects %s in a successful HTTP response', async (_description, makeBadPage) => {
    await expect(fetchContributionDiscoveryPage({
      fetchImplementation: respond(makeBadPage()),
    })).rejects.toMatchObject({
      name: 'ContributionDiscoveryError',
      code: 'invalid_response',
      status: null,
    });
  });
});
