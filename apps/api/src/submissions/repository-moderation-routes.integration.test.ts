import type { AddressInfo } from 'node:net';

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { createApp } from '../app.js';
import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import type { UpsertRepositoryMetadataInput } from '../repositories/repository-metadata.js';
import type { UpsertRepositoryInput } from '../repositories/repository.js';
import { RepositoryStore } from '../repositories/repository-store.js';
import { ModerationReviewerAuthenticator } from './moderation-reviewer-auth.js';
import { RepositorySubmissionModerationService } from './repository-submission-moderation-service.js';
import { RepositorySubmissionStore } from './repository-submission-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for protected moderation route tests.',
  );
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 5,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);
const repositoryStore = new RepositoryStore(pool);
const submissionStore = new RepositorySubmissionStore(pool);
const servers: ReturnType<ReturnType<typeof createApp>['listen']>[] = [];
const reviewerToken = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

async function clearFixtures(): Promise<void> {
  await pool.query('DELETE FROM repository_submission_moderation_events');
  await pool.query('DELETE FROM repository_submissions');
  await pool.query('DELETE FROM repositories');
}

beforeEach(clearFixtures);
afterEach(clearFixtures);

afterAll(async () => {
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
  await pool.end();
});

function repositoryInput(
  githubRepositoryId: string,
  name: string,
): UpsertRepositoryInput {
  return {
    githubRepositoryId,
    owner: 'review-org',
    name,
    fullName: `review-org/${name}`,
    githubUrl: `https://github.com/review-org/${name}`,
    defaultBranch: 'main',
    description: `Protected moderation fixture ${name}`,
    isArchived: false,
    isFork: false,
    createdAtGithub: new Date('2026-01-01T00:00:00Z'),
    updatedAtGithub: new Date('2026-09-25T00:00:00Z'),
    pushedAtGithub: new Date('2026-09-25T01:00:00Z'),
    lastSyncedAt: new Date('2026-09-25T02:00:00Z'),
  };
}

function metadataInput(): UpsertRepositoryMetadataInput {
  return {
    stars: 15,
    forks: 2,
    openIssues: 1,
    primaryLanguage: 'TypeScript',
    licenseSpdx: 'MIT',
    topics: ['opensource', 'typescript'],
    observedAt: new Date('2026-09-25T02:00:00Z'),
  };
}

async function prepareCandidate() {
  const repository = await repositoryStore.upsertWithMetadata(
    repositoryInput('910000001', 'protected-project'),
    metadataInput(),
    { initialListing: 'unlisted' },
  );

  const created = await submissionStore.createPending({
    submittedUrl: 'https://github.com/review-org/protected-project',
    normalizedOwner: 'review-org',
    normalizedName: 'protected-project',
    normalizedFullName: 'review-org/protected-project',
  });

  if (created.kind !== 'created') {
    throw new Error('Expected a fresh protected moderation submission.');
  }

  const validated = await submissionStore.recordValidation({
    kind: 'valid',
    submissionId: created.submission.id,
    repository: {
      githubRepositoryId: '910000001',
      owner: 'review-org',
      name: 'protected-project',
      fullName: 'review-org/protected-project',
      githubUrl: 'https://github.com/review-org/protected-project',
    },
    validatedAt: new Date('2026-09-25T03:00:00Z'),
  });

  const handedOff = await submissionStore.recordEvidenceHandoffComplete({
    submissionId: validated.id,
    repositoryId: repository.id,
    completedAt: new Date('2026-09-25T04:00:00Z'),
  });

  return { repository, submission: handedOff };
}

async function startApp() {
  const moderationService = new RepositorySubmissionModerationService(
    submissionStore,
    () => new Date('2026-09-25T05:00:00Z'),
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
      candidateReader: submissionStore,
    },
  });
  const server = app.listen(0);
  servers.push(server);

  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}`;
}

describe('protected moderation API with PostgreSQL', () => {
  it('requires auth and publishes an approved candidate through the existing transaction', async () => {
    const { repository, submission } = await prepareCandidate();
    const baseUrl = await startApp();

    const unauthorized = await fetch(
      `${baseUrl}/api/moderation/submissions`,
    );
    expect(unauthorized.status).toBe(401);

    const queue = await fetch(
      `${baseUrl}/api/moderation/submissions`,
      {
        headers: {
          authorization: `Bearer ${reviewerToken}`,
        },
      },
    );
    const queueBody = (await queue.json()) as {
      data: Array<{ id: string }>;
    };

    expect(queue.status).toBe(200);
    expect(queueBody.data.map((item) => item.id)).toEqual([
      submission.id,
    ]);
    expect(await repositoryStore.findById(repository.id)).toBeNull();

    const decision = await fetch(
      `${baseUrl}/api/moderation/submissions/${submission.id}/decision`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${reviewerToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          decision: 'APPROVED',
          reason: 'Verified useful repository with complete evidence.',
        }),
      },
    );
    const decisionBody = (await decision.json()) as {
      data: {
        status: string;
        repositoryId: string;
        event: {
          reviewerRef: string;
          reason: string;
          createdAt: string;
        };
      };
    };

    expect(decision.status).toBe(200);
    expect(decisionBody.data).toEqual(
      expect.objectContaining({
        status: 'APPROVED',
        repositoryId: repository.id,
        event: expect.objectContaining({
          reviewerRef: 'maintainer:SanamRai001',
          reason:
            'Verified useful repository with complete evidence.',
          createdAt: '2026-09-25T05:00:00.000Z',
        }),
      }),
    );

    expect(await repositoryStore.findById(repository.id)).toEqual(
      expect.objectContaining({
        id: repository.id,
      }),
    );

    const events = await submissionStore.listModerationEvents(
      submission.id,
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.reviewerRef).toBe(
      'maintainer:SanamRai001',
    );
  });
});
