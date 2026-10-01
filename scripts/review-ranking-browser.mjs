/* global console, URL, window, document */
/**
 * A2 browser-review gate. Uses mock HTTP transport, NOT live repository data.
 * The actual production Vite bundle is served via vite preview by the workflow.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const ORIGIN = 'http://127.0.0.1:4173';
const OUTPUT = 'artifacts/browser-review';
const observedAt = '2026-09-26T12:00:00.000Z';
const checks = [];

function repository(id) {
  return {
    id: '11111111-1111-4111-8111-' + String(id).padStart(12, '0'),
    githubRepositoryId: String(120000 + id),
    owner: 'sample',
    name: 'project-' + id,
    fullName: 'sample/project-' + id,
    githubUrl: 'https://github.com/sample/project-' + id,
    defaultBranch: 'main',
    description: 'A curated public project for the browser review.',
    isArchived: false,
    isFork: false,
    createdAtGithub: '2025-01-01T00:00:00.000Z',
    updatedAtGithub: observedAt,
    pushedAtGithub: observedAt,
    lastSyncedAt: observedAt,
    createdAt: observedAt,
    updatedAt: observedAt,
    metadata: {
      stars: 120,
      forks: 20,
      openIssues: 4,
      primaryLanguage: 'TypeScript',
      licenseSpdx: 'MIT',
      topics: ['backend'],
      observedAt,
    },
  };
}

function trend(days) {
  return {
    requestedWindowDays: days,
    actualWindowDays: days,
    baselineCapturedOn: days === 7 ? '2026-09-19' : '2026-08-27',
    latestCapturedOn: '2026-09-26',
  };
}

function item(mode, id) {
  const explanation = mode === 'hidden_gems'
    ? {
        components: [{
          id: 'maintenance',
          points: 30,
          maxPoints: 35,
          signalIds: ['maintenance.days_since_push'],
        }],
        positivePoints: 65,
        popularityPenalty: {
          id: 'popularity_saturation',
          points: 3,
          maxPoints: 25,
          stars: 120,
          freeStars: 250,
          saturationStars: 50000,
        },
        optionalMomentumCoverage: {
          available: 1,
          expected: 2,
          missingSignalIds: ['momentum.forks_delta_30d'],
        },
      }
    : {
        components: [{
          id: 'stars_7d_momentum',
          points: 35,
          maxPoints: 45,
          signalIds: ['momentum.stars_delta_7d'],
          normalizedDelta: 8,
        }],
        historyCoverage: {
          stars7d: trend(7),
          stars30d: trend(30),
          forks30d: trend(30),
        },
        visibilityContext: {
          stars: {
            id: 'visibility.stars_total',
            availability: 'available',
            value: 120,
            provenance: null,
          },
          forks: {
            id: 'visibility.forks_total',
            availability: 'available',
            value: 20,
            provenance: null,
          },
        },
        maintenanceCoverage: { availability: 'available', daysSincePush: 0 },
      };

  return {
    repository: repository(id),
    ranking: {
      mode,
      formulaVersion: mode === 'hidden_gems' ? 'hidden-gem-v1' : 'rising-v1',
      score: mode === 'hidden_gems' ? 62 : 35,
      explanation,
    },
  };
}

function responsePage(mode, data, cursor = null, eligibleCount = data.length) {
  return {
    data,
    ranking: {
      mode,
      formulaVersion: mode === 'hidden_gems' ? 'hidden-gem-v1' : 'rising-v1',
      evaluatedAt: observedAt,
      evaluatedCount: Math.max(eligibleCount, 13),
      eligibleCount,
    },
    pagination: { limit: 12, nextCursor: cursor },
  };
}

async function mockApi(page, resolveRanking, counters = { catalog: 0, rank: 0 }) {
  await page.route('**/api/repositories**', async (route) => {
    const url = new URL(route.request().url());
    const ranking = url.pathname.match(/^\/api\/repositories\/rankings\/(hidden_gems|rising)$/);
    let result;
    if (ranking) {
      counters.rank += 1;
      result = await resolveRanking(ranking[1], url.searchParams.get('cursor'));
    } else if (url.pathname === '/api/repositories') {
      counters.catalog += 1;
      result = {
        data: [],
        pagination: { limit: 12, nextCursor: null },
      };
    } else {
      throw new Error('Unexpected API request in browser review: ' + url.pathname);
    }
    const payload = result && result.__httpError
      ? {
          status: result.__httpError,
          body: { error: 'service_unavailable', message: 'Temporary ranking error.' },
        }
      : { status: 200, body: result };

    try {
      await route.fulfill({
        status: payload.status,
        contentType: 'application/json',
        body: JSON.stringify(payload.body),
      });
    } catch (error) {
      // React StrictMode can abort its first development effect. Production Vite
      // preview should normally not do so, but a canceled request is harmless.
      if (!/closed|cancel|abort|already handled/i.test(String(error))) throw error;
    }
  });
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return () => assert.deepEqual(errors, [], 'No uncaught browser runtime errors');
}

