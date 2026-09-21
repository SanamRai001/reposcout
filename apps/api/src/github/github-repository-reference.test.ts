import { describe, expect, it } from 'vitest';

import { parseGithubRepositoryReference } from './github-repository-reference.js';

describe('parseGithubRepositoryReference', () => {
  it.each([
    ['openai/openai-node', { owner: 'openai', name: 'openai-node' }],
    ['https://github.com/openai/openai-node', { owner: 'openai', name: 'openai-node' }],
    ['https://github.com/openai/openai-node/', { owner: 'openai', name: 'openai-node' }],
    ['https://github.com/openai/openai-node.git', { owner: 'openai', name: 'openai-node' }],
  ])('parses %s', (value, expected) => {
    expect(parseGithubRepositoryReference(value)).toEqual(expected);
  });

  it.each([
    '',
    'openai',
    'openai/openai-node/issues',
    'https://github.example.com/openai/openai-node',
    'http://github.com/openai/openai-node',
    'https://github.com/openai/openai-node?tab=readme',
    'https://github.com/openai/openai-node#readme',
    'https://github.com/openai/openai%2Fnode',
  ])('rejects invalid reference %s', (value) => {
    expect(() => parseGithubRepositoryReference(value)).toThrow();
  });
});
