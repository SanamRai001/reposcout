import { describe, expect, it, vi } from 'vitest';

import {
  RepositorySubmissionError,
  submitRepository,
} from './repository-submission-client';

function successBody() {
  return {
    data: {
      id: '11111111-1111-4111-8111-111111111111',
      repository: {
        owner: 'example',
        name: 'project',
        fullName: 'example/project',
        githubUrl: 'https://github.com/example/project',
      },
      status: 'PENDING',
      createdAt: '2026-09-25T12:00:00.000Z',
    },
  };
}

describe('submitRepository', () => {
  it('submits only the repository URL to the same-origin public endpoint', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(successBody()), {
        status: 201,
        headers: {
          'content-type': 'application/json',
        },
      }),
    );

    const submission = await submitRepository({
      repositoryUrl: 'https://github.com/Example/Project.git',
      fetchImplementation,
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/submissions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          repositoryUrl: 'https://github.com/Example/Project.git',
        }),
      }),
    );
    expect(submission.repository.fullName).toBe('example/project');
    expect(submission.status).toBe('PENDING');
  });

  it('surfaces invalid repository input as a non-retryable client-visible state', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'invalid_submission',
          message: 'GitHub repository URL must use https://github.com.',
        }),
        { status: 400 },
      ),
    );

    await expect(
      submitRepository({
        repositoryUrl: 'http://github.com/example/project',
        fetchImplementation,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: 'RepositorySubmissionError',
        code: 'invalid_submission',
        status: 400,
        retryable: false,
      }),
    );
  });

  it.each([
    ['repository_already_indexed', 'Repository is already indexed by RepoScout.'],
    ['submission_already_pending', 'A pending submission already exists for this repository.'],
  ])('preserves duplicate state %s', async (code, message) => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: code,
          message,
        }),
        { status: 409 },
      ),
    );

    await expect(
      submitRepository({
        repositoryUrl: 'https://github.com/example/project',
        fetchImplementation,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code,
        status: 409,
        retryable: false,
      }),
    );
  });

  it('preserves repository resubmission cooldown as a non-immediate retry state', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'submission_resubmission_cooldown',
          message:
            'This repository was recently processed. Please wait before submitting it again.',
          retryAfterSeconds: 86_400,
        }),
        {
          status: 409,
          headers: {
            'retry-after': '86400',
          },
        },
      ),
    );

    await expect(
      submitRepository({
        repositoryUrl: 'https://github.com/example/project',
        fetchImplementation,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'submission_resubmission_cooldown',
        status: 409,
        retryable: false,
        retryAfterSeconds: 86_400,
      }),
    );
  });

  it('preserves the stable public submission rate-limit error as retryable', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'submission_rate_limited',
          message:
            'Too many repository submission attempts. Try again after the retry window.',
          retryAfterSeconds: 60,
        }),
        {
          status: 429,
          headers: {
            'retry-after': '60',
          },
        },
      ),
    );

    await expect(
      submitRepository({
        repositoryUrl: 'https://github.com/example/project',
        fetchImplementation,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'submission_rate_limited',
        status: 429,
        retryable: true,
      }),
    );
  });

  it('marks server failures as retryable', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'internal_server_error',
          message: 'Submission service unavailable.',
        }),
        { status: 503 },
      ),
    );

    await expect(
      submitRepository({
        repositoryUrl: 'https://github.com/example/project',
        fetchImplementation,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'unknown_error',
        status: 503,
        retryable: true,
      }),
    );
  });

  it('marks network failures as retryable', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    await expect(
      submitRepository({
        repositoryUrl: 'https://github.com/example/project',
        fetchImplementation,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'network_error',
        status: null,
        retryable: true,
      }),
    );
  });

  it('rejects malformed successful responses', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'incomplete',
          },
        }),
        { status: 201 },
      ),
    );

    await expect(
      submitRepository({
        repositoryUrl: 'https://github.com/example/project',
        fetchImplementation,
      }),
    ).rejects.toBeInstanceOf(RepositorySubmissionError);
  });
});
