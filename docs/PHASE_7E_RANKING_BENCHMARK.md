# Phase 7E — Ranking Benchmark, Evaluation, and Tuning Decision

## Goal

Create a reproducible benchmark for Hidden Gems and Rising before changing any ranking formula.

The purpose of Phase 7E is not to force a v2.

It is to answer:

> Do the current formulas violate any ranking behavior RepoScout explicitly claims to want?

If not, changing weights is not justified yet.

## Benchmark version

~~~text
ranking-benchmark-v1
~~~

## Dataset

The first benchmark is deliberately synthetic and frozen.

It contains:

~~~text
18 total ranking cases
 7 Hidden Gems cases
11 Rising cases

13 gating expectations
 2 non-gating risk probes
~~~

Synthetic cases make the benchmark:

- deterministic;
- reviewable;
- fast;
- CI-safe;
- independent of live GitHub changes.

They do **not** prove that the formulas are optimal for every real repository ecosystem.

## Gating expectations

### Hidden Gems

The benchmark requires:

1. healthy low visibility > equally healthy high visibility;
2. evidence > obscurity alone;
3. mature supported repository > unsupported obscure repository;
4. more observed community readiness must not lower score;
5. missing required evidence = ineligible;
6. missing optional history can remain eligible.

### Rising

The benchmark requires:

1. same momentum = same score regardless of lifetime popularity;
2. balanced sustained growth > isolated one-week star burst;
3. strong momentum > weak momentum;
4. missing primary history = ineligible;
5. excessive sparse history = ineligible;
6. missing maintenance can remain eligible;
7. normalized allowed sparse history approximately matches its exact-window peer.

## Result

Current formulas:

~~~text
hidden-gem-v1
rising-v1
~~~

pass:

~~~text
13 / 13
~~~

gating expectations.

Therefore Phase 7E makes **no formula change**.

No:

- weight change;
- star threshold change;
- popularity saturation change;
- maintenance horizon change;
- momentum target change;
- sparse-window tolerance change;
- new formula version.

This is intentional.

A synthetic benchmark passing does not justify "optimizing" arbitrary numbers further.

## Risk probe 1 — Community-file checklist sensitivity

Hidden Gems rewards observed repository/community-file presence.

That evidence is useful, but file presence alone cannot establish that:

- CONTRIBUTING guidance is useful;
- maintainers actually respond;
- issue templates are healthy rather than bureaucratic;
- the repository welcomes outside contributors.

A repository can create files cheaply.

The benchmark therefore measures and reports this sensitivity but does not mark it as a successful ranking property.

A future improvement needs richer evidence before formula tuning is meaningful.

## Risk probe 2 — Artificial momentum bursts

Rising measures changes in stars and forks.

A synthetic very large growth burst can saturate the score.

The historical snapshot system cannot currently distinguish:

- organic adoption;
- legitimate launch publicity;
- bot/fake stars;
- coordinated manipulation.

Changing the current weights cannot establish authenticity.

Future anti-abuse work should add evidence/provenance/anomaly signals first, then benchmark those signals.

## Evaluator design

The benchmark evaluator accepts scorer functions.

Default:

~~~text
hidden-gem-v1
rising-v1
~~~

A future candidate formula can run against the same benchmark without changing benchmark code.

If a proposed formula causes existing invariants to fail, that regression is visible immediately.

## Commands

Run the CI-style gate:

~~~bash
npm run test:ranking -w @reposcout/api
~~~

Print the machine-readable benchmark report:

~~~bash
npm run eval:ranking -w @reposcout/api
~~~

The CLI exits nonzero when any gating expectation fails.

## CI integration

CI now includes:

~~~text
Verify ranking benchmark
~~~

after the existing application/Jev verification and before database migration checks.

Ranking invariants are therefore protected on every pull request and push.

## Formula revision policy

A future formula change must:

1. state the observed failure/problem;
2. retain or deliberately version benchmark expectations;
3. compare old and proposed scorers against the benchmark;
4. create a new public formula version;
5. document threshold/weight changes;
6. preserve deterministic fallback;
7. avoid silently changing benchmark cases only to make the new formula pass.

## Real-world evaluation

The next ranking benchmark expansion should use actual repository observations.

But those observations must be frozen.

A future fixture should capture:

- repository identifier;
- current metadata;
- README/community evidence;
- historical snapshots/trends;
- evaluation timestamp;
- manual/human label or other explicit ground truth;
- benchmark version.

CI should never use live changing GitHub values as benchmark truth.

## Model-assisted reranking

Phase 7E does not justify model-assisted ranking.

The deterministic benchmark currently passes all gating expectations.

A model experiment should only begin after a real measured gap is identified that deterministic signals cannot address.

Any model layer must remain:

- bounded;
- versioned;
- clearly probabilistic;
- explainable separately from measured facts;
- optional when provider access is unavailable.

## Verification history

Initial implementation head `8acab841017de6c124e343d2f9994d0efb091e27` failed CI #242 due to one unused lint binding.

Follow-up head `a527f8c227f3cbfa694d45606429d800ffc57c1d` failed CI #243 because the sparse-window fixture helper inferred actual days as only 7 or 30.

Corrected code head `f785dbf56cf99ff855470ed336d9d4af17802c87` passed CI #244 completely, including the new ranking benchmark gate.

## Phase 7 completion

Phase 7 now contains:

~~~text
7A  ranking signal contract
7B  Hidden Gems v1
7C  Rising v1
7D  public ranking + explanations
7E  benchmark + regression gate
~~~

Phase 7 is complete.

## Next phase

Phase 8 — Contribution Discovery.
