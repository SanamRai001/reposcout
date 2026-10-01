import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  fetchRepositoryRankingPage,
  type RankingScoreComponent,
  type RankingTrendProvenance,
  type RepositoryRankingItem,
  type RepositoryRankingMode,
  type RepositoryRankingPage,
} from './lib/repository-ranking-client.js';

const RANKING_PAGE_SIZE = 12;

const numberFormat = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const scoreFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const componentNames: Record<string, string> = {
  maintenance: 'Maintenance freshness',
  documentation: 'README evidence',
  contribution_guidance: 'Contribution guidance',
  community_readiness: 'Community readiness',
  momentum_bonus: 'Optional momentum',
  stars_7d_momentum: '7-day star momentum',
  stars_30d_momentum: '30-day star momentum',
  forks_30d_momentum: '30-day fork momentum',
  maintenance_support: 'Recent maintenance',
};

const descriptions: Record<RepositoryRankingMode, Readonly<{
  title: string;
  description: string;
  empty: string;
}>> = {
  hidden_gems: {
    title: 'Explore Hidden Gems.',
    description:
      'Curated repositories surfaced through maintenance, documentation, community evidence and a visibility-aware formula. This is a discovery signal, not an objective quality rating.',
    empty:
      'There are no eligible Hidden Gems yet. This view needs measured metadata, README and contribution evidence; unmeasured repositories are omitted, not scored as poor projects.',
  },
  rising: {
    title: 'See what is gaining momentum.',
    description:
      'Compare recorded star and fork momentum across 7- and 30-day windows. Rankings use RepoScout snapshots, not guessed popularity or lifetime stars.',
    empty:
      'No projects have enough measured history for Rising yet. RepoScout needs suitable 7- and 30-day snapshots before it can calculate momentum. Try the full catalog meanwhile.',
  },
};

function formatUtcDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC';
}

