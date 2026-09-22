import 'dotenv/config';

import { loadEnvironment } from '../config/env.js';
import { createDatabasePool } from '../database/database.js';
import { GithubClient } from '../github/github-client.js';
import { parseGithubRepositoryReference } from '../github/github-repository-reference.js';
import { RepositoryReadmeService } from '../github/repository-readme-service.js';
import { RepositoryReadmeStore } from '../repositories/repository-readme-store.js';
import { RepositoryStore } from '../repositories/repository-store.js';

function parseReferenceArgument(args: string[]): string {
  if (args.length !== 1 || !args[0]) {
    throw new Error(
      'Usage: npm run refresh:readme -w @reposcout/api -- <owner/repository|GitHub URL>',
    );
  }

  return args[0];
}

async function run(): Promise<void> {
  const referenceValue = parseReferenceArgument(process.argv.slice(2));
  const reference = parseGithubRepositoryReference(referenceValue);
  const environment = loadEnvironment();
  const pool = createDatabasePool(environment.database);

  try {
    const repositoryStore = new RepositoryStore(pool);
    const matches = await repositoryStore.findByFullName(
      `${reference.owner}/${reference.name}`,
    );

    if (matches.length === 0) {
      throw new Error(
        'Repository must be ingested into RepoScout before README refresh.',
      );
    }

    if (matches.length > 1) {
      throw new Error(
        'Repository full name is ambiguous; resolve canonical identity before README refresh.',
      );
    }

    const repository = matches[0]!;

    const githubClient = new GithubClient({
      token: environment.github.token,
      requestTimeoutMs: environment.github.requestTimeoutMs,
    });
    const readmeStore = new RepositoryReadmeStore(pool);
    const service = new RepositoryReadmeService(
      githubClient,
      readmeStore,
    );

    const result = await service.refresh(repository);

    console.log(
      JSON.stringify(
        {
          repository: {
            id: repository.id,
            fullName: repository.fullName,
          },
          readme: {
            status: result.status,
            sourceRef: result.sourceRef,
            path: result.path,
            sha: result.sha,
            sizeBytes: result.sizeBytes,
            observedAt: result.observedAt.toISOString(),
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }),
  );
  process.exitCode = 1;
});
