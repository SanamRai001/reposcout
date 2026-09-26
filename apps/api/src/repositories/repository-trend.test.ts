import { describe, expect, it } from 'vitest';

import { parseRepositoryTrendWindowDays } from './repository-trend.js';

describe('parseRepositoryTrendWindowDays', () => {
  it('accepts explicit windows from one to 365 days', () => {
    expect(parseRepositoryTrendWindowDays('1')).toBe(1);
    expect(parseRepositoryTrendWindowDays('30')).toBe(30);
    expect(parseRepositoryTrendWindowDays('365')).toBe(365);
  });

  it.each([
    undefined,
    '',
    '0',
    '366',
    '-1',
    '1.5',
    'seven',
  ])('rejects invalid window value %s', (value) => {
    expect(() => parseRepositoryTrendWindowDays(value)).toThrow(
      'windowDays must be an integer between 1 and 365.',
    );
  });
});
