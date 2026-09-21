import { describe, expect, it } from 'vitest';

import { parseIngestRepositoryCommand } from './ingest-repository-command.js';

describe('parseIngestRepositoryCommand', () => {
  it('parses a repository reference', () => {
    expect(parseIngestRepositoryCommand(['openai/openai-node'])).toEqual({
      reference: 'openai/openai-node',
      force: false,
    });
  });

  it('parses an explicit force refresh', () => {
    expect(
      parseIngestRepositoryCommand([
        'https://github.com/openai/openai-node',
        '--force',
      ]),
    ).toEqual({
      reference: 'https://github.com/openai/openai-node',
      force: true,
    });
  });

  it('rejects missing or multiple repository references', () => {
    expect(() => parseIngestRepositoryCommand([])).toThrow('Usage:');
    expect(() =>
      parseIngestRepositoryCommand(['owner/one', 'owner/two']),
    ).toThrow('Usage:');
  });
});
