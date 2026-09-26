import { describe, expect, it } from 'vitest';

import type { RepositoryTrendResult } from './repository-trend.js';
import {
  buildRepositoryRankingSignalSnapshot,
  REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION,
  REPOSITORY_RANKING_MODE_CONTRACTS,
  REPOSITORY_RANKING_SIGNAL_DEFINITIONS,
} from './repository-ranking-signals.js';

const repository = {
  id: '11111111-1111-4111-8111-111111111111',
  pushedAtGithub: new Date('2026-09-20T12:00:00Z'),
};

function completeTrend(
  windowDays: 7 | 30,
  actualWindowDays: number = windowDays,
): RepositoryTrendResult {
  const baselineOn =
    windowDays === 7 ? '2026-09-19' : '2026-08-27';

  return {
    status: 'complete',
    repositoryId: repository.id,
    requestedWindowDays: windowDays,
    cutoffOn: baselineOn,
    actualWindowDays,
    baseline: {
      capturedOn: baselineOn,
      capturedAt: new Date(`${baselineOn}T08:00:00Z`),
      stars: 100,
      forks: 10,
      openIssues: 8,
    },
    latest: {
      capturedOn: '2026-09-26',
      capturedAt: new Date('2026-09-26T08:00:00Z'),
      stars: 130,
      forks: 14,
      openIssues: 6,
    },
    delta: {
      stars: 30,
      forks: 4,
      openIssues: -2,
    },
  };
}

function baseInput() {
  return {
    evaluatedAt: new Date('2026-09-26T12:00:00Z'),
    repository,
    metadata: {
      stars: 130,
      forks: 14,
    },
    readme: {
      status: 'PRESENT' as const,
    },
    contributionEvidence: {
      status: 'OBSERVED' as const,
      contributing: {
        apiUrl: 'https://api.github.com/example/contributing',
        htmlUrl: 'https://github.com/example/contributing',
      },
      codeOfConduct: null,
      issueTemplate: {
        apiUrl: 'https://api.github.com/example/issues',
        htmlUrl: 'https://github.com/example/issues',
      },
      pullRequestTemplate: null,
      securityPolicy: null,
    },
    trend7d: completeTrend(7, 8),
    trend30d: completeTrend(30, 30),
  };
}

