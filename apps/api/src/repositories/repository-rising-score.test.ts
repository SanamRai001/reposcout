import { describe, expect, it } from 'vitest';

import {
  buildRepositoryRankingSignalSnapshot,
  type BuildRepositoryRankingSignalInput,
  type RepositoryRankingSignalSnapshot,
} from './repository-ranking-signals.js';
import {
  RISING_FORMULA_VERSION,
  RISING_V1_POLICY,
  scoreRisingV1,
} from './repository-rising-score.js';
import type { RepositoryTrendResult } from './repository-trend.js';

const repositoryId = '11111111-1111-4111-8111-111111111111';

function completeTrend(
  windowDays: 7 | 30,
  starsDelta: number,
  forksDelta: number,
  actualWindowDays: number = windowDays,
): RepositoryTrendResult {
  const baselineOn =
    windowDays === 7 ? '2026-09-19' : '2026-08-27';

  return {
    status: 'complete',
    repositoryId,
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
      stars: 100 + starsDelta,
      forks: 10 + forksDelta,
      openIssues: 8,
    },
    delta: {
      stars: starsDelta,
      forks: forksDelta,
      openIssues: 0,
    },
  };
}

function signalInput(
  overrides: Partial<BuildRepositoryRankingSignalInput> = {},
): BuildRepositoryRankingSignalInput {
  return {
    evaluatedAt: new Date('2026-09-26T12:00:00Z'),
    repository: {
      id: repositoryId,
      pushedAtGithub: new Date('2026-09-24T12:00:00Z'),
    },
    metadata: {
      stars: 200,
      forks: 20,
    },
    readme: {
      status: 'PRESENT',
    },
    contributionEvidence: {
      status: 'OBSERVED',
      contributing: null,
      codeOfConduct: null,
      issueTemplate: null,
      pullRequestTemplate: null,
      securityPolicy: null,
    },
    trend7d: completeTrend(7, 25, 3),
    trend30d: completeTrend(30, 100, 15),
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<BuildRepositoryRankingSignalInput> = {},
): RepositoryRankingSignalSnapshot {
  return buildRepositoryRankingSignalSnapshot(signalInput(overrides));
}

function eligibleScore(
  value: ReturnType<typeof scoreRisingV1>,
) {
  expect(value.status).toBe('eligible');

  if (value.status !== 'eligible') {
    throw new Error('Expected eligible rising score.');
  }

  return value;
}

describe('rising-v1', () => {
  it('produces a versioned momentum-first score with explicit components', () => {
    const result = eligibleScore(scoreRisingV1(snapshot()));

    expect(result.formulaVersion).toBe(RISING_FORMULA_VERSION);
    expect(result.signalContractVersion).toBe('ranking-signals-v1');
    expect(result.score).toBe(100);
    expect(result.components.map((component) => component.id)).toEqual([
      'stars_7d_momentum',
      'stars_30d_momentum',
      'forks_30d_momentum',
      'maintenance_support',
    ]);
    expect(
      result.components
        .slice(0, 3)
        .reduce((sum, component) => sum + component.maxPoints, 0),
    ).toBe(95);
  });

  it('requires all primary historical signals', () => {
    const result = scoreRisingV1(
      snapshot({
        trend7d: {
          status: 'insufficient_history',
          reason: 'window_not_covered',
          repositoryId,
          requestedWindowDays: 7,
          cutoffOn: '2026-09-19',
          availableWindowDays: 3,
          oldestAvailable: null,
          latest: null,
        },
      }),
    );

    expect(result.status).toBe('ineligible');

    if (result.status === 'ineligible') {
      expect(result.reasons).toContainEqual({
        code: 'missing_primary_signal',
        signalId: 'momentum.stars_delta_7d',
        reason: 'insufficient_history',
      });
    }
  });

  it('rejects excessively sparse 7-day history instead of treating it as exact', () => {
    const result = scoreRisingV1(
      snapshot({
        trend7d: completeTrend(7, 40, 4, 10),
      }),
    );

    expect(result.status).toBe('ineligible');

    if (result.status === 'ineligible') {
      expect(result.reasons).toContainEqual({
        code: 'history_window_too_sparse',
        signalId: 'momentum.stars_delta_7d',
        requestedWindowDays: 7,
        actualWindowDays: 10,
        maxActualWindowDays: 9,
      });
    }
  });

  it('rejects excessively sparse 30-day history for both 30-day primary signals', () => {
    const result = scoreRisingV1(
      snapshot({
        trend30d: completeTrend(30, 150, 20, 36),
      }),
    );

    expect(result.status).toBe('ineligible');

    if (result.status === 'ineligible') {
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          {
            code: 'history_window_too_sparse',
            signalId: 'momentum.stars_delta_30d',
            requestedWindowDays: 30,
            actualWindowDays: 36,
            maxActualWindowDays: 35,
          },
          {
            code: 'history_window_too_sparse',
            signalId: 'momentum.forks_delta_30d',
            requestedWindowDays: 30,
            actualWindowDays: 36,
            maxActualWindowDays: 35,
          },
        ]),
      );
    }
  });

  it('normalizes allowed sparse history back to the requested window', () => {
    const result = eligibleScore(
      scoreRisingV1(
        snapshot({
          trend7d: completeTrend(7, 27, 3, 9),
          trend30d: completeTrend(30, 105, 18, 35),
        }),
      ),
    );

    const stars7d = result.components.find(
      (component) => component.id === 'stars_7d_momentum',
    );
    const stars30d = result.components.find(
      (component) => component.id === 'stars_30d_momentum',
    );
    const forks30d = result.components.find(
      (component) => component.id === 'forks_30d_momentum',
    );

    expect(stars7d?.normalizedDelta).toBe(21);
    expect(stars30d?.normalizedDelta).toBe(90);
    expect(forks30d?.normalizedDelta).toBe(15.43);
    expect(result.historyCoverage.stars7d.actualWindowDays).toBe(9);
    expect(result.historyCoverage.stars30d.actualWindowDays).toBe(35);
  });

  it('does not award points for lifetime popularity', () => {
    const small = eligibleScore(
      scoreRisingV1(
        snapshot({
          metadata: {
            stars: 10,
            forks: 1,
          },
        }),
      ),
    );
    const huge = eligibleScore(
      scoreRisingV1(
        snapshot({
          metadata: {
            stars: 1_000_000,
            forks: 100_000,
          },
        }),
      ),
    );

    expect(huge.score).toBe(small.score);
    expect(huge.components).toEqual(small.components);
    expect(huge.visibilityContext.stars).not.toEqual(
      small.visibilityContext.stars,
    );
  });

  it('gives zero momentum points to zero or negative growth', () => {
    const result = eligibleScore(
      scoreRisingV1(
        snapshot({
          trend7d: completeTrend(7, -2, 0),
          trend30d: completeTrend(30, 0, -1),
        }),
      ),
    );

    expect(
      result.components
        .slice(0, 3)
        .every((component) => component.points === 0),
    ).toBe(true);
    expect(result.score).toBe(
      result.components.find(
        (component) => component.id === 'maintenance_support',
      )?.points,
    );
  });

  it('caps each momentum component at its configured maximum', () => {
    const result = eligibleScore(
      scoreRisingV1(
        snapshot({
          trend7d: completeTrend(7, 10_000, 1_000),
          trend30d: completeTrend(30, 100_000, 10_000),
        }),
      ),
    );

    expect(
      result.components.find(
        (component) => component.id === 'stars_7d_momentum',
      )?.points,
    ).toBe(RISING_V1_POLICY.stars7dMaxPoints);
    expect(
      result.components.find(
        (component) => component.id === 'stars_30d_momentum',
      )?.points,
    ).toBe(RISING_V1_POLICY.stars30dMaxPoints);
    expect(
      result.components.find(
        (component) => component.id === 'forks_30d_momentum',
      )?.points,
    ).toBe(RISING_V1_POLICY.forks30dMaxPoints);
  });

  it('keeps maintenance optional and bounded to five points', () => {
    const missingMaintenance = eligibleScore(
      scoreRisingV1(
        snapshot({
          repository: {
            id: repositoryId,
            pushedAtGithub: null,
          },
        }),
      ),
    );
    const freshMaintenance = eligibleScore(scoreRisingV1(snapshot()));

    expect(missingMaintenance.maintenanceCoverage).toEqual({
      availability: 'missing',
      reason: 'unavailable',
    });
    expect(
      missingMaintenance.components.find(
        (component) => component.id === 'maintenance_support',
      )?.points,
    ).toBe(0);
    expect(
      freshMaintenance.components.find(
        (component) => component.id === 'maintenance_support',
      )?.points,
    ).toBeLessThanOrEqual(RISING_V1_POLICY.maintenanceMaxPoints);
  });

  it('is deterministic for the same signal snapshot', () => {
    const input = snapshot();

    expect(scoreRisingV1(input)).toEqual(scoreRisingV1(input));
  });
});
