export type GithubRepositoryReference = Readonly<{
  owner: string;
  name: string;
}>;

const SEGMENT_PATTERN = /^[A-Za-z0-9_.-]+$/;

function validateSegment(label: 'owner' | 'repository', value: string): string {
  if (
    value.length === 0 ||
    value.length > 100 ||
    value === '.' ||
    value === '..' ||
    !SEGMENT_PATTERN.test(value)
  ) {
    throw new Error(`Invalid GitHub ${label} name.`);
  }

  return value;
}

function fromPath(path: string): GithubRepositoryReference {
  const segments = path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => decodeURIComponent(segment));

  if (segments.length !== 2) {
    throw new Error('GitHub repository reference must contain owner/repository.');
  }

  const owner = validateSegment('owner', segments[0] ?? '');
  let name = segments[1] ?? '';

  if (name.endsWith('.git')) {
    name = name.slice(0, -4);
  }

  return {
    owner,
    name: validateSegment('repository', name),
  };
}

export function parseGithubRepositoryReference(
  value: string,
): GithubRepositoryReference {
  const candidate = value.trim();

  if (candidate.length === 0) {
    throw new Error('GitHub repository reference is required.');
  }

  if (!candidate.includes('://')) {
    return fromPath(candidate);
  }

  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error('GitHub repository URL is invalid.');
  }

  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') {
    throw new Error('GitHub repository URL must use https://github.com.');
  }

  if (url.username || url.password || url.port || url.search || url.hash) {
    throw new Error('GitHub repository URL contains unsupported components.');
  }

  return fromPath(url.pathname);
}
