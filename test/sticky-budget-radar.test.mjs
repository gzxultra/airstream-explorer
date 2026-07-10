import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTrailers } from '../src/lib/data.mjs';
import { renderDetail, renderExploreCard } from '../src/lib/render.mjs';
import { renderCompare } from '../src/lib/render.mjs';

const trailers = loadTrailers();
const classic = trailers.find((t) => t.slug === 'classic-33fb-2026');
const bambi = trailers.find((t) => t.slug === 'bambi-16rb-2026');
const basecamp = trailers.find((t) => t.slug === 'basecamp-16x-2026');

// ---- Sticky Detail Summary Bar ----

test('detail page has sticky summary bar with model name and specs', () => {
  const html = renderDetail(classic, undefined, null, null, trailers);
  assert.match(html, /id="detail-sticky-summary"/);
  assert.match(html, /sticky-summary-title">Classic 33FB<\/span>/);
  assert.match(html, /sticky-summary-stat/);
  // Should be hidden by default
  assert.match(html, /detail-sticky-summary" hidden/);
});

test('sticky summary bar renders for every trailer', () => {
  for (const t of trailers) {
    const html = renderDetail(t, undefined, null, null, trailers);
    assert.match(html, /detail-sticky-summary/, `${t.slug} missing sticky summary`);
    assert.match(html, new RegExp(`sticky-summary-title">${t.model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${t.slug} missing model name in sticky summary`);
  }
});

// ---- Weight Budget Waterfall ----

test('weight budget renders for trailers with CCC', () => {
  const html = renderDetail(classic, undefined, null, null, trailers);
  assert.match(html, /weight-budget/);
  assert.match(html, /wb-bar/);
  assert.match(html, /wb-fresh/);  // Classic has fresh water
  assert.match(html, /wb-legend/);
});

test('weight budget handles compact models where fluids exceed CCC', () => {
  const html = renderDetail(bambi, undefined, null, null, trailers);
  // Bambi 16RB: CCC=350, fresh 23gal (192lb) + waste 30gal (250lb) + propane 40 = 482 > 350
  assert.match(html, /weight-budget/);
  assert.match(html, /exceed/i, 'Should warn about exceeding CCC');
  // Should NOT show the gear segment when over budget
  assert.ok(!html.match(/wb-gear/), 'No gear segment when over budget');
});

test('weight budget shows gear segment on spacious models', () => {
  const html = renderDetail(classic, undefined, null, null, trailers);
  // Classic 33FB: CCC=1575 >> fluids. Should have gear segment.
  assert.match(html, /wb-gear/);
  assert.match(html, /Your gear/);
});

test('weight budget is a collapsible section', () => {
  const html = renderDetail(classic, undefined, null, null, trailers);
  assert.match(html, /weight-budget collapsible/);
  assert.match(html, /collapsible-trigger/);
});

// ---- Compare Radar Chart ----

test('compare page has radar overlay container', () => {
  const html = renderCompare(trailers);
  assert.match(html, /id="cmp-radar-wrap"/);
  assert.match(html, /cmp-radar-chart/);
  assert.match(html, /cmp-radar-legend/);
  assert.match(html, /Spec profile overlay/);
  // Hidden by default
  assert.match(html, /cmp-radar-wrap" hidden/);
});

test('app.js contains detailStickyBar IIFE', () => {
  const appjs = readFileSync('src/assets/js/app.js', 'utf8');
  assert.match(appjs, /detailStickyBar/);
  assert.match(appjs, /detail-sticky-summary/);
});

test('app.js contains compare radar builder', () => {
  const appjs = readFileSync('src/assets/js/app.js', 'utf8');
  assert.match(appjs, /RADAR_COLORS/);
  assert.match(appjs, /buildRadarSvg/);
  assert.match(appjs, /cmp-radar-wrap/);
});

test('site.css has styles for all 3 new features', () => {
  const css = readFileSync('src/assets/css/site.css', 'utf8');
  assert.match(css, /\.detail-sticky-summary/);
  assert.match(css, /\.wb-bar/);
  assert.match(css, /\.wb-fresh/);
  assert.match(css, /\.cmp-radar-wrap/);
  assert.match(css, /\.cmp-radar-legend/);
});
