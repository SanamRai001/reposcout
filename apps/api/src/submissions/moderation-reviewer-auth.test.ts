import { describe, expect, it } from 'vitest';

import { ModerationReviewerAuthenticator } from './moderation-reviewer-auth.js';

describe('ModerationReviewerAuthenticator', () => {
  const authenticator = new ModerationReviewerAuthenticator([
    {
      reviewerRef: 'maintainer:SanamRai001',
      token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    {
      reviewerRef: 'reviewer:second',
      token: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
  ]);

  it('maps a valid bearer token to its trusted reviewer reference', () => {
    expect(
      authenticator.authenticate(
        'Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ),
    ).toBe('maintainer:SanamRai001');
  });

  it('rejects missing, malformed, and unknown credentials', () => {
    expect(authenticator.authenticate(undefined)).toBeNull();
    expect(authenticator.authenticate('Basic abc')).toBeNull();
    expect(authenticator.authenticate('Bearer short')).toBeNull();
    expect(
      authenticator.authenticate(
        'Bearer cccccccccccccccccccccccccccccccc',
      ),
    ).toBeNull();
  });
});