function ScoreComponents({
  components,
}: Readonly<{ components: readonly RankingScoreComponent[] }>) {
  return (
    <ul className="ranking-breakdown">
      {components.map((component) => (
        <li key={component.id}>
          <div className="ranking-breakdown-line">
            <span>{componentNames[component.id] ?? component.id.replace(/_/g, ' ')}</span>
            <strong>
              {scoreFormat.format(component.points)} / {scoreFormat.format(component.maxPoints)} pts
            </strong>
          </div>
          <div className="ranking-meter" aria-hidden="true">
            <span
              style={{
                width: String(
                  component.maxPoints > 0
                    ? Math.max(0, Math.min(100, component.points / component.maxPoints * 100))
                    : 0,
                ) + '%',
              }}
            />
          </div>
          {component.normalizedDelta !== undefined &&
          component.normalizedDelta !== null ? (
            <small>
              Window-normalized change: {component.normalizedDelta > 0 ? '+' : ''}
              {scoreFormat.format(component.normalizedDelta)}
            </small>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function HistoryCoverage({
  label,
  window,
}: Readonly<{ label: string; window: RankingTrendProvenance }>) {
  return (
    <li>
      {label}: {window.actualWindowDays}-day observed span for a requested
      {' '}{window.requestedWindowDays}-day window.
    </li>
  );
}

export function RankingEvidenceCard({
  item,
}: Readonly<{ item: RepositoryRankingItem }>) {
  const { repository, ranking } = item;
  const metadata = repository.metadata;

  return (
    <article className="ranked-card">
      <div className="ranked-topline">
        <span className="repository-owner">{repository.owner}</span>
        <span className="ranked-score" aria-label={
          'Formula score ' + scoreFormat.format(ranking.score) + ' out of 100'
        }>
          <strong>{scoreFormat.format(ranking.score)}</strong>
          <span>/ 100 signal</span>
        </span>
      </div>
      <h3>{repository.name}</h3>
      <p className="repository-description">
        {repository.description ?? 'No repository description is available yet.'}
      </p>
      <div className="ranked-meta">
        <span>{metadata?.primaryLanguage ?? 'Language unmeasured'}</span>
        <span>{metadata ? numberFormat.format(metadata.stars) + ' stars' : 'Stars unmeasured'}</span>
        <span>{metadata?.licenseSpdx ?? 'License unmeasured'}</span>
      </div>

      <details className="ranking-evidence">
        <summary>Why this repository appears here</summary>
        <p className="ranking-explanation-intro">
          {ranking.mode === 'hidden_gems'
            ? 'This experimental formula combines current evidence and an optional momentum bonus, then accounts for popularity saturation.'
            : 'This formula emphasizes observed recent momentum, with maintenance as a small supporting signal.'}
        </p>
        <ScoreComponents components={ranking.explanation.components} />
        {ranking.mode === 'hidden_gems' ? (
          <div className="ranking-evidence-foot">
            <p>
              Positive subtotal: {scoreFormat.format(ranking.explanation.positivePoints)} pts.
              Popularity adjustment: −{scoreFormat.format(ranking.explanation.popularityPenalty.points)} pts.
            </p>
            <p>
              Optional momentum available: {ranking.explanation.optionalMomentumCoverage.available}
              {' '}of {ranking.explanation.optionalMomentumCoverage.expected} signals.
              Missing momentum is not treated as measured zero growth.
            </p>
          </div>
        ) : (
          <div className="ranking-evidence-foot">
            <strong>Historical measurement coverage</strong>
            <ul>
              <HistoryCoverage label="Stars (7d)" window={ranking.explanation.historyCoverage.stars7d} />
              <HistoryCoverage label="Stars (30d)" window={ranking.explanation.historyCoverage.stars30d} />
              <HistoryCoverage label="Forks (30d)" window={ranking.explanation.historyCoverage.forks30d} />
            </ul>
            <p>
              Current total stars and forks are visibility context only; they do not add ranking points.
            </p>
          </div>
        )}
        <p className="ranking-formula">Formula: {ranking.formulaVersion}</p>
      </details>

      <a
        className="repository-link"
        href={repository.githubUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Explore on GitHub <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}

function RankingSkeleton() {
  return (
    <div className="ranking-grid" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="ranked-card repository-card-skeleton" key={index}>
          <div className="skeleton-line skeleton-line-short" />
          <div className="skeleton-line skeleton-line-title" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line-medium" />
          <div className="skeleton-line skeleton-line-footer" />
        </div>
      ))}
    </div>
  );
}

export function RankingExplorer({
  mode,
}: Readonly<{ mode: RepositoryRankingMode }>) {
  const [page, setPage] = useState<RepositoryRankingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const paginationController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrorMessage(null);
    setPageError(null);
    setPage(null);
    void fetchRepositoryRankingPage({
      mode,
      limit: RANKING_PAGE_SIZE,
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setPage(result);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load rankings right now.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [mode, reloadToken]);

  useEffect(
    () => () => paginationController.current?.abort(),
    [mode],
  );

  async function loadMore(): Promise<void> {
    if (!page?.pagination.nextCursor || loadingMore) return;

    const cursor = page.pagination.nextCursor;
    const controller = new AbortController();
    paginationController.current = controller;
    setLoadingMore(true);
    setPageError(null);

    try {
      const next = await fetchRepositoryRankingPage({
        mode,
        limit: RANKING_PAGE_SIZE,
        cursor,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;
      setPage((current) => {
        if (!current || current.ranking.mode !== mode ||
            current.pagination.nextCursor !== cursor ||
            current.ranking.formulaVersion !== next.ranking.formulaVersion ||
            current.ranking.evaluatedAt !== next.ranking.evaluatedAt) {
          return current;
        }

        const seen = new Set(current.data.map((item) => item.repository.id));
        return {
          data: [
            ...current.data,
            ...next.data.filter((item) => !seen.has(item.repository.id)),
          ],
          ranking: current.ranking,
          pagination: next.pagination,
        };
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        setPageError(
          error instanceof Error
            ? error.message
            : 'Unable to load more ranking results.',
        );
      }
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
      if (paginationController.current === controller) {
        paginationController.current = null;
      }
    }
  }

  const copy = descriptions[mode];

  return (
    <section className="ranking-section" aria-labelledby="ranking-heading">
      <div className="ranking-intro">
        <div>
          <p className="catalog-kicker">Evidence-backed discovery</p>
          <h2 id="ranking-heading">{copy.title}</h2>
        </div>
        <p>{copy.description}</p>
      </div>

      {!loading && page ? (
        <div className="ranking-stats" aria-label="Ranking evaluation context">
          <span><strong>{page.ranking.eligibleCount}</strong> eligible repositories</span>
          <span><strong>{page.ranking.evaluatedCount}</strong> listed repositories evaluated</span>
          <span>Evaluated {formatUtcDate(page.ranking.evaluatedAt)}</span>
        </div>
      ) : null}

      <div aria-live="polite" aria-busy={loading || loadingMore}>
        {loading ? <RankingSkeleton /> : null}

        {!loading && errorMessage ? (
          <div className="catalog-state catalog-state-error" role="alert">
            <span className="state-signal state-signal-error" aria-hidden="true" />
            <h3>Ranking data unavailable</h3>
            <p>{errorMessage}</p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : null}

        {!loading && page?.data.length === 0 ? (
          <div className="catalog-state">
            <span className="state-signal" aria-hidden="true" />
            <h3>No eligible repositories yet</h3>
            <p>{copy.empty}</p>
            <a className="ranking-catalog-link" href="/">Browse the full catalog ↗</a>
          </div>
        ) : null}

        {!loading && page && page.data.length > 0 ? (
          <>
            <div className="ranking-grid">
              {page.data.map((item) => (
                <RankingEvidenceCard
                  key={item.repository.id}
                  item={item}
                />
              ))}
            </div>
            {pageError ? (
              <div className="inline-error" role="alert">
                <span className="state-signal state-signal-error" aria-hidden="true" />
                <span>{pageError}</span>
                <button
                  className="ranking-inline-retry"
                  type="button"
                  onClick={() => void loadMore()}
                >
                  Retry
                </button>
              </div>
            ) : null}
            <div className="catalog-actions">
              {page.pagination.nextCursor ? (
                <button
                  className="primary-button"
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? 'Loading more…' : 'Load more ranked repositories'}
                </button>
              ) : (
                <span className="catalog-end">
                  <span className="signal-dot" aria-hidden="true" />
                  End of eligible repositories in this view.
                </span>
              )}
            </div>
          </>
        ) : null}
      </div>
      <p className="ranking-methodology">
        Ranked lists use deterministic formula evidence; they are not universal
        repository-quality judgments. Ineligible or unmeasured projects are
        omitted. Ranking pagination can shift if source data refreshes during browsing.
      </p>
    </section>
  );
}
