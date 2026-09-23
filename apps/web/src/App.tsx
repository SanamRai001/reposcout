import {
  type FormEvent,
  useEffect,
  useState,
} from 'react';

import {
  fetchRepositoryCatalogPage,
  fetchRepositoryDiscoveryPage,
  normalizeRepositoryDiscoveryScope,
  repositoryDiscoveryScopeFromSearch,
  repositoryDiscoveryScopeToSearch,
  type RepositoryCatalogItem,
  type RepositoryDiscoveryScope,
} from './lib/repository-catalog-client';

const PAGE_SIZE = 12;

type DiscoveryFormState = Readonly<{
  query: string;
  language: string;
  license: string;
  topics: string;
  minStars: string;
  maxStars: string;
  fork: '' | 'true' | 'false';
  archived: '' | 'true' | 'false';
}>;

const compactNumber = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatCount(value: number): string {
  return compactNumber.format(value);
}

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

function formFromScope(
  scope: RepositoryDiscoveryScope | null,
): DiscoveryFormState {
  return {
    query: scope?.query ?? '',
    language: scope?.filters.language ?? '',
    license: scope?.filters.license ?? '',
    topics: scope?.filters.topics.join(', ') ?? '',
    minStars:
      scope?.filters.minStars !== null &&
      scope?.filters.minStars !== undefined
        ? String(scope.filters.minStars)
        : '',
    maxStars:
      scope?.filters.maxStars !== null &&
      scope?.filters.maxStars !== undefined
        ? String(scope.filters.maxStars)
        : '',
    fork:
      scope?.filters.fork === null || scope?.filters.fork === undefined
        ? ''
        : String(scope.filters.fork) as 'true' | 'false',
    archived:
      scope?.filters.archived === null ||
      scope?.filters.archived === undefined
        ? ''
        : String(scope.filters.archived) as 'true' | 'false',
  };
}

function parseOptionalInteger(
  value: string,
  label: string,
): number | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${label} must be a nonnegative whole number.`);
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} is too large.`);
  }

  return parsed;
}

function scopeFromForm(
  form: DiscoveryFormState,
): RepositoryDiscoveryScope | null {
  const minStars = parseOptionalInteger(form.minStars, 'Minimum stars');
  const maxStars = parseOptionalInteger(form.maxStars, 'Maximum stars');

  if (
    minStars !== null &&
    maxStars !== null &&
    minStars > maxStars
  ) {
    throw new Error(
      'Minimum stars must be less than or equal to maximum stars.',
    );
  }

  const topics = form.topics
    .split(',')
    .map((topic) => topic.trim())
    .filter(Boolean);

  if (topics.length > 10) {
    throw new Error('Use at most 10 topics.');
  }

  const scope = normalizeRepositoryDiscoveryScope({
    query: form.query,
    language: form.language,
    license: form.license,
    topics,
    minStars,
    maxStars,
    fork: form.fork === '' ? null : form.fork === 'true',
    archived:
      form.archived === '' ? null : form.archived === 'true',
  });

  if (scope?.query && scope.query.length < 2) {
    throw new Error('Search text must contain at least 2 characters.');
  }

  if (scope?.query && scope.query.length > 120) {
    throw new Error('Search text must be 120 characters or fewer.');
  }

  for (const [label, value] of [
    ['Language', scope?.filters.language],
    ['License', scope?.filters.license],
    ...((scope?.filters.topics ?? []).map(
      (topic) => ['Topic', topic] as const,
    )),
  ] as const) {
    if (value && value.length > 64) {
      throw new Error(`${label} must be 64 characters or fewer.`);
    }
  }

  return scope;
}

function browserScope(): RepositoryDiscoveryScope | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return repositoryDiscoveryScopeFromSearch(window.location.search);
}

function updateBrowserScope(scope: RepositoryDiscoveryScope | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const search = repositoryDiscoveryScopeToSearch(scope);
  const url = search
    ? `${window.location.pathname}?${search}`
    : window.location.pathname;

  window.history.pushState(null, '', url);
}

