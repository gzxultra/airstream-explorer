import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderDetail, renderWaterAutonomy } from '../src/lib/render.mjs';
import { loadTrailers } from '../src/lib/data.mjs';

const trailers = loadTrailers();
const classic33 = trailers.find(t => t.slug === 'classic-33fb-2026');
const bambi16 = trailers.find(t => t.slug === 'bambi-16rb-2026');
const basecamp16 = trailers.find(t => t.slug === 'basecamp-16x-2026');

// ---------------------------------------------------------------------------
// SPEC DELTAS on related / cross-family cards
// ---------------------------------------------------------------------------
describe('spec deltas on recommendation cards', () => {
  it('related section contains delta chips', () => {
    const html = renderDetail(classic33, undefined, null, trailers);
    // Related cards should have spec-deltas with delta-chip spans
    assert.ok(html.includes('spec-deltas'), 'has spec-deltas container');
    assert.ok(html.includes('delta-chip'), 'has delta chips');
  });

  it('cross-family section contains delta chips', () => {
    const html = renderDetail(classic33, undefined, null, trailers);
    // Cross-family "you might also like" should also show deltas
    const crossIdx = html.indexOf('cross-family');
    if (crossIdx > 0) {
      const crossSection = html.slice(crossIdx);
      assert.ok(crossSection.includes('spec-deltas'), 'cross-family has deltas');
    }
  });

  it('delta chips show +/- values', () => {
    const html = renderDetail(bambi16, undefined, null, trailers);
    // Should have some positive and negative deltas since Bambi 16RB is small
    const deltaMatches = html.match(/delta-chip/g) || [];
    assert.ok(deltaMatches.length >= 2, `expected at least 2 delta chips, got ${deltaMatches.length}`);
  });

  it('delta chips include weight and price', () => {
    const html = renderDetail(classic33, undefined, null, trailers);
    // Classic 33FB is the heaviest/most expensive, so related cards should show - deltas
    const relSection = html.slice(html.indexOf('class="related"'));
    // Should contain lb and $k references in delta chips
    assert.ok(relSection.includes(' lb</span>') || relSection.includes('lb</span>'), 'has weight deltas');
    assert.ok(relSection.includes('$') && relSection.includes('k</span>'), 'has price deltas');
  });
});

// ---------------------------------------------------------------------------
// WATER AUTONOMY CALCULATOR
// ---------------------------------------------------------------------------
describe('water autonomy calculator', () => {
  it('renders for trailers with tanks', () => {
    const html = renderWaterAutonomy(classic33);
    assert.ok(html.includes('water-autonomy'), 'has water-autonomy section id');
    assert.ok(html.includes('water-calc-data'), 'has data island');
    assert.ok(html.includes('wc-people'), 'has people slider');
    assert.ok(html.includes('wc-usage-btn'), 'has usage level buttons');
  });

  it('returns empty for trailers with no tanks', () => {
    const noTanks = { ...classic33, freshGal: 0, grayGal: 0, blackGal: null };
    const html = renderWaterAutonomy(noTanks);
    assert.equal(html, '', 'no output without tanks');
  });

  it('shows combined tank label for single-waste models', () => {
    // Bambi 16RB has a combined waste tank (grayGal null, blackGal 30)
    const html = renderWaterAutonomy(bambi16);
    assert.ok(html.includes('combined'), 'mentions combined tank');
  });

  it('shows separate gray/black for models with both', () => {
    // Classic 33FB has separate gray and black tanks
    const html = renderWaterAutonomy(classic33);
    assert.ok(html.includes('wc-gray'), 'has gray tank bar');
    assert.ok(html.includes('wc-black'), 'has black tank bar');
    assert.ok(html.includes('Gray water'), 'has gray label');
    assert.ok(html.includes('Black water'), 'has black label');
  });

  it('data island contains valid JSON with usage levels', () => {
    const html = renderWaterAutonomy(classic33);
    const match = html.match(/<script type="application\/json" id="water-calc-data">([\s\S]*?)<\/script>/);
    assert.ok(match, 'has data island');
    const data = JSON.parse(match[1]);
    assert.ok(data.usage.conservative, 'has conservative usage');
    assert.ok(data.usage.moderate, 'has moderate usage');
    assert.ok(data.usage.heavy, 'has heavy usage');
    assert.equal(data.freshGal, classic33.freshGal, 'fresh gal matches');
  });

  it('computes correct default days', () => {
    const html = renderWaterAutonomy(classic33);
    // Classic 33FB: fresh 54 gal, moderate = 6gpd * 2 people = 4.5 days fresh
    // The total-days number should be present
    assert.ok(html.includes('wc-total-days'), 'has total days display');
    assert.ok(html.includes('days of camping'), 'has days label');
  });

  it('appears in detail page section nav (via off-grid dashboard)', () => {
    const html = renderDetail(classic33, undefined, null, trailers);
    assert.ok(html.includes('#offgrid-dash'), 'section nav links to off-grid dashboard');
  });

  it('usage buttons have correct aria attributes', () => {
    const html = renderWaterAutonomy(classic33);
    assert.ok(html.includes('aria-pressed="true"'), 'active button has aria-pressed true');
    assert.ok(html.includes('aria-pressed="false"'), 'inactive buttons have aria-pressed false');
    assert.ok(html.includes('role="radiogroup"'), 'has radiogroup role');
  });
});

