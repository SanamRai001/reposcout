import {
  REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION,
  type RepositoryRankingSignalId,
  type RepositoryRankingSignalMissingReason,
  type RepositoryRankingSignalObservation,
  type RepositoryRankingSignalSnapshot,
  type RepositoryRankingTrendProvenance,
} from './repository-ranking-signals.js';

export const RISING_FORMULA_VERSION = 'rising-v1' as const;

export const RISING_V1_POLICY = Object.freeze({
  stars7dMaxPoints: 45,
  stars30dMaxPoints: 35,
  forks30dMaxPoints: 15,
  maintenanceMaxPoints: 5,
  stars7dTarget: 25,
  stars30dTarget: 100,
  forks30dTarget: 15,
  maintenanceHorizonDays: 90,
  maxActualWindowDays7d: 9,
  maxActualWindowDays30d: 35,
});

const PRIMARY_SIGNAL_IDS = Object.freeze([
  'momentum.stars_delta_7d',
  'momentum.stars_delta_30d',
  'momentum.forks_delta_30d',
] satisfies RepositoryRankingSignalId[]);

export type RisingIneligibility =
  | Readonly<{
      code: 'missing_primary_signal';
      signalId: RepositoryRankingSignalId;
      reason: RepositoryRankingSignalMissingReason;
    }>
  | Readonly<{
      code: 'history_window_too_sparse';
      signalId: RepositoryRankingSignalId;
      requestedWindowDays: 7 | 30;
      actualWindowDays: number;
      maxActualWindowDays: number;
    }>;

export type RisingScoreComponent = Readonly<{
  id:
    | 'stars_7d_momentum'
    | 'stars_30d_momentum'
    | 'forks_30d_momentum'
    | 'maintenance_support';
  points: number;
  maxPoints: number;
  signalIds: readonly RepositoryRankingSignalId[];
  normalizedDelta: number | null;
}>;

export type RisingVisibilityContext = Readonly<{
  stars: RepositoryRankingSignalObservation;
  forks: RepositoryRankingSignalObservation;
}>;

export type RisingScoreResult =
  | Readonly<{
      status: 'ineligible';
      formulaVersion: typeof RISING_FORMULA_VERSION;
      signalContractVersion: typeof REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION;
      repositoryId: string;
      evaluatedAt: Date;
      reasons: readonly RisingIneligibility[];
      visibilityContext: RisingVisibilityContext;
    }>
  | Readonly<{
      status: 'eligible';
      formulaVersion: typeof RISING_FORMULA_VERSION;
      signalContractVersion: typeof REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION;
      repositoryId: string;
      evaluatedAt: Date;
      score: number;
      components: readonly RisingScoreComponent[];
      historyCoverage: Readonly<{
        stars7d: RepositoryRankingTrendProvenance;
        stars30d: RepositoryRankingTrendProvenance;
        forks30d: RepositoryRankingTrendProvenance;
      }>;
      visibilityContext: RisingVisibilityContext;
      maintenanceCoverage:
        | Readonly<{
            availability: 'available';
            daysSincePush: number;
          }>
        | Readonly<{
            availability: 'missing';
            reason: RepositoryRankingSignalMissingReason;
          }>;
    }>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertFiniteNumber(
  signalId: RepositoryRankingSignalId,
  value: number,
): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      `${signalId} must be a finite number for rising-v1.`,
    );
  }

  return value;
}

function requiredTrend(
  snapshot: RepositoryRankingSignalSnapshot,
  signalId:
    | 'momentum.stars_delta_7d'
    | 'momentum.stars_delta_30d'
    | 'momentum.forks_delta_30d',
  requestedWindowDays: 7 | 30,
  maxActualWindowDays: number,
): Readonly<{
  ineligibility: RisingIneligibility | null;
  delta: number | null;
  provenance: RepositoryRankingTrendProvenance | null;
}> {
  const observation = snapshot.signals[signalId];

  if (observation.availability === 'missing') {
    return {
      ineligibility: {
        code: 'missing_primary_signal',
        signalId,
        reason: observation.reason,
      },
      delta: null,
      provenance: null,
    };
  }

  if (typeof observation.value !== 'number') {
    throw new Error(
      `${signalId} must be numeric when available.`,
    );
  }

  const provenance = observation.provenance;

  if (provenance === null) {
    throw new Error(
      `${signalId} requires historical provenance for rising-v1.`,
    );
  }

  if (provenance.requestedWindowDays !== requestedWindowDays) {
    throw new Error(
      `${signalId} requires a ${requestedWindowDays}-day provenance window.`,
    );
  }

  if (
    !Number.isInteger(provenance.actualWindowDays) ||
    provenance.actualWindowDays < requestedWindowDays
  ) {
    throw new Error(
      `${signalId} has invalid actualWindowDays provenance.`,
    );
  }

  if (provenance.actualWindowDays > maxActualWindowDays) {
    return {
      ineligibility: {
        code: 'history_window_too_sparse',
        signalId,
        requestedWindowDays,
        actualWindowDays: provenance.actualWindowDays,
        maxActualWindowDays,
      },
      delta: null,
      provenance,
    };
  }

  return {
    ineligibility: null,
    delta: assertFiniteNumber(signalId, observation.value),
    provenance,
  };
}

