import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL(
    '../../../../.github/workflows/semantic-retrieval-live-evaluation.yml',
    import.meta.url,
  ),
  'utf8',
);

describe('manual semantic evaluation workflow safety', () => {
  it('passes user-selected inputs as environment variables, not executable shell text', () => {
    expect(workflow).toContain('OPENAI_EMBEDDING_MODEL: ${{ inputs.model }}');
    expect(workflow).toContain('OPENAI_EMBEDDING_DIMENSIONS: ${{ inputs.dimensions }}');
    expect(workflow).toContain('EVALUATION_RUNS: ${{ inputs.runs }}');

    const steps = workflow.split(/(?=^      - name: )/m).slice(1);

    for (const step of steps) {
      const runIndex = step.indexOf('\n        run:');

      if (runIndex >= 0) {
        expect(step.slice(runIndex)).not.toMatch(/\$\{\{\s*inputs\./);
      }
    }

    expect(workflow).toContain('--runs "$EVALUATION_RUNS"');
    expect(workflow).toContain('"$OPENAI_EMBEDDING_DIMENSIONS"');
  });

  it('validates dimensions and run count before installing dependencies', () => {
    const validation = workflow.indexOf('      - name: Validate workflow inputs');
    const installation = workflow.indexOf('      - name: Install dependencies');

    expect(validation).toBeGreaterThan(0);
    expect(installation).toBeGreaterThan(validation);
    expect(workflow).toContain('^[1-9][0-9]*$');
    expect(workflow).toContain('text-embedding-3-small) max_dimensions=1536');
    expect(workflow).toContain('text-embedding-3-large) max_dimensions=3072');
    expect(workflow).toContain('1|3|5)');
  });

  it('retains partial evidence after non-cancellation failures', () => {
    expect(workflow).toContain('      - name: Upload evaluation evidence\n        if: ${{ !cancelled() }}');
    expect(workflow).toContain('          if-no-files-found: warn');
    expect(workflow).toContain('          retention-days: 30');
  });
});
