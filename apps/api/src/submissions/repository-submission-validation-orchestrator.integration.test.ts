import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { RepositorySubmissionStore } from './repository-submission-store.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for submission orchestration tests.',
  );
}

const environment: DatabaseEnvironment = {
  url: databaseUrl,
  ssl: false,
  poolMax: 2,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 1_000,
};

const pool = createDatabasePool(environment);
const submissionStore = new RepositorySubmissionStore(pool);

beforeEach(async () => {
  await pool.query('DELETE FROM repository_submissions');
});

afterAll(async () => {
  await pool.end();
});

async function createPending(
  index: number,
): Promise<string> {
  const name = `project-${index}`;
  const result = await submissionStore.createPending({
    submittedUrl: `https://github.com/example/${name}`,
    normalizedOwner: 'example',
    normalizedName: name,
    normalizedFullName: `example/${name}`,
  });

  if (result.kind !== 'created') {
    throw new Error('Expected a new pending submission fixture.');
  }

  return result.submission.id;
}

describe('pending submission validation candidate selection', () => {
  it('returns only pending unvalidated submissions and respects the limit', async () => {
    const firstId = await createPending(1);
    const secondId = await createPending(2);
    const thirdId = await createPending(3);

    await submissionStore.recordValidation({
      kind: 'invalid',
      submissionId: secondId,
      validatedAt: new Date('2026-09-24T06:00:00Z'),
    });

    const candidates =
      await submissionStore.listPendingValidationCandidates(1);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.validationOutcome).toBeNull();
    expect(candidates[0]?.status).toBe('PENDING');
    expect([firstId, thirdId]).toContain(candidates[0]?.id);

    const allRemaining =
      await submissionStore.listPendingValidationCandidates(10);

    expect(allRemaining.map((item) => item.id).sort()).toEqual(
      [firstId, thirdId].sort(),
    );
    expect(allRemaining.some((item) => item.id === secondId)).toBe(false);
  });

  it('rejects unbounded or invalid candidate limits', async () => {
    await expect(
      submissionStore.listPendingValidationCandidates(0),
    ).rejects.toThrow(
      'Validation candidate limit must be an integer between 1 and 50.',
    );

    await expect(
      submissionStore.listPendingValidationCandidates(51),
    ).rejects.toThrow(
      'Validation candidate limit must be an integer between 1 and 50.',
    );
  });
});
