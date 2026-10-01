import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ContributionExplorer,
  ContributionIssueCard,
  ContributionResults,
} from './ContributionExplorer.js';
import {
  EMPTY_CONTRIBUTION_FILTERS,
  type ContributionDiscoveryItem,
} from './lib/contribution-discovery-client.js';

const signals = Object.fromEntries([
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
  value: id === 'activity.issue_age_days' ? 20
    : id === 'activity.days_since_update' ? 3
    : id === 'discussion.comment_count' ? 2
    : true,
}])) as unknown as ContributionDiscoveryItem['evidence']['signals'];

const issue: ContributionDiscoveryItem = {
  repository: {
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'sample/opensource',
    githubUrl: 'https://github.com/sample/opensource',
    primaryLanguage: 'TypeScript',
  },
  issue: {
    githubIssueId: '12001',
    number: 42,
    title: 'Improve keyboard accessibility',
    githubUrl: 'https://github.com/sample/opensource/issues/42',
    state: 'open',
    locked: false,
    assigneeCount: 0,
    commentCount: 2,
    labels: ['good first issue'],
    createdAtGithub: '2026-09-03T12:00:00.000Z',
    updatedAtGithub: '2026-09-23T12:00:00.000Z',
    observedAt: '2026-09-26T12:00:00.000Z',
  },
  evidence: {
    normalizedLabels: ['good first issue'],
    signals,
  },
  recommendation: {
    contractVersion: 'contribution-recommendation-v1',
    status: 'consider',
    evidence: [{
      code: 'good_first_issue_hint',
      signalIds: ['entry.good_first_issue_label'],
      message: 'Observed maintainer label hint; not a suitability guarantee.',
    }],
    cautions: [{
      code: 'contributing_evidence_missing',
      signalIds: ['process.contributing_present'],
      message: 'Contribution guidance was not collected.',
    }],
    limitations: ['issue_complexity_not_measured'],
  },
};

describe('Contribution Explorer B2 presentation', () => {
  it('renders the standalone public issue search with filter labels and home navigation', () => {
    const html = renderToStaticMarkup(<ContributionExplorer />);
    expect(html).toContain('Find somewhere to contribute.');
    expect(html).toContain('Primary language');
    expect(html).toContain('Good first issue label');
    expect(html).toContain('CONTRIBUTING evidence');
    expect(html).toContain('Apply filters');
    expect(html).toContain('href="/"');
    expect(html).toContain('Browse the full catalog'.replace('Browse the full catalog', 'Repository discovery'));
  });

  it('renders loading without inventing live issues', () => {
    const html = renderToStaticMarkup(
      <ContributionResults filters={EMPTY_CONTRIBUTION_FILTERS} />,
    );
    expect(html).toContain('Loading observed issues');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('View current issue on GitHub');
  });

  it('separates observed evidence, cautions and limits on each issue', () => {
    const html = renderToStaticMarkup(<ContributionIssueCard item={issue} />);
    expect(html).toContain('Improve keyboard accessibility');
    expect(html).toContain('Signals to consider');
    expect(html).toContain('Open when observed');
    expect(html).toContain('Unassigned');
    expect(html).toContain('Evidence, cautions');
    expect(html).toContain('Observed evidence');
    expect(html).toContain('Cautions');
    expect(html).toContain('Actual issue complexity is not measured.');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="https://github.com/sample/opensource/issues/42"');
  });

  it('does not confuse missing contributor evidence with an observed absence', () => {
    const missing = {
      ...issue,
      evidence: {
        ...issue.evidence,
        signals: {
          ...issue.evidence.signals,
          'process.contributing_present': {
            id: 'process.contributing_present',
            availability: 'missing',
            reason: 'not_collected',
          },
        } as ContributionDiscoveryItem['evidence']['signals'],
      },
    } satisfies ContributionDiscoveryItem;
    const html = renderToStaticMarkup(<ContributionIssueCard item={missing} />);
    expect(html).toContain('CONTRIBUTING evidence not collected');
    expect(html).not.toContain('No CONTRIBUTING guidance observed');
  });

  it('distinguishes review-required cases from consider signals', () => {
    const item: ContributionDiscoveryItem = {
      ...issue,
      recommendation: { ...issue.recommendation, status: 'needs_review' },
    };
    const html = renderToStaticMarkup(<ContributionIssueCard item={item} />);
    expect(html).toContain('Review issue details');
    expect(html).not.toContain('Signals to consider');
  });
});
