/* global console, URL, document, window */
/** Real Chromium smoke tests of the production-built /contribute page.
 * The HTTP responses below are synthetic Phase 8 contract fixtures.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const ORIGIN = 'http://127.0.0.1:4173';
const OUTPUT = 'artifacts/contribution-browser-review';
const OBSERVED = '2026-09-26T12:00:00.000Z';
const KEYS = [
  'entry.good_first_issue_label', 'entry.help_wanted_label',
  'process.contributing_present', 'process.code_of_conduct_present',
  'process.issue_template_present', 'process.pull_request_template_present',
  'availability.open', 'availability.unassigned', 'availability.unlocked',
  'activity.issue_age_days', 'activity.days_since_update', 'discussion.comment_count',
];

function item(index = 1) {
  const signals = Object.fromEntries(KEYS.map((id) => [
    id,
    {
      id,
      availability: 'available',
      value: id === 'activity.issue_age_days' ? 15
        : id === 'activity.days_since_update' ? 2
        : id === 'discussion.comment_count' ? 3
        : true,
    },
  ]));
  return {
    repository: {
      id: '11111111-1111-4111-8111-' + String(index).padStart(12, '0'),
      fullName: 'sample/project-' + index,
      githubUrl: 'https://github.com/sample/project-' + index,
      primaryLanguage: 'TypeScript',
    },
    issue: {
      githubIssueId: String(20000 + index),
      number: index,
      title: 'Improve public example ' + index,
      githubUrl: 'https://github.com/sample/project-' + index + '/issues/' + index,
      state: 'open',
      locked: false,
      assigneeCount: 0,
      commentCount: 3,
      labels: ['good first issue'],
      createdAtGithub: '2026-09-11T12:00:00.000Z',
      updatedAtGithub: '2026-09-24T12:00:00.000Z',
      observedAt: OBSERVED,
    },
    evidence: {
      normalizedLabels: ['good first issue'],
      signals,
    },
    recommendation: {
      contractVersion: 'contribution-recommendation-v1',
      status: 'consider',
      evidence: [{
        code: 'good_first_issue_hint',
        signalIds: ['entry.good_first_issue_label'],
        message: 'A good first issue label was observed; it does not guarantee an easy task.',
      }],
      cautions: [{
        code: 'contributing_evidence_missing',
        signalIds: ['process.contributing_present'],
        message: 'Check live contributor instructions before beginning.',
      }],
      limitations: ['issue_complexity_not_measured'],
    },
  };
}

function filtersFromUrl(parameters) {
  const bool = (key) => parameters.has(key) ? parameters.get(key) === 'true' : null;
  return {
    unassigned: bool('unassigned'),
    unlocked: bool('unlocked'),
    goodFirstIssue: bool('goodFirstIssue'),
    helpWanted: bool('helpWanted'),
    language: parameters.get('language'),
    updatedWithinDays: parameters.has('updatedWithinDays')
      ? Number(parameters.get('updatedWithinDays')) : null,
    contributing: parameters.get('contributing'),
  };
}

function pageFor(parameters, data, cursor = null, evaluatedAt = OBSERVED) {
  return {
    data,
    discovery: {
      contractVersion: 'contribution-signals-v1',
      evaluatedAt,
      state: 'open',
      filters: filtersFromUrl(parameters),
    },
    pagination: {
      limit: Number(parameters.get('limit') ?? '20'),
      nextCursor: cursor,
    },
  };
}

async function installApi(page, resolve, counters = { requests: 0 }) {
  await page.route((url) => url.pathname === '/api/contributions/issues', async (route) => {
    counters.requests += 1;
    const url = new URL(route.request().url());
    const result = resolve(url.searchParams);
    const status = result?.httpError ?? 200;
    try {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(status === 200 ? result : {
          error: 'service_unavailable',
          message: 'Contribution discovery temporarily unavailable.',
        }),
      });
    } catch (error) {
      if (!/closed|cancel|abort|already handled/i.test(String(error))) throw error;
    }
  });
}

function checkPageErrors(page) {
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  return () => assert.deepEqual(problems, [], 'No uncaught frontend errors');
}

async function waitForCards(page, count) {
  await page.waitForFunction(
    (expected) => document.querySelectorAll('.contribution-card').length === expected,
    count,
    { timeout: 10000 },
  );
}

async function checkOverflow(page, label) {
  const measured = await page.evaluate(() => ({
    available: window.innerWidth,
    occupied: document.documentElement.scrollWidth,
  }));
  assert.ok(
    measured.occupied <= measured.available + 1,
    label + ' horizontal overflow: ' + JSON.stringify(measured),
  );
}

const tests = [];
async function run(label, callback) {
  await callback();
  tests.push(label);
  console.log('PASS: ' + label);
}

await mkdir(OUTPUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  await run('Direct contribution deep link, filter submit and Back/Forward', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const clean = checkPageErrors(page);
    const counters = { requests: 0 };
    await installApi(page, (params) => pageFor(params, [item(1)]), counters);
    await page.goto(ORIGIN + '/contribute?unassigned=true&language=typescript');
    await page.getByRole('heading', { name: 'Find somewhere to contribute.' }).waitFor();
    await waitForCards(page, 1);
    assert.equal(await page.getByRole('textbox', { name: 'Primary language' }).inputValue(), 'typescript');
    assert.equal(await page.getByRole('combobox', { name: 'Unassigned' }).inputValue(), 'true');
    await page.getByRole('combobox', { name: 'Help wanted label' }).selectOption('true');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.waitForURL(/helpWanted=true/);
    await waitForCards(page, 1);
    await page.goBack();
    assert.equal(await page.getByRole('combobox', { name: 'Help wanted label' }).inputValue(), '');
    await page.goForward();
    assert.equal(await page.getByRole('combobox', { name: 'Help wanted label' }).inputValue(), 'true');
    assert.ok(counters.requests >= 2);
    await page.screenshot({ path: OUTPUT + '/contribution-desktop.png', fullPage: true });
    clean();
    await page.close();
  });

  for (const [label, width, height] of [
    ['320px', 320, 700],
    ['375px', 375, 812],
    ['768px', 768, 1024],
    ['1440px', 1440, 900],
  ]) {
    await run('Viewport ' + label + ', evidence keyboard toggle and no overflow', async () => {
      const page = await browser.newPage({ viewport: { width, height } });
      const clean = checkPageErrors(page);
      await installApi(page, (params) => pageFor(params, [item(1)]));
      await page.goto(ORIGIN + '/contribute');
      await waitForCards(page, 1);
      await checkOverflow(page, label);
      const summary = page.getByText('Evidence, cautions & limitations', { exact: true });
      await summary.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('details[open]').count(), 1);
      const content = await page.locator('details[open]').first().innerText();
      assert.match(content, /Actual issue complexity is not measured/);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('details[open]').count(), 0);
      await page.keyboard.press('Enter');
      await page.screenshot({ path: OUTPUT + '/contribution-' + label + '.png', fullPage: true });
      clean();
      await page.close();
    });
  }

  await run('Invalid shared filter blocks API until reset', async () => {
    const page = await browser.newPage();
    const clean = checkPageErrors(page);
    const counters = { requests: 0 };
    await installApi(page, (params) => pageFor(params, [item(1)]), counters);
    await page.goto(ORIGIN + '/contribute?updatedWithinDays=invalid');
    await page.getByRole('heading', { name: 'Shared filter URL is invalid' }).waitFor();
    assert.equal(counters.requests, 0);
    await page.screenshot({ path: OUTPUT + '/invalid-url.png', fullPage: true });
    await page.getByRole('button', { name: 'Clear invalid filters' }).click();
    await waitForCards(page, 1);
    assert.equal(new URL(page.url()).search, '');
    clean();
    await page.close();
  });

  await run('Genuine empty filtered results', async () => {
    const page = await browser.newPage();
    const clean = checkPageErrors(page);
    await installApi(page, (params) => pageFor(params, []));
    await page.goto(ORIGIN + '/contribute?contributing=present');
    await page.getByRole('heading', { name: 'No observed issues match these filters' }).waitFor();
    assert.equal(await page.locator('.contribution-card').count(), 0);
    await page.screenshot({ path: OUTPUT + '/contribution-empty.png', fullPage: true });
    clean();
    await page.close();
  });

  await run('HTTP failure followed by an explicit successful retry', async () => {
    const page = await browser.newPage();
    const clean = checkPageErrors(page);
    let offline = true;
    await installApi(page, (params) => offline ? { httpError: 503 } : pageFor(params, [item(1)]));
    await page.goto(ORIGIN + '/contribute');
    await page.getByRole('heading', { name: 'Issue discovery is unavailable' }).waitFor();
    await page.screenshot({ path: OUTPUT + '/contribution-error.png', fullPage: true });
    offline = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await waitForCards(page, 1);
    clean();
    await page.close();
  });

  await run('Opaque cursor pagination deduplicates issues', async () => {
    const page = await browser.newPage();
    const clean = checkPageErrors(page);
    let receivedCursor = null;
    await installApi(page, (params) => {
      const cursor = params.get('cursor');
      if (cursor === null) {
        return pageFor(params, Array.from({ length: 12 }, (_, i) => item(i + 1)), 'opaque + cursor');
      }
      receivedCursor = cursor;
      return pageFor(params, [item(12), item(13)], null);
    });
    await page.goto(ORIGIN + '/contribute');
    await waitForCards(page, 12);
    await page.getByRole('button', { name: 'Load more issues' }).click();
    await waitForCards(page, 13);
    assert.equal(receivedCursor, 'opaque + cursor');
    await page.getByText('End of observed issues in this filter scope.').waitFor();
    await page.screenshot({ path: OUTPUT + '/contribution-paged.png', fullPage: true });
    clean();
    await page.close();
  });

  await run('Pagination error retains cards and supports restart', async () => {
    const page = await browser.newPage();
    const clean = checkPageErrors(page);
    await installApi(page, (params) => params.has('cursor')
      ? { httpError: 503 }
      : pageFor(params, Array.from({ length: 12 }, (_, i) => item(i + 1)), 'cursor-1'));
    await page.goto(ORIGIN + '/contribute');
    await waitForCards(page, 12);
    await page.getByRole('button', { name: 'Load more issues' }).click();
    await page.getByRole('button', { name: 'Restart results' }).waitFor();
    assert.equal(await page.locator('.contribution-card').count(), 12);
    await page.screenshot({ path: OUTPUT + '/contribution-page-error.png', fullPage: true });
    await page.getByRole('button', { name: 'Restart results' }).click();
    await waitForCards(page, 12);
    clean();
    await page.close();
  });

  console.log('CONTRIBUTION BROWSER REVIEW PASSED: ' + tests.length + ' checks.');
} finally {
  await browser.close();
}
