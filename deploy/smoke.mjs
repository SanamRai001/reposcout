#!/usr/bin/env node
/* global console, process, fetch, URL, AbortSignal */
/**
 * Real deployment HTTP check, without fixture data or nonempty-catalog assumptions.
 * node deploy/smoke.mjs https://your-reposcout-host.example
 */
import assert from 'node:assert/strict';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node deploy/smoke.mjs https://your-reposcout-host');
  process.exit(2);
}
let origin;
try {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' ||
      url.search || url.hash || url.username || url.password) throw Error();
  origin = url.origin;
} catch {
  console.error('Expected a simple HTTP(S) origin without credentials, path or query.');
  process.exit(2);
}
const get = async (path) => fetch(origin + path, {
  headers: { accept: 'application/json, text/html;q=0.9' },
  signal: AbortSignal.timeout(15000),
  redirect: 'error',
});
const json = async (path) => {
  const response = await get(path);
  assert.equal(response.status, 200, path + ' should respond 200');
  assert.match(response.headers.get('content-type') ?? '', /application\/json/i, path);
  return response.json();
};
const spa = async (path) => {
  const response = await get(path);
  assert.equal(response.status, 200, path + ' needs direct-loading SPA fallback');
  assert.match(response.headers.get('content-type') ?? '', /text\/html/i, path);
  const html = await response.text();
  assert.match(html, /<div id="root"><\/div>/, path + ' needs web app shell');
  assert.match(html, /\/assets\/[^"]+\.js/, path + ' needs built JS');
  console.log('PASS direct SPA ' + path);
};
try {
  assert.equal((await json('/health')).status, 'ok');
  assert.equal((await json('/ready')).status, 'ready');
  console.log('PASS API process and live database readiness');

  for (const path of [
    '/', '/?view=hidden_gems', '/?view=rising',
    '/contribute', '/contribute?unassigned=true',
  ]) await spa(path);

  const catalog = await json('/api/repositories?limit=1');
  assert.ok(Array.isArray(catalog.data));
  assert.ok(catalog.pagination && 'nextCursor' in catalog.pagination);
  const search = await json('/api/repositories/search?language=typescript&limit=1');
  assert.ok(Array.isArray(search.data) && search.search);
  console.log('PASS actual catalog/search; sample rows=' + catalog.data.length);

  for (const mode of ['hidden_gems', 'rising']) {
    const page = await json('/api/repositories/rankings/' + mode + '?limit=1');
    assert.ok(Array.isArray(page.data));
    assert.equal(page.ranking?.mode, mode);
    assert.ok(Number.isSafeInteger(page.ranking?.evaluatedCount));
    assert.ok(Number.isSafeInteger(page.ranking?.eligibleCount));
    console.log('PASS actual ' + mode + ' API; eligible=' + page.ranking.eligibleCount +
      ', sample rows=' + page.data.length);
  }
  const issues = await json('/api/contributions/issues?limit=1');
  assert.ok(Array.isArray(issues.data));
  assert.equal(issues.discovery?.contractVersion, 'contribution-signals-v1');
  assert.equal(issues.discovery?.state, 'open');
  console.log('PASS actual contribution API; sample rows=' + issues.data.length);

  const invalidApi = await get('/api/__reposcout_missing_route');
  assert.equal(invalidApi.status, 404, 'Unknown API must not render SPA');
  assert.match(invalidApi.headers.get('content-type') ?? '', /application\/json/i);
  const invalidAsset = await get('/assets/__reposcout_missing_asset.js');
  assert.equal(invalidAsset.status, 404, 'Missing JS asset must not render SPA');
  console.log('PASS API/asset 404 separation');

  if (catalog.data.length === 0 || issues.data.length === 0) {
    console.warn('DATA GAP: Catalog and/or stored issue observations are empty. ' +
      'The deployment serves valid real API contracts, but ingestion needs review.');
  }
  console.log('REPOSCOUT DEPLOYMENT SMOKE PASSED (no mocked API fixtures).');
} catch (error) {
  console.error('REPOSCOUT DEPLOYMENT SMOKE FAILED:', error?.stack ?? error);
  process.exitCode = 1;
}
