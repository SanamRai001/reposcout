import { describe, expect, it, vi } from 'vitest';

import {
  fetchRepositoryRankingPage,
  RepositoryRankingError,
} from './repository-ranking-client.js';

function repository() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    githubRepositoryId: '123456789',
    owner: 'example',
    name: 'project',
    fullName: 'example/project',
    githubUrl: 'https://github.com/example/project',
    defaultBranch: 'main',
    description: 'A sample open source repository.',
    isArchived: false,
    isFork: false,
    createdAtGithub: '2025-01-01T00:00:00.000Z',
    updatedAtGithub: '2026-09-26T00:00:00.000Z',
    pushedAtGithub: '2026-09-26T00:00:00.000Z',
    lastSyncedAt: '2026-09-26T08:00:00.000Z',
    createdAt: '2026-09-26T08:00:00.000Z',
    updatedAt: '2026-09-26T08:00:00.000Z',
    metadata: {
      stars: 125,
      forks: 12,
      openIssues: 3,
      primaryLanguage: 'TypeScript',
      licenseSpdx: 'MIT',
      topics: ['backend'],
      observedAt: '2026-09-26T08:00:00.000Z',
    },
  };
}

function component(id: string, normalizedDelta?: number | null) {
  return {
    id,
    points: 10,
    maxPoints: 20,
    signalIds: ['maintenance.days_since_push'],
    ...(normalizedDelta !== undefined ? { normalizedDelta } : {}),
  };
}

const provenance7d = {
  requestedWindowDays: 7,
  actualWindowDays: 7,
  baselineCapturedOn: '2026-09-19',
  latestCapturedOn: '2026-09-26',
};

const provenance30d = {
  requestedWindowDays: 30,
  actualWindowDays: 30,
  baselineCapturedOn: '2026-08-27',
  latestCapturedOn: '2026-09-26',
};

function hiddenItem() {
  return {
    repository: repository(),
    ranking: {
      mode: 'hidden_gems',
      formulaVersion: 'hidden-gem-v1',
      score: 65,
      explanation: {
        components: [component('maintenance')],
        positivePoints: 68,
        popularityPenalty: {
          id: 'popularity_saturation',
          points: 3,
          maxPoints: 25,
          stars: 125,
          freeStars: 250,
          saturationStars: 50000,
        },
        optionalMomentumCoverage: {
          available: 1,
          expected: 2,
          missingSignalIds: ['momentum.forks_delta_30d'],
        },
      },
    },
  };
}

function risingItem() {
  return {
    repository: repository(),
    ranking: {
      mode: 'rising',
      formulaVersion: 'rising-v1',
      score: 42,
      explanation: {
        components: [component('stars_7d_momentum', 8)],
        historyCoverage: {
          stars7d: provenance7d,
          stars30d: provenance30d,
          forks30d: provenance30d,
        },
        visibilityContext: {
          stars: {
            id: 'visibility.stars_total',
            availability: 'available',
            value: 125,
            provenance: null,
          },
          forks: {
            id: 'visibility.forks_total',
            availability: 'available',
            value: 12,
            provenance: null,
          },
        },
        maintenanceCoverage: {
          availability: 'available',
          daysSincePush: 0,
        },
      },
    },
  };
}

function rankingPage(mode: 'hidden_gems' | 'rising') {
  return {
    data: [mode === 'hidden_gems' ? hiddenItem() : risingItem()],
    ranking: {
      mode,
      formulaVersion: mode === 'hidden_gems' ? 'hidden-gem-v1' : 'rising-v1',
      evaluatedAt: '2026-09-26T12:00:00.000Z',
      evaluatedCount: 3,
      eligibleCount: 2,
    },
    pagination: {
      limit: 1,
      nextCursor: 'opaque ranking + cursor',
    },
  };
}

function respond(body: unknown, status = 200): typeof fetch {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
}

