export type IngestRepositoryCommand = Readonly<{
  reference: string;
  force: boolean;
}>;

export function parseIngestRepositoryCommand(
  argv: readonly string[],
): IngestRepositoryCommand {
  const force = argv.includes('--force');
  const positional = argv.filter((argument) => argument !== '--force');

  if (positional.length !== 1) {
    throw new Error(
      'Usage: npm run ingest:repository -w @reposcout/api -- <owner/repo|github-url> [--force]',
    );
  }

  return {
    reference: positional[0] as string,
    force,
  };
}
