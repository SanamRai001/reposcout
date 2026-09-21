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

describe('RepoScout API', () => {
  it('returns a healthy response', async () => {
    const app = createApp();
    const server = app.listen(0);
    servers.push(server);

    await new Promise<void>((resolve) => server.once('listening', resolve));

    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
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
});
