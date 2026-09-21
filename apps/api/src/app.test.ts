import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';

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

async function startApp(
  dependencies?: Parameters<typeof createApp>[0],
): Promise<{ baseUrl: string }> {
  const app = createApp(dependencies);
  const server = app.listen(0);
  servers.push(server);

  await new Promise<void>((resolve) => server.once('listening', resolve));

  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

describe('RepoScout API', () => {
  it('returns a healthy liveness response', async () => {
    const { baseUrl } = await startApp();
    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as {
      service: string;
      status: string;
      timestamp: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('reposcout-api');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it('returns ready when dependencies are available', async () => {
    const { baseUrl } = await startApp({
      checkReadiness: async () => undefined,
    });

    const response = await fetch(`${baseUrl}/ready`);
    const body = (await response.json()) as {
      status: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ready');
  });

  it('returns 503 when a required dependency is unavailable', async () => {
    const { baseUrl } = await startApp({
      checkReadiness: async () => {
        throw new Error('database unavailable');
      },
    });

    const response = await fetch(`${baseUrl}/ready`);
    const body = (await response.json()) as {
      status: string;
    };

    expect(response.status).toBe(503);
    expect(body.status).toBe('unavailable');
  });
});
