import { useEffect, useState } from 'react';

import {
  fetchRepositoryCatalogPage,
  type RepositoryCatalogItem,
} from './lib/repository-catalog-client';

const PAGE_SIZE = 12;

function formatSyncDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Sync time unavailable';
  }

  return `Synced ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)}`;
}

function RepositoryCard({
  repository,
}: Readonly<{ repository: RepositoryCatalogItem }>) {
  return (
    <article className="repository-card">
      <div className="repository-card-topline">
        <span className="repository-owner">{repository.owner}</span>
        <div className="repository-badges" aria-label="Repository status">
          {repository.isArchived ? (
            <span className="repository-badge repository-badge-warm">
              Archived
            </span>
          ) : null}
          {repository.isFork ? (
            <span className="repository-badge">Fork</span>
          ) : null}
        </div>
      </div>

      <h2>{repository.name}</h2>

      <p className="repository-description">
        {repository.description ?? 'No repository description is available yet.'}
      </p>

      <div className="repository-meta">
        <span>
          <span className="meta-dot" aria-hidden="true" />
          {repository.defaultBranch
            ? `Default branch: ${repository.defaultBranch}`
            : 'Default branch unavailable'}
        </span>
        <span>{formatSyncDate(repository.lastSyncedAt)}</span>
      </div>

      <a
        className="repository-link"
        href={repository.githubUrl}
        target="_blank"
        rel="noreferrer"
      >
        View on GitHub
        <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}

function CatalogSkeleton() {
  return (
    <div className="repository-grid" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="repository-card repository-card-skeleton" key={index}>
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

export function App() {
  const [repositories, setRepositories] = useState<RepositoryCatalogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setInitialLoading(true);
    setErrorMessage(null);

    void fetchRepositoryCatalogPage({
      limit: PAGE_SIZE,
      signal: controller.signal,
    })
      .then((page) => {
        setRepositories(page.data);
        setNextCursor(page.pagination.nextCursor);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setRepositories([]);
        setNextCursor(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load repositories right now.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setInitialLoading(false);
        }
      });

    return () => controller.abort();
  }, [reloadToken]);

  async function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setErrorMessage(null);

    try {
      const page = await fetchRepositoryCatalogPage({
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });

      setRepositories((current) => {
        const existingIds = new Set(
          current.map((repository) => repository.id),
        );
        const newRepositories = page.data.filter(
          (repository) => !existingIds.has(repository.id),
        );

        return [...current, ...newRepositories];
      });
      setNextCursor(page.pagination.nextCursor);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load more repositories right now.',
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const hasRepositories = repositories.length > 0;

  return (
    <main className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />

      <header className="site-header">
        <a className="brand-lockup" href="/" aria-label="RepoScout home">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-mark-dot" />
          </span>
          <span>RepoScout</span>
        </a>

        <span className="phase-badge">Catalog · Phase 3B</span>
      </header>

      <section className="catalog-intro" aria-labelledby="catalog-title">
        <p className="eyebrow">Repository index</p>
        <div className="catalog-intro-grid">
          <div>
            <h1 id="catalog-title">Discover open source worth knowing.</h1>
          </div>
          <p>
            Browse the first repositories indexed by RepoScout. These are
            canonical repository facts from our own catalog—no popularity
            ranking, AI scoring, or hidden recommendation logic yet.
          </p>
        </div>
      </section>

      <section className="catalog-section" aria-labelledby="catalog-heading">
        <div className="catalog-heading-row">
          <div>
            <p className="catalog-kicker">Live catalog</p>
            <h2 id="catalog-heading">Indexed repositories</h2>
          </div>

          {!initialLoading && hasRepositories ? (
            <span className="catalog-count">
              {repositories.length}
              {nextCursor ? '+' : ''} loaded
            </span>
          ) : null}
        </div>

        <div aria-live="polite">
          {initialLoading ? <CatalogSkeleton /> : null}

          {!initialLoading && errorMessage && !hasRepositories ? (
            <div className="catalog-state catalog-state-error">
              <span className="state-signal state-signal-error" aria-hidden="true" />
              <h3>Catalog unavailable</h3>
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

          {!initialLoading && !errorMessage && !hasRepositories ? (
            <div className="catalog-state">
              <span className="state-signal" aria-hidden="true" />
              <h3>No repositories indexed yet</h3>
              <p>
                The catalog API is ready. Repositories will appear here as they
                are ingested into RepoScout.
              </p>
            </div>
          ) : null}

          {!initialLoading && hasRepositories ? (
            <>
              <div className="repository-grid">
                {repositories.map((repository) => (
                  <RepositoryCard
                    repository={repository}
                    key={repository.id}
                  />
                ))}
              </div>

              {errorMessage ? (
                <div className="inline-error" role="status">
                  <span className="state-signal state-signal-error" aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              <div className="catalog-actions">
                {nextCursor ? (
                  <button
                    className="primary-button"
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                  >
                    {loadingMore ? 'Loading repositories…' : 'Load more'}
                  </button>
                ) : (
                  <span className="catalog-end">
                    <span className="signal-dot" aria-hidden="true" />
                    You reached the end of the current index.
                  </span>
                )}
              </div>
            </>
          ) : null}
        </div>
      </section>

      <footer className="catalog-footer">
        <span>Measured facts first. Discovery signals come next.</span>
        <span>RepoScout · open-source repository intelligence</span>
      </footer>
    </main>
  );
}
