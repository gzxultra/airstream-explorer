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

describe('propane estimator rendering', () => {
  const t = trailers.find(x => x.year === 2026) || trailers[0];
  const html = renderDetail(t, resolve, null, trailers);

  it('detail page includes propane section with id', () => {
    assert.ok(html.includes('id="propane"'), 'missing #propane section');
  });

  it('propane section has data island with BTU config', () => {
    assert.ok(html.includes('id="propane-data"'), 'missing propane-data script');
    assert.ok(html.includes('"btuPerLb"'), 'missing btuPerLb in data island');
  });

  it('propane section has sliders for each appliance', () => {
    assert.ok(html.includes('data-prop-key="furnace"'), 'missing furnace slider');
    assert.ok(html.includes('data-prop-key="waterHeater"'), 'missing water heater slider');
    assert.ok(html.includes('data-prop-key="stove"'), 'missing stove slider');
  });

  it('propane appears in section nav', () => {
    assert.ok(html.includes('#propane'), 'propane missing from secnav');
  });
});

describe('electrical load planner rendering', () => {
  const t = trailers.find(x => x.year === 2026) || trailers[0];
  const html = renderDetail(t, resolve, null, trailers);

  it('detail page includes electrical section with id', () => {
    assert.ok(html.includes('id="electrical"'), 'missing #electrical section');
  });

  it('electrical section has data island', () => {
    assert.ok(html.includes('id="elec-data"'), 'missing elec-data script');
  });

  it('electrical section has appliance checkboxes', () => {
    assert.ok(html.includes('class="elec-check"'), 'missing elec-check checkboxes');
  });

  it('electrical section has budget bar', () => {
    assert.ok(html.includes('elec-budget-fill'), 'missing budget bar fill');
  });

  it('30A models get 3600W max', () => {
    const bambi = trailers.find(x => x.model === 'Bambi' && x.year === 2026);
    if (bambi) {
      const bhtml = renderDetail(bambi, resolve, null, trailers);
      assert.ok(bhtml.includes('30A shore power'), 'Bambi should be 30A');
      assert.ok(bhtml.includes('3,600W max'), 'Bambi should show 3600W');
    }
  });

  it('Classic gets 50A / 12000W max', () => {
    const classic = trailers.find(x => x.model === 'Classic' && x.year === 2026);
    if (classic) {
      const chtml = renderDetail(classic, resolve, null, trailers);
      assert.ok(chtml.includes('50A shore power'), 'Classic should be 50A');
      assert.ok(chtml.includes('12,000W max'), 'Classic should show 12000W');
    }
  });

  it('electrical appears in section nav', () => {
    assert.ok(html.includes('#electrical'), 'electrical missing from secnav');
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
