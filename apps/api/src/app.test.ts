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

  it('adds correlation and baseline security headers', async () => {
    const { baseUrl } = await startApp();
    const response = await fetch(`${baseUrl}/health`);

    expect(response.headers.get('x-request-id')).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
    expect(response.headers.get('x-content-type-options')).toBe(
      'nosniff',
    );
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
  });

  it('marks submission and moderation responses as non-cacheable', async () => {
    const { baseUrl } = await startApp();

    const submission = await fetch(`${baseUrl}/api/submissions`);
    const moderation = await fetch(`${baseUrl}/api/moderation/submissions`);

    expect(submission.headers.get('cache-control')).toBe('no-store');
    expect(moderation.headers.get('cache-control')).toBe('no-store');
  });

  it('maps malformed JSON to a stable 400 instead of a 500', async () => {
    const { baseUrl } = await startApp();
    const response = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{"repositoryUrl":',
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_json');
  });

  it('maps oversized JSON bodies to a stable 413 instead of a 500', async () => {
    const { baseUrl } = await startApp();
    const response = await fetch(`${baseUrl}/api/submissions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        repositoryUrl: `https://github.com/example/${'x'.repeat(110_000)}`,
      }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(413);
    expect(body.error).toBe('request_body_too_large');
  });

});
