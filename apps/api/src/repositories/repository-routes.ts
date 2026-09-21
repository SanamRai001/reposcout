import { Router } from 'express';

import {
  encodeRepositoryCursor,
  isRepositoryId,
  parseRepositoryCursor,
  parseRepositoryPageLimit,
  toRepositoryResponse,
  type RepositoryCatalogReader,
} from './repository-catalog.js';

export function createRepositoryRouter(repositoryCatalog: RepositoryCatalogReader) {
  const router = Router();

  router.get('/', async (request, response, next) => {
    try {
      const limit = parseRepositoryPageLimit(request.query.limit);
      const cursor = parseRepositoryCursor(request.query.cursor);
      const page = await repositoryCatalog.listPage({ limit, cursor });

      const nextCursor =
        page.hasMore && page.items.length > 0
          ? encodeRepositoryCursor(page.items[page.items.length - 1]!)
          : null;

      response.status(200).json({
        data: page.items.map(toRepositoryResponse),
        pagination: {
          limit,
          nextCursor,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.startsWith('limit ') ||
          error.message.startsWith('cursor '))
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

  router.get('/:id', async (request, response, next) => {
    try {
      const id = request.params.id;

      if (!id || !isRepositoryId(id)) {
        response.status(400).json({
          error: 'invalid_repository_id',
          message: 'Repository id must be a valid UUID.',
        });
        return;
      }

      const repository = await repositoryCatalog.findById(id);

      if (!repository) {
        response.status(404).json({
          error: 'repository_not_found',
          message: 'Repository was not found.',
        });
        return;
      }

      response.status(200).json({
        data: toRepositoryResponse(repository),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
