import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RankingEvidenceCard, RankingExplorer } from './RankingExplorer.js';
import type { RepositoryRankingItem } from './lib/repository-ranking-client.js';

const repository = {
  id: '11111111-1111-4111-8111-111111111111',
  githubRepositoryId: '123',
  owner: 'sample',
  name: 'useful-tool',
  fullName: 'sample/useful-tool',
  githubUrl: 'https://github.com/sample/useful-tool',
  defaultBranch: 'main',
  description: 'A public project to explore.',
  isArchived: false,
  isFork: false,
  createdAtGithub: '2025-01-01T00:00:00.000Z',
  updatedAtGithub: '2026-09-26T00:00:00.000Z',
  pushedAtGithub: '2026-09-26T00:00:00.000Z',
  lastSyncedAt: '2026-09-26T00:00:00.000Z',
  createdAt: '2026-09-26T00:00:00.000Z',
  updatedAt: '2026-09-26T00:00:00.000Z',
  metadata: {
    stars: 120,
    forks: 20,
    openIssues: 4,
    primaryLanguage: 'TypeScript',
    licenseSpdx: 'MIT',
    topics: ['tools'],
    observedAt: '2026-09-26T00:00:00.000Z',
  },
};

const hidden: RepositoryRankingItem = {
  repository,
  ranking: {
    mode: 'hidden_gems',
    score: 62,
    formulaVersion: 'hidden-gem-v1',
    explanation: {
      components: [
        {
          id: 'maintenance',
          points: 30,
          maxPoints: 35,
          signalIds: ['maintenance.days_since_push'],
        },
      ],
      positivePoints: 65,
      popularityPenalty: {
        id: 'popularity_saturation',
        points: 3,
        maxPoints: 25,
        stars: 120,
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

const history7d = {
  requestedWindowDays: 7 as const,
  actualWindowDays: 7,
  baselineCapturedOn: '2026-09-19',
  latestCapturedOn: '2026-09-26',
};

const history30d = {
  requestedWindowDays: 30 as const,
  actualWindowDays: 30,
  baselineCapturedOn: '2026-08-27',
  latestCapturedOn: '2026-09-26',
};

const rising: RepositoryRankingItem = {
  repository,
  ranking: {
    mode: 'rising',
    score: 42,
    formulaVersion: 'rising-v1',
    explanation: {
      components: [
        {
          id: 'stars_7d_momentum',
          points: 42,
          maxPoints: 45,
          signalIds: ['momentum.stars_delta_7d'],
          normalizedDelta: 25,
        },
      ],
      historyCoverage: {
        stars7d: history7d,
        stars30d: history30d,
        forks30d: history30d,
      },
      visibilityContext: {
        stars: {
          id: 'visibility.stars_total',
          availability: 'available',
          value: 120,
          provenance: null,
        },
        forks: {
          id: 'visibility.forks_total',
          availability: 'available',
          value: 20,
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

describe('ranking presentation', () => {
  it.each([
    ['hidden_gems', 'Explore Hidden Gems.'],
    ['rising', 'See what is gaining momentum.'],
  ] as const)('starts the %s view with labelled loading state', (mode, heading) => {
    const html = renderToStaticMarkup(<RankingExplorer mode={mode} />);
    expect(html).toContain(heading);
    expect(html).toContain('aria-labelledby="ranking-heading"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('ranking-grid');
  });

  it('explains a Hidden Gems score and exposes the actual GitHub URL', () => {
    const html = renderToStaticMarkup(<RankingEvidenceCard item={hidden} />);
    expect(html).toContain('sample/useful-tool'.split('/')[0]);
    expect(html).toContain('Why this repository appears here');
    expect(html).toContain('Maintenance freshness');
    expect(html).toContain('Popularity adjustment');
    expect(html).toContain('Optional momentum available');
    expect(html).toContain('hidden-gem-v1');
    expect(html).toContain('href="https://github.com/sample/useful-tool"');
    expect(html).toContain('noopener noreferrer');
    expect(html).toContain('out of 100');
  });

  it('shows Rising window provenance and normalized deltas without using total stars as a score', () => {
    const html = renderToStaticMarkup(<RankingEvidenceCard item={rising} />);
    expect(html).toContain('Window-normalized change');
    expect(html).toContain('Historical measurement coverage');
    expect(html).toContain('Stars (7d)');
    expect(html).toContain('Forks (30d)');
    expect(html).toContain('visibility context only');
    expect(html).toContain('rising-v1');
  });
});