function normalizeDelta(
  delta: number,
  provenance: RepositoryRankingTrendProvenance,
): number {
  return (
    delta *
    (provenance.requestedWindowDays / provenance.actualWindowDays)
  );
}

function positiveMomentumPoints(
  normalizedDelta: number,
  target: number,
  maxPoints: number,
): number {
  if (!Number.isFinite(normalizedDelta)) {
    throw new Error('Normalized momentum delta must be finite.');
  }

  if (normalizedDelta <= 0) {
    return 0;
  }

  return roundScore(
    clamp(
      Math.log1p(normalizedDelta) / Math.log1p(target),
      0,
      1,
    ) * maxPoints,
  );
}

function maintenanceComponent(
  observation: RepositoryRankingSignalObservation,
): Readonly<{
  component: RisingScoreComponent;
  coverage: RisingScoreResult extends infer _ ? never : never;
}> {
  if (observation.availability === 'missing') {
    return {
      component: {
        id: 'maintenance_support',
        points: 0,
        maxPoints: RISING_V1_POLICY.maintenanceMaxPoints,
        signalIds: ['maintenance.days_since_push'],
        normalizedDelta: null,
      },
      coverage: undefined as never,
    };
  }

  if (typeof observation.value !== 'number') {
    throw new Error(
      'maintenance.days_since_push must be numeric when available.',
    );
  }

  const daysSincePush = observation.value;

  if (!Number.isFinite(daysSincePush) || daysSincePush < 0) {
    throw new Error(
      'maintenance.days_since_push must be a finite nonnegative number.',
    );
  }

  const freshness = clamp(
    1 - daysSincePush / RISING_V1_POLICY.maintenanceHorizonDays,
    0,
    1,
  );

  return {
    component: {
      id: 'maintenance_support',
      points: roundScore(
        freshness * RISING_V1_POLICY.maintenanceMaxPoints,
      ),
      maxPoints: RISING_V1_POLICY.maintenanceMaxPoints,
      signalIds: ['maintenance.days_since_push'],
      normalizedDelta: null,
    },
    coverage: undefined as never,
  };
}