function discoveryLabels(
  scope: RepositoryDiscoveryScope,
): string[] {
  const labels: string[] = [];

  if (scope.query) {
    labels.push(`Search: ${scope.query}`);
  }

  if (scope.filters.language) {
    labels.push(`Language: ${scope.filters.language}`);
  }

  if (scope.filters.license) {
    labels.push(`License: ${scope.filters.license}`);
  }

  for (const topic of scope.filters.topics) {
    labels.push(`#${topic}`);
  }

  if (scope.filters.minStars !== null) {
    labels.push(`≥ ${scope.filters.minStars} stars`);
  }

  if (scope.filters.maxStars !== null) {
    labels.push(`≤ ${scope.filters.maxStars} stars`);
  }

  if (scope.filters.fork !== null) {
    labels.push(scope.filters.fork ? 'Forks' : 'Not forks');
  }

  if (scope.filters.archived !== null) {
    labels.push(scope.filters.archived ? 'Archived' : 'Not archived');
  }

  return labels;
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

      {repository.metadata ? (
        <>
          <div className="repository-stats" aria-label="Repository metrics">
            <span>
              <strong>{formatCount(repository.metadata.stars)}</strong>
              <small>Stars</small>
            </span>
            <span>
              <strong>{formatCount(repository.metadata.forks)}</strong>
              <small>Forks</small>
            </span>
            <span>
              <strong>{formatCount(repository.metadata.openIssues)}</strong>
              <small>Open issues/PRs</small>
            </span>
          </div>

          <div className="repository-facts">
            {repository.metadata.primaryLanguage ? (
              <span>{repository.metadata.primaryLanguage}</span>
            ) : null}
            {repository.metadata.licenseSpdx ? (
              <span>{repository.metadata.licenseSpdx}</span>
            ) : null}
            {repository.metadata.topics.slice(0, 2).map((topic) => (
              <span key={topic}>#{topic}</span>
            ))}
          </div>
        </>
      ) : (
        <p className="metadata-pending">Metadata pending</p>
      )}

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
  const initialScope = browserScope();
  const [activeScope, setActiveScope] =
    useState<RepositoryDiscoveryScope | null>(initialScope);
  const [form, setForm] = useState<DiscoveryFormState>(
    formFromScope(initialScope),
  );
  const [repositories, setRepositories] = useState<RepositoryCatalogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const request = activeScope
      ? fetchRepositoryDiscoveryPage({
          scope: activeScope,
          limit: PAGE_SIZE,
          signal: controller.signal,
        })
      : fetchRepositoryCatalogPage({
          limit: PAGE_SIZE,
          signal: controller.signal,
        });

    void request
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
            : activeScope
              ? 'Unable to search repositories right now.'
              : 'Unable to load repositories right now.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setInitialLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeScope, reloadToken]);

  useEffect(() => {
    const handlePopState = () => {
      const scope = browserScope();
      setInitialLoading(true);
      setLoadingMore(false);
      setErrorMessage(null);
      setFormError(null);
      setRepositories([]);
      setNextCursor(null);
      setActiveScope(scope);
      setForm(formFromScope(scope));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function commitScope(scope: RepositoryDiscoveryScope | null): void {
    updateBrowserScope(scope);
    setInitialLoading(true);
    setLoadingMore(false);
    setErrorMessage(null);
    setFormError(null);
    setRepositories([]);
    setNextCursor(null);
    setActiveScope(scope);
    setForm(formFromScope(scope));
  }

  function submitDiscovery(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    try {
      commitScope(scopeFromForm(form));
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Check the discovery filters and try again.',
      );
    }
  }

  function clearDiscovery(): void {
    commitScope(null);
  }

  function retryCatalog(): void {
    setInitialLoading(true);
    setErrorMessage(null);
    setReloadToken((value) => value + 1);
  }

  async function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setErrorMessage(null);

    try {
      const page = activeScope
        ? await fetchRepositoryDiscoveryPage({
            scope: activeScope,
            cursor: nextCursor,
            limit: PAGE_SIZE,
          })
        : await fetchRepositoryCatalogPage({
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
          : activeScope
            ? 'Unable to load more matches right now.'
            : 'Unable to load more repositories right now.',
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const hasRepositories = repositories.length > 0;
  const isDiscovery = activeScope !== null;
  const activeLabels = activeScope ? discoveryLabels(activeScope) : [];

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

        <span className="phase-badge">Discovery · Phase 4C</span>
      </header>

      <section className="catalog-intro" aria-labelledby="catalog-title">
        <p className="eyebrow">Open-source discovery</p>
        <div className="catalog-intro-grid">
          <div>
            <h1 id="catalog-title">Discover open source worth knowing.</h1>
          </div>
          <p>
            Search canonical repository text or narrow the index with measured
            language, license, topic, star, fork, and archive filters. Results
            are deterministic matches—not an AI score or hidden relevance rank.
          </p>
        </div>
      </section>

      <section
        className="discovery-section"
        aria-labelledby="discovery-heading"
      >
        <div className="discovery-heading">
          <div>
            <p className="catalog-kicker">Discovery controls</p>
            <h2 id="discovery-heading">Find a useful repository</h2>
          </div>
          <p>
            Leave search text empty to discover by filters only. Topic filters
            use all-topic matching.
          </p>
        </div>

        <form className="discovery-panel" onSubmit={submitDiscovery}>
          <div className="discovery-search-row">
            <label className="discovery-field discovery-field-search">
              <span>Search</span>
              <input
                type="search"
                value={form.query}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    query: event.target.value,
                  }))
                }
                placeholder="TypeScript backend SDK"
                maxLength={120}
              />
            </label>

            <button className="primary-button" type="submit">
              Apply discovery
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={clearDiscovery}
            >
              Clear
            </button>
          </div>

          <div className="discovery-filter-grid">
            <label className="discovery-field">
              <span>Language</span>
              <input
                value={form.language}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    language: event.target.value,
                  }))
                }
                placeholder="typescript"
                maxLength={64}
              />
            </label>

            <label className="discovery-field">
              <span>License</span>
              <input
                value={form.license}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    license: event.target.value,
                  }))
                }
                placeholder="mit"
                maxLength={64}
              />
            </label>

            <label className="discovery-field discovery-field-topics">
              <span>Topics</span>
              <input
                value={form.topics}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    topics: event.target.value,
                  }))
                }
                placeholder="backend, sdk"
              />
            </label>

            <label className="discovery-field">
              <span>Min stars</span>
              <input
                inputMode="numeric"
                value={form.minStars}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minStars: event.target.value,
                  }))
                }
                placeholder="100"
              />
            </label>

            <label className="discovery-field">
              <span>Max stars</span>
              <input
                inputMode="numeric"
                value={form.maxStars}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxStars: event.target.value,
                  }))
                }
                placeholder="5000"
              />
            </label>

            <label className="discovery-field">
              <span>Fork state</span>
              <select
                value={form.fork}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fork: event.target.value as DiscoveryFormState['fork'],
                  }))
                }
              >
                <option value="">Any</option>
                <option value="false">Not forks</option>
                <option value="true">Forks only</option>
              </select>
            </label>

            <label className="discovery-field">
              <span>Archive state</span>
              <select
                value={form.archived}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    archived:
                      event.target.value as DiscoveryFormState['archived'],
                  }))
                }
              >
                <option value="">Any</option>
                <option value="false">Active only</option>
                <option value="true">Archived only</option>
              </select>
            </label>
          </div>

          <div className="discovery-panel-footer">
            <span>
              Results currently use stable traversal order, not relevance
              ranking.
            </span>
            <span>Up to 10 comma-separated topics.</span>
          </div>

          {formError ? (
            <div className="inline-error discovery-form-error" role="alert">
              <span
                className="state-signal state-signal-error"
                aria-hidden="true"
              />
              <span>{formError}</span>
            </div>
          ) : null}
        </form>

        {activeLabels.length > 0 ? (
          <div className="active-discovery" aria-label="Active discovery scope">
            <span className="active-discovery-label">Active</span>
            <div className="active-discovery-chips">
              {activeLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="catalog-section" aria-labelledby="catalog-heading">
        <div className="catalog-heading-row">
          <div>
            <p className="catalog-kicker">
              {isDiscovery ? 'Discovery matches' : 'Live catalog'}
            </p>
            <h2 id="catalog-heading">
              {isDiscovery ? 'Matching repositories' : 'Indexed repositories'}
            </h2>
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
              <span
                className="state-signal state-signal-error"
                aria-hidden="true"
              />
              <h3>
                {isDiscovery ? 'Discovery unavailable' : 'Catalog unavailable'}
              </h3>
              <p>{errorMessage}</p>
              <button
                className="secondary-button"
                type="button"
                onClick={retryCatalog}
              >
                Try again
              </button>
            </div>
          ) : null}

          {!initialLoading && !errorMessage && !hasRepositories ? (
            <div className="catalog-state">
              <span className="state-signal" aria-hidden="true" />
              <h3>
                {isDiscovery
                  ? 'No repositories match this discovery scope'
                  : 'No repositories indexed yet'}
              </h3>
              <p>
                {isDiscovery
                  ? 'Try a broader search, remove a filter, or return to the full catalog.'
                  : 'The catalog API is ready. Repositories will appear here as they are ingested into RepoScout.'}
              </p>
              {isDiscovery ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={clearDiscovery}
                >
                  Browse full catalog
                </button>
              ) : null}
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
                  <span
                    className="state-signal state-signal-error"
                    aria-hidden="true"
                  />
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
                    {loadingMore
                      ? isDiscovery
                        ? 'Loading matches…'
                        : 'Loading repositories…'
                      : 'Load more'}
                  </button>
                ) : (
                  <span className="catalog-end">
                    <span className="signal-dot" aria-hidden="true" />
                    {isDiscovery
                      ? 'You reached the end of these matches.'
                      : 'You reached the end of the current index.'}
                  </span>
                )}
              </div>
            </>
          ) : null}
        </div>
      </section>

      <footer className="catalog-footer">
        <span>Deterministic search and filters. No hidden ranking.</span>
        <span>RepoScout · open-source repository intelligence</span>
      </footer>
    </main>
  );
}
