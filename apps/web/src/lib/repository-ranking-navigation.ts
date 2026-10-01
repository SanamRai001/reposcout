import type { RepositoryRankingMode } from './repository-ranking-client.js';

/**
 * Ranking mode is mutually exclusive with catalog search/filter URL state.
 * An unknown view falls back to the existing catalog, not a fabricated rank.
 */
export function rankingModeFromSearch(search: string): RepositoryRankingMode | null {
  const view = new URLSearchParams(search).get('view');
  return view === 'hidden_gems' || view === 'rising' ? view : null;
}

export function rankingModeToSearch(mode: RepositoryRankingMode | null): string {
  return mode === null ? '' : new URLSearchParams({ view: mode }).toString();
}
