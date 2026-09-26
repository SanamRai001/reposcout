import {
  CONTRIBUTION_DISCOVERY_SIGNAL_CONTRACT_VERSION,
  type ContributionDiscoverySignalId,
  type ContributionDiscoverySignalSnapshot,
} from './repository-contribution-signals.js';

export const CONTRIBUTION_RECOMMENDATION_CONTRACT_VERSION =
  'contribution-recommendation-v1' as const;

export const CONTRIBUTION_RECOMMENDATION_V1_POLICY = Object.freeze({
  recentUpdateHorizonDays: 90,
});

export type ContributionRecommendationStatus =
  | 'consider'
  | 'needs_review';

export type ContributionRecommendationEvidenceCode =
  | 'issue_open'
  | 'issue_unassigned'
  | 'discussion_unlocked'
  | 'good_first_issue_hint'
  | 'help_wanted_hint'
  | 'recently_updated'
  | 'contributing_guidance_present';

export type ContributionRecommendationCautionCode =
  | 'issue_closed'
  | 'issue_assigned'
  | 'discussion_locked'
  | 'no_entry_hint'
  | 'stale_update'
  | 'contributing_guidance_absent'
  | 'contributing_evidence_missing'
  | 'contributing_not_applicable';

export type ContributionRecommendationLimitationCode =
  | 'issue_complexity_not_measured'
  | 'maintainer_responsiveness_not_measured'
  | 'linked_pr_outcomes_not_measured'
  | 'external_contributor_success_not_measured'
  | 'required_domain_expertise_not_measured';

export type ContributionRecommendationExplanation<TCode extends string> =
  Readonly<{
    code: TCode;
    signalIds: readonly ContributionDiscoverySignalId[];
    message: string;
  }>;

export type ContributionRecommendation = Readonly<{
  contractVersion: typeof CONTRIBUTION_RECOMMENDATION_CONTRACT_VERSION;
  signalContractVersion:
    typeof CONTRIBUTION_DISCOVERY_SIGNAL_CONTRACT_VERSION;
  repositoryId: string;
  githubIssueId: string;
  issueNumber: number;
  evaluatedAt: Date;
  status: ContributionRecommendationStatus;
  evidence: readonly ContributionRecommendationExplanation<ContributionRecommendationEvidenceCode>[];
  cautions: readonly ContributionRecommendationExplanation<ContributionRecommendationCautionCode>[];
  limitations: readonly ContributionRecommendationLimitationCode[];
}>;

export const CONTRIBUTION_RECOMMENDATION_LIMITATIONS =
  Object.freeze([
    'issue_complexity_not_measured',
    'maintainer_responsiveness_not_measured',
    'linked_pr_outcomes_not_measured',
    'external_contributor_success_not_measured',
    'required_domain_expertise_not_measured',
  ] satisfies ContributionRecommendationLimitationCode[]);

function availableBoolean(
  snapshot: ContributionDiscoverySignalSnapshot,
  signalId: ContributionDiscoverySignalId,
): boolean {
  const observation = snapshot.signals[signalId];

  if (
    observation.availability !== 'available' ||
    typeof observation.value !== 'boolean'
  ) {
    throw new Error(
      `${signalId} must be an available boolean signal for contribution-recommendation-v1.`,
    );
  }

  return observation.value;
}

function availableNumber(
  snapshot: ContributionDiscoverySignalSnapshot,
  signalId: ContributionDiscoverySignalId,
): number {
  const observation = snapshot.signals[signalId];

  if (
    observation.availability !== 'available' ||
    typeof observation.value !== 'number' ||
    !Number.isFinite(observation.value) ||
    observation.value < 0
  ) {
    throw new Error(
      `${signalId} must be an available nonnegative numeric signal for contribution-recommendation-v1.`,
    );
  }

  return observation.value;
}

