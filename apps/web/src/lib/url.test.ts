import { describe, expect, it } from 'vitest';

import { normalizeBaseUrl } from './url';

describe('normalizeBaseUrl', () => {
  it('removes whitespace and trailing slashes', () => {
    expect(normalizeBaseUrl('  http://localhost:4000///  ')).toBe(
      'http://localhost:4000',
    );
  });
});
