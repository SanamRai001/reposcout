import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger, sanitizeLogMetadata } from './logger.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sanitizeLogMetadata', () => {
  it('redacts sensitive keys recursively without removing safe metadata', () => {
    expect(
      sanitizeLogMetadata({
        requestId: 'request-1',
        authorization: 'Bearer top-secret',
        nested: {
          apiKey: 'api-secret',
          tokenHash: 'hash-secret',
          safe: 'visible',
        },
        values: [
          {
            password: 'hidden',
            status: 'ok',
          },
        ],
      }),
    ).toEqual({
      requestId: 'request-1',
      authorization: '[REDACTED]',
      nested: {
        apiKey: '[REDACTED]',
        tokenHash: '[REDACTED]',
        safe: 'visible',
      },
      values: [
        {
          password: '[REDACTED]',
          status: 'ok',
        },
      ],
    });
  });

  it('does not allow metadata to overwrite reserved log fields', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    logger.info('security.test', {
      event: 'attacker.event',
      level: 'error',
      timestamp: 'attacker-time',
      token: 'hidden-token',
    });

    const payload = JSON.parse(String(info.mock.calls[0]?.[0])) as {
      event: string;
      level: string;
      timestamp: string;
      token: string;
    };

    expect(payload.event).toBe('security.test');
    expect(payload.level).toBe('info');
    expect(payload.timestamp).not.toBe('attacker-time');
    expect(payload.token).toBe('[REDACTED]');
  });
});
