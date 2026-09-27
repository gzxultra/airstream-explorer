import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePropaneDuration } from '../src/lib/render.mjs';
import { renderDetail, renderExploreCard } from '../src/lib/render.mjs';
import { loadTrailers, assetPaths, computeFleetRanges, computeFleetStandouts } from '../src/lib/data.mjs';

const trailers = loadTrailers();
const resolve = assetPaths;

describe('computePropaneDuration', () => {
  it('returns Infinity days when no appliances are running', () => {
    const r = computePropaneDuration(40, { furnace: 0, waterHeater: 0, stove: 0 });
    assert.equal(r.days, Infinity);
    assert.equal(r.dailyBtu, 0);
    assert.equal(r.dailyLb, 0);
  });

  it('calculates correct duration with furnace only at 25k BTU for 4 hr/day', () => {
    const r = computePropaneDuration(40, { furnace: 4 });
    // 40 lb × 21594 BTU/lb = 863,760 total BTU
    // 25000 BTU/hr × 4 hr = 100,000 BTU/day
    // 863,760 / 100,000 = 8.6376 days
    assert.ok(Math.abs(r.days - 8.6376) < 0.01, `expected ~8.64 days, got ${r.days}`);
    assert.equal(r.dailyBtu, 100000);
  });

  it('stacks multiple appliances correctly', () => {
    const r = computePropaneDuration(40, { furnace: 4, waterHeater: 1, stove: 0.5 });
    // furnace: 25000 × 4 = 100,000
    // water heater: 12000 × 1 = 12,000
    // stove: 9000 × 0.5 = 4,500
    // total daily: 116,500 BTU
    assert.equal(r.dailyBtu, 116500);
    assert.ok(r.days > 0 && r.days < 10);
  });

  it('works with 0 lb capacity (edge case)', () => {
    const r = computePropaneDuration(0, { furnace: 4 });
    assert.equal(r.days, 0);
    assert.equal(r.totalBtu, 0);
  });
});

describe('off-grid tabs: Endurance + Water only (redesign 2026-09-27)', () => {
  const t = trailers.find(x => x.year === 2026) || trailers[0];
  const html = renderDetail(t, resolve, null, trailers);

  it('detail page has Endurance and Water tabs, no Propane/Electrical tabs', () => {
    assert.ok(html.includes('id="og-endurance"'), 'missing og-endurance tab');
    assert.ok(html.includes('id="og-water"'), 'missing og-water tab');
    assert.ok(!html.includes('id="og-propane"'), 'og-propane tab must not exist');
    assert.ok(!html.includes('id="og-electrical"'), 'og-electrical tab must not exist');
  });

  it('Endurance is the default (checked) tab', () => {
    assert.ok(html.includes('id="og-endurance" checked'), 'Endurance should be the default tab');
  });

  it('propane renders as a one-line summary inside the Endurance panel', () => {
    assert.ok(html.includes('class="propane-line'), 'missing propane-line summary');
    const endIdx = html.indexOf('id="og-endurance"');
    const lineIdx = html.indexOf('propane-line');
    const waterIdx = html.indexOf('id="og-water"');
    assert.ok(lineIdx > endIdx && lineIdx < waterIdx, 'propane-line should sit inside the Endurance panel');
  });

  it('no propane estimator data island or sliders', () => {
    assert.ok(!html.includes('id="propane-data"'), 'no propane-data island');
    assert.ok(!html.includes('data-prop-key'), 'no propane sliders');
  });
});

describe('electrical load planner removed from detail (redesign 2026-09-27)', () => {
  const t = trailers.find(x => x.year === 2026) || trailers[0];
  const html = renderDetail(t, resolve, null, trailers);

  it('no og-electrical tab on the detail page', () => {
    assert.ok(!html.includes('id="og-electrical"'), 'og-electrical tab must not exist');
  });

  it('no elec-data island', () => {
    assert.ok(!html.includes('id="elec-data"'), 'no elec-data island');
  });

  it('no electrical appliance checkboxes', () => {
    assert.ok(!html.includes('class="elec-check"'), 'no elec-check checkboxes');
  });

  it('no electrical budget bar', () => {
    assert.ok(!html.includes('elec-budget-fill'), 'no budget bar fill');
  });

  it('no electrical planner panel copy', () => {
    assert.ok(!html.includes('Select appliances to see the load'), 'no planner copy');
    assert.ok(!html.includes('class="electrical-tab"'), 'no electrical-tab container');
  });

  it('off-grid section keeps exactly two tab inputs', () => {
    const count = (html.match(/class="og-tab-input"/g) || []).length;
    assert.equal(count, 2, `expected 2 off-grid tabs, got ${count}`);
  });

  it('off-grid section stays in page (Endurance + Water)', () => {
    assert.ok(html.includes('id="offgrid"'), 'offgrid section stays in page');
    assert.ok(!html.includes('class="secnav"'), 'no section nav');
  });
});

describe('explore list view', () => {
  it('explore card has xcard class for list view styling', () => {
    const t = trailers.find(x => x.year === 2026) || trailers[0];
    const ranges = computeFleetRanges(trailers);
    const badges = computeFleetStandouts(trailers);
    const card = renderExploreCard(t, resolve, false, ranges, badges[t.slug] || []);
    assert.ok(card.includes('class="xcard"'), 'missing xcard class');
    assert.ok(card.includes('xcard-body'), 'missing xcard-body');
    assert.ok(card.includes('xcard-specs'), 'missing xcard-specs');
  });
});
