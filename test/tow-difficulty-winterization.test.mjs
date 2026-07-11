// Tests for tow difficulty rating and winterization guide
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { towDifficulty, winterizationGuide } from '../src/lib/data.mjs';
import { renderDetail, renderExploreCard, esc } from '../src/lib/render.mjs';
import { loadTrailers, assetPaths } from '../src/lib/data.mjs';

const trailers = loadTrailers();

// ---------------------------------------------------------------------------
// towDifficulty unit tests
// ---------------------------------------------------------------------------
describe('towDifficulty', () => {
  it('returns null for missing data', () => {
    assert.equal(towDifficulty(null), null);
    assert.equal(towDifficulty({}), null);
    assert.equal(towDifficulty({ weightLb: 3000 }), null);
  });

  it('scores a light, short trailer as Easy tow (1)', () => {
    const d = towDifficulty({ weightLb: 3000, lengthFt: 18, model: 'Bambi' });
    assert.ok(d);
    assert.equal(d.score, 1);
    assert.equal(d.label, 'Easy tow');
    assert.ok(d.tip.length > 10);
  });

  it('scores a heavy, long trailer as Heavy hauler (5)', () => {
    const d = towDifficulty({ weightLb: 8500, lengthFt: 34, model: 'Classic' });
    assert.ok(d);
    assert.equal(d.score, 5);
    assert.equal(d.label, 'Heavy hauler');
  });

  it('gives moderate-range score for mid-weight trailers', () => {
    const d = towDifficulty({ weightLb: 5500, lengthFt: 25, model: 'Caravel' });
    assert.ok(d);
    assert.ok(d.score >= 2 && d.score <= 4, `expected 2-4 but got ${d.score}`);
  });

  it('has higher score for dual-axle vs equivalent single-axle', () => {
    // Flying Cloud (dual) vs Caravel (single), same weight/length
    const dual = towDifficulty({ weightLb: 5500, lengthFt: 25, model: 'Flying Cloud' });
    const single = towDifficulty({ weightLb: 5500, lengthFt: 25, model: 'Caravel' });
    assert.ok(dual);
    assert.ok(single);
    assert.ok(dual.score >= single.score, 'dual-axle should score >= single-axle');
  });

  it('score is always 1-5', () => {
    for (const t of trailers) {
      const d = towDifficulty(t);
      if (d) {
        assert.ok(d.score >= 1 && d.score <= 5, `${t.slug}: score ${d.score} out of range`);
      }
    }
  });

  it('every trailer in the dataset gets a rating', () => {
    for (const t of trailers) {
      const d = towDifficulty(t);
      assert.ok(d, `${t.slug} should have a tow difficulty rating`);
    }
  });
});

