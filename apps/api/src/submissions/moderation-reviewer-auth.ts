import { createHash, timingSafeEqual } from 'node:crypto';

export type ModerationReviewerCredential = Readonly<{
  reviewerRef: string;
  token: string;
}>;

type StoredCredential = Readonly<{
  reviewerRef: string;
  tokenHash: Buffer;
}>;

function tokenHash(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

export class ModerationReviewerAuthenticator {
  private readonly credentials: readonly StoredCredential[];

  public constructor(
    credentials: readonly ModerationReviewerCredential[],
  ) {
    this.credentials = credentials.map((credential) => ({
      reviewerRef: credential.reviewerRef,
      tokenHash: tokenHash(credential.token),
    }));
  }

  authenticate(authorizationHeader: string | undefined): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const match = /^Bearer ([^\s]+)$/i.exec(authorizationHeader);

    if (!match?.[1]) {
      return null;
    }

    const candidateHash = tokenHash(match[1]);
    let matchedReviewer: string | null = null;

    for (const credential of this.credentials) {
      if (
        candidateHash.length === credential.tokenHash.length &&
        timingSafeEqual(candidateHash, credential.tokenHash)
      ) {
        matchedReviewer = credential.reviewerRef;
      }
    }

    return matchedReviewer;
  }
}
