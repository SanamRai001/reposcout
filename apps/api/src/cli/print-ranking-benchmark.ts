import {
  runRankingBenchmark,
} from '../evaluation/repository-ranking-benchmark.js';

const report = runRankingBenchmark();

console.log(JSON.stringify(report, null, 2));

if (report.summary.guardrailsFailed > 0) {
  process.exitCode = 1;
}
