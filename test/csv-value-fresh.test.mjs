// Tests for: value-asc sort, fresh-desc sort, CSV export button markup.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SORT_KEYS, sortTrailers } from '../src/lib/explore.mjs';
import { loadTrailers } from '../src/lib/data.mjs';
import { renderExploreSections } from '../src/lib/render.mjs';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// SORT_KEYS additions
// ---------------------------------------------------------------------------
describe('value-asc sort key', () => {
  test('exists in SORT_KEYS with correct label', () => {
    assert.ok(SORT_KEYS['value-asc'], 'value-asc missing from SORT_KEYS');
    assert.match(SORT_KEYS['value-asc'].label, /value|\/ft/i);
    assert.strictEqual(SORT_KEYS['value-asc'].dir, 1);
  });

  test('computes $/ft correctly', () => {
    const get = SORT_KEYS['value-asc'].get;
    const fake = { msrp: 100000, lengthFt: 25 };
    assert.strictEqual(get(fake), 4000); // 100000/25
  });

  test('handles zero-length gracefully', () => {
    const get = SORT_KEYS['value-asc'].get;
    assert.strictEqual(get({ msrp: 50000, lengthFt: 0 }), Infinity);
  });

  test('sortTrailers by value-asc puts cheapest $/ft first', () => {
    const trailers = loadTrailers().filter((t) => t.year === 2026);
    const sorted = sortTrailers(trailers, 'value-asc');
    assert.ok(sorted.length > 1);
    // Each trailer's $/ft should be ≤ the next
    for (let i = 1; i < sorted.length; i++) {
      const vPrev = sorted[i - 1].msrp / sorted[i - 1].lengthFt;
      const vCurr = sorted[i].msrp / sorted[i].lengthFt;
      assert.ok(vPrev <= vCurr || vPrev === vCurr, `${sorted[i - 1].slug} ($${Math.round(vPrev)}/ft) should be ≤ ${sorted[i].slug} ($${Math.round(vCurr)}/ft)`);
    }
  });
});

describe('fresh-desc sort key', () => {
  test('exists in SORT_KEYS with correct label', () => {
    assert.ok(SORT_KEYS['fresh-desc'], 'fresh-desc missing from SORT_KEYS');
    assert.match(SORT_KEYS['fresh-desc'].label, /fresh|water/i);
    assert.strictEqual(SORT_KEYS['fresh-desc'].dir, -1);
  });

  test('sortTrailers by fresh-desc puts biggest tank first', () => {
    const trailers = loadTrailers().filter((t) => t.year === 2026 && t.freshGal > 0);
    const sorted = sortTrailers(trailers, 'fresh-desc');
    assert.ok(sorted.length > 1);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].freshGal || 0;
      const curr = sorted[i].freshGal || 0;
      assert.ok(prev >= curr, `${sorted[i - 1].slug} (${prev}gal) should be ≥ ${sorted[i].slug} (${curr}gal)`);
    }
  });
});

// ---------------------------------------------------------------------------
// CSV export button in rendered HTML
// ---------------------------------------------------------------------------
describe('CSV export button', () => {
  const trailers = loadTrailers();
  const html = renderExploreSections(trailers, undefined, []);

  test('explore sections contain csv-export button', () => {
    assert.ok(html.includes('id="csv-export"'), 'CSV export button missing from explore HTML');
  });

  test('csv-export button has download icon SVG', () => {
    assert.ok(html.includes('class="csv-export-btn"'), 'csv-export-btn class missing');
  });

  test('csv-export button is inside xc-layout-actions wrapper', () => {
    assert.ok(html.includes('class="xc-layout-actions"'), 'xc-layout-actions wrapper missing');
    const actionsIdx = html.indexOf('xc-layout-actions');
    const btnIdx = html.indexOf('csv-export');
    assert.ok(btnIdx > actionsIdx, 'CSV button should be inside xc-layout-actions');
  });
});

// ---------------------------------------------------------------------------
// Client-side keymap parity: app.js must handle both new sort keys
// ---------------------------------------------------------------------------
const __dirname = path.dirname(new URL(import.meta.url).pathname);

describe('client-side sort keymap parity', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'assets', 'js', 'app.js'), 'utf8');

  test('app.js handles value-asc sort (computed $/ft)', () => {
    assert.ok(appJs.includes("'value-asc'"), 'app.js missing value-asc sort handling');
  });

  test('app.js has fresh-desc in keymap', () => {
    assert.ok(appJs.includes("'fresh-desc'"), 'app.js missing fresh-desc in sort keymap');
  });

  test('app.js contains csvExport IIFE', () => {
    assert.ok(appJs.includes('csvExport'), 'app.js missing csvExport IIFE');
    assert.ok(appJs.includes('csv-export'), 'app.js missing csv-export element lookup');
  });
});

// ---------------------------------------------------------------------------
// CSS coverage
// ---------------------------------------------------------------------------
describe('CSS for new features', () => {
  const siteCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'assets', 'css', 'site.css'), 'utf8');
  const themeCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'assets', 'css', 'theme.css'), 'utf8');

  test('site.css has csv-export-btn styles', () => {
    assert.ok(siteCss.includes('.csv-export-btn'), 'site.css missing .csv-export-btn');
  });

  test('site.css has xc-layout-actions wrapper', () => {
    assert.ok(siteCss.includes('.xc-layout-actions'), 'site.css missing .xc-layout-actions');
  });

  test('theme.css has dark-mode csv-export-btn', () => {
    assert.ok(themeCss.includes('.csv-export-btn'), 'theme.css missing dark-mode .csv-export-btn');
  });

  test('csv-export-btn hidden in print', () => {
    assert.ok(siteCss.includes('.csv-export-btn'), 'csv-export-btn should be in print hide rules');
  });
});
