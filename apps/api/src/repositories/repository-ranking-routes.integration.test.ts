import type { AddressInfo } from 'node:net';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { RepositoryContributionEvidenceStore } from './repository-contribution-evidence-store.js';
import { RepositoryRankingService } from './repository-ranking-service.js';
import { RepositoryReadmeStore } from './repository-readme-store.js';
import { RepositorySnapshotStore } from './repository-snapshot-store.js';
import { RepositoryStore } from './repository-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for repository ranking route tests.',
  );
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 6,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);
const repositoryStore = new RepositoryStore(pool);
const snapshotStore = new RepositorySnapshotStore(pool);
const readmeStore = new RepositoryReadmeStore(pool);
const evidenceStore = new RepositoryContributionEvidenceStore(pool);
const rankingService = new RepositoryRankingService(
  repositoryStore,
  readmeStore,
  evidenceStore,
  snapshotStore,
  () => new Date('2026-09-26T12:00:00.000Z'),
);
const servers: ReturnType<ReturnType<typeof createApp>['listen']>[] = [];

beforeEach(async () => {
  await pool.query('DELETE FROM repositories');
});

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

async function startApp(): Promise<string> {
  const app = createApp({
    repositoryCatalog: repositoryStore,
    repositoryTrend: snapshotStore,
    repositoryRanking: rankingService,
  });
  const server = app.listen(0);
  servers.push(server);

  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}`;
}

async function seedRepository(input: Readonly<{
  githubRepositoryId: string;
  name: string;
  listed?: boolean;
  completeEvidence?: boolean;
  completeHistory?: boolean;
}>) {
  const latestStars = 200;
  const latestForks = 25;
  const repository = await repositoryStore.upsertWithMetadata(
    {
      githubRepositoryId: input.githubRepositoryId,
      owner: 'ranking-api',
      name: input.name,
      fullName: `ranking-api/${input.name}`,
      githubUrl: `https://github.com/ranking-api/${input.name}`,
      defaultBranch: 'main',
      description: `Ranking fixture ${input.name}.`,
      isArchived: false,
      isFork: false,
      createdAtGithub: new Date('2025-01-01T00:00:00Z'),
      updatedAtGithub: new Date('2026-09-26T08:00:00Z'),
      pushedAtGithub: new Date('2026-09-26T08:00:00Z'),
      lastSyncedAt: new Date('2026-09-26T08:00:00Z'),
    },
    {
      stars: latestStars,
      forks: latestForks,
      openIssues: 5,
      primaryLanguage: 'TypeScript',
      licenseSpdx: 'MIT',
      topics: ['ranking'],
      observedAt: new Date('2026-09-26T08:00:00Z'),
    },
    {
      initialListing: input.listed === false ? 'unlisted' : 'listed',
    },
  );

  if (input.completeEvidence !== false) {
    await readmeStore.upsert({
      repositoryId: repository.id,
      status: 'PRESENT',
      sourceRef: 'main',
      path: 'README.md',
      sha: `readme-${input.githubRepositoryId}`,
      sizeBytes: 4,
      content: 'test',
      observedAt: new Date('2026-09-26T08:00:00Z'),
    });

    await evidenceStore.upsert({
      repositoryId: repository.id,
      status: 'OBSERVED',
      contributing: {
        apiUrl: `https://api.github.com/repos/ranking-api/${input.name}/community/code_of_conduct`,
        htmlUrl: `https://github.com/ranking-api/${input.name}/blob/main/CONTRIBUTING.md`,
      },
      codeOfConduct: {
        apiUrl: `https://api.github.com/repos/ranking-api/${input.name}/community/code_of_conduct`,
        htmlUrl: `https://github.com/ranking-api/${input.name}/blob/main/CODE_OF_CONDUCT.md`,
      },
      issueTemplate: {
        apiUrl: `https://api.github.com/repos/ranking-api/${input.name}/community/issue_templates`,
        htmlUrl: `https://github.com/ranking-api/${input.name}/issues/new/choose`,
      },
      pullRequestTemplate: {
        apiUrl: `https://api.github.com/repos/ranking-api/${input.name}/community/pull_request_template`,
        htmlUrl: `https://github.com/ranking-api/${input.name}/blob/main/.github/PULL_REQUEST_TEMPLATE.md`,
      },
      securityPolicy: {
        sourceRef: 'main',
        path: 'SECURITY.md',
        sha: `security-${input.githubRepositoryId}`,
        sizeBytes: 50,
      },
      communityProfileUpdatedAt: new Date('2026-09-26T08:00:00Z'),
      observedAt: new Date('2026-09-26T08:00:00Z'),
    });
  }

  if (input.completeHistory !== false) {
    await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-08-27T08:00:00Z'),
      stars: 100,
      forks: 10,
      openIssues: 6,
    });
    await snapshotStore.captureDaily({
      repositoryId: repository.id,
      capturedAt: new Date('2026-09-19T08:00:00Z'),
      stars: 175,
      forks: 20,
      openIssues: 6,
    });
  }

  return repository;
}

