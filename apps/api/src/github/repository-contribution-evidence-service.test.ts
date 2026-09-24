import { describe, expect, it, vi } from 'vitest';

import type {
  GithubCommunityProfileSnapshot,
  GithubSecurityPolicySnapshot,
} from './github-client.js';
import { RepositoryContributionEvidenceService } from './repository-contribution-evidence-service.js';
import type {
  RepositoryContributionEvidenceRecord,
  UpsertRepositoryContributionEvidenceInput,
} from '../repositories/repository-contribution-evidence.js';
import type { RepositoryRecord } from '../repositories/repository.js';

const repository: RepositoryRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  githubRepositoryId: '123456789',
  owner: 'openai',
  name: 'openai-node',
  fullName: 'openai/openai-node',
  githubUrl: 'https://github.com/openai/openai-node',
  defaultBranch: 'main',
  description: 'OpenAI Node SDK',
  isArchived: false,
  isFork: false,
  discoveryStatus: 'DISCOVERABLE',
  createdAtGithub: new Date('2023-04-19T00:00:00Z'),
  updatedAtGithub: new Date('2026-09-20T00:00:00Z'),
  pushedAtGithub: new Date('2026-09-20T01:00:00Z'),
  lastSyncedAt: new Date('2026-09-21T08:00:00Z'),
  createdAt: new Date('2026-09-21T08:00:01Z'),
  updatedAt: new Date('2026-09-21T08:00:01Z'),
};

const profile: GithubCommunityProfileSnapshot = {
  contributing: {
    apiUrl:
      'https://api.github.com/repos/openai/openai-node/contents/CONTRIBUTING.md',
    htmlUrl:
      'https://github.com/openai/openai-node/blob/main/CONTRIBUTING.md',
  },
  codeOfConduct: {
    apiUrl:
      'https://api.github.com/repos/openai/openai-node/contents/CODE_OF_CONDUCT.md',
    htmlUrl:
      'https://github.com/openai/openai-node/blob/main/CODE_OF_CONDUCT.md',
  },
  issueTemplate: null,
  pullRequestTemplate: {
    apiUrl:
      'https://api.github.com/repos/openai/openai-node/contents/.github/PULL_REQUEST_TEMPLATE.md',
    htmlUrl:
      'https://github.com/openai/openai-node/blob/main/.github/PULL_REQUEST_TEMPLATE.md',
  },
  updatedAt: new Date('2026-09-20T12:00:00Z'),
};

const securityPolicy: GithubSecurityPolicySnapshot = {
  path: '.github/SECURITY.md',
  sha: 'security-sha',
  sizeBytes: 420,
};

const persisted: RepositoryContributionEvidenceRecord = {
  repositoryId: repository.id,
  status: 'OBSERVED',
  contributing: profile.contributing,
  codeOfConduct: profile.codeOfConduct,
  issueTemplate: null,
  pullRequestTemplate: profile.pullRequestTemplate,
  securityPolicy: {
    sourceRef: 'main',
    path: '.github/SECURITY.md',
    sha: 'security-sha',
    sizeBytes: 420,
  },
  communityProfileUpdatedAt: profile.updatedAt,
  observedAt: new Date('2026-09-22T12:00:00Z'),
  createdAt: new Date('2026-09-22T12:00:01Z'),
  updatedAt: new Date('2026-09-22T12:00:01Z'),
};

describe('RepositoryContributionEvidenceService', () => {
  it('combines community profile and repository-local security evidence', async () => {
    const fetchCommunityProfile = vi.fn().mockResolvedValue(profile);
    const fetchSecurityPolicy = vi.fn().mockResolvedValue(securityPolicy);
    const upsert = vi.fn<
      (
        input: UpsertRepositoryContributionEvidenceInput,
      ) => Promise<RepositoryContributionEvidenceRecord>
    >().mockResolvedValue(persisted);
    const observedAt = new Date('2026-09-22T12:00:00Z');
    const service = new RepositoryContributionEvidenceService(
      { fetchCommunityProfile, fetchSecurityPolicy },
      { upsert },
      () => observedAt,
    );

    const result = await service.refresh(repository);

    expect(fetchCommunityProfile).toHaveBeenCalledWith({
      owner: 'openai',
      name: 'openai-node',
    });
    expect(fetchSecurityPolicy).toHaveBeenCalledWith(
      {
        owner: 'openai',
        name: 'openai-node',
      },
      'main',
    );
    expect(upsert).toHaveBeenCalledWith({
      repositoryId: repository.id,
      status: 'OBSERVED',
      contributing: profile.contributing,
      codeOfConduct: profile.codeOfConduct,
      issueTemplate: null,
      pullRequestTemplate: profile.pullRequestTemplate,
      securityPolicy: {
        sourceRef: 'main',
        path: '.github/SECURITY.md',
        sha: 'security-sha',
        sizeBytes: 420,
      },
      communityProfileUpdatedAt: profile.updatedAt,
      observedAt,
    });
    expect(result).toBe(persisted);
  });

  it('records forks as unsupported without calling GitHub community endpoints', async () => {
    const fetchCommunityProfile = vi.fn();
    const fetchSecurityPolicy = vi.fn();
    const upsert = vi.fn().mockResolvedValue({
      ...persisted,
      status: 'UNSUPPORTED_FORK',
      contributing: null,
      codeOfConduct: null,
      issueTemplate: null,
      pullRequestTemplate: null,
      securityPolicy: null,
      communityProfileUpdatedAt: null,
    });
    const observedAt = new Date('2026-09-22T13:00:00Z');
    const service = new RepositoryContributionEvidenceService(
      { fetchCommunityProfile, fetchSecurityPolicy },
      { upsert },
      () => observedAt,
    );

    await service.refresh({
      ...repository,
      isFork: true,
    });

    expect(fetchCommunityProfile).not.toHaveBeenCalled();
    expect(fetchSecurityPolicy).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith({
      repositoryId: repository.id,
      status: 'UNSUPPORTED_FORK',
      contributing: null,
      codeOfConduct: null,
      issueTemplate: null,
      pullRequestTemplate: null,
      securityPolicy: null,
      communityProfileUpdatedAt: null,
      observedAt,
    });
  });

  it('skips security lookup when no default branch exists', async () => {
    const fetchCommunityProfile = vi.fn().mockResolvedValue(profile);
    const fetchSecurityPolicy = vi.fn();
    const upsert = vi.fn().mockResolvedValue({
      ...persisted,
      securityPolicy: null,
    });
    const service = new RepositoryContributionEvidenceService(
      { fetchCommunityProfile, fetchSecurityPolicy },
      { upsert },
      () => new Date('2026-09-22T14:00:00Z'),
    );

    await service.refresh({
      ...repository,
      defaultBranch: null,
    });

    expect(fetchCommunityProfile).toHaveBeenCalledTimes(1);
    expect(fetchSecurityPolicy).not.toHaveBeenCalled();
  });
});
