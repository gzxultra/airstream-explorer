// Tests for the three features added in this round:
//   1. Smart filter presets on explore page
//   2. Nearest-match suggestions when filters return 0 results
//   3. Browse-similar deep links on detail spec tables

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SMART_PRESETS, nearestMatches, SORT_KEYS,
} from '../src/lib/explore.mjs';
import { loadTrailers } from '../src/lib/data.mjs';
import { renderExploreCard, renderExploreSections } from '../src/lib/render.mjs';
import { renderDetail } from '../src/lib/render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const trailers = loadTrailers();

// ---------------------------------------------------------------------------
// 1. SMART_PRESETS structure
// ---------------------------------------------------------------------------

test('SMART_PRESETS exports an array of at least 4 presets', () => {
  assert.ok(Array.isArray(SMART_PRESETS));
  assert.ok(SMART_PRESETS.length >= 4, `expected ≥4 presets, got ${SMART_PRESETS.length}`);
});

test('each preset has required fields: id, label, icon, desc, filters', () => {
  for (const p of SMART_PRESETS) {
    assert.equal(typeof p.id, 'string', `preset missing id`);
    assert.equal(typeof p.label, 'string', `preset missing label`);
    assert.equal(typeof p.icon, 'string', `preset missing icon`);
    assert.equal(typeof p.desc, 'string', `preset missing desc`);
    assert.equal(typeof p.filters, 'object', `preset missing filters`);
  }
});

test('preset IDs are unique', () => {
  const ids = SMART_PRESETS.map((p) => p.id);
  assert.equal(ids.length, new Set(ids).size, 'duplicate preset IDs');
});

test('preset filter sort keys reference valid SORT_KEYS', () => {
  for (const p of SMART_PRESETS) {
    if (p.filters.sort) {
      assert.ok(SORT_KEYS[p.filters.sort], `preset ${p.id} has invalid sort key: ${p.filters.sort}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 2. NEAREST MATCHES logic
// ---------------------------------------------------------------------------

test('nearestMatches returns empty when all trailers pass filters', () => {
  const result = nearestMatches(trailers, {}); // no filters → all pass
  // With no filters, penalty is 0 for everything → filtered out (penalty > 0)
  assert.equal(result.length, 0);
});

test('nearestMatches returns suggestions for impossible price filter', () => {
  const result = nearestMatches(trailers, { msrpMax: 10000 }); // impossibly low
  assert.ok(result.length > 0, 'should find near-matches');
  assert.ok(result.length <= 3, 'should return at most 3');
  for (const r of result) {
    assert.ok(r.trailer, 'each result has a trailer');
    assert.ok(r.reason, 'each result has a reason');
    assert.ok(r.reason.includes('over budget'), `reason should mention budget: ${r.reason}`);
  }
});

test('nearestMatches returns suggestions for impossible sleeps filter', () => {
  const result = nearestMatches(trailers, { sleepsMin: 10 });
  assert.ok(result.length > 0, 'should find near-matches for high sleeps');
  for (const r of result) {
    assert.ok(r.reason.includes('sleeps'), `reason should mention sleeps: ${r.reason}`);
  }
});

test('nearestMatches scores closer trailers first', () => {
  // Budget just slightly above cheapest: nearest should be close to the cutoff
  const cheapest = Math.min(...trailers.map((t) => t.msrp));
  const result = nearestMatches(trailers, { msrpMax: cheapest - 1000 });
  if (result.length >= 2) {
    // First result should be the one closest to the budget
    assert.ok(result[0].trailer.msrp <= result[1].trailer.msrp,
      'first result should be cheaper or equal');
  }
});

// ---------------------------------------------------------------------------
// 3. SMART PRESETS in rendered HTML
// ---------------------------------------------------------------------------

test('renderExploreSections includes smart-preset buttons', () => {
  const html = renderExploreSections(trailers);
  assert.ok(html.includes('smart-presets'), 'should have smart-presets container');
  assert.ok(html.includes('data-preset="first-timer"'), 'should have first-timer preset');
  assert.ok(html.includes('data-preset="family-adventure"'), 'should have family preset');
  assert.ok(html.includes('data-filters='), 'presets should have data-filters attribute');
});

test('renderExploreSections includes nearest-match container', () => {
  const html = renderExploreSections(trailers);
  assert.ok(html.includes('x-nearest'), 'should have nearest-match container');
  assert.ok(html.includes('x-nearest-grid'), 'should have nearest-match grid');
});

// ---------------------------------------------------------------------------
// 4. BROWSE-SIMILAR LINKS on detail pages
// ---------------------------------------------------------------------------

test('detail page includes browse-similar links for a typical trailer', () => {
  const t = trailers.find((x) => x.slug === 'bambi-16rb-2026') || trailers[0];
  const html = renderDetail(t, undefined, null, trailers);
  assert.ok(html.includes('browse-links'), 'should have browse-links container');
  assert.ok(html.includes('browse-link'), 'should have at least one browse link');
  assert.ok(html.includes('Browse similar'), 'should have browse-similar label');
});

test('browse-similar links contain valid explore deep-link hashes', () => {
  const t = trailers.find((x) => x.msrp > 60000 && x.sleeps >= 4) || trailers[0];
  const html = renderDetail(t, undefined, null, trailers);
  // Links should point to ../index.html#all with filter params
  const linkMatch = html.match(/href="\.\.\/index\.html#all&[^"]+"/g);
  assert.ok(linkMatch && linkMatch.length > 0, 'should have deep-link hrefs');
});

// ---------------------------------------------------------------------------
// 5. Built HTML verification
// ---------------------------------------------------------------------------

test('built index.html contains smart-preset buttons', () => {
  const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf8');
  assert.ok(html.includes('smart-preset'), 'index should have preset buttons');
  assert.ok(html.includes('data-preset='), 'index should have preset data attrs');
});

test('built index.html contains nearest-match container', () => {
  const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf8');
  assert.ok(html.includes('x-nearest'), 'index should have nearest container');
});

test('built detail page contains browse-links', () => {
  const html = readFileSync(join(ROOT, 'dist/m/bambi-16rb-2026.html'), 'utf8');
  assert.ok(html.includes('browse-links'), 'detail should have browse links');
});

test('built CSS contains smart-preset styles', () => {
  const cssDir = join(ROOT, 'dist/assets/css');
  const cssFile = readdirSync(cssDir).find((f) => f.startsWith('site.') && f.endsWith('.css'));
  assert.ok(cssFile, 'should find fingerprinted site.css');
  const css = readFileSync(join(cssDir, cssFile), 'utf8');
  assert.ok(css.includes('.smart-preset'), 'site.css should have preset styles');
  assert.ok(css.includes('.x-nearest'), 'site.css should have nearest styles');
  assert.ok(css.includes('.browse-link'), 'site.css should have browse link styles');
});

test('built app.js contains smart-preset handler', () => {
  const jsDir = join(ROOT, 'dist/assets/js');
  const jsFile = readdirSync(jsDir).find((f) => f.startsWith('app.') && f.endsWith('.js'));
  assert.ok(jsFile, 'should find fingerprinted app.js');
  const js = readFileSync(join(jsDir, jsFile), 'utf8');
  assert.ok(js.includes('smart-preset'), 'app.js should have preset handling');
  assert.ok(js.includes('x-nearest'), 'app.js should have nearest-match handling');
});