async function assertNoHorizontalOverflow(page, label) {
  const measures = await page.evaluate(() => ({
    windowWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(
    measures.documentWidth <= measures.windowWidth + 1,
    label + ' has horizontal overflow: ' + JSON.stringify(measures),
  );
}

async function run(name, fn) {
  await fn();
  checks.push(name);
  console.log('PASS: ' + name);
}

await mkdir(OUTPUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  await run('Deep-linked rankings, mode navigation and Back/Forward', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const clean = trackErrors(page);
    const counters = { catalog: 0, rank: 0 };
    await mockApi(page, (mode) => responsePage(mode, [item(mode, 1)]), counters);
    await page.goto(ORIGIN + '/?view=hidden_gems');
    await page.getByRole('heading', { name: 'Explore Hidden Gems.' }).waitFor();
    await page.locator('.ranked-card:not(.repository-card-skeleton)').first().waitFor();
    assert.equal(counters.catalog, 0, 'Ranking view must not request catalog pages');
    assert.equal(await page.locator('a[aria-current="page"]').innerText(), 'Hidden Gems');
    await page.screenshot({ path: OUTPUT + '/hidden-gems-desktop.png', fullPage: true });

    await page.getByRole('link', { name: 'Rising', exact: true }).click();
    await page.getByRole('heading', { name: 'See what is gaining momentum.' }).waitFor();
    await page.locator('.ranked-card:not(.repository-card-skeleton)').first().waitFor();
    assert.match(page.url(), /view=rising/);
    await page.screenshot({ path: OUTPUT + '/rising-desktop.png', fullPage: true });

    await page.goBack();
    await page.getByRole('heading', { name: 'Explore Hidden Gems.' }).waitFor();
    await page.goForward();
    await page.getByRole('heading', { name: 'See what is gaining momentum.' }).waitFor();
    assert.equal(counters.catalog, 0);
    await page.getByRole('link', { name: 'Explore catalog', exact: true }).click();
    await page.getByRole('heading', { name: 'Find a useful repository' }).waitFor();
    await page.getByRole('heading', { name: 'No repositories indexed yet' }).waitFor();
    assert.ok(counters.catalog > 0, 'Catalog loads only after returning to catalog');
    assert.equal(new URL(page.url()).search, '');
    await page.screenshot({ path: OUTPUT + '/catalog-desktop.png', fullPage: true });
    clean();
    await page.close();
  });

  for (const [label, width, height, mode] of [
    ['mobile', 375, 812, 'hidden_gems'],
    ['tablet', 768, 1024, 'rising'],
    ['desktop', 1440, 900, 'hidden_gems'],
  ]) {
    await run(label + ' rendering and no horizontal document overflow', async () => {
      const page = await browser.newPage({ viewport: { width, height } });
      const clean = trackErrors(page);
      await mockApi(page, (requestedMode) =>
        responsePage(requestedMode, [item(requestedMode, 1)]));
      await page.goto(ORIGIN + '/?view=' + mode);
      await page.locator('.ranked-card:not(.repository-card-skeleton)').first().waitFor();
      await assertNoHorizontalOverflow(page, label);
      await page.locator('summary').first().click();
      assert.ok(await page.locator('details[open]').count() > 0);
      const explanation = await page.locator('details[open]').first().innerText();
      assert.match(explanation, mode === 'hidden_gems'
        ? /Popularity adjustment/
        : /Historical measurement coverage/);
      await page.screenshot({
        path: OUTPUT + '/ranking-' + label + '-expanded.png',
        fullPage: true,
      });
      clean();
      await page.close();
    });
  }

  await run('Genuine empty Rising eligibility state', async () => {
    const page = await browser.newPage();
    const clean = trackErrors(page);
    await mockApi(page, (mode) => responsePage(mode, [], null, 0));
    await page.goto(ORIGIN + '/?view=rising');
    await page.getByRole('heading', { name: 'No eligible repositories yet' }).waitFor();
    assert.equal(await page.locator('.ranked-card:not(.repository-card-skeleton)').count(), 0);
    assert.ok(await page.getByText(/7- and 30-day snapshots/).isVisible());
    await page.screenshot({ path: OUTPUT + '/rising-empty.png', fullPage: true });
    clean();
    await page.close();
  });

  await run('HTTP failure followed by an explicit successful retry', async () => {
    const page = await browser.newPage();
    const clean = trackErrors(page);
    let unavailable = true;
    await mockApi(page, (mode) => unavailable
      ? { __httpError: 503 }
      : responsePage(mode, [item(mode, 1)]));
    await page.goto(ORIGIN + '/?view=hidden_gems');
    await page.getByRole('heading', { name: 'Ranking data unavailable' }).waitFor();
    await page.screenshot({ path: OUTPUT + '/ranking-error.png', fullPage: true });
    unavailable = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.locator('.ranked-card:not(.repository-card-skeleton)').first().waitFor();
    assert.equal(await page.locator('.ranked-card:not(.repository-card-skeleton)').count(), 1);
    clean();
    await page.close();
  });

  await run('Opaque load-more cursor, duplicate elimination and end state', async () => {
    const page = await browser.newPage();
    const clean = trackErrors(page);
    let receivedCursor = null;
    await mockApi(page, (mode, cursor) => {
      if (cursor === null) {
        return responsePage(
          mode, Array.from({ length: 12 }, (_, index) => item(mode, index + 1)),
          'opaque+one', 13,
        );
      }
      receivedCursor = cursor;
      return responsePage(mode, [item(mode, 12), item(mode, 13)], null, 13);
    });
    await page.goto(ORIGIN + '/?view=hidden_gems');
    await page.waitForFunction(() => document.querySelectorAll('.ranked-card:not(.repository-card-skeleton)').length === 12);
    await page.getByRole('button', { name: 'Load more ranked repositories' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.ranked-card:not(.repository-card-skeleton)').length === 13);
    assert.equal(receivedCursor, 'opaque+one');
    assert.equal(await page.locator('.ranked-card:not(.repository-card-skeleton)').count(), 13);
    assert.ok(await page.getByText('End of eligible repositories in this view.').isVisible());
    await page.screenshot({ path: OUTPUT + '/ranking-pagination.png', fullPage: true });
    clean();
    await page.close();
  });

  await run('Pagination failure retains existing cards and offers restart', async () => {
    const page = await browser.newPage();
    const clean = trackErrors(page);
    await mockApi(page, (mode, cursor) => cursor === null
      ? responsePage(mode, Array.from({ length: 12 }, (_, i) => item(mode, i + 1)), 'cursor-1', 13)
      : { __httpError: 503 });
    await page.goto(ORIGIN + '/?view=hidden_gems');
    await page.waitForFunction(() => document.querySelectorAll('.ranked-card:not(.repository-card-skeleton)').length === 12);
    await page.getByRole('button', { name: 'Load more ranked repositories' }).click();
    await page.getByRole('button', { name: 'Restart ranking' }).waitFor();
    assert.equal(await page.locator('.ranked-card:not(.repository-card-skeleton)').count(), 12);
    await page.screenshot({ path: OUTPUT + '/ranking-pagination-error.png', fullPage: true });
    await page.getByRole('button', { name: 'Restart ranking' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.ranked-card:not(.repository-card-skeleton)').length === 12);
    clean();
    await page.close();
  });

  console.log('BROWSER REVIEW PASSED: ' + checks.length + ' checks.');
} finally {
  await browser.close();
}