export function scoreRisingV1(
  snapshot: RepositoryRankingSignalSnapshot,
): RisingScoreResult {
  if (
    snapshot.contractVersion !==
    REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION
  ) {
    throw new Error(
      `rising-v1 requires ${REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION}.`,
    );
  }

  if (
    !(snapshot.evaluatedAt instanceof Date) ||
    Number.isNaN(snapshot.evaluatedAt.getTime())
  ) {
    throw new Error('Ranking signal snapshot evaluatedAt is invalid.');
  }

  const visibilityContext: RisingVisibilityContext = {
    stars: snapshot.signals['visibility.stars_total'],
    forks: snapshot.signals['visibility.forks_total'],
  };

  const stars7d = requiredTrend(
    snapshot,
    'momentum.stars_delta_7d',
    7,
    RISING_V1_POLICY.maxActualWindowDays7d,
  );
  const stars30d = requiredTrend(
    snapshot,
    'momentum.stars_delta_30d',
    30,
    RISING_V1_POLICY.maxActualWindowDays30d,
  );
  const forks30d = requiredTrend(
    snapshot,
    'momentum.forks_delta_30d',
    30,
    RISING_V1_POLICY.maxActualWindowDays30d,
  );

  const reasons = [stars7d, stars30d, forks30d]
    .map((item) => item.ineligibility)
    .filter((item): item is RisingIneligibility => item !== null);

  if (reasons.length > 0) {
    return {
      status: 'ineligible',
      formulaVersion: RISING_FORMULA_VERSION,
      signalContractVersion:
        REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION,
      repositoryId: snapshot.repositoryId,
      evaluatedAt: snapshot.evaluatedAt,
      reasons,
      visibilityContext,
    };
  }

  if (
    stars7d.delta === null ||
    stars7d.provenance === null ||
    stars30d.delta === null ||
    stars30d.provenance === null ||
    forks30d.delta === null ||
    forks30d.provenance === null
  ) {
    throw new Error('Eligible rising-v1 history unexpectedly missing.');
  }

  const normalizedStars7d = normalizeDelta(
    stars7d.delta,
    stars7d.provenance,
  );
  const normalizedStars30d = normalizeDelta(
    stars30d.delta,
    stars30d.provenance,
  );
  const normalizedForks30d = normalizeDelta(
    forks30d.delta,
    forks30d.provenance,
  );

  const stars7dPoints = positiveMomentumPoints(
    normalizedStars7d,
    RISING_V1_POLICY.stars7dTarget,
    RISING_V1_POLICY.stars7dMaxPoints,
  );
  const stars30dPoints = positiveMomentumPoints(
    normalizedStars30d,
    RISING_V1_POLICY.stars30dTarget,
    RISING_V1_POLICY.stars30dMaxPoints,
  );
  const forks30dPoints = positiveMomentumPoints(
    normalizedForks30d,
    RISING_V1_POLICY.forks30dTarget,
    RISING_V1_POLICY.forks30dMaxPoints,
  );

  const maintenanceObservation =
    snapshot.signals['maintenance.days_since_push'];
  const maintenance =
    maintenanceObservation.availability === 'available'
      ? (() => {
          if (typeof maintenanceObservation.value !== 'number') {
            throw new Error(
              'maintenance.days_since_push must be numeric when available.',
            );
          }

          const daysSincePush = maintenanceObservation.value;

          if (!Number.isFinite(daysSincePush) || daysSincePush < 0) {
            throw new Error(
              'maintenance.days_since_push must be a finite nonnegative number.',
            );
          }

          return {
            points: roundScore(
              clamp(
                1 -
                  daysSincePush /
                    RISING_V1_POLICY.maintenanceHorizonDays,
                0,
                1,
              ) * RISING_V1_POLICY.maintenanceMaxPoints,
            ),
            coverage: {
              availability: 'available' as const,
              daysSincePush,
            },
          };
        })()
      : {
          points: 0,
          coverage: {
            availability: 'missing' as const,
            reason: maintenanceObservation.reason,
          },
        };

  const components: RisingScoreComponent[] = [
    {
      id: 'stars_7d_momentum',
      points: stars7dPoints,
      maxPoints: RISING_V1_POLICY.stars7dMaxPoints,
      signalIds: ['momentum.stars_delta_7d'],
      normalizedDelta: roundScore(normalizedStars7d),
    },
    {
      id: 'stars_30d_momentum',
      points: stars30dPoints,
      maxPoints: RISING_V1_POLICY.stars30dMaxPoints,
      signalIds: ['momentum.stars_delta_30d'],
      normalizedDelta: roundScore(normalizedStars30d),
    },
    {
      id: 'forks_30d_momentum',
      points: forks30dPoints,
      maxPoints: RISING_V1_POLICY.forks30dMaxPoints,
      signalIds: ['momentum.forks_delta_30d'],
      normalizedDelta: roundScore(normalizedForks30d),
    },
    {
      id: 'maintenance_support',
      points: maintenance.points,
      maxPoints: RISING_V1_POLICY.maintenanceMaxPoints,
      signalIds: ['maintenance.days_since_push'],
      normalizedDelta: null,
    },
  ];

  return {
    status: 'eligible',
    formulaVersion: RISING_FORMULA_VERSION,
    signalContractVersion:
      REPOSITORY_RANKING_SIGNAL_CONTRACT_VERSION,
    repositoryId: snapshot.repositoryId,
    evaluatedAt: snapshot.evaluatedAt,
    score: roundScore(
      clamp(
        components.reduce(
          (sum, component) => sum + component.points,
          0,
        ),
        0,
        100,
      ),
    ),
    components,
    historyCoverage: {
      stars7d: stars7d.provenance,
      stars30d: stars30d.provenance,
      forks30d: forks30d.provenance,
    },
    visibilityContext,
    maintenanceCoverage: maintenance.coverage,
  };
}