// ---------------------------------------------------------------------------
// winterizationGuide unit tests
// ---------------------------------------------------------------------------
describe('winterizationGuide', () => {
  it('returns empty for null input', () => {
    const g = winterizationGuide(null);
    assert.deepEqual(g.items, []);
    assert.equal(g.drainPoints, 0);
  });

  it('generates items using real tank capacities', () => {
    const t = trailers.find((x) => x.slug === 'bambi-16rb-2026');
    assert.ok(t, 'Bambi 16RB 2026 must exist');
    const g = winterizationGuide(t);
    assert.ok(g.items.length >= 10, `expected ≥10 items, got ${g.items.length}`);
    // Should reference the actual fresh tank size
    const freshItem = g.items.find((i) => i.text.includes(String(t.freshGal)));
    assert.ok(freshItem, 'should reference real fresh tank capacity');
  });

  it('counts drain points correctly for separate tanks', () => {
    // Find a trailer with separate gray + black
    const t = trailers.find((x) => x.freshGal && x.grayGal && x.blackGal);
    assert.ok(t, 'need a trailer with separate tanks');
    const g = winterizationGuide(t);
    assert.equal(g.drainPoints, 3, 'fresh + gray + black = 3 drain points');
  });

  it('counts drain points correctly for combined waste', () => {
    // Bambi 16RB has combined waste (no gray, just black)
    const t = trailers.find((x) => x.freshGal && !x.grayGal && x.blackGal);
    if (t) {
      const g = winterizationGuide(t);
      assert.equal(g.drainPoints, 2, 'fresh + combined waste = 2 drain points');
      const wasteItem = g.items.find((i) => i.text.includes('waste (combined)'));
      assert.ok(wasteItem, 'should label as combined waste when no gray tank');
    }
  });

  it('includes battery items only when battery exists', () => {
    const withBatt = trailers.find((x) => x.batteryKwh > 0);
    const noBatt = { model: 'Test', floorplan: '16', year: 2026, freshGal: 20 };
    if (withBatt) {
      const g1 = winterizationGuide(withBatt);
      assert.ok(g1.items.some((i) => i.cat === 'electrical' && i.text.includes('kWh')));
    }
    const g2 = winterizationGuide(noBatt);
    assert.ok(!g2.items.some((i) => i.text.includes('kWh')), 'no battery item without battery');
  });

  it('includes solar items only when solar exists', () => {
    const withSolar = trailers.find((x) => x.solarW > 0);
    if (withSolar) {
      const g = winterizationGuide(withSolar);
      assert.ok(g.items.some((i) => i.text.includes(String(withSolar.solarW) + 'W')));
    }
  });

  it('every item has required fields', () => {
    for (const t of trailers.slice(0, 5)) {
      const g = winterizationGuide(t);
      for (const item of g.items) {
        assert.ok(item.cat, `item missing cat: ${item.text}`);
        assert.ok(item.text, 'item missing text');
        assert.ok(item.icon, `item missing icon: ${item.text}`);
        assert.ok(item.detail, `item missing detail: ${item.text}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Render integration: winterization section + tow difficulty badge in output
// ---------------------------------------------------------------------------
describe('render integration', () => {
  it('detail page includes winterization section with wz-check inputs', () => {
    const t = trailers.find((x) => x.slug === 'bambi-16rb-2026');
    const html = renderDetail(t, assetPaths, null, null, trailers);
    assert.ok(html.includes('id="winterization"'), 'winterization section missing');
    assert.ok(html.includes('wz-check'), 'winterization checkboxes missing');
    assert.ok(html.includes('wz-progress'), 'winterization progress bar missing');
    assert.ok(html.includes('wz-reset'), 'winterization reset button missing');
  });

  it('detail page includes winterization in section nav', () => {
    const t = trailers.find((x) => x.slug === 'flying-cloud-25fb-2026');
    const html = renderDetail(t, assetPaths, null, null, trailers);
    assert.ok(html.includes('#winterization'), 'winterization nav link missing');
    assert.ok(html.includes('Storage'), 'Storage label in section nav missing');
  });

  it('detail page includes tow difficulty badge', () => {
    const t = trailers.find((x) => x.slug === 'bambi-16rb-2026');
    const html = renderDetail(t, assetPaths, null, null, trailers);
    assert.ok(html.includes('tow-diff--detail'), 'detail tow difficulty badge missing');
    assert.ok(html.includes('tow-diff-dot'), 'tow difficulty dots missing');
    assert.ok(html.includes('tow-diff-label'), 'tow difficulty label missing');
    assert.ok(html.includes('tow-diff-tip'), 'tow difficulty tip missing');
  });

  it('explore card includes tow difficulty badge', () => {
    const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
    const html = renderExploreCard(t, assetPaths);
    assert.ok(html.includes('tow-diff--card'), 'card tow difficulty badge missing');
    assert.ok(html.includes('tow-diff-dot'), 'card tow difficulty dots missing');
  });

  it('detail page includes compare button', () => {
    const t = trailers.find((x) => x.slug === 'bambi-16rb-2026');
    const html = renderDetail(t, assetPaths, null, null, trailers);
    assert.ok(html.includes('id="detail-compare"'), 'compare button missing');
    assert.ok(html.includes('data-compare-slug="bambi-16rb-2026"'), 'compare slug attr missing');
  });

  it('winterization references real tank sizes from the trailer', () => {
    const t = trailers.find((x) => x.freshGal && x.grayGal && x.blackGal);
    assert.ok(t, 'need a trailer with all 3 tanks');
    const html = renderDetail(t, assetPaths, null, null, trailers);
    assert.ok(html.includes(`${t.freshGal}-gallon fresh`), 'should show real fresh gallon count');
    assert.ok(html.includes(`${t.grayGal}-gallon gray`), 'should show real gray gallon count');
  });
});

// ---------------------------------------------------------------------------
// app.js: winterization IIFE + detailCompare IIFE presence
// ---------------------------------------------------------------------------
describe('app.js client modules', () => {
  const appJs = readFileSync('src/assets/js/app.js', 'utf8');

  it('contains winterization IIFE', () => {
    assert.ok(appJs.includes('(function winterization()'), 'winterization IIFE missing');
    assert.ok(appJs.includes('ae:wz:'), 'winterization localStorage key missing');
  });

  it('contains detailCompare IIFE', () => {
    assert.ok(appJs.includes('(function detailCompare()'), 'detailCompare IIFE missing');
    assert.ok(appJs.includes('detail-compare'), 'detail-compare button wiring missing');
  });

  it('genericCollapsible skips winterization', () => {
    assert.ok(appJs.includes("trig.closest('.winterization')"), 'genericCollapsible should skip winterization');
  });
});
