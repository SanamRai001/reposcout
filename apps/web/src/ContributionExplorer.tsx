import { type FormEvent, useEffect, useRef, useState } from 'react';

import {
  ContributionDiscoveryError,
  EMPTY_CONTRIBUTION_FILTERS,
  fetchContributionDiscoveryPage,
  normalizeContributionFilters,
  type ContributionDiscoveryItem,
  type ContributionDiscoveryPage,
  type ContributionFilters,
  type ContributionProcessFilter,
} from './lib/contribution-discovery-client.js';
import {
  contributionFiltersFromSearch,
  contributionFiltersToSearch,
} from './lib/contribution-navigation.js';
import './contribution.css';

const PAGE_SIZE = 12;

type FilterForm = {
  unassigned: string;
  unlocked: string;
  goodFirstIssue: string;
  helpWanted: string;
  language: string;
  updatedWithinDays: string;
  contributing: string;
};

type LocationState =
  | Readonly<{ valid: true; filters: ContributionFilters }>
  | Readonly<{ valid: false; message: string }>;

function fromLocation(): LocationState {
  if (typeof window === 'undefined') {
    return { valid: true, filters: EMPTY_CONTRIBUTION_FILTERS };
  }

  try {
    return {
      valid: true,
      filters: contributionFiltersFromSearch(window.location.search),
    };
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error
        ? error.message
        : 'The shared contribution filters are invalid.',
    };
  }
}

function fromBool(value: boolean | null): string {
  return value === null ? '' : String(value);
}

function toBool(value: string): boolean | null {
  return value === '' ? null : value === 'true';
}

function formFromFilters(filters: ContributionFilters): FilterForm {
  return {
    unassigned: fromBool(filters.unassigned),
    unlocked: fromBool(filters.unlocked),
    goodFirstIssue: fromBool(filters.goodFirstIssue),
    helpWanted: fromBool(filters.helpWanted),
    language: filters.language ?? '',
    updatedWithinDays: filters.updatedWithinDays?.toString() ?? '',
    contributing: filters.contributing ?? '',
  };
}

function filtersFromForm(form: FilterForm): ContributionFilters {
  const days = form.updatedWithinDays.trim();
  if (days && !/^\d+$/.test(days)) {
    throw new ContributionDiscoveryError(
      'Update window must be a whole number of days.',
      null,
      'invalid_contribution_filter',
    );
  }

  return normalizeContributionFilters({
    unassigned: toBool(form.unassigned),
    unlocked: toBool(form.unlocked),
    goodFirstIssue: toBool(form.goodFirstIssue),
    helpWanted: toBool(form.helpWanted),
    language: form.language.trim() ? form.language : null,
    updatedWithinDays: days ? Number(days) : null,
    contributing: (form.contributing || null) as ContributionProcessFilter | null,
  });
}

function displayTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC';
}

const limitationLabels: Record<string, string> = {
  issue_complexity_not_measured: 'Actual issue complexity is not measured.',
  maintainer_responsiveness_not_measured: 'Maintainer responsiveness is not measured.',
  linked_pr_outcomes_not_measured: 'Outcomes of linked pull requests are not measured.',
  external_contributor_success_not_measured: 'External contributor success is not measured.',
  required_domain_expertise_not_measured: 'Required domain expertise is not measured.',
};

function guidanceLabel(item: ContributionDiscoveryItem): string {
  const signal = item.evidence.signals['process.contributing_present'];
  if (signal.availability === 'missing') {
    return signal.reason === 'not_applicable'
      ? 'CONTRIBUTING evidence not applicable'
      : 'CONTRIBUTING evidence not collected';
  }
  return signal.value === true
    ? 'CONTRIBUTING guidance observed'
    : 'No CONTRIBUTING guidance observed';
}

