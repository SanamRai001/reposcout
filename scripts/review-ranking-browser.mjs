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
      stars: 473,
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
        components: [
          {
            id: 'maintenance',
            points: 30,
            maxPoints: 35,
            signalIds: ['maintenance.days_since_push'],
          },
          {
            id: 'documentation',
            points: 20,
            maxPoints: 20,
            signalIds: ['documentation.readme_present'],
          },
          {
            id: 'contribution_guidance',
            points: 0,
            maxPoints: 20,
            signalIds: ['community.contributing_present'],
          },
          {
            id: 'community_readiness',
            points: 10,
            maxPoints: 20,
            signalIds: ['community.code_of_conduct_present'],
          },
          {
            id: 'momentum_bonus',
            points: 3.5,
            maxPoints: 5,
            signalIds: ['momentum.stars_delta_30d'],
          },
        ],
        positivePoints: 63.5,
        popularityPenalty: {
          id: 'popularity_saturation',
          points: 3,
          maxPoints: 25,
          stars: 473,
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
        components: [
          {
            id: 'stars_7d_momentum',
            points: 35.43,
            maxPoints: 45,
            signalIds: ['momentum.stars_delta_7d'],
            normalizedDelta: 12,
          },
          {
            id: 'stars_30d_momentum',
            points: 0,
            maxPoints: 35,
            signalIds: ['momentum.stars_delta_30d'],
            normalizedDelta: 0,
          },
          {
            id: 'forks_30d_momentum',
            points: 0,
            maxPoints: 15,
            signalIds: ['momentum.forks_delta_30d'],
            normalizedDelta: 0,
          },
          {
            id: 'maintenance_support',
            points: 5,
            maxPoints: 5,
            signalIds: ['maintenance.days_since_push'],
            normalizedDelta: null,
          },
        ],
        historyCoverage: {
          stars7d: trend(7),
          stars30d: trend(30),
          forks30d: trend(30),
        },
        visibilityContext: {
          stars: {
            id: 'visibility.stars_total',
            availability: 'available',
            value: 473,
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
      score: mode === 'hidden_gems' ? 60.5 : 40.43,
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
  await page.route((url) => url.pathname.startsWith('/api/repositories'), async (route) => {
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

async function waitForRealCard(page, label) {
  try {
    await page.locator('.ranked-card:not(.repository-card-skeleton)').first().waitFor({
      timeout: 10000,
    });
  } catch (error) {
    console.error('RANKING UI DIAGNOSTIC (' + label + ') URL=' + page.url());
    console.error(await page.locator('main').innerText());
    await page.screenshot({
      path: OUTPUT + '/diagnostic-' + label + '.png',
      fullPage: true,
    });
    throw error;
  }
}

async function assertNoHorizontalOverflow(page, label) {
  const measures = await page.evaluate(() => {
    const nav = document.querySelector('.discovery-view-nav');
    return {
      windowWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      navWidth: nav?.clientWidth ?? 0,
      navScrollWidth: nav?.scrollWidth ?? 0,
    };
  });
  assert.ok(
    measures.documentWidth <= measures.windowWidth + 1,
    label + ' has horizontal overflow: ' + JSON.stringify(measures),
  );
  assert.ok(
    measures.navScrollWidth <= measures.navWidth + 2,
    label + ' clips a discovery tab: ' + JSON.stringify(measures),
  );
}

async function assertAllDiscoveryTabsVisible(page, label) {
  const layout = await page.evaluate(() => {
    const nav = document.querySelector('.discovery-view-nav');
    if (!nav) return null;
    const bounds = nav.getBoundingClientRect();
    return {
      width: nav.clientWidth,
      scrollWidth: nav.scrollWidth,
      left: bounds.left,
      right: bounds.right,
      tabs: Array.from(nav.querySelectorAll('a')).map((tab) => {
        const rect = tab.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(tab);
        const textRect = range.getBoundingClientRect();
        return {
          label: tab.textContent?.trim(),
          left: rect.left,
          right: rect.right,
          textLeft: textRect.left,
          textRight: textRect.right,
        };
      }),
    };
  });

  assert.ok(layout, label + ' must render ranking navigation');
  assert.equal(layout.tabs.length, 3, label + ' must expose all three views');
  assert.ok(
    layout.scrollWidth <= layout.width + 1,
    label + ' must not hide a discovery view behind horizontal scrolling: ' + JSON.stringify(layout),
  );
  for (const tab of layout.tabs) {
    assert.ok(tab.left >= layout.left - 1 && tab.right <= layout.right + 1,
      label + ' tab must fit in the navigation viewport: ' + tab.label);
    assert.ok(
      tab.textLeft >= tab.left - 1 && tab.textRight <= tab.right + 1,
      label + ' must show complete tab text: ' + JSON.stringify(tab),
    );
  }
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
    await waitForRealCard(page, 'hidden-deeplink');
    assert.equal(counters.catalog, 0, 'Ranking view must not request catalog pages');
    assert.equal(await page.locator('a[aria-current="page"]').innerText(), 'Hidden Gems');
    await page.screenshot({ path: OUTPUT + '/hidden-gems-desktop.png', fullPage: true });

    await page.getByRole('link', { name: 'Rising', exact: true }).click();
    await page.getByRole('heading', { name: 'See what is gaining momentum.' }).waitFor();
    await waitForRealCard(page, 'rising-after-navigation');
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
    ['compact-mobile', 320, 700, 'hidden_gems'],
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
      await waitForRealCard(page, 'viewport');
      await assertNoHorizontalOverflow(page, label);
      await assertAllDiscoveryTabsVisible(page, label);
      await page.locator('summary').first().click();
      assert.ok(await page.locator('details[open]').count() > 0);
      const explanation = await page.locator('details[open]').first().innerText();
      assert.match(explanation, mode === 'hidden_gems'
        ? /Popularity adjustment/
        : /Historical measurement coverage/);
      // A native disclosure must remain operable without a pointer.
      const summary = page.locator('details summary').first();
      await summary.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('details[open]').count(), 0);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('details[open]').count(), 1);
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
    await waitForRealCard(page, 'error-retry');
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
