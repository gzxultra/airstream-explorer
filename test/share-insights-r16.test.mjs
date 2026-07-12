import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTrailers } from '../src/lib/data.mjs';
import { renderDetail, renderExplore } from '../src/lib/render.mjs';

const trailers = loadTrailers();
const trailer = trailers.find((t) => t.slug === 'classic-33fb-2026');
const html = renderDetail(trailer, undefined, null, null, trailers);
const exploreHtml = renderExplore(trailers);

// --- Change 1: Explore Share View button ---

test('explore page has share view button with id x-share-view', () => {
  assert.ok(exploreHtml.includes('id="x-share-view"'), 'missing share-view button');
});

test('share view button has share SVG icon and label', () => {
  const idx = exploreHtml.indexOf('id="x-share-view"');
  const chunk = exploreHtml.slice(idx, idx + 500);
  assert.ok(chunk.includes('<svg'), 'missing SVG icon in share button');
  assert.ok(chunk.includes('Share</button>'), 'missing Share label');
});

// --- Change 2: Tow Match Insights CSS ---

test('app.js builds tow insights pick cards with tow-pick class', () => {
  const js = readFileSync('src/assets/js/app.js', 'utf8');
  assert.ok(js.includes('tow-pick'), 'missing tow-pick class in client JS');
  assert.ok(js.includes('tow-insights-picks'), 'missing tow-insights-picks');
  assert.ok(js.includes('tow-pick-icon'), 'missing tow-pick-icon');
  assert.ok(js.includes('tow-pick-name'), 'missing tow-pick-name');
});

test('site.css has tow-summary and tow-pick styles', () => {
  const css = readFileSync('src/assets/css/site.css', 'utf8');
  assert.ok(css.includes('.tow-summary'), 'missing .tow-summary');
  assert.ok(css.includes('.tow-pick'), 'missing .tow-pick');
  assert.ok(css.includes('.tow-insights-picks'), 'missing .tow-insights-picks');
});

test('theme.css has dark overrides for tow insights panel', () => {
  const css = readFileSync('src/assets/css/theme.css', 'utf8');
  assert.ok(css.includes('[data-theme="dark"] .tow-summary'), 'missing dark .tow-summary');
  assert.ok(css.includes('[data-theme="dark"] .tow-pick'), 'missing dark .tow-pick');
});

test('tow insights mobile responsive rule exists', () => {
  const css = readFileSync('src/assets/css/site.css', 'utf8');
  // The mobile rule stacks picks vertically
  assert.ok(css.includes('.tow-insights-picks { flex-direction: column'), 'missing mobile stack rule');
});

// --- Change 3: Spec text includes canonical URL ---

test('spec text includes canonical URL for the trailer', () => {
  const m = html.match(/data-spec-text="([^"]*)"/);
  assert.ok(m, 'data-spec-text not found');
  assert.ok(
    m[1].includes('airstream-explorer.pages.dev/m/classic-33fb-2026.html'),
    'spec text should end with the canonical URL'
  );
});

test('spec text URL is the last segment before final separator', () => {
  const m = html.match(/data-spec-text="([^"]*)"/);
  const parts = m[1].split(' || ');
  const last = parts[parts.length - 1];
  assert.ok(last.startsWith('https://'), 'last spec-text segment should be a URL');
  assert.ok(last.includes('/m/classic-33fb-2026.html'), 'URL should point to the trailer detail');
});

// --- Share button wiring in app.js ---

test('app.js wires share view button click handler', () => {
  const js = readFileSync('src/assets/js/app.js', 'utf8');
  assert.ok(js.includes("getElementById('x-share-view')"), 'missing x-share-view getElementById');
  assert.ok(js.includes('encodeHash'), 'should use encodeHash for URL');
});
