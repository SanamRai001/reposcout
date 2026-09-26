import { DeterministicSemanticFixtureProvider } from '../evaluation/deterministic-semantic-fixture-provider.js';
import { runSemanticRetrievalEvaluation } from '../evaluation/repository-semantic-retrieval-evaluator.js';

const report = await runSemanticRetrievalEvaluation(
  new DeterministicSemanticFixtureProvider(),
);

console.log(JSON.stringify(report, null, 2));

if (
  report.semantic.top1Accuracy <= report.lexical.top1Accuracy ||
  report.semantic.meanReciprocalRank <
    report.lexical.meanReciprocalRank
) {
  process.exitCode = 1;
}
