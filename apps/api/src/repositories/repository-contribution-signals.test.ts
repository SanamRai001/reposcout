import { describe, expect, it } from 'vitest';

import {
  buildContributionDiscoverySignalSnapshot,
  CONTRIBUTION_DISCOVERY_SIGNAL_CONTRACT_VERSION,
  CONTRIBUTION_DISCOVERY_SIGNAL_DEFINITIONS,
  normalizeContributionIssueLabel,
  type BuildContributionDiscoverySignalInput,
} from './repository-contribution-signals.js';

const repositoryEvidence = {
  status: 'OBSERVED' as const,
  contributing: {
    apiUrl: 'https://api.github.com/repos/example/project/community',
    htmlUrl:
      'https://github.com/example/project/blob/main/CONTRIBUTING.md',
  },
  codeOfConduct: {
    apiUrl: 'https://api.github.com/repos/example/project/community',
    htmlUrl:
      'https://github.com/example/project/blob/main/CODE_OF_CONDUCT.md',
  },
  issueTemplate: null,
  pullRequestTemplate: null,
};

function build(overrides: {
  labels?: string[];
  state?: 'open' | 'closed';
  locked?: boolean;
  assigneeCount?: number;
  commentCount?: number;
  repositoryEvidence?: BuildContributionDiscoverySignalInput['repositoryEvidence'];
} = {}) {
  return buildContributionDiscoverySignalSnapshot({
    repositoryId: '11111111-1111-4111-8111-111111111111',
    evaluatedAt: new Date('2026-09-26T12:00:00.000Z'),
    issue: {
      githubIssueId: '9001',
      number: 42,
      title: 'Add typed pagination example',
      state: overrides.state ?? 'open',
      locked: overrides.locked ?? false,
      assigneeCount: overrides.assigneeCount ?? 0,
      commentCount: overrides.commentCount ?? 3,
      labels: overrides.labels ?? [
        'Good First Issue',
        'help-wanted',
      ],
      createdAt: new Date('2026-09-16T12:00:00.000Z'),
      updatedAt: new Date('2026-09-24T12:00:00.000Z'),
    },
    repositoryEvidence:
      overrides.repositoryEvidence === undefined
        ? repositoryEvidence
        : overrides.repositoryEvidence,
  });
}

