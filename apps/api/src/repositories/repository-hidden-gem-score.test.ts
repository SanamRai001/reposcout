import { describe, expect, it } from 'vitest';

import {
  buildRepositoryRankingSignalSnapshot,
  type BuildRepositoryRankingSignalInput,
  type RepositoryRankingSignalSnapshot,
} from './repository-ranking-signals.js';
import {
  HIDDEN_GEM_FORMULA_VERSION,
  HIDDEN_GEM_V1_POLICY,
  scoreHiddenGemV1,
} from './repository-hidden-gem-score.js';
import type { RepositoryTrendResult } from './repository-trend.js';

const repositoryId = '11111111-1111-4111-8111-111111111111';

function completeTrend(
  windowDays: 7 | 30,
  starsDelta: number,
  forksDelta: number,
): RepositoryTrendResult {
  const baselineOn =
    windowDays === 7 ? '2026-09-19' : '2026-08-27';

  return {
    status: 'complete',
    repositoryId,
    requestedWindowDays: windowDays,
    cutoffOn: baselineOn,
    actualWindowDays: windowDays,
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
      pushedAtGithub: new Date('2026-09-20T12:00:00Z'),
    },
    metadata: {
      stars: 100,
      forks: 12,
    },
    readme: {
      status: 'PRESENT',
    },
    contributionEvidence: {
      status: 'OBSERVED',
      contributing: {
        apiUrl: 'https://api.github.com/repos/example/project/community/code_of_conduct',
        htmlUrl: 'https://github.com/example/project/blob/main/CONTRIBUTING.md',
      },
      codeOfConduct: {
        apiUrl: 'https://api.github.com/repos/example/project/community/code_of_conduct',
        htmlUrl: 'https://github.com/example/project/blob/main/CODE_OF_CONDUCT.md',
      },
      issueTemplate: {
        apiUrl: 'https://api.github.com/repos/example/project/community/issue_templates',
        htmlUrl: 'https://github.com/example/project/issues/new/choose',
      },
      pullRequestTemplate: {
        apiUrl: 'https://api.github.com/repos/example/project/community/pull_request_template',
        htmlUrl: 'https://github.com/example/project/blob/main/.github/PULL_REQUEST_TEMPLATE.md',
      },
      securityPolicy: {
        sourceRef: 'main',
        path: 'SECURITY.md',
        sha: 'abc123',
        sizeBytes: 1000,
      },
    },
    trend7d: completeTrend(7, 8, 1),
    trend30d: completeTrend(30, 50, 10),
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<BuildRepositoryRankingSignalInput> = {},
): RepositoryRankingSignalSnapshot {
  return buildRepositoryRankingSignalSnapshot(signalInput(overrides));
}

function eligibleScore(
  value: ReturnType<typeof scoreHiddenGemV1>,
) {
  expect(value.status).toBe('eligible');

  if (value.status !== 'eligible') {
    throw new Error('Expected eligible hidden-gem score.');
  }

  return value;
}

