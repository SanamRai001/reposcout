import {
  runRepositoryRankingBenchmark,
} from '../evaluation/repository-ranking-evaluator.js';

const run = runRepositoryRankingBenchmark();

console.log(JSON.stringify(run, null, 2));

if (run.summary.failed > 0) {
  process.exitCode = 1;
}
