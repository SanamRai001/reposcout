import {
  REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION,
  type RepositoryRankingSignalId,
  type RepositoryRankingSignalMissingReason,
  type RepositoryRankingSignalObservation,
  type RepositoryRankingSignalSnapshot,
} from './repository-ranking-signals.js';

export const HIDDEN_GEM_FORMULA_VERSION = 'hidden-gem-v1' as const;

export const HIDDEN_GEM_V1_POLICY = Object.freeze({
  maintenanceMaxPoints: 35,
  maintenanceHorizonDays: 365,
  readmeMaxPoints: 20,
  contributingMaxPoints: 20,
  communityReadinessMaxPoints: 20,
  communityReadinessPointsPerSignal: 5,
  momentumMaxPoints: 5,
  momentumStarsMaxPoints: 3.5,
  momentumForksMaxPoints: 1.5,
  momentumStarsTarget30d: 50,
  momentumForksTarget30d: 10,
  popularityPenaltyMaxPoints: 25,
  popularityPenaltyFreeStars: 250,
  popularityPenaltySaturationStars: 50_000,
});

const REQUIRED_SIGNALS = Object.freeze([
  'visibility.stars_total',
  'maintenance.days_since_push',
  'documentation.readme_present',
  'community.contributing_present',
  'community.code_of_conduct_present',
  'community.issue_template_present',
  'community.pull_request_template_present',
  'community.security_policy_present',
] satisfies RepositoryRankingSignalId[]);

const COMMUNITY_READINESS_SIGNALS = Object.freeze([
  'community.code_of_conduct_present',
  'community.issue_template_present',
  'community.pull_request_template_present',
  'community.security_policy_present',
] satisfies RepositoryRankingSignalId[]);

const OPTIONAL_MOMENTUM_SIGNALS = Object.freeze([
  'momentum.stars_delta_30d',
  'momentum.forks_delta_30d',
] satisfies RepositoryRankingSignalId[]);

export type HiddenGemIneligibility = Readonly<{
  code: 'missing_required_signal';
  signalId: RepositoryRankingSignalId;
  reason: RepositoryRankingSignalMissingReason;
}>;

export type HiddenGemScoreComponent = Readonly<{
  id:
    | 'maintenance'
    | 'documentation'
    | 'contribution_guidance'
    | 'community_readiness'
    | 'momentum_bonus';
  points: number;
  maxPoints: number;
  signalIds: readonly RepositoryRankingSignalId[];
}>;

export type HiddenGemPopularityPenalty = Readonly<{
  id: 'popularity_saturation';
  points: number;
  maxPoints: number;
  stars: number;
  freeStars: number;
  saturationStars: number;
}>;