describe('contribution discovery signal contract', () => {
  it('uses a versioned unique definition catalog', () => {
    expect(
      CONTRIBUTION_DISCOVERY_SIGNAL_CONTRACT_VERSION,
    ).toBe('contribution-signals-v1');

    const ids = CONTRIBUTION_DISCOVERY_SIGNAL_DEFINITIONS.map(
      (definition) => definition.id,
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(
      CONTRIBUTION_DISCOVERY_SIGNAL_DEFINITIONS.every(
        (definition) => definition.description.trim().length > 0,
      ),
    ).toBe(true);
  });

  it.each([
    ['Good First Issue', 'good first issue'],
    ['good-first-issue', 'good first issue'],
    ['good_first_issue', 'good first issue'],
    [' HELP   WANTED ', 'help wanted'],
  ])('normalizes label variant %s', (raw, normalized) => {
    expect(normalizeContributionIssueLabel(raw)).toBe(normalized);
  });

  it('captures label hints without turning them into a beginner-friendly judgment', () => {
    const snapshot = build();

    expect(snapshot.normalizedLabels).toEqual([
      'good first issue',
      'help wanted',
    ]);
    expect(snapshot.signals['entry.good_first_issue_label']).toEqual({
      id: 'entry.good_first_issue_label',
      availability: 'available',
      value: true,
    });
    expect(snapshot.signals['entry.help_wanted_label']).toEqual({
      id: 'entry.help_wanted_label',
      availability: 'available',
      value: true,
    });
    expect(snapshot).not.toHaveProperty('beginnerFriendly');
    expect(snapshot).not.toHaveProperty('score');
  });

  it('keeps observed absence distinct from missing repository evidence', () => {
    const observed = build({
      repositoryEvidence: {
        status: 'OBSERVED',
        contributing: null,
        codeOfConduct: null,
        issueTemplate: null,
        pullRequestTemplate: null,
      },
    });
    const missing = build({
      repositoryEvidence: null,
    });

    expect(
      observed.signals['process.contributing_present'],
    ).toEqual({
      id: 'process.contributing_present',
      availability: 'available',
      value: false,
    });
    expect(
      missing.signals['process.contributing_present'],
    ).toEqual({
      id: 'process.contributing_present',
      availability: 'missing',
      reason: 'not_collected',
    });
  });

  it('marks unsupported fork process evidence as not applicable', () => {
    const snapshot = build({
      repositoryEvidence: {
        status: 'UNSUPPORTED_FORK',
        contributing: null,
        codeOfConduct: null,
        issueTemplate: null,
        pullRequestTemplate: null,
      },
    });

    expect(
      snapshot.signals['process.contributing_present'],
    ).toEqual({
      id: 'process.contributing_present',
      availability: 'missing',
      reason: 'not_applicable',
    });
  });

  it('captures availability and discussion facts separately from entry labels', () => {
    const snapshot = build({
      labels: [],
      state: 'closed',
      locked: true,
      assigneeCount: 2,
      commentCount: 7,
    });

    expect(snapshot.signals['availability.open']).toEqual({
      id: 'availability.open',
      availability: 'available',
      value: false,
    });
    expect(snapshot.signals['availability.unassigned']).toEqual({
      id: 'availability.unassigned',
      availability: 'available',
      value: false,
    });
    expect(snapshot.signals['availability.unlocked']).toEqual({
      id: 'availability.unlocked',
      availability: 'available',
      value: false,
    });
    expect(snapshot.signals['discussion.comment_count']).toEqual({
      id: 'discussion.comment_count',
      availability: 'available',
      value: 7,
    });
    expect(
      snapshot.signals['entry.good_first_issue_label'],
    ).toEqual(
      expect.objectContaining({
        availability: 'available',
        value: false,
      }),
    );
  });

  it('derives explicit age and update-recency windows from the evaluation time', () => {
    const snapshot = build();

    expect(snapshot.signals['activity.issue_age_days']).toEqual({
      id: 'activity.issue_age_days',
      availability: 'available',
      value: 10,
    });
    expect(snapshot.signals['activity.days_since_update']).toEqual({
      id: 'activity.days_since_update',
      availability: 'available',
      value: 2,
    });
  });

  it('deduplicates normalized labels deterministically', () => {
    const snapshot = build({
      labels: [
        'Good First Issue',
        'good-first-issue',
        ' HELP WANTED ',
        'help_wanted',
      ],
    });

    expect(snapshot.normalizedLabels).toEqual([
      'good first issue',
      'help wanted',
    ]);
  });

  it('rejects invalid temporal observations instead of producing negative ages', () => {
    expect(() =>
      buildContributionDiscoverySignalSnapshot({
        repositoryId: 'repo',
        evaluatedAt: new Date('2026-09-20T00:00:00Z'),
        issue: {
          githubIssueId: '1',
          number: 1,
          title: 'Invalid fixture',
          state: 'open',
          locked: false,
          assigneeCount: 0,
          commentCount: 0,
          labels: [],
          createdAt: new Date('2026-09-21T00:00:00Z'),
          updatedAt: new Date('2026-09-21T00:00:00Z'),
        },
        repositoryEvidence: null,
      }),
    ).toThrow(
      'evaluatedAt must not be earlier than issue.createdAt.',
    );
  });

  it('rejects empty labels rather than silently inventing a normalized label', () => {
    expect(() => normalizeContributionIssueLabel('   ')).toThrow(
      'Contribution issue labels must be non-empty.',
    );
  });
});
