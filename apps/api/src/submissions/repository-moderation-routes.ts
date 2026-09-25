import { Router, type Request, type Response } from 'express';

import { responseRequestId } from '../http-security.js';
import { logger } from '../logger.js';
import { isRepositoryId } from '../repositories/repository-catalog.js';
import type { ModerationReviewerAuthenticator } from './moderation-reviewer-auth.js';
import {
  InvalidRepositorySubmissionModerationError,
  RepositorySubmissionAlreadyModeratedError,
  RepositorySubmissionModerationNotFoundError,
  type RepositorySubmissionModerationService,
  RepositorySubmissionNotEligibleForModerationError,
} from './repository-submission-moderation-service.js';
import type { RepositorySubmissionModerationResult } from './repository-submission-moderation.js';
import type { RepositorySubmissionRecord } from './repository-submission.js';

type ModerationCandidateReader = Readonly<{
  listPendingModerationCandidates(
    limit: number,
  ): Promise<RepositorySubmissionRecord[]>;
}>;

export type RepositoryModerationRouterDependencies = Readonly<{
  authenticator: ModerationReviewerAuthenticator;
  moderationService: RepositorySubmissionModerationService;
  candidateReader: ModerationCandidateReader;
}>;

function authenticate(
  request: Request,
  response: Response,
  authenticator: ModerationReviewerAuthenticator,
): string | null {
  const reviewerRef = authenticator.authenticate(
    request.headers.authorization,
  );

  if (reviewerRef) {
    return reviewerRef;
  }

  logger.info('moderation.authentication_failed', {
    requestId: responseRequestId(response),
    method: request.method,
    path: request.path,
  });
  response.setHeader('WWW-Authenticate', 'Bearer');
  response.status(401).json({
    error: 'moderation_unauthorized',
    message: 'A valid moderation reviewer credential is required.',
  });
  return null;
}

function parseLimit(value: unknown): number {
  if (value === undefined) {
    return 20;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new InvalidRepositorySubmissionModerationError(
      'limit must be an integer between 1 and 50.',
    );
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new InvalidRepositorySubmissionModerationError(
      'limit must be an integer between 1 and 50.',
    );
  }

  return parsed;
}

function parseDecisionBody(value: unknown): Readonly<{
  decision: unknown;
  reason: unknown;
}> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new InvalidRepositorySubmissionModerationError(
      'Request body must be an object containing decision and reason.',
    );
  }

  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort();

  if (
    keys.length !== 2 ||
    keys[0] !== 'decision' ||
    keys[1] !== 'reason'
  ) {
    throw new InvalidRepositorySubmissionModerationError(
      'Request body must contain only decision and reason.',
    );
  }

  return {
    decision: body.decision,
    reason: body.reason,
  };
}

function toCandidateResponse(submission: RepositorySubmissionRecord) {
  return {
    id: submission.id,
    status: submission.status,
    validationOutcome: submission.validationOutcome,
    repository: submission.resolvedRepository,
    handoffRepositoryId: submission.handoffRepositoryId,
    validatedAt: submission.validatedAt?.toISOString() ?? null,
    evidenceHandoffCompletedAt:
      submission.evidenceHandoffCompletedAt?.toISOString() ?? null,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
  };
}

function toModerationResponse(result: RepositorySubmissionModerationResult) {
  return {
    submissionId: result.submissionId,
    repositoryId: result.repositoryId,
    status: result.status,
    event: {
      id: result.event.id,
      decision: result.event.decision,
      reviewerRef: result.event.reviewerRef,
      reason: result.event.reason,
      createdAt: result.event.createdAt.toISOString(),
    },
  };
}

export function createRepositoryModerationRouter(
  dependencies: RepositoryModerationRouterDependencies,
) {
  const router = Router();

  router.get('/submissions', async (request, response, next) => {
    const reviewerRef = authenticate(
      request,
      response,
      dependencies.authenticator,
    );

    if (!reviewerRef) {
      return;
    }

    try {
      const limit = parseLimit(request.query.limit);
      const submissions =
        await dependencies.candidateReader.listPendingModerationCandidates(
          limit,
        );

      logger.info('moderation.queue_read', {
        requestId: responseRequestId(response),
        reviewerRef,
        limit,
        count: submissions.length,
      });
      response.status(200).json({
        data: submissions.map(toCandidateResponse),
        moderation: {
          reviewerRef,
          limit,
        },
      });
    } catch (error) {
      if (error instanceof InvalidRepositorySubmissionModerationError) {
        logger.info('moderation.request_rejected', {
          requestId: responseRequestId(response),
          reviewerRef,
          outcome: 'invalid_moderation_request',
        });
        response.status(400).json({
          error: 'invalid_moderation_request',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  });

  router.post(
    '/submissions/:id/decision',
    async (request, response, next) => {
      const reviewerRef = authenticate(
        request,
        response,
        dependencies.authenticator,
      );

      if (!reviewerRef) {
        return;
      }

      const submissionId = request.params.id;

      if (!submissionId || !isRepositoryId(submissionId)) {
        logger.info('moderation.request_rejected', {
          requestId: responseRequestId(response),
          reviewerRef,
          outcome: 'invalid_submission_id',
        });
        response.status(400).json({
          error: 'invalid_submission_id',
          message: 'Submission id must be a valid UUID.',
        });
        return;
      }

      try {
        const body = parseDecisionBody(request.body);
        const result = await dependencies.moderationService.moderate({
          submissionId,
          decision: body.decision,
          reviewerRef,
          reason: body.reason,
        });

        logger.info('moderation.decision_applied', {
          requestId: responseRequestId(response),
          reviewerRef,
          submissionId,
          decision: result.status,
        });
        response.status(200).json({
          data: toModerationResponse(result),
        });
      } catch (error) {
        if (error instanceof InvalidRepositorySubmissionModerationError) {
          logger.info('moderation.request_rejected', {
            requestId: responseRequestId(response),
            reviewerRef,
            submissionId,
            outcome: 'invalid_moderation_request',
          });
          response.status(400).json({
            error: 'invalid_moderation_request',
            message: error.message,
          });
          return;
        }

        if (error instanceof RepositorySubmissionModerationNotFoundError) {
          logger.info('moderation.request_rejected', {
            requestId: responseRequestId(response),
            reviewerRef,
            submissionId,
            outcome: 'moderation_submission_not_found',
          });
          response.status(404).json({
            error: 'moderation_submission_not_found',
            message: error.message,
          });
          return;
        }

        if (
          error instanceof RepositorySubmissionNotEligibleForModerationError
        ) {
          logger.info('moderation.request_rejected', {
            requestId: responseRequestId(response),
            reviewerRef,
            submissionId,
            outcome: 'moderation_submission_not_eligible',
          });
          response.status(409).json({
            error: 'moderation_submission_not_eligible',
            message: error.message,
          });
          return;
        }

        if (error instanceof RepositorySubmissionAlreadyModeratedError) {
          logger.info('moderation.request_rejected', {
            requestId: responseRequestId(response),
            reviewerRef,
            submissionId,
            outcome: 'moderation_submission_already_decided',
            decision: error.decision,
          });
          response.status(409).json({
            error: 'moderation_submission_already_decided',
            message: error.message,
            decision: error.decision,
          });
          return;
        }

        next(error);
      }
    },
  );

  return router;
}