describe('repository ranking API with PostgreSQL', () => {
  it('returns listed eligible Hidden Gems with deterministic tie ordering and cursor continuation', async () => {
    const first = await seedRepository({
      githubRepositoryId: '970000001',
      name: 'alpha',
    });
    const second = await seedRepository({
      githubRepositoryId: '970000002',
      name: 'beta',
    });
    await seedRepository({
      githubRepositoryId: '970000003',
      name: 'missing-evidence',
      completeEvidence: false,
    });
    await seedRepository({
      githubRepositoryId: '970000004',
      name: 'unlisted',
      listed: false,
    });

    const expectedIds = [first.id, second.id].sort();
    const baseUrl = await startApp();

    const firstResponse = await fetch(
      `${baseUrl}/api/repositories/rankings/hidden_gems?limit=1`,
    );
    const firstBody = (await firstResponse.json()) as {
      data: Array<{
        repository: { id: string; fullName: string };
        ranking: {
          mode: string;
          formulaVersion: string;
          score: number;
          explanation: {
            components: unknown[];
            popularityPenalty: { points: number };
          };
        };
      }>;
      ranking: {
        mode: string;
        formulaVersion: string;
        evaluatedAt: string;
        evaluatedCount: number;
        eligibleCount: number;
      };
      pagination: { nextCursor: string | null };
    };

    expect(firstResponse.status).toBe(200);
    expect(firstBody.ranking).toEqual({
      mode: 'hidden_gems',
      formulaVersion: 'hidden-gem-v1',
      evaluatedAt: '2026-09-26T12:00:00.000Z',
      evaluatedCount: 3,
      eligibleCount: 2,
    });
    expect(firstBody.data).toHaveLength(1);
    expect(firstBody.data[0]?.repository.id).toBe(expectedIds[0]);
    expect(firstBody.data[0]?.ranking.mode).toBe('hidden_gems');
    expect(firstBody.data[0]?.ranking.explanation.components).toHaveLength(5);
    expect(firstBody.pagination.nextCursor).toEqual(expect.any(String));

    const secondResponse = await fetch(
      `${baseUrl}/api/repositories/rankings/hidden_gems?limit=1&cursor=${encodeURIComponent(
        firstBody.pagination.nextCursor as string,
      )}`,
    );
    const secondBody = (await secondResponse.json()) as {
      data: Array<{ repository: { id: string } }>;
      ranking: { evaluatedAt: string };
      pagination: { nextCursor: string | null };
    };

    expect(secondResponse.status).toBe(200);
    expect(secondBody.data.map((item) => item.repository.id)).toEqual([
      expectedIds[1],
    ]);
    expect(secondBody.ranking.evaluatedAt).toBe(
      firstBody.ranking.evaluatedAt,
    );
    expect(secondBody.pagination.nextCursor).toBeNull();
  });

  it('returns only listed repositories with sufficient history in Rising mode', async () => {
    const eligible = await seedRepository({
      githubRepositoryId: '980000001',
      name: 'rising-eligible',
    });
    await seedRepository({
      githubRepositoryId: '980000002',
      name: 'rising-no-history',
      completeHistory: false,
    });
    await seedRepository({
      githubRepositoryId: '980000003',
      name: 'rising-unlisted',
      listed: false,
    });

    const baseUrl = await startApp();
    const response = await fetch(
      `${baseUrl}/api/repositories/rankings/rising?limit=10`,
    );
    const body = (await response.json()) as {
      data: Array<{
        repository: { id: string };
        ranking: {
          mode: string;
          formulaVersion: string;
          score: number;
          explanation: {
            components: Array<{ id: string; normalizedDelta: number | null }>;
            historyCoverage: {
              stars7d: { requestedWindowDays: number; actualWindowDays: number };
            };
            visibilityContext: {
              stars: { availability: string; value: number };
            };
          };
        };
      }>;
      ranking: { evaluatedCount: number; eligibleCount: number };
    };

    expect(response.status).toBe(200);
    expect(body.ranking).toEqual(
      expect.objectContaining({
        evaluatedCount: 2,
        eligibleCount: 1,
      }),
    );
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.repository.id).toBe(eligible.id);
    expect(body.data[0]?.ranking).toEqual(
      expect.objectContaining({
        mode: 'rising',
        formulaVersion: 'rising-v1',
      }),
    );
    expect(
      body.data[0]?.ranking.explanation.historyCoverage.stars7d,
    ).toEqual(
      expect.objectContaining({
        requestedWindowDays: 7,
        actualWindowDays: 7,
      }),
    );
    expect(
      body.data[0]?.ranking.explanation.visibilityContext.stars.value,
    ).toBe(200);
  });

  it('rejects invalid modes and cross-mode cursors with stable errors', async () => {
    await seedRepository({
      githubRepositoryId: '990000001',
      name: 'cursor-source',
    });
    const baseUrl = await startApp();

    const hidden = await fetch(
      `${baseUrl}/api/repositories/rankings/hidden_gems?limit=1`,
    );
    const hiddenBody = (await hidden.json()) as {
      pagination: { nextCursor: string | null };
    };

    const invalidMode = await fetch(
      `${baseUrl}/api/repositories/rankings/popular`,
    );
    expect(invalidMode.status).toBe(400);
    await expect(invalidMode.json()).resolves.toEqual({
      error: 'invalid_ranking_mode',
      message: 'ranking mode must be hidden_gems or rising.',
    });

    if (hiddenBody.pagination.nextCursor) {
      const crossMode = await fetch(
        `${baseUrl}/api/repositories/rankings/rising?cursor=${encodeURIComponent(
          hiddenBody.pagination.nextCursor,
        )}`,
      );
      expect(crossMode.status).toBe(400);
      await expect(crossMode.json()).resolves.toEqual({
        error: 'invalid_ranking_cursor',
        message: 'ranking cursor is invalid.',
      });
    }
  });
});