describe('repository ranking signal contract', () => {
  it('uses a versioned unique signal definition catalog', () => {
    expect(REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION).toBe(
      'ranking-signals-v1',
    );

    const ids = REPOSITORY_RANKING_SIGNAL_DEFINITIONS.map(
      (definition) => definition.id,
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(
      REPOSITORY_RANKING_SIGNAL_DEFINITIONS.every(
        (definition) => definition.modes.length > 0,
      ),
    ).toBe(true);
  });

  it('collects measured and derived signals without producing a score', () => {
    const snapshot = buildRepositoryRankingSignalSnapshot(baseInput());

    expect(snapshot.contractVersion).toBe('ranking-signals-v1');
    expect(snapshot.repositoryId).toBe(repository.id);
    expect(snapshot).not.toHaveProperty('score');

    expect(snapshot.signals['visibility.stars_total']).toEqual({
      id: 'visibility.stars_total',
      availability: 'available',
      value: 130,
      provenance: null,
    });
    expect(snapshot.signals['maintenance.days_since_push']).toEqual({
      id: 'maintenance.days_since_push',
      availability: 'available',
      value: 6,
      provenance: null,
    });
    expect(snapshot.signals['community.contributing_present']).toEqual({
      id: 'community.contributing_present',
      availability: 'available',
      value: true,
      provenance: null,
    });
    expect(snapshot.signals['community.code_of_conduct_present']).toEqual({
      id: 'community.code_of_conduct_present',
      availability: 'available',
      value: false,
      provenance: null,
    });
  });

  it('preserves trend provenance when sparse history overshoots a requested window', () => {
    const snapshot = buildRepositoryRankingSignalSnapshot(baseInput());

    expect(snapshot.signals['momentum.stars_delta_7d']).toEqual({
      id: 'momentum.stars_delta_7d',
      availability: 'available',
      value: 30,
      provenance: {
        requestedWindowDays: 7,
        actualWindowDays: 8,
        baselineCapturedOn: '2026-09-19',
        latestCapturedOn: '2026-09-26',
      },
    });
  });

  it('preserves zero values instead of treating them as missing', () => {
    const snapshot = buildRepositoryRankingSignalSnapshot({
      ...baseInput(),
      metadata: {
        stars: 0,
        forks: 0,
      },
    });

    expect(snapshot.signals['visibility.stars_total']).toEqual(
      expect.objectContaining({
        availability: 'available',
        value: 0,
      }),
    );
    expect(snapshot.signals['visibility.forks_total']).toEqual(
      expect.objectContaining({
        availability: 'available',
        value: 0,
      }),
    );
  });

  it('represents missing current metadata and evidence explicitly', () => {
    const snapshot = buildRepositoryRankingSignalSnapshot({
      ...baseInput(),
      metadata: null,
      readme: null,
      contributionEvidence: null,
    });

    expect(snapshot.signals['visibility.stars_total']).toEqual({
      id: 'visibility.stars_total',
      availability: 'missing',
      reason: 'not_collected',
      provenance: null,
    });
    expect(snapshot.signals['documentation.readme_present']).toEqual({
      id: 'documentation.readme_present',
      availability: 'missing',
      reason: 'not_collected',
      provenance: null,
    });
    expect(snapshot.signals['community.contributing_present']).toEqual({
      id: 'community.contributing_present',
      availability: 'missing',
      reason: 'not_collected',
      provenance: null,
    });
  });

  it('treats a too-large README as present evidence', () => {
    const snapshot = buildRepositoryRankingSignalSnapshot({
      ...baseInput(),
      readme: {
        status: 'TOO_LARGE',
      },
    });

    expect(snapshot.signals['documentation.readme_present']).toEqual(
      expect.objectContaining({
        availability: 'available',
        value: true,
      }),
    );
  });

  it('marks unsupported fork community evidence as not applicable', () => {
    const snapshot = buildRepositoryRankingSignalSnapshot({
      ...baseInput(),
      contributionEvidence: {
        status: 'UNSUPPORTED_FORK',
        contributing: null,
        codeOfConduct: null,
        issueTemplate: null,
        pullRequestTemplate: null,
        securityPolicy: null,
      },
    });

    expect(snapshot.signals['community.contributing_present']).toEqual({
      id: 'community.contributing_present',
      availability: 'missing',
      reason: 'not_applicable',
      provenance: null,
    });
  });

  it('marks incomplete history as insufficient rather than zero momentum', () => {
    const snapshot = buildRepositoryRankingSignalSnapshot({
      ...baseInput(),
      trend30d: {
        status: 'insufficient_history',
        reason: 'window_not_covered',
        repositoryId: repository.id,
        requestedWindowDays: 30,
        cutoffOn: '2026-08-27',
        availableWindowDays: 12,
        oldestAvailable: null,
        latest: null,
      },
    });

    expect(snapshot.signals['momentum.stars_delta_30d']).toEqual({
      id: 'momentum.stars_delta_30d',
      availability: 'missing',
      reason: 'insufficient_history',
      provenance: null,
    });
    expect(snapshot.signals['context.open_issues_delta_30d']).toEqual({
      id: 'context.open_issues_delta_30d',
      availability: 'missing',
      reason: 'insufficient_history',
      provenance: null,
    });
  });

  it('does not reinterpret open issue direction as a quality judgment', () => {
    const definition = REPOSITORY_RANKING_SIGNAL_DEFINITIONS.find(
      (item) => item.id === 'context.open_issues_delta_30d',
    );

    expect(definition?.role).toBe('context');
    expect(definition?.description).toContain(
      'direction is not inherently good or bad',
    );
  });

  it('rejects a mismatched historical window instead of silently relabeling it', () => {
    expect(() =>
      buildRepositoryRankingSignalSnapshot({
        ...baseInput(),
        trend7d: completeTrend(30),
      }),
    ).toThrow(
      'momentum.stars_delta_7d requires a 7-day trend result.',
    );
  });

  it('marks missing push timestamp as unavailable maintenance evidence', () => {
    const snapshot = buildRepositoryRankingSignalSnapshot({
      ...baseInput(),
      repository: {
        ...repository,
        pushedAtGithub: null,
      },
    });

    expect(snapshot.signals['maintenance.days_since_push']).toEqual({
      id: 'maintenance.days_since_push',
      availability: 'missing',
      reason: 'unavailable',
      provenance: null,
    });
  });
  it('keeps Hidden Gems and Rising signal roles distinct', () => {
    expect(REPOSITORY_RANKING_MODE_CONTRACTS.hidden_gems).toEqual(
      expect.objectContaining({
        mode: 'hidden_gems',
        contractVersion: 'hidden-gems-signals-v1',
      }),
    );
    expect(
      REPOSITORY_RANKING_MODE_CONTRACTS.hidden_gems.primarySignals,
    ).toContain('documentation.readme_present');
    expect(
      REPOSITORY_RANKING_MODE_CONTRACTS.hidden_gems.primarySignals,
    ).not.toContain('momentum.stars_delta_7d');

    expect(REPOSITORY_RANKING_MODE_CONTRACTS.rising).toEqual(
      expect.objectContaining({
        mode: 'rising',
        contractVersion: 'rising-signals-v1',
      }),
    );
    expect(
      REPOSITORY_RANKING_MODE_CONTRACTS.rising.primarySignals,
    ).toEqual([
      'momentum.stars_delta_7d',
      'momentum.stars_delta_30d',
      'momentum.forks_delta_30d',
    ]);
    expect(
      REPOSITORY_RANKING_MODE_CONTRACTS.rising.primarySignals,
    ).not.toContain('visibility.stars_total');
  });

  it('references only catalogued signals from every mode contract', () => {
    const knownSignals = new Set(
      REPOSITORY_RANKING_SIGNAL_DEFINITIONS.map(
        (definition) => definition.id,
      ),
    );

    for (const contract of Object.values(
      REPOSITORY_RANKING_MODE_CONTRACTS,
    )) {
      for (const signalId of [
        ...contract.primarySignals,
        ...contract.supportingSignals,
        ...contract.contextSignals,
      ]) {
        expect(knownSignals.has(signalId)).toBe(true);
      }
    }
  });

});
