import { Router } from 'express';

import { responseRequestId } from '../http-security.js';
import { logger } from '../logger.js';

import {
  InvalidRepositorySubmissionError,
  RepositoryAlreadyIndexedError,
  RepositorySubmissionAlreadyPendingError,
  RepositorySubmissionCooldownError,
  type RepositorySubmissionService,
} from './repository-submission-service.js';
import type { RepositorySubmissionRecord } from './repository-submission.js';

function parseBody(value: unknown): unknown {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new InvalidRepositorySubmissionError(
      'Request body must be an object containing repositoryUrl.',
    );
  }

  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);

  if (keys.length !== 1 || keys[0] !== 'repositoryUrl') {
    throw new InvalidRepositorySubmissionError(
      'Request body must contain only repositoryUrl.',
    );
  }

  return body.repositoryUrl;
}

function toResponse(submission: RepositorySubmissionRecord) {
  return {
    id: submission.id,
    repository: {
      owner: submission.normalizedOwner,
      name: submission.normalizedName,
      fullName: submission.normalizedFullName,
      githubUrl: submission.submittedUrl,
    },
    status: submission.status,
    createdAt: submission.createdAt.toISOString(),
  };
}

export function createRepositorySubmissionRouter(
  service: RepositorySubmissionService,
) {
  const router = Router();

  router.post('/', async (request, response, next) => {
    try {
      const repositoryUrl = parseBody(request.body);
      const submission = await service.submit(repositoryUrl);

      logger.info('submission.intake_accepted', {
        requestId: responseRequestId(response),
        submissionId: submission.id,
        status: submission.status,
      });
      response.status(201).json({
        data: toResponse(submission),
      });
    } catch (error) {
      if (error instanceof InvalidRepositorySubmissionError) {
        logger.info('submission.intake_rejected', {
          requestId: responseRequestId(response),
          outcome: 'invalid_submission',
        });
        response.status(400).json({
          error: 'invalid_submission',
          message: error.message,
        });
        return;
      }

      if (error instanceof RepositoryAlreadyIndexedError) {
        logger.info('submission.intake_rejected', {
          requestId: responseRequestId(response),
          outcome: 'repository_already_indexed',
        });
        response.status(409).json({
          error: 'repository_already_indexed',
          message: error.message,
        });
        return;
      }

      if (error instanceof RepositorySubmissionAlreadyPendingError) {
        logger.info('submission.intake_rejected', {
          requestId: responseRequestId(response),
          outcome: 'submission_already_pending',
        });
        response.status(409).json({
          error: 'submission_already_pending',
          message: error.message,
        });
        return;
      }

      if (error instanceof RepositorySubmissionCooldownError) {
        response.setHeader('Retry-After', String(error.retryAfterSeconds));
        logger.info('submission.intake_rejected', {
          requestId: responseRequestId(response),
          outcome: 'submission_resubmission_cooldown',
          retryAfterSeconds: error.retryAfterSeconds,
        });
        response.status(409).json({
          error: 'submission_resubmission_cooldown',
          message: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        });
        return;
      }

      next(error);
    }
  });

  return router;
}
