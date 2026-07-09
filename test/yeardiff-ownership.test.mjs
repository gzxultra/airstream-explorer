import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTrailers, computeYearDiff } from '../src/lib/data.mjs';
import { renderDetail } from '../src/lib/render.mjs';

const trailers = loadTrailers();

// ---------------------------------------------------------------------------
// computeYearDiff unit tests
// ---------------------------------------------------------------------------
describe('computeYearDiff', () => {
  test('returns null for a 2025 trailer', () => {
    const t25 = trailers.find((t) => t.year === 2025);
    assert.equal(computeYearDiff(t25, trailers), null);
  });

  test('returns null for a 2026 trailer with no 2025 counterpart', () => {
    // Find a 2026-only floorplan (no matching 2025)
    const t26only = trailers.find((t) => {
      if (t.year !== 2026) return false;
      return !trailers.some((x) => x.model === t.model && x.floorplan === t.floorplan && x.year === 2025);
    });
    if (t26only) {
      assert.equal(computeYearDiff(t26only, trailers), null);
    }
  });

  test('returns diffs for a 2026 trailer with a 2025 counterpart', () => {
    // Find a 2026 trailer that has a 2025 counterpart
    const t26 = trailers.find((t) => {
      if (t.year !== 2026) return false;
      return trailers.some((x) => x.model === t.model && x.floorplan === t.floorplan && x.year === 2025);
    });
    if (!t26) return; // skip if no pairs exist
    const result = computeYearDiff(t26, trailers);
    // result can be null if specs are identical, or an object with diffs
    if (result) {
      assert.ok(result.prev, 'has prev reference');
      assert.ok(Array.isArray(result.diffs), 'has diffs array');
      assert.ok(result.diffs.length > 0, 'has at least one diff');
      for (const d of result.diffs) {
        assert.ok(d.field, 'diff has field name');
        assert.ok(d.key, 'diff has key');
        assert.ok(['up', 'down', 'changed'].includes(d.direction), 'valid direction');
      }
    }
  });

  test('returns null for null input', () => {
    assert.equal(computeYearDiff(null, trailers), null);
  });

  test('diffs include correct direction labels', () => {
    // Test with a synthetic pair
    const fake25 = { slug: 'test-20rb-2025', model: 'Test', floorplan: '20RB', year: 2025, msrp: 100000, weightLb: 5000, gvwrLb: 6000, cccLb: 1000, hitchWeightLb: 500, freshGal: 30, grayGal: 20, blackGal: 20, solarW: 200, batteryKwh: 2.5, sleeps: 4, lengthFt: 25 };
    const fake26 = { slug: 'test-20rb-2026', model: 'Test', floorplan: '20RB', year: 2026, msrp: 105000, weightLb: 4900, gvwrLb: 6000, cccLb: 1100, hitchWeightLb: 500, freshGal: 30, grayGal: 20, blackGal: 20, solarW: 300, batteryKwh: 2.5, sleeps: 4, lengthFt: 25 };
    const result = computeYearDiff(fake26, [fake25, fake26]);
    assert.ok(result, 'should produce diffs');
    // MSRP went up: direction 'up'
    const msrpDiff = result.diffs.find((d) => d.key === 'msrp');
    assert.ok(msrpDiff, 'has msrp diff');
    assert.equal(msrpDiff.direction, 'up');
    assert.equal(msrpDiff.delta, 5000);
    // Weight went down: direction 'down'
    const wDiff = result.diffs.find((d) => d.key === 'weightLb');
    assert.ok(wDiff);
    assert.equal(wDiff.direction, 'down');
    // Solar went up
    const sDiff = result.diffs.find((d) => d.key === 'solarW');
    assert.ok(sDiff);
    assert.equal(sDiff.direction, 'up');
    assert.equal(sDiff.delta, 100);
    // CCC went up
    const cDiff = result.diffs.find((d) => d.key === 'cccLb');
    assert.ok(cDiff);
    assert.equal(cDiff.direction, 'up');
    // Fields that didn't change should NOT appear
    assert.ok(!result.diffs.find((d) => d.key === 'gvwrLb'), 'unchanged GVWR omitted');
    assert.ok(!result.diffs.find((d) => d.key === 'freshGal'), 'unchanged freshGal omitted');
    assert.ok(!result.diffs.find((d) => d.key === 'sleeps'), 'unchanged sleeps omitted');
  });
});

