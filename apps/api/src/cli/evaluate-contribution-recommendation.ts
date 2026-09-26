import {
  runContributionRecommendationBenchmark,
} from '../evaluation/repository-contribution-recommendation-evaluator.js';

const run = runContributionRecommendationBenchmark();

console.log(JSON.stringify(run, null, 2));

if (run.summary.failed > 0) {
  process.exitCode = 1;
}
