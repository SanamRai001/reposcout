import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import type {
  ContributionDiscoveryItem,
  ContributionDiscoveryReader,
} from './repository-contribution-discovery.js';
import { buildContributionDiscoverySignalSnapshot } from './repository-contribution-signals.js';

const servers: ReturnType<ReturnType<typeof createApp>['listen']>[] = [];

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

function createItem(): ContributionDiscoveryItem {
  const evaluatedAt = new Date('2026-09-26T12:00:00.000Z');
  const issue = {
    id: '11111111-1111-4111-8111-111111111111',
    repositoryId: '22222222-2222-4222-8222-222222222222',
    githubIssueId: '991000001',
    number: 42,
    title: 'Improve contribution docs',
    githubUrl: 'https://github.com/example/project/issues/42',
    state: 'open' as const,
    locked: false,
    assigneeCount: 0,
    commentCount: 2,
    labels: ['Good-First_Issue', 'help-wanted'],
    createdAtGithub: new Date('2026-09-01T00:00:00.000Z'),
    updatedAtGithub: new Date('2026-09-25T12:00:00.000Z'),
    observedAt: new Date('2026-09-26T08:00:00.000Z'),
    createdAt: new Date('2026-09-26T08:00:00.000Z'),
    updatedAt: new Date('2026-09-26T08:00:00.000Z'),
  };

  return {
    repository: {
      id: issue.repositoryId,
      fullName: 'example/project',
      githubUrl: 'https://github.com/example/project',
      primaryLanguage: 'TypeScript',
    },
    issue,
    signalSnapshot: buildContributionDiscoverySignalSnapshot({
      repositoryId: issue.repositoryId,
      evaluatedAt,
      issue: {
        githubIssueId: issue.githubIssueId,
        number: issue.number,
        title: issue.title,
        state: issue.state,
        locked: issue.locked,
        assigneeCount: issue.assigneeCount,
        commentCount: issue.commentCount,
        labels: issue.labels,
        createdAt: issue.createdAtGithub,
        updatedAt: issue.updatedAtGithub,
      },
      repositoryEvidence: null,
    }),
  };
}

async function startApp(reader: ContributionDiscoveryReader) {
  const app = createApp({ contributionDiscovery: reader });
  const server = app.listen(0);
  servers.push(server);

  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}`;
}

describe('public contribution discovery routes', () => {
  it('exposes measured open-issue evidence and keeps cursor evaluation time stable', async () => {
    const item = createItem();
    const discoverPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [item], hasMore: true })
      .mockResolvedValueOnce({ items: [], hasMore: false });
    const baseUrl = await startApp({ discoverPage });

    const query =
      'unassigned=true&unlocked=true&goodFirstIssue=true&helpWanted=true&language=TypeScript&updatedWithinDays=30&contributing=present&limit=1';
    const firstResponse = await fetch(
      `${baseUrl}/api/contributions/issues?${query}`,
    );
    const firstBody = (await firstResponse.json()) as {
      data: Array<{
        issue: { state: string };
        evidence: {
          normalizedLabels: string[];
          signals: Record<string, unknown>;
        };
        recommendation: {
          contractVersion: string;
          status: string;
          cautionCodes?: string[];
          cautions: Array<{ code: string }>;
        };
      }>;
      discovery: {
        contractVersion: string;
        evaluatedAt: string;
        state: string;
        filters: Record<string, unknown>;
      };
      pagination: { nextCursor: string | null };
    };

    expect(firstResponse.status).toBe(200);
    expect(firstBody.discovery).toEqual(
      expect.objectContaining({
        contractVersion: 'contribution-signals-v1',
        state: 'open',
        filters: {
          unassigned: true,
          unlocked: true,
          goodFirstIssue: true,
          helpWanted: true,
          language: 'typescript',
          updatedWithinDays: 30,
          contributing: 'present',
        },
      }),
    );
    expect(firstBody.data[0]).toEqual(
      expect.objectContaining({
        issue: expect.objectContaining({ state: 'open' }),
        evidence: expect.objectContaining({
          normalizedLabels: ['good first issue', 'help wanted'],
        }),
        recommendation: expect.objectContaining({
          contractVersion: 'contribution-recommendation-v1',
          status: 'consider',
          cautions: expect.arrayContaining([
            expect.objectContaining({
              code: 'contributing_evidence_missing',
            }),
          ]),
        }),
      }),
    );
    expect(
      JSON.stringify(firstBody.data[0]),
    ).not.toContain('beginnerFriendly');
    expect(JSON.stringify(firstBody.data[0])).not.toContain('"score"');
    expect(firstBody.pagination.nextCursor).toEqual(expect.any(String));

    const secondResponse = await fetch(
      `${baseUrl}/api/contributions/issues?${query}&cursor=${encodeURIComponent(
        firstBody.pagination.nextCursor as string,
      )}`,
    );
    const secondBody = (await secondResponse.json()) as {
      discovery: { evaluatedAt: string };
    };

    expect(secondResponse.status).toBe(200);
    expect(secondBody.discovery.evaluatedAt).toBe(
      firstBody.discovery.evaluatedAt,
    );
    expect(discoverPage).toHaveBeenCalledTimes(2);

    const secondInput = discoverPage.mock.calls[1]?.[0];
    expect(secondInput.evaluatedAt.toISOString()).toBe(
      firstBody.discovery.evaluatedAt,
    );
  });

  it('rejects changed filter scope when reusing a cursor', async () => {
    const item = createItem();
    const discoverPage = vi
      .fn()
      .mockResolvedValue({ items: [item], hasMore: true });
    const baseUrl = await startApp({ discoverPage });

    const firstResponse = await fetch(
      `${baseUrl}/api/contributions/issues?unassigned=true&limit=1`,
    );
    const firstBody = (await firstResponse.json()) as {
      pagination: { nextCursor: string };
    };

    const changedScopeResponse = await fetch(
      `${baseUrl}/api/contributions/issues?unassigned=false&limit=1&cursor=${encodeURIComponent(
        firstBody.pagination.nextCursor,
      )}`,
    );
    const changedScopeBody = (await changedScopeResponse.json()) as {
      error: string;
    };

    expect(changedScopeResponse.status).toBe(400);
    expect(changedScopeBody.error).toBe('invalid_pagination');
    expect(discoverPage).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed deterministic filters before discovery work', async () => {
    const discoverPage = vi.fn();
    const baseUrl = await startApp({ discoverPage });

    const response = await fetch(
      `${baseUrl}/api/contributions/issues?goodFirstIssue=maybe`,
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_contribution_filter');
    expect(discoverPage).not.toHaveBeenCalled();
  });
});