describe('ranking API client', () => {
  it.each([
    ['hidden_gems', 'hidden-gem-v1'],
    ['rising', 'rising-v1'],
  ] as const)('reads the typed %s ranking evidence', async (mode, formula) => {
    const fetchImplementation = respond(rankingPage(mode));
    const page = await fetchRepositoryRankingPage({
      mode,
      limit: 1,
      cursor: 'cursor + unsafe',
      fetchImplementation,
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      `/api/repositories/rankings/${mode}?limit=1&cursor=cursor+%2B+unsafe`,
      {
        method: 'GET',
        headers: { accept: 'application/json' },
      },
    );
    expect(page.ranking.formulaVersion).toBe(formula);
    expect(page.ranking.evaluatedAt).toBe('2026-09-26T12:00:00.000Z');
    expect(page.data[0]?.repository.fullName).toBe('example/project');
    expect(page.data[0]?.ranking.score).toBeGreaterThan(0);
    expect(page.pagination.nextCursor).toBe('opaque ranking + cursor');
  });

  it('exposes distinct Hidden Gems evidence', async () => {
    const page = await fetchRepositoryRankingPage({
      mode: 'hidden_gems',
      fetchImplementation: respond(rankingPage('hidden_gems')),
    });
    const ranking = page.data[0]?.ranking;
    if (ranking?.mode !== 'hidden_gems') throw new Error('Expected hidden gem.');
    expect(ranking.explanation.popularityPenalty.points).toBe(3);
    expect(ranking.explanation.optionalMomentumCoverage.missingSignalIds).toEqual([
      'momentum.forks_delta_30d',
    ]);
  });

  it('exposes Rising history and measured visibility context', async () => {
    const page = await fetchRepositoryRankingPage({
      mode: 'rising',
      fetchImplementation: respond(rankingPage('rising')),
    });
    const ranking = page.data[0]?.ranking;
    if (ranking?.mode !== 'rising') throw new Error('Expected rising.');
    expect(ranking.explanation.historyCoverage.stars7d.actualWindowDays).toBe(7);
    expect(ranking.explanation.visibilityContext.stars).toEqual(
      expect.objectContaining({ availability: 'available', value: 125 }),
    );
  });

  it('supports a valid empty ranking page', async () => {
    const body = rankingPage('rising');
    const page = await fetchRepositoryRankingPage({
      mode: 'rising',
      fetchImplementation: respond({
        ...body,
        data: [],
        ranking: { ...body.ranking, eligibleCount: 0 },
        pagination: { limit: 20, nextCursor: null },
      }),
    });
    expect(page.data).toEqual([]);
    expect(page.pagination.nextCursor).toBeNull();
  });

  it('passes an AbortSignal without changing the request', async () => {
    const controller = new AbortController();
    const fetchImplementation = respond(rankingPage('hidden_gems'));
    await fetchRepositoryRankingPage({
      mode: 'hidden_gems',
      signal: controller.signal,
      fetchImplementation,
    });
    expect(fetchImplementation.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it('rejects an invalid requested page size before making a request', async () => {
    const fetchImplementation = respond(rankingPage('rising'));
    await expect(fetchRepositoryRankingPage({
      mode: 'rising',
      limit: 51,
      fetchImplementation,
    })).rejects.toEqual(expect.objectContaining({
      name: 'RepositoryRankingError',
      code: 'invalid_pagination',
    }));
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('preserves status and code from a stale/cross-mode cursor error', async () => {
    await expect(fetchRepositoryRankingPage({
      mode: 'rising',
      fetchImplementation: respond({
        error: 'invalid_ranking_cursor',
        message: 'ranking cursor is invalid.',
      }, 400),
    })).rejects.toEqual(expect.objectContaining({
      name: 'RepositoryRankingError',
      status: 400,
      code: 'invalid_ranking_cursor',
      message: 'ranking cursor is invalid.',
    }));
  });

  it('uses a safe fallback for a non-JSON provider failure', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('Bad Gateway', { status: 502 }),
    );
    await expect(fetchRepositoryRankingPage({
      mode: 'hidden_gems', fetchImplementation,
    })).rejects.toEqual(expect.objectContaining({
      status: 502,
      code: null,
      message: 'Unable to load rankings right now.',
    }));
  });

  it('preserves a stable network failure state', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    await expect(fetchRepositoryRankingPage({
      mode: 'hidden_gems', fetchImplementation,
    })).rejects.toEqual(expect.objectContaining({
      name: 'RepositoryRankingError',
      status: null,
      code: 'network_error',
    }));
  });

  it('preserves intentional request aborts instead of reporting an API outage', async () => {
    const controller = new AbortController();
    controller.abort();
    const original = new Error('aborted');
    const fetchImplementation = vi.fn<typeof fetch>().mockRejectedValue(original);
    await expect(fetchRepositoryRankingPage({
      mode: 'rising', signal: controller.signal, fetchImplementation,
    })).rejects.toBe(original);
  });

  it.each([
    ['a mismatched ranking mode', () => ({
      ...rankingPage('hidden_gems'), ranking: rankingPage('rising').ranking,
    })],
    ['a mismatched item mode', () => ({
      ...rankingPage('hidden_gems'), data: [risingItem()],
    })],
    ['a nonnumeric score', () => ({
      ...rankingPage('hidden_gems'),
      data: [{ ...hiddenItem(), ranking: { ...hiddenItem().ranking, score: 'high' } }],
    })],
    ['incomplete explanation evidence', () => ({
      ...rankingPage('hidden_gems'),
      data: [{ ...hiddenItem(), ranking: {
        ...hiddenItem().ranking, explanation: { components: [] },
      } }],
    })],
    ['invalid pagination', () => ({
      ...rankingPage('hidden_gems'), pagination: { limit: 0, nextCursor: null },
    })],
    ['invalid eligible count', () => ({
      ...rankingPage('hidden_gems'),
      ranking: { ...rankingPage('hidden_gems').ranking, eligibleCount: 4 },
    })],
  ])('rejects %s as a malformed successful response', async (_label, makeBody) => {
    await expect(fetchRepositoryRankingPage({
      mode: 'hidden_gems',
      fetchImplementation: respond(makeBody()),
    })).rejects.toBeInstanceOf(RepositoryRankingError);
  });
});
