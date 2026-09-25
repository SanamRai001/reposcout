export type RepositorySubmission = Readonly<{
  id: string;
  repository: Readonly<{
    owner: string;
    name: string;
    fullName: string;
    githubUrl: string;
  }>;
  status: 'PENDING';
  createdAt: string;
}>;

export type RepositorySubmissionErrorCode =
  | 'invalid_submission'
  | 'repository_already_indexed'
  | 'submission_already_pending'
  | 'network_error'
  | 'invalid_response'
  | 'unknown_error';

export class RepositorySubmissionError extends Error {
  public constructor(
    message: string,
    public readonly code: RepositorySubmissionErrorCode,
    public readonly status: number | null,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'RepositorySubmissionError';
  }
}

type SubmissionErrorBody = Readonly<{
  error?: unknown;
  message?: unknown;
}>;

function isSubmission(value: unknown): value is RepositorySubmission {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const submission = value as Record<string, unknown>;
  const repository =
    submission.repository && typeof submission.repository === 'object'
      ? (submission.repository as Record<string, unknown>)
      : null;

  return (
    typeof submission.id === 'string' &&
    repository !== null &&
    typeof repository.owner === 'string' &&
    typeof repository.name === 'string' &&
    typeof repository.fullName === 'string' &&
    typeof repository.githubUrl === 'string' &&
    submission.status === 'PENDING' &&
    typeof submission.createdAt === 'string'
  );
}

function parseSubmissionResponse(value: unknown): RepositorySubmission {
  if (!value || typeof value !== 'object') {
    throw new RepositorySubmissionError(
      'RepoScout returned an invalid submission response.',
      'invalid_response',
      null,
      true,
    );
  }

  const body = value as Record<string, unknown>;

  if (!isSubmission(body.data)) {
    throw new RepositorySubmissionError(
      'RepoScout returned an invalid submission response.',
      'invalid_response',
      null,
      true,
    );
  }

  return body.data;
}

function errorCode(value: unknown): RepositorySubmissionErrorCode {
  switch (value) {
    case 'invalid_submission':
    case 'repository_already_indexed':
    case 'submission_already_pending':
      return value;
    default:
      return 'unknown_error';
  }
}

export async function submitRepository(
  input: Readonly<{
    repositoryUrl: string;
    signal?: AbortSignal;
    fetchImplementation?: typeof fetch;
  }>,
): Promise<RepositorySubmission> {
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      repositoryUrl: input.repositoryUrl,
    }),
  };

  if (input.signal) {
    requestInit.signal = input.signal;
  }

  let response: Response;

  try {
    response = await fetchImplementation('/api/submissions', requestInit);
  } catch {
    throw new RepositorySubmissionError(
      'Unable to reach RepoScout. Check your connection and try again.',
      'network_error',
      null,
      true,
    );
  }

  const body = (await response.json().catch(() => null)) as
    | SubmissionErrorBody
    | unknown;

  if (!response.ok) {
    const bodyRecord =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)
        : null;
    const code = errorCode(bodyRecord?.error);
    const message =
      typeof bodyRecord?.message === 'string'
        ? bodyRecord.message
        : response.status >= 500
          ? 'RepoScout could not accept the submission right now.'
          : 'RepoScout could not accept this repository submission.';

    throw new RepositorySubmissionError(
      message,
      code,
      response.status,
      response.status >= 500 || response.status === 429,
    );
  }

  return parseSubmissionResponse(body);
}