export function ContributionIssueCard({
  item,
}: Readonly<{ item: ContributionDiscoveryItem }>) {
  const { repository, issue, recommendation } = item;

  return (
    <article className="contribution-card">
      <div className="contribution-card-topline">
        <span className="repository-owner">{repository.fullName}</span>
        <span className={recommendation.status === 'consider'
          ? 'contribution-signal contribution-signal-consider'
          : 'contribution-signal'}>
          {recommendation.status === 'consider'
            ? 'Signals to consider'
            : 'Review issue details'}
        </span>
      </div>
      <h3>{issue.title}</h3>
      <p className="contribution-issue-number">
        Issue #{issue.number} · {repository.primaryLanguage ?? 'Language not collected'}
      </p>
      <div className="contribution-facts">
        <span>Open when observed</span>
        <span>{issue.assigneeCount === 0 ? 'Unassigned' : issue.assigneeCount + ' assignees'}</span>
        <span>{issue.locked ? 'Discussion locked' : 'Discussion open'}</span>
        <span>{issue.commentCount} comments observed</span>
      </div>
      {issue.labels.length > 0 ? (
        <div className="contribution-labels" aria-label="GitHub issue labels">
          {issue.labels.map((label) => <span key={label}>{label}</span>)}
        </div>
      ) : null}
      <p className="contribution-guidance">{guidanceLabel(item)}</p>
      <p className="contribution-observation">
        Last GitHub issue update: {displayTime(issue.updatedAtGithub)}
        <br />
        RepoScout observed this issue: {displayTime(issue.observedAt)}
      </p>

      <details className="contribution-evidence">
        <summary>Evidence, cautions &amp; limitations</summary>
        <div className="contribution-explanations">
          <h4>Observed evidence</h4>
          {recommendation.evidence.length > 0 ? (
            <ul>
              {recommendation.evidence.map(({ code, message }) => (
                <li key={code}>{message}</li>
              ))}
            </ul>
          ) : <p>No positive discovery evidence recorded.</p>}
          <h4>Cautions</h4>
          {recommendation.cautions.length > 0 ? (
            <ul>
              {recommendation.cautions.map(({ code, message }) => (
                <li key={code}>{message}</li>
              ))}
            </ul>
          ) : <p>No additional cautions recorded in the current formula.</p>}
          <h4>Not measured by RepoScout</h4>
          <ul>
            {recommendation.limitations.map((code) => (
              <li key={code}>{limitationLabels[code] ?? code.replaceAll('_', ' ')}</li>
            ))}
          </ul>
        </div>
        <p className="contribution-contract">
          {recommendation.contractVersion} · {item.evidence.signals['availability.open'].id}
        </p>
      </details>

      <a className="repository-link" href={issue.githubUrl} target="_blank" rel="noopener noreferrer">
        View current issue on GitHub <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}

type ResultsState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error'; message: string }>
  | Readonly<{ status: 'ready'; page: ContributionDiscoveryPage }>;

export function ContributionResults({
  filters,
}: Readonly<{ filters: ContributionFilters }>) {
  const [results, setResults] = useState<ResultsState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const paginationController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchContributionDiscoveryPage({
      filters,
      limit: PAGE_SIZE,
      signal: controller.signal,
    }).then((page) => {
      if (!controller.signal.aborted) setResults({ status: 'ready', page });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setResults({
          status: 'error',
          message: error instanceof Error
            ? error.message
            : 'Could not load contribution issues.',
        });
      }
    });
    return () => controller.abort();
  }, [filters, reloadToken]);

  useEffect(() => () => paginationController.current?.abort(), []);

  function restart(): void {
    paginationController.current?.abort();
    setResults({ status: 'loading' });
    setPageError(null);
    setLoadingMore(false);
    setReloadToken((current) => current + 1);
  }

  async function loadMore(): Promise<void> {
    if (loadingMore || results.status !== 'ready' ||
        !results.page.pagination.nextCursor) return;

    const current = results.page;
    const cursor = current.pagination.nextCursor;
    const controller = new AbortController();
    paginationController.current = controller;
    setLoadingMore(true);
    setPageError(null);

    try {
      const next = await fetchContributionDiscoveryPage({
        filters, limit: PAGE_SIZE, cursor, signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      if (next.discovery.evaluatedAt !== current.discovery.evaluatedAt ||
          next.discovery.contractVersion !== current.discovery.contractVersion) {
        setPageError('The contribution snapshot changed while paging. Restart results to continue.');
        return;
      }

      setResults((previous) => {
        if (previous.status !== 'ready' ||
            previous.page.pagination.nextCursor !== cursor ||
            previous.page.discovery.evaluatedAt !== current.discovery.evaluatedAt) {
          return previous;
        }
        const seen = new Set(previous.page.data.map((item) =>
          item.repository.id + ':' + item.issue.githubIssueId));
        return {
          status: 'ready',
          page: {
            data: [
              ...previous.page.data,
              ...next.data.filter((item) =>
                !seen.has(item.repository.id + ':' + item.issue.githubIssueId)),
            ],
            discovery: previous.page.discovery,
            pagination: next.pagination,
          },
        };
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        setPageError(error instanceof Error
          ? error.message : 'Unable to load more contribution issues.');
      }
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
      if (paginationController.current === controller) paginationController.current = null;
    }
  }

  return (
    <section className="contribution-results" aria-label="Matching contribution issues">
      <div className="contribution-results-heading">
        <div>
          <p className="catalog-kicker">Stored public issue observations</p>
          <h2>Explore open issues</h2>
        </div>
        <p>
          The list follows a stable update-time traversal, not a difficulty or suitability rank.
          Always check the linked issue on GitHub before starting work.
        </p>
      </div>

      <div aria-live="polite" aria-busy={results.status === 'loading' || loadingMore}>
        {results.status === 'loading' ? (
          <div className="catalog-state" role="status">
            <span className="state-signal" aria-hidden="true" />
            <h3>Loading observed issues…</h3>
            <p>Checking the selected evidence filters.</p>
          </div>
        ) : null}

        {results.status === 'error' ? (
          <div className="catalog-state catalog-state-error" role="alert">
            <span className="state-signal state-signal-error" aria-hidden="true" />
            <h3>Issue discovery is unavailable</h3>
            <p>{results.message}</p>
            <button className="secondary-button" type="button" onClick={restart}>
              Try again
            </button>
          </div>
        ) : null}

        {results.status === 'ready' ? (
          <>
            <p className="contribution-evaluated">
              Evidence evaluated {displayTime(results.page.discovery.evaluatedAt)}
            </p>
            {results.page.data.length === 0 ? (
              <div className="catalog-state">
                <span className="state-signal" aria-hidden="true" />
                <h3>No observed issues match these filters</h3>
                <p>Try a broader filter set. An empty view does not mean a project has no opportunities on GitHub.</p>
              </div>
            ) : (
              <div className="contribution-grid">
                {results.page.data.map((item) => (
                  <ContributionIssueCard
                    key={item.repository.id + ':' + item.issue.githubIssueId}
                    item={item}
                  />
                ))}
              </div>
            )}

            {pageError ? (
              <div className="inline-error" role="alert">
                <span className="state-signal state-signal-error" aria-hidden="true" />
                <span>{pageError}</span>
                <button className="contribution-retry" type="button"
                  disabled={loadingMore} onClick={() => void loadMore()}>
                  Retry page
                </button>
                <button className="contribution-retry" type="button" onClick={restart}>
                  Restart results
                </button>
              </div>
            ) : null}

            {results.page.data.length > 0 ? (
              <div className="catalog-actions">
                {results.page.pagination.nextCursor ? (
                  <button className="primary-button" type="button"
                    disabled={loadingMore} onClick={() => void loadMore()}>
                    {loadingMore ? 'Loading more…' : 'Load more issues'}
                  </button>
                ) : (
                  <span className="catalog-end">
                    <span className="signal-dot" aria-hidden="true" />
                    End of observed issues in this filter scope.
                  </span>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function ThreeStateSelect({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="contribution-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Any</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </label>
  );
}

export function ContributionExplorer() {
  const [location, setLocation] = useState<LocationState>(fromLocation);
  const [form, setForm] = useState<FilterForm>(() => formFromFilters(
    typeof window !== 'undefined' ? (
      (() => {
        try {
          return contributionFiltersFromSearch(window.location.search);
        } catch {
          return EMPTY_CONTRIBUTION_FILTERS;
        }
      })()
    ) : EMPTY_CONTRIBUTION_FILTERS,
  ));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const onPopState = () => {
      const current = fromLocation();
      setLocation(current);
      setForm(formFromFilters(current.valid
        ? current.filters : EMPTY_CONTRIBUTION_FILTERS));
      setFormError(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function navigate(filters: ContributionFilters): void {
    const search = contributionFiltersToSearch(filters);
    if (typeof window !== 'undefined') {
      const newPath = '/contribute' + (search ? '?' + search : '');
      if (window.location.pathname + window.location.search !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    }
    setLocation({ valid: true, filters });
    setForm(formFromFilters(filters));
    setFormError(null);
  }

  function submitFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    try {
      navigate(filtersFromForm(form));
    } catch (error) {
      setFormError(error instanceof Error
        ? error.message : 'Please check the selected issue filters.');
    }
  }

  const activeSearch = location.valid
    ? contributionFiltersToSearch(location.filters) : null;

  return (
    <main className="app-shell contribution-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <header className="site-header">
        <a className="brand-lockup" href="/" aria-label="RepoScout home">
          <span className="brand-mark" aria-hidden="true"><span className="brand-mark-dot" /></span>
          <span>RepoScout</span>
        </a>
        <nav className="contribution-header-links" aria-label="Main">
          <a className="header-link" href="/">Repository discovery</a>
          <a className="header-link" href="/#add-repository">Submit a repository</a>
        </nav>
      </header>

      <section className="catalog-intro contribution-intro" aria-labelledby="contribution-title">
        <p className="eyebrow">Community · Public GitHub issues</p>
        <div className="catalog-intro-grid">
          <div><h1 id="contribution-title">Find somewhere to contribute.</h1></div>
          <p>
            Explore stored issue observations from curated public projects.
            View actual signals, read cautions, and open the live issue on GitHub.
            A good-first-issue label is a hint, not proof that a task is easy.
          </p>
        </div>
      </section>

      <section className="contribution-filter-section" aria-labelledby="contribution-filters-title">
        <div className="contribution-filter-heading">
          <div>
            <p className="catalog-kicker">Narrow the issue list</p>
            <h2 id="contribution-filters-title">Find a relevant entry point</h2>
          </div>
          <p>Choose any combination. Filters apply only after selecting Apply filters.</p>
        </div>

        <form className="contribution-filter-panel" onSubmit={submitFilters}>
          <div className="contribution-filter-grid">
            <label className="contribution-field">
              <span>Primary language</span>
              <input value={form.language} maxLength={64} placeholder="typescript"
                onChange={(event) => setForm((current) =>
                  ({ ...current, language: event.target.value }))} />
            </label>
            <ThreeStateSelect label="Good first issue label" value={form.goodFirstIssue}
              onChange={(value) => setForm((current) => ({ ...current, goodFirstIssue: value }))} />
            <ThreeStateSelect label="Help wanted label" value={form.helpWanted}
              onChange={(value) => setForm((current) => ({ ...current, helpWanted: value }))} />
            <ThreeStateSelect label="Unassigned" value={form.unassigned}
              onChange={(value) => setForm((current) => ({ ...current, unassigned: value }))} />
            <ThreeStateSelect label="Discussion unlocked" value={form.unlocked}
              onChange={(value) => setForm((current) => ({ ...current, unlocked: value }))} />
            <label className="contribution-field">
              <span>Updated within (days)</span>
              <input inputMode="numeric" value={form.updatedWithinDays}
                placeholder="90" onChange={(event) => setForm((current) =>
                  ({ ...current, updatedWithinDays: event.target.value }))} />
            </label>
            <label className="contribution-field">
              <span>CONTRIBUTING evidence</span>
              <select value={form.contributing}
                onChange={(event) => setForm((current) =>
                  ({ ...current, contributing: event.target.value }))}>
                <option value="">Any</option>
                <option value="present">Present</option>
                <option value="absent">Observed absent</option>
                <option value="missing">Not collected</option>
                <option value="not_applicable">Not applicable</option>
              </select>
            </label>
          </div>

          <div className="contribution-filter-actions">
            <p>Results are observations, not a beginner-suitability rating.</p>
            <div>
              <button type="button" className="secondary-button"
                onClick={() => navigate(EMPTY_CONTRIBUTION_FILTERS)}>
                Clear
              </button>
              <button type="submit" className="primary-button">Apply filters</button>
            </div>
          </div>
          {formError ? <div className="inline-error" role="alert">
            <span className="state-signal state-signal-error" aria-hidden="true" />
            {formError}
          </div> : null}
        </form>
      </section>

      {location.valid ? (
        <ContributionResults key={activeSearch ?? ''} filters={location.filters} />
      ) : (
        <div className="catalog-state catalog-state-error" role="alert">
          <span className="state-signal state-signal-error" aria-hidden="true" />
          <h3>Shared filter URL is invalid</h3>
          <p>{location.message} No issue request was made with those filters.</p>
          <button type="button" className="secondary-button"
            onClick={() => navigate(EMPTY_CONTRIBUTION_FILTERS)}>
            Clear invalid filters
          </button>
        </div>
      )}

      <footer className="catalog-footer">
        <span>RepoScout · Evidence-first contribution discovery</span>
        <span>Always verify issue availability on GitHub before beginning work.</span>
      </footer>
    </main>
  );
}
