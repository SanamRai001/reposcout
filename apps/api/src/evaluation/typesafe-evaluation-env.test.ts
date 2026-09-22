import { describe, expect, it } from 'vitest';

import { loadTypeSafeEvaluationEnvironment } from './typesafe-evaluation-env.js';

describe('loadTypeSafeEvaluationEnvironment', () => {
  it('requires the API key only for live evaluation tooling', () => {
    expect(() =>
      loadTypeSafeEvaluationEnvironment({
        TYPESAFE_MODEL: 'jev-latest',
      }),
    ).toThrow('TYPESAFE_API_KEY is required for live Jev evaluation.');
  });

  it('uses safe defaults for model and timeout', () => {
    expect(
      loadTypeSafeEvaluationEnvironment({
        TYPESAFE_API_KEY: ' secret ',
      }),
    ).toEqual({
      apiKey: 'secret',
      model: 'jev-latest',
      requestTimeoutMs: 8000,
    });
  });

  it('validates the live request timeout', () => {
    expect(() =>
      loadTypeSafeEvaluationEnvironment({
        TYPESAFE_API_KEY: 'secret',
        TYPESAFE_REQUEST_TIMEOUT_MS: '100',
      }),
    ).toThrow(
      'TYPESAFE_REQUEST_TIMEOUT_MS must be an integer between 500 and 60000.',
    );
  });
});