export function buildContributionRecommendation(
  snapshot: ContributionDiscoverySignalSnapshot,
): ContributionRecommendation {
  if (
    snapshot.contractVersion !==
    CONTRIBUTION_DISCOVERY_SIGNAL_CONTRACT_VERSION
  ) {
    throw new Error(
      `contribution-recommendation-v1 requires ${CONTRIBUTION_DISCOVERY_SIGNAL_CONTRACT_VERSION}.`,
    );
  }

  const evidence: ContributionRecommendationExplanation<ContributionRecommendationEvidenceCode>[] =
    [];
  const cautions: ContributionRecommendationExplanation<ContributionRecommendationCautionCode>[] =
    [];

  const open = availableBoolean(snapshot, 'availability.open');
  const unassigned = availableBoolean(
    snapshot,
    'availability.unassigned',
  );
  const unlocked = availableBoolean(
    snapshot,
    'availability.unlocked',
  );
  const goodFirstIssue = availableBoolean(
    snapshot,
    'entry.good_first_issue_label',
  );
  const helpWanted = availableBoolean(
    snapshot,
    'entry.help_wanted_label',
  );
  const daysSinceUpdate = availableNumber(
    snapshot,
    'activity.days_since_update',
  );

  if (open) {
    evidence.push({
      code: 'issue_open',
      signalIds: ['availability.open'],
      message: 'The latest stored GitHub observation says the issue is open.',
    });
  } else {
    cautions.push({
      code: 'issue_closed',
      signalIds: ['availability.open'],
      message: 'The latest stored GitHub observation says the issue is closed.',
    });
  }

  if (unassigned) {
    evidence.push({
      code: 'issue_unassigned',
      signalIds: ['availability.unassigned'],
      message: 'The latest stored observation has no GitHub assignees.',
    });
  } else {
    cautions.push({
      code: 'issue_assigned',
      signalIds: ['availability.unassigned'],
      message: 'The issue currently has one or more GitHub assignees.',
    });
  }

  if (unlocked) {
    evidence.push({
      code: 'discussion_unlocked',
      signalIds: ['availability.unlocked'],
      message: 'The issue discussion is not locked.',
    });
  } else {
    cautions.push({
      code: 'discussion_locked',
      signalIds: ['availability.unlocked'],
      message: 'The issue discussion is locked.',
    });
  }

  if (goodFirstIssue) {
    evidence.push({
      code: 'good_first_issue_hint',
      signalIds: ['entry.good_first_issue_label'],
      message:
        'The issue has a normalized good-first-issue maintainer/community hint.',
    });
  }

  if (helpWanted) {
    evidence.push({
      code: 'help_wanted_hint',
      signalIds: ['entry.help_wanted_label'],
      message:
        'The issue has a normalized help-wanted maintainer/community hint.',
    });
  }

  if (!goodFirstIssue && !helpWanted) {
    cautions.push({
      code: 'no_entry_hint',
      signalIds: [
        'entry.good_first_issue_label',
        'entry.help_wanted_label',
      ],
      message:
        'RepoScout has not observed a good-first-issue or help-wanted label hint.',
    });
  }

  const recentlyUpdated =
    daysSinceUpdate <=
    CONTRIBUTION_RECOMMENDATION_V1_POLICY.recentUpdateHorizonDays;

  if (recentlyUpdated) {
    evidence.push({
      code: 'recently_updated',
      signalIds: ['activity.days_since_update'],
      message:
        `The issue was updated within the ${CONTRIBUTION_RECOMMENDATION_V1_POLICY.recentUpdateHorizonDays}-day recommendation horizon.`,
    });
  } else {
    cautions.push({
      code: 'stale_update',
      signalIds: ['activity.days_since_update'],
      message:
        `The issue has not been updated within the ${CONTRIBUTION_RECOMMENDATION_V1_POLICY.recentUpdateHorizonDays}-day recommendation horizon.`,
    });
  }

  const contributing =
    snapshot.signals['process.contributing_present'];

  if (contributing.availability === 'available') {
    if (typeof contributing.value !== 'boolean') {
      throw new Error(
        'process.contributing_present must be boolean when available.',
      );
    }

    if (contributing.value) {
      evidence.push({
        code: 'contributing_guidance_present',
        signalIds: ['process.contributing_present'],
        message:
          'RepoScout observed repository CONTRIBUTING guidance.',
      });
    } else {
      cautions.push({
        code: 'contributing_guidance_absent',
        signalIds: ['process.contributing_present'],
        message:
          'RepoScout observed repository community evidence but no CONTRIBUTING guidance.',
      });
    }
  } else if (contributing.reason === 'not_applicable') {
    cautions.push({
      code: 'contributing_not_applicable',
      signalIds: ['process.contributing_present'],
      message:
        'CONTRIBUTING evidence is not applicable under the existing unsupported-fork evidence boundary.',
    });
  } else {
    cautions.push({
      code: 'contributing_evidence_missing',
      signalIds: ['process.contributing_present'],
      message:
        'RepoScout has not collected repository CONTRIBUTING evidence.',
    });
  }

  const status: ContributionRecommendationStatus =
    open &&
    unassigned &&
    unlocked &&
    recentlyUpdated &&
    (goodFirstIssue || helpWanted)
      ? 'consider'
      : 'needs_review';

  return {
    contractVersion: CONTRIBUTION_RECOMMENDATION_CONTRACT_VERSION,
    signalContractVersion:
      CONTRIBUTION_DISCOVERY_SIGNAL_CONTRACT_VERSION,
    repositoryId: snapshot.repositoryId,
    githubIssueId: snapshot.githubIssueId,
    issueNumber: snapshot.issueNumber,
    evaluatedAt: snapshot.evaluatedAt,
    status,
    evidence,
    cautions,
    limitations: CONTRIBUTION_RECOMMENDATION_LIMITATIONS,
  };
}

export function toContributionRecommendationResponse(
  recommendation: ContributionRecommendation,
) {
  return {
    contractVersion: recommendation.contractVersion,
    status: recommendation.status,
    evidence: recommendation.evidence,
    cautions: recommendation.cautions,
    limitations: recommendation.limitations,
  };
}