// ---------------------------------------------------------------------------
// Year-diff section in rendered HTML
// ---------------------------------------------------------------------------
describe('renderDetail year-diff section', () => {
  test('2026 detail pages with 2025 counterparts contain year-diff section', () => {
    const t26withPrev = trailers.find((t) => {
      if (t.year !== 2026) return false;
      return trailers.some((x) => x.model === t.model && x.floorplan === t.floorplan && x.year === 2025);
    });
    if (!t26withPrev) return;
    const html = renderDetail(t26withPrev, undefined, null, null, trailers);
    const hasDiff = computeYearDiff(t26withPrev, trailers);
    if (hasDiff) {
      assert.ok(html.includes('id="year-diff"'), 'has year-diff section');
      assert.ok(html.includes('What changed from 2025'), 'has heading');
      assert.ok(html.includes('year-diff-table'), 'has table');
    }
  });

  test('2025 detail pages do NOT contain year-diff section', () => {
    const t25 = trailers.find((t) => t.year === 2025);
    if (!t25) return;
    const html = renderDetail(t25, undefined, null, null, trailers);
    assert.ok(!html.includes('id="year-diff"'), 'no year-diff for 2025');
  });

  test('year-diff section nav appears when diff exists', () => {
    const t26withPrev = trailers.find((t) => {
      if (t.year !== 2026) return false;
      return trailers.some((x) => x.model === t.model && x.floorplan === t.floorplan && x.year === 2025);
    });
    if (!t26withPrev) return;
    const hasDiff = computeYearDiff(t26withPrev, trailers);
    if (!hasDiff) return;
    const html = renderDetail(t26withPrev, undefined, null, null, trailers);
    assert.ok(html.includes('#year-diff'), 'section nav links to year-diff');
    assert.ok(html.includes('2025→26'), 'section nav label');
  });
});

// ---------------------------------------------------------------------------
// Ownership tool in rendered HTML
// ---------------------------------------------------------------------------
describe('renderDetail ownership tool', () => {
  test('detail pages with MSRP contain ownership section', () => {
    const tWithPrice = trailers.find((t) => t.msrp > 0);
    if (!tWithPrice) return;
    const html = renderDetail(tWithPrice, undefined, null, null, trailers);
    assert.ok(html.includes('id="ownership"'), 'has ownership section');
    assert.ok(html.includes('ownership-data'), 'has data island');
    assert.ok(html.includes('Annual ownership cost'), 'has heading');
    assert.ok(html.includes('own-bar-stack'), 'has bar chart');
    assert.ok(html.includes('own-insurance'), 'has insurance slider');
    assert.ok(html.includes('own-storage'), 'has storage slider');
    assert.ok(html.includes('own-maintenance'), 'has maintenance slider');
    assert.ok(html.includes('own-depreciation'), 'has depreciation slider');
  });

  test('ownership section nav link exists for priced trailers', () => {
    const tWithPrice = trailers.find((t) => t.msrp > 0);
    if (!tWithPrice) return;
    const html = renderDetail(tWithPrice, undefined, null, null, trailers);
    assert.ok(html.includes('#ownership'), 'section nav links to ownership');
    assert.ok(html.includes('>Ownership<'), 'section nav label');
  });

  test('ownership data island has correct MSRP', () => {
    const t = trailers.find((t) => t.msrp > 0);
    if (!t) return;
    const html = renderDetail(t, undefined, null, null, trailers);
    const match = html.match(/<script type="application\/json" id="ownership-data">([^<]+)<\/script>/);
    assert.ok(match, 'ownership data island exists');
    const data = JSON.parse(match[1]);
    assert.equal(data.msrp, t.msrp, 'MSRP matches');
    assert.ok(data.defaults, 'defaults present');
    assert.ok(data.defaults.insurancePct > 0, 'insurance default present');
  });

  test('ownership stacked bar has all four segments', () => {
    const t = trailers.find((t) => t.msrp > 0);
    if (!t) return;
    const html = renderDetail(t, undefined, null, null, trailers);
    assert.ok(html.includes('own-bar--insurance'), 'insurance bar');
    assert.ok(html.includes('own-bar--storage'), 'storage bar');
    assert.ok(html.includes('own-bar--maintenance'), 'maintenance bar');
    assert.ok(html.includes('own-bar--depreciation'), 'depreciation bar');
  });
});

// ---------------------------------------------------------------------------
// Collapsible sections in rendered HTML
// ---------------------------------------------------------------------------
describe('collapsible sections', () => {
  test('app.js contains ownershipTool IIFE', async () => {
    const { readFileSync } = await import('node:fs');
    const appJs = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(appJs.includes('ownershipTool'), 'ownership tool JS exists');
    assert.ok(appJs.includes('own-insurance'), 'ownership slider wiring');
    assert.ok(appJs.includes('own-total'), 'ownership total output');
  });

  test('app.js contains collapsibleSections IIFE', async () => {
    const { readFileSync } = await import('node:fs');
    const appJs = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(appJs.includes('collapsibleSections'), 'collapsible sections JS exists');
    assert.ok(appJs.includes('ae:collapsed'), 'localStorage key present');
    assert.ok(appJs.includes('data-collapsible'), 'sets data-collapsible attr');
    assert.ok(appJs.includes('is-collapsed'), 'toggles is-collapsed class');
    assert.ok(appJs.includes('section-collapse-body'), 'wraps in collapse body');
  });
});
