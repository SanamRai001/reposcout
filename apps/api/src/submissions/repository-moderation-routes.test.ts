import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { ModerationReviewerAuthenticator } from './moderation-reviewer-auth.js';
import {
  RepositorySubmissionAlreadyModeratedError,
  RepositorySubmissionModerationNotFoundError,
  RepositorySubmissionModerationService,
  RepositorySubmissionNotEligibleForModerationError,
} from './repository-submission-moderation-service.js';
import type {
  ModerateRepositorySubmissionInput,
  RepositorySubmissionModerationResult,
} from './repository-submission-moderation.js';
import type { RepositorySubmissionRecord } from './repository-submission.js';

const servers: ReturnType<ReturnType<typeof createApp>['listen']>[] = [];
const reviewerToken = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const candidate: RepositorySubmissionRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  submittedUrl: 'https://github.com/example/project',
  normalizedOwner: 'example',
  normalizedName: 'project',
  normalizedFullName: 'example/project',
  status: 'PENDING',
  validationOutcome: 'VALID',
  resolvedRepository: {
    githubRepositoryId: '123456789',
    owner: 'example',
    name: 'project',
    fullName: 'example/project',
    githubUrl: 'https://github.com/example/project',
  },
  duplicateRepositoryId: null,
  validatedAt: new Date('2026-09-25T10:00:00Z'),
  handoffRepositoryId: '22222222-2222-4222-8222-222222222222',
  evidenceHandoffCompletedAt: new Date('2026-09-25T11:00:00Z'),
  createdAt: new Date('2026-09-25T09:00:00Z'),
  updatedAt: new Date('2026-09-25T11:00:00Z'),
};

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
});

type ModerationStoreResult =
  | Readonly<{
      kind: 'moderated';
      result: RepositorySubmissionModerationResult;
    }>
  | Readonly<{ kind: 'not_found' }>
  | Readonly<{ kind: 'not_eligible' }>
  | Readonly<{
      kind: 'already_moderated';
      decision: 'APPROVED' | 'REJECTED';
    }>;

async function startApp(options: {
  listPendingModerationCandidates?: (
    limit: number,
  ) => Promise<RepositorySubmissionRecord[]>;
  moderate?: (
    input: ModerateRepositorySubmissionInput,
  ) => Promise<ModerationStoreResult>;
} = {}) {
  const listPendingModerationCandidates =
    options.listPendingModerationCandidates ??
    vi.fn().mockResolvedValue([candidate]);
  const moderate =
    options.moderate ??
    vi.fn().mockResolvedValue({
      kind: 'moderated',
      result: {
        submissionId: candidate.id,
        repositoryId: candidate.handoffRepositoryId,
        status: 'APPROVED',
        event: {
          id: '33333333-3333-4333-8333-333333333333',
          submissionId: candidate.id,
          decision: 'APPROVED',
          reviewerRef: 'maintainer:SanamRai001',
          reason: 'Useful project.',
          createdAt: new Date('2026-09-25T12:00:00Z'),
        },
      },
    });

  const moderationService = new RepositorySubmissionModerationService(
    { moderate },
    () => new Date('2026-09-25T12:00:00Z'),
  );
  const authenticator = new ModerationReviewerAuthenticator([
    {
      reviewerRef: 'maintainer:SanamRai001',
      token: reviewerToken,
    },
  ]);
  const app = createApp({
    repositoryModeration: {
      authenticator,
      moderationService,
      candidateReader: {
        listPendingModerationCandidates,
      },
    },
  });
  const server = app.listen(0);
  servers.push(server);

  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    listPendingModerationCandidates,
    moderate,
  };
}

function authHeaders() {
  return {
    authorization: `Bearer ${reviewerToken}`,
  };
}

describe('protected repository moderation routes', () => {
  it('rejects queue access without a valid reviewer credential', async () => {
    const { baseUrl, listPendingModerationCandidates } = await startApp();

    const response = await fetch(
      `${baseUrl}/api/moderation/submissions`,
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
    expect(body.error).toBe('moderation_unauthorized');
    expect(listPendingModerationCandidates).not.toHaveBeenCalled();
  });

  it('returns the protected pending moderation queue', async () => {
    const { baseUrl, listPendingModerationCandidates } = await startApp();

    const response = await fetch(
      `${baseUrl}/api/moderation/submissions?limit=10`,
      { headers: authHeaders() },
    );
    const body = (await response.json()) as {
      data: Array<{
        id: string;
        repository: { fullName: string } | null;
      }>;
      moderation: { reviewerRef: string; limit: number };
    };

    expect(response.status).toBe(200);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        id: candidate.id,
        repository: expect.objectContaining({
          fullName: 'example/project',
        }),
      }),
    );
    expect(body.moderation).toEqual({
      reviewerRef: 'maintainer:SanamRai001',
      limit: 10,
    });
    expect(listPendingModerationCandidates).toHaveBeenCalledWith(10);
  });

  it('injects authenticated reviewer identity into the decision', async () => {
    const { baseUrl, moderate } = await startApp();

    const response = await fetch(
      `${baseUrl}/api/moderation/submissions/${candidate.id}/decision`,
      {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          decision: 'APPROVED',
          reason: 'Useful project.',
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(moderate).toHaveBeenCalledWith({
      submissionId: candidate.id,
      decision: 'APPROVED',
      reviewerRef: 'maintainer:SanamRai001',
      reason: 'Useful project.',
      decidedAt: new Date('2026-09-25T12:00:00Z'),
    });
  });

  it('rejects client attempts to spoof reviewerRef', async () => {
    const { baseUrl, moderate } = await startApp();

    const response = await fetch(
      `${baseUrl}/api/moderation/submissions/${candidate.id}/decision`,
      {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          decision: 'REJECTED',
          reason: 'Reason.',
          reviewerRef: 'attacker:spoofed',
        }),
      },
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_moderation_request');
    expect(moderate).not.toHaveBeenCalled();
  });

  it('maps stable moderation domain errors to HTTP responses', async () => {
    const cases = [
      {
        error: new RepositorySubmissionModerationNotFoundError(),
        status: 404,
        code: 'moderation_submission_not_found',
      },
      {
        error: new RepositorySubmissionNotEligibleForModerationError(),
        status: 409,
        code: 'moderation_submission_not_eligible',
      },
      {
        error: new RepositorySubmissionAlreadyModeratedError('APPROVED'),
        status: 409,
        code: 'moderation_submission_already_decided',
      },
    ] as const;

    for (const item of cases) {
      const { baseUrl } = await startApp({
        moderate: vi.fn().mockRejectedValue(item.error),
      });

      const response = await fetch(
        `${baseUrl}/api/moderation/submissions/${candidate.id}/decision`,
        {
          method: 'POST',
          headers: {
            ...authHeaders(),
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            decision: 'REJECTED',
            reason: 'Reason.',
          }),
        },
      );
      const body = (await response.json()) as { error: string };

      expect(response.status).toBe(item.status);
      expect(body.error).toBe(item.code);
    }
  });
});