export type HiddenGemScoreResult =
  | Readonly<{
      status: 'ineligible';
      formulaVersion: typeof HIDDEN_GEM_FORMULA_VERSION;
      signalContractVersion: typeof REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION;
      repositoryId: string;
      evaluatedAt: Date;
      reasons: readonly HiddenGemIneligibility[];
    }>
  | Readonly<{
      status: 'eligible';
      formulaVersion: typeof HIDDEN_GEM_FORMULA_VERSION;
      signalContractVersion: typeof REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION;
      repositoryId: string;
      evaluatedAt: Date;
      score: number;
      positivePoints: number;
      components: readonly HiddenGemScoreComponent[];
      popularityPenalty: HiddenGemPopularityPenalty;
      optionalMomentumCoverage: Readonly<{
        available: number;
        expected: number;
        missingSignalIds: readonly RepositoryRankingSignalId[];
      }>;
    }>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertFiniteNonnegative(
  signalId: RepositoryRankingSignalId,
  value: number,
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${signalId} must be a finite nonnegative number for hidden-gem-v1.`,
    );
  }

  return value;
}

function availableNumber(
  observation: RepositoryRankingSignalObservation,
): number {
  if (
    observation.availability !== 'available' ||
    typeof observation.value !== 'number'
  ) {
    throw new Error(
      `${observation.id} must be an available numeric signal.`,
    );
  }

  return observation.value;
}

function availableBoolean(
  observation: RepositoryRankingSignalObservation,
): boolean {
  if (
    observation.availability !== 'available' ||
    typeof observation.value !== 'boolean'
  ) {
    throw new Error(
      `${observation.id} must be an available boolean signal.`,
    );
  }

  return observation.value;
}

function maintenancePoints(daysSincePush: number): number {
  const days = assertFiniteNonnegative(
    'maintenance.days_since_push',
    daysSincePush,
  );
  const freshness = clamp(
    1 - days / HIDDEN_GEM_V1_POLICY.maintenanceHorizonDays,
    0,
    1,
  );

  return roundScore(
    freshness * HIDDEN_GEM_V1_POLICY.maintenanceMaxPoints,
  );
}

function popularityPenalty(stars: number): number {
  const measuredStars = assertFiniteNonnegative(
    'visibility.stars_total',
    stars,
  );

  if (measuredStars <= HIDDEN_GEM_V1_POLICY.popularityPenaltyFreeStars) {
    return 0;
  }

  const numerator = Math.log(
    (measuredStars + 1) /
      (HIDDEN_GEM_V1_POLICY.popularityPenaltyFreeStars + 1),
  );
  const denominator = Math.log(
    (HIDDEN_GEM_V1_POLICY.popularityPenaltySaturationStars + 1) /
      (HIDDEN_GEM_V1_POLICY.popularityPenaltyFreeStars + 1),
  );
  const saturation = clamp(numerator / denominator, 0, 1);

  return roundScore(
    saturation * HIDDEN_GEM_V1_POLICY.popularityPenaltyMaxPoints,
  );
}

function positiveMomentumPoints(
  delta: number,
  target: number,
  maxPoints: number,
): number {
  if (!Number.isFinite(delta)) {
    throw new Error('Momentum delta must be finite.');
  }

  if (delta <= 0) {
    return 0;
  }

  const normalized = clamp(
    Math.log1p(delta) / Math.log1p(target),
    0,
    1,
  );

  return normalized * maxPoints;
}

function collectIneligibility(
  snapshot: RepositoryRankingSignalSnapshot,
): HiddenGemIneligibility[] {
  const reasons: HiddenGemIneligibility[] = [];

  for (const signalId of REQUIRED_SIGNALS) {
    const observation = snapshot.signals[signalId];

    if (observation.availability === 'missing') {
      reasons.push({
        code: 'missing_required_signal',
        signalId,
        reason: observation.reason,
      });
    }
  }

  return reasons;
}

export function scoreHiddenGemV1(
  snapshot: RepositoryRankingSignalSnapshot,
): HiddenGemScoreResult {
  if (
    snapshot.contractVersion !==
    REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION
  ) {
    throw new Error(
      `hidden-gem-v1 requires ${REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION}.`,
    );
  }

  if (
    !(snapshot.evaluatedAt instanceof Date) ||
    Number.isNaN(snapshot.evaluatedAt.getTime())
  ) {
    throw new Error('Ranking signal snapshot evaluatedAt is invalid.');
  }

  const ineligibility = collectIneligibility(snapshot);

  if (ineligibility.length > 0) {
    return {
      status: 'ineligible',
      formulaVersion: HIDDEN_GEM_FORMULA_VERSION,
      signalContractVersion: REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION,
      repositoryId: snapshot.repositoryId,
      evaluatedAt: snapshot.evaluatedAt,
      reasons: ineligibility,
    };
  }

  const stars = availableNumber(
    snapshot.signals['visibility.stars_total'],
  );
  const daysSincePush = availableNumber(
    snapshot.signals['maintenance.days_since_push'],
  );
  const readmePresent = availableBoolean(
    snapshot.signals['documentation.readme_present'],
  );
  const contributingPresent = availableBoolean(
    snapshot.signals['community.contributing_present'],
  );

  const maintenance = maintenancePoints(daysSincePush);
  const documentation = readmePresent
    ? HIDDEN_GEM_V1_POLICY.readmeMaxPoints
    : 0;
  const contributionGuidance = contributingPresent
    ? HIDDEN_GEM_V1_POLICY.contributingMaxPoints
    : 0;

  const positiveCommunitySignals = COMMUNITY_READINESS_SIGNALS.filter(
    (signalId) => availableBoolean(snapshot.signals[signalId]),
  ).length;
  const communityReadiness =
    positiveCommunitySignals *
    HIDDEN_GEM_V1_POLICY.communityReadinessPointsPerSignal;

  const missingMomentumSignalIds: RepositoryRankingSignalId[] = [];
  let momentum = 0;

  const starsMomentum =
    snapshot.signals['momentum.stars_delta_30d'];
  if (starsMomentum.availability === 'available') {
    if (typeof starsMomentum.value !== 'number') {
      throw new Error(
        'momentum.stars_delta_30d must be numeric when available.',
      );
    }

    momentum += positiveMomentumPoints(
      starsMomentum.value,
      HIDDEN_GEM_V1_POLICY.momentumStarsTarget30d,
      HIDDEN_GEM_V1_POLICY.momentumStarsMaxPoints,
    );
  } else {
    missingMomentumSignalIds.push('momentum.stars_delta_30d');
  }

  const forksMomentum =
    snapshot.signals['momentum.forks_delta_30d'];
  if (forksMomentum.availability === 'available') {
    if (typeof forksMomentum.value !== 'number') {
      throw new Error(
        'momentum.forks_delta_30d must be numeric when available.',
      );
    }

    momentum += positiveMomentumPoints(
      forksMomentum.value,
      HIDDEN_GEM_V1_POLICY.momentumForksTarget30d,
      HIDDEN_GEM_V1_POLICY.momentumForksMaxPoints,
    );
  } else {
    missingMomentumSignalIds.push('momentum.forks_delta_30d');
  }

  momentum = roundScore(
    clamp(momentum, 0, HIDDEN_GEM_V1_POLICY.momentumMaxPoints),
  );

  const components: HiddenGemScoreComponent[] = [
    {
      id: 'maintenance',
      points: maintenance,
      maxPoints: HIDDEN_GEM_V1_POLICY.maintenanceMaxPoints,
      signalIds: ['maintenance.days_since_push'],
    },
    {
      id: 'documentation',
      points: documentation,
      maxPoints: HIDDEN_GEM_V1_POLICY.readmeMaxPoints,
      signalIds: ['documentation.readme_present'],
    },
    {
      id: 'contribution_guidance',
      points: contributionGuidance,
      maxPoints: HIDDEN_GEM_V1_POLICY.contributingMaxPoints,
      signalIds: ['community.contributing_present'],
    },
    {
      id: 'community_readiness',
      points: communityReadiness,
      maxPoints: HIDDEN_GEM_V1_POLICY.communityReadinessMaxPoints,
      signalIds: COMMUNITY_READINESS_SIGNALS,
    },
    {
      id: 'momentum_bonus',
      points: momentum,
      maxPoints: HIDDEN_GEM_V1_POLICY.momentumMaxPoints,
      signalIds: OPTIONAL_MOMENTUM_SIGNALS,
    },
  ];

  const positivePoints = roundScore(
    components.reduce((sum, component) => sum + component.points, 0),
  );
  const penaltyPoints = popularityPenalty(stars);
  const score = roundScore(
    clamp(positivePoints - penaltyPoints, 0, 100),
  );

  return {
    status: 'eligible',
    formulaVersion: HIDDEN_GEM_FORMULA_VERSION,
    signalContractVersion: REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION,
    repositoryId: snapshot.repositoryId,
    evaluatedAt: snapshot.evaluatedAt,
    score,
    positivePoints,
    components,
    popularityPenalty: {
      id: 'popularity_saturation',
      points: penaltyPoints,
      maxPoints: HIDDEN_GEM_V1_POLICY.popularityPenaltyMaxPoints,
      stars,
      freeStars: HIDDEN_GEM_V1_POLICY.popularityPenaltyFreeStars,
      saturationStars:
        HIDDEN_GEM_V1_POLICY.popularityPenaltySaturationStars,
    },
    optionalMomentumCoverage: {
      available:
        OPTIONAL_MOMENTUM_SIGNALS.length -
        missingMomentumSignalIds.length,
      expected: OPTIONAL_MOMENTUM_SIGNALS.length,
      missingSignalIds: missingMomentumSignalIds,
    },
  };
}
