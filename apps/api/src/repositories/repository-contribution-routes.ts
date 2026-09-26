import { Router } from 'express';

import { parseRepositoryPageLimit } from './repository-catalog.js';
import {
  encodeContributionDiscoveryCursor,
  parseContributionDiscoveryCursor,
  parseContributionDiscoveryFilters,
  toContributionDiscoveryResponseItem,
  type ContributionDiscoveryReader,
} from './repository-contribution-discovery.js';
import {
  CONTRIBUTION_DISCOVERY_SIGNAL_CONTRACT_VERSION,
} from './repository-contribution-signals.js';

export function createContributionDiscoveryRouter(
  contributionDiscovery: ContributionDiscoveryReader,
) {
  const router = Router();

  router.get('/issues', async (request, response, next) => {
    try {
      const filters = parseContributionDiscoveryFilters({
        unassigned: request.query.unassigned,
        unlocked: request.query.unlocked,
        goodFirstIssue: request.query.goodFirstIssue,
        helpWanted: request.query.helpWanted,
        language: request.query.language,
        updatedWithinDays: request.query.updatedWithinDays,
        contributing: request.query.contributing,
      });
      const limit = parseRepositoryPageLimit(request.query.limit);
      const cursor = parseContributionDiscoveryCursor(
        request.query.cursor,
        filters,
      );
      const evaluatedAt = cursor?.evaluatedAt ?? new Date();

      const page = await contributionDiscovery.discoverPage({
        filters,
        limit,
        position: cursor?.position ?? null,
        evaluatedAt,
      });

      const nextCursor =
        page.hasMore && page.items.length > 0
          ? encodeContributionDiscoveryCursor(
              page.items[page.items.length - 1]!,
              evaluatedAt,
              filters,
            )
          : null;

      response.status(200).json({
        data: page.items.map(toContributionDiscoveryResponseItem),
        discovery: {
          contractVersion:
            CONTRIBUTION_DISCOVERY_SIGNAL_CONTRACT_VERSION,
          evaluatedAt: evaluatedAt.toISOString(),
          state: 'open',
          filters: {
            unassigned: filters.unassigned,
            unlocked: filters.unlocked,
            goodFirstIssue: filters.goodFirstIssue,
            helpWanted: filters.helpWanted,
            language: filters.primaryLanguage,
            updatedWithinDays: filters.updatedWithinDays,
            contributing: filters.contributing,
          },
        },
        pagination: {
          limit,
          nextCursor,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('filter ')
      ) {
        response.status(400).json({
          error: 'invalid_contribution_filter',
          message: error.message,
        });
        return;
      }

      if (
        error instanceof Error &&
        (
          error.message.startsWith('limit ') ||
          error.message.startsWith('cursor ')
        )
      ) {
        response.status(400).json({
          error: 'invalid_pagination',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  });

  return router;
}