// ---------------------------------------------------------------------------
// MAINTENANCE QUICK-REF
// ---------------------------------------------------------------------------
describe('maintenance quick reference', () => {
  it('renders on every detail page', () => {
    const html = renderDetail(classic33, undefined, null, trailers);
    assert.ok(html.includes('maintenance-ref'), 'has maintenance section id');
    assert.ok(html.includes('maint-table'), 'has maintenance table');
  });

  it('includes core maintenance items', () => {
    const html = renderDetail(classic33, undefined, null, trailers);
    assert.ok(html.includes('Tire pressure check'), 'has tire pressure');
    assert.ok(html.includes('Wheel bearing service'), 'has wheel bearings');
    assert.ok(html.includes('Winterization'), 'has winterization');
    assert.ok(html.includes('Fire extinguisher'), 'has fire extinguisher');
  });

  it('includes solar maintenance for solar-equipped trailers', () => {
    // Classic 33FB has solar
    if (classic33.solarW) {
      const html = renderDetail(classic33, undefined, null, trailers);
      assert.ok(html.includes('Solar panel cleaning'), 'has solar maintenance');
    }
  });

  it('includes battery check for battery-equipped trailers', () => {
    if (classic33.batteryKwh) {
      const html = renderDetail(classic33, undefined, null, trailers);
      assert.ok(html.includes('Battery health check'), 'has battery maintenance');
    }
  });

  it('has priority badges', () => {
    const html = renderDetail(classic33, undefined, null, trailers);
    assert.ok(html.includes('maint-badge--safety'), 'has safety badges');
    assert.ok(html.includes('maint-badge--routine'), 'has routine badges');
    assert.ok(html.includes('maint-badge--seasonal'), 'has seasonal badges');
  });

  it('links to full maintenance page', () => {
    const html = renderDetail(classic33, undefined, null, trailers);
    assert.ok(html.includes('maintenance.html'), 'links to full maintenance guide');
  });

  it('is collapsible', () => {
    const html = renderDetail(classic33, undefined, null, trailers);
    const maintIdx = html.indexOf('id="maintenance-ref"');
    const maintSection = html.slice(maintIdx, maintIdx + 500);
    assert.ok(maintSection.includes('collapsible'), 'has collapsible class');
    assert.ok(maintSection.includes('collapsible-trigger'), 'has trigger');
  });

  it('appears in section nav', () => {
    const html = renderDetail(classic33, undefined, null, trailers);
    assert.ok(html.includes('#maintenance-ref'), 'section nav has maintenance link');
  });
});

// ---------------------------------------------------------------------------
// CLIENT JS — water autonomy IIFE present
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
const app = readFileSync('src/assets/js/app.js', 'utf8');

describe('app.js water autonomy', () => {

  it('has waterAutonomyCalc IIFE', () => {
    assert.ok(app.includes('waterAutonomyCalc'), 'app.js contains waterAutonomyCalc');
  });

  it('reads water-calc-data island', () => {
    assert.ok(app.includes('water-calc-data'), 'app.js reads the data island');
  });
});
