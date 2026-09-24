import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { RepositorySubmissionService } from './repository-submission-service.js';
import type { RepositorySubmissionRecord } from './repository-submission.js';

const servers: ReturnType<ReturnType<typeof createApp>['listen']>[] = [];

const submission: RepositorySubmissionRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  submittedUrl: 'https://github.com/example/project',
  normalizedOwner: 'example',
  normalizedName: 'project',
  normalizedFullName: 'example/project',
  status: 'PENDING',
  validationOutcome: null,
  resolvedRepository: null,
  duplicateRepositoryId: null,
  validatedAt: null,
  handoffRepositoryId: null,
  evidenceHandoffCompletedAt: null,
  createdAt: new Date('2026-09-23T12:00:00Z'),
  updatedAt: new Date('2026-09-23T12:00:00Z'),
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

async function startApp(service: RepositorySubmissionService) {
  const app = createApp({
    repositorySubmissionService: service,
  });
  const server = app.listen(0);
  servers.push(server);

  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}`;
}

function serviceWith(options: {
  indexed?: boolean;
  pendingDuplicate?: boolean;
} = {}) {
  return new RepositorySubmissionService(
    {
      existsByNormalizedFullName: vi
        .fn()
        .mockResolvedValue(options.indexed ?? false),
    },
    {
      createPending: vi.fn().mockResolvedValue(
        options.pendingDuplicate
          ? {
              kind: 'pending_duplicate',
              submission,
            }
          : {
              kind: 'created',
              submission,
            },
      ),
    },
  );
}

describe('repository submission routes', () => {
  it('creates a pending submission with canonical repository identity', async () => {
    const baseUrl = await startApp(serviceWith());

    const response = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        repositoryUrl: 'https://github.com/Example/Project.git',
      }),
    });
    const body = (await response.json()) as {
      data: {
        id: string;
        repository: {
          owner: string;
          name: string;
          fullName: string;
          githubUrl: string;
        };
        status: string;
        createdAt: string;
      };
    };

    expect(response.status).toBe(201);
    expect(body.data).toEqual({
      id: submission.id,
      repository: {
        owner: 'example',
        name: 'project',
        fullName: 'example/project',
        githubUrl: 'https://github.com/example/project',
      },
      status: 'PENDING',
      createdAt: '2026-09-23T12:00:00.000Z',
    });
  });

  it('rejects bodies with extra user-controlled metadata', async () => {
    const baseUrl = await startApp(serviceWith());

    const response = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        repositoryUrl: 'https://github.com/example/project',
        description: '<script>alert(1)</script>',
      }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_submission');
  });

  it('returns 409 when the repository is already indexed', async () => {
    const baseUrl = await startApp(serviceWith({ indexed: true }));

    const response = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        repositoryUrl: 'https://github.com/example/project',
      }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe('repository_already_indexed');
  });

  it('returns 409 when a pending submission already exists', async () => {
    const baseUrl = await startApp(
      serviceWith({ pendingDuplicate: true }),
    );

    const response = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        repositoryUrl: 'https://github.com/example/project',
      }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe('submission_already_pending');
  });
});