describe('hidden-gem-v1', () => {
  it('produces a versioned explainable score with bounded components', () => {
    const result = eligibleScore(scoreHiddenGemV1(snapshot()));

    expect(result.formulaVersion).toBe(HIDDEN_GEM_FORMULA_VERSION);
    expect(result.signalContractVersion).toBe('ranking-signals-v1');
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.components).toHaveLength(5);
    expect(result.components.map((component) => component.id)).toEqual([
      'maintenance',
      'documentation',
      'contribution_guidance',
      'community_readiness',
      'momentum_bonus',
    ]);
    expect(result.popularityPenalty.maxPoints).toBe(25);
  });

  it('does not award positive quality points merely for having zero stars', () => {
    const lowEvidence = eligibleScore(
      scoreHiddenGemV1(
        snapshot({
          repository: {
            id: repositoryId,
            pushedAtGithub: new Date('2025-01-01T00:00:00Z'),
          },
          metadata: {
            stars: 0,
            forks: 0,
          },
          readme: {
            status: 'NOT_FOUND',
          },
          contributionEvidence: {
            status: 'OBSERVED',
            contributing: null,
            codeOfConduct: null,
            issueTemplate: null,
            pullRequestTemplate: null,
            securityPolicy: null,
          },
          trend30d: {
            status: 'insufficient_history',
            reason: 'window_not_covered',
            repositoryId,
            requestedWindowDays: 30,
            cutoffOn: '2026-08-27',
            availableWindowDays: 0,
            oldestAvailable: null,
            latest: null,
          },
        }),
      ),
    );

    expect(lowEvidence.popularityPenalty.points).toBe(0);
    expect(lowEvidence.score).toBe(0);
    expect(lowEvidence.positivePoints).toBe(0);
  });

  it('subtracts popularity saturation instead of treating low stars as quality', () => {
    const lowVisibility = eligibleScore(
      scoreHiddenGemV1(
        snapshot({
          metadata: {
            stars: 100,
            forks: 12,
          },
        }),
      ),
    );
    const highVisibility = eligibleScore(
      scoreHiddenGemV1(
        snapshot({
          metadata: {
            stars: 50_000,
            forks: 12,
          },
        }),
      ),
    );

    expect(lowVisibility.popularityPenalty.points).toBe(0);
    expect(highVisibility.popularityPenalty.points).toBe(
      HIDDEN_GEM_V1_POLICY.popularityPenaltyMaxPoints,
    );
    expect(highVisibility.score).toBe(
      lowVisibility.score -
        HIDDEN_GEM_V1_POLICY.popularityPenaltyMaxPoints,
    );
  });

  it('caps popularity saturation above the configured threshold', () => {
    const saturated = eligibleScore(
      scoreHiddenGemV1(
        snapshot({
          metadata: {
            stars: 1_000_000,
            forks: 100,
          },
        }),
      ),
    );

    expect(saturated.popularityPenalty.points).toBe(25);
  });

  it('requires primary/current evidence instead of silently scoring missing data as zero', () => {
    const result = scoreHiddenGemV1(
      snapshot({
        metadata: null,
        readme: null,
        contributionEvidence: null,
      }),
    );

    expect(result.status).toBe('ineligible');

    if (result.status === 'ineligible') {
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          {
            code: 'missing_required_signal',
            signalId: 'visibility.stars_total',
            reason: 'not_collected',
          },
          {
            code: 'missing_required_signal',
            signalId: 'documentation.readme_present',
            reason: 'not_collected',
          },
          {
            code: 'missing_required_signal',
            signalId: 'community.contributing_present',
            reason: 'not_collected',
          },
        ]),
      );
    }
  });

  it('treats unsupported community evidence as ineligible rather than false', () => {
    const result = scoreHiddenGemV1(
      snapshot({
        contributionEvidence: {
          status: 'UNSUPPORTED_FORK',
          contributing: null,
          codeOfConduct: null,
          issueTemplate: null,
          pullRequestTemplate: null,
          securityPolicy: null,
        },
      }),
    );

    expect(result.status).toBe('ineligible');

    if (result.status === 'ineligible') {
      expect(result.reasons).toContainEqual({
        code: 'missing_required_signal',
        signalId: 'community.contributing_present',
        reason: 'not_applicable',
      });
    }
  });

  it('keeps 30-day momentum optional and reports missing coverage explicitly', () => {
    const result = eligibleScore(
      scoreHiddenGemV1(
        snapshot({
          trend30d: {
            status: 'insufficient_history',
            reason: 'window_not_covered',
            repositoryId,
            requestedWindowDays: 30,
            cutoffOn: '2026-08-27',
            availableWindowDays: 12,
            oldestAvailable: null,
            latest: null,
          },
        }),
      ),
    );

    expect(result.components.find(
      (component) => component.id === 'momentum_bonus',
    )?.points).toBe(0);
    expect(result.optionalMomentumCoverage).toEqual({
      available: 0,
      expected: 2,
      missingSignalIds: [
        'momentum.stars_delta_30d',
        'momentum.forks_delta_30d',
      ],
    });
  });

  it('uses positive momentum only as a small bounded bonus', () => {
    const zeroMomentum = eligibleScore(
      scoreHiddenGemV1(
        snapshot({
          trend30d: completeTrend(30, 0, 0),
        }),
      ),
    );
    const strongMomentum = eligibleScore(scoreHiddenGemV1(snapshot()));

    expect(
      strongMomentum.components.find(
        (component) => component.id === 'momentum_bonus',
      )?.points,
    ).toBe(HIDDEN_GEM_V1_POLICY.momentumMaxPoints);
    expect(strongMomentum.score - zeroMomentum.score).toBe(
      HIDDEN_GEM_V1_POLICY.momentumMaxPoints,
    );
  });

  it('does not penalize negative momentum in Hidden Gems v1', () => {
    const result = eligibleScore(
      scoreHiddenGemV1(
        snapshot({
          trend30d: completeTrend(30, -5, -2),
        }),
      ),
    );

    expect(result.components.find(
      (component) => component.id === 'momentum_bonus',
    )?.points).toBe(0);
  });

  it('decays maintenance contribution to zero after the one-year horizon', () => {
    const fresh = eligibleScore(scoreHiddenGemV1(snapshot()));
    const stale = eligibleScore(
      scoreHiddenGemV1(
        snapshot({
          repository: {
            id: repositoryId,
            pushedAtGithub: new Date('2024-01-01T00:00:00Z'),
          },
        }),
      ),
    );

    expect(
      fresh.components.find((component) => component.id === 'maintenance')
        ?.points,
    ).toBeGreaterThan(0);
    expect(
      stale.components.find((component) => component.id === 'maintenance')
        ?.points,
    ).toBe(0);
  });

  it('is deterministic for the same signal snapshot', () => {
    const input = snapshot();

    expect(scoreHiddenGemV1(input)).toEqual(scoreHiddenGemV1(input));
  });
});
