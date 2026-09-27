import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTrailers, groupByFamily, deriveAxle } from '../src/lib/data.mjs';
import { renderDetail, renderIndex } from '../src/lib/render.mjs';

const trailers = loadTrailers();
const families = groupByFamily(trailers);
const bambi16rb = trailers.find((t) => t.slug === 'bambi-16rb-2026');
const classic33fb = trailers.find((t) => t.slug === 'classic-33fb-2026');
const indexHtml = renderIndex(families, trailers);

// ---------------------------------------------------------------------------
// 1. Axle type derivation
// ---------------------------------------------------------------------------
describe('deriveAxle', () => {
  it('returns "single" for Bambi', () => {
    assert.equal(deriveAxle({ model: 'Bambi', floorplan: '16RB' }), 'single');
  });
  it('returns "single" for Basecamp', () => {
    assert.equal(deriveAxle({ model: 'Basecamp', floorplan: '16X' }), 'single');
  });
  it('returns "single" for Caravel', () => {
    assert.equal(deriveAxle({ model: 'Caravel', floorplan: '20FB' }), 'single');
  });
  it('returns "single" for World Traveler', () => {
    assert.equal(deriveAxle({ model: 'World Traveler', floorplan: '22RB' }), 'single');
  });
  it('returns "single" for Basecamp XE', () => {
    assert.equal(deriveAxle({ model: 'Basecamp Xe', floorplan: '20' }), 'single');
  });
  it('returns "dual" for Flying Cloud', () => {
    assert.equal(deriveAxle({ model: 'Flying Cloud', floorplan: '25FB' }), 'dual');
  });
  it('returns "dual" for Classic', () => {
    assert.equal(deriveAxle({ model: 'Classic', floorplan: '33FB' }), 'dual');
  });
  it('returns "dual" for International', () => {
    assert.equal(deriveAxle({ model: 'International', floorplan: '28RB' }), 'dual');
  });
  it('returns "dual" for FLW LE', () => {
    assert.equal(deriveAxle({ model: 'Frank Lloyd Wright Usonian Limited Edition', floorplan: '28RB' }), 'dual');
  });
  it('returns "dual" for Stetson', () => {
    assert.equal(deriveAxle({ model: 'Stetson + 6666 Special Edition', floorplan: '27FB' }), 'dual');
  });
  it('returns "dual" for Trade Wind', () => {
    assert.equal(deriveAxle({ model: 'Trade Wind', floorplan: '25FB' }), 'dual');
  });
  it('returns "dual" for Globetrotter', () => {
    assert.equal(deriveAxle({ model: 'Globetrotter', floorplan: '27FB' }), 'dual');
  });
  it('returns null for unknown model', () => {
    assert.equal(deriveAxle({ model: 'FakeModel', floorplan: '99Z' }), null);
  });
  it('covers all 58 trailers (no nulls)', () => {
    for (const t of trailers) {
      const axle = deriveAxle(t);
      assert.ok(axle === 'single' || axle === 'dual',
        `${t.slug} should have axle type, got ${axle}`);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Axle spec row in detail HTML
// ---------------------------------------------------------------------------
describe('axle in detail pages', () => {
  it('Bambi 16RB shows "Single axle" in spec table', () => {
    const html = renderDetail(bambi16rb, undefined, null, trailers);
    assert.ok(html.includes('Single axle'), 'expected Single axle in Bambi spec');
  });
  it('Classic 33FB shows "Dual axle" in spec table', () => {
    const html = renderDetail(classic33fb, undefined, null, trailers);
    assert.ok(html.includes('Dual axle'), 'expected Dual axle in Classic spec');
  });
  it('Axle glossary tooltip is present', () => {
    const html = renderDetail(bambi16rb, undefined, null, trailers);
    assert.ok(html.includes('Single-axle trailers are lighter'));
  });
});

// ---------------------------------------------------------------------------
// 3. Axle filter on explore page
// ---------------------------------------------------------------------------
describe('axle explore filter', () => {
  it('explore has axle filter dropdown', () => {
    assert.ok(indexHtml.includes('id="x-axle"'), 'expected x-axle select');
    assert.ok(indexHtml.includes('Single axle'), 'expected Single axle option');
    assert.ok(indexHtml.includes('Dual axle'), 'expected Dual axle option');
  });
  it('explore card payload carries axle data for every trailer', () => {
    // Cards are client-rendered now: the axle filter reads axle from the
    // #xdata JSON payload instead of data-axle attributes in static HTML.
    const m = indexHtml.match(/<script type="application\/json" id="xdata">([\s\S]*?)<\/script>/);
    assert.ok(m, '#xdata payload present');
    const items = JSON.parse(m[1]).filter((i) => i.type === 'trailer');
    const singles = items.filter((i) => i.axle === 'single').length;
    const duals = items.filter((i) => i.axle === 'dual').length;
    assert.ok(singles > 0, 'expected some single-axle trailers');
    assert.ok(duals > 0, 'expected some dual-axle trailers');
    assert.equal(singles + duals, 58, 'all 58 trailers carry axle data');
  });
  it('app.js wires up axle filter', () => {
    const js = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(js.includes("state.axle"), 'expected state.axle in app.js');
    assert.ok(js.includes("'x-axle'"), 'expected x-axle element lookup');
  });
});

// ---------------------------------------------------------------------------
// 4. Compare bar delta preview
// ---------------------------------------------------------------------------
describe('compare bar delta', () => {
  it('explore page has cmp-delta element', () => {
    assert.ok(indexHtml.includes('id="cmp-delta"'), 'expected cmp-delta element');
  });
  it('app.js computes delta for 2 selected models', () => {
    const js = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(js.includes('cmp-delta'), 'expected cmp-delta in app.js');
    assert.ok(js.includes('sel.length === 2'), 'expected 2-model check');
  });
});

// ---------------------------------------------------------------------------
// 5. Recently viewed on home page
// ---------------------------------------------------------------------------
describe('recently viewed on home page', () => {
  it('home page has home-recent section', () => {
    assert.ok(indexHtml.includes('id="home-recent"'), 'expected home-recent section');
    assert.ok(indexHtml.includes('id="home-recent-grid"'), 'expected home-recent-grid');
    assert.ok(indexHtml.includes('id="home-recent-clear"'), 'expected home-recent-clear btn');
  });
  it('home-recent starts hidden', () => {
    assert.match(indexHtml, /home-recent[^>]*hidden/);
  });
  it('app.js populates home-recent from localStorage', () => {
    const js = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(js.includes('home-recent-grid'), 'expected home-recent-grid in app.js');
    assert.ok(js.includes('homeCatalog'), 'expected homeCatalog data build');
    assert.ok(js.includes('renderHome'), 'expected renderHome function');
  });
  it('CSS styles exist for home-recent', () => {
    const css = readFileSync('src/assets/css/site.css', 'utf8');
    assert.ok(css.includes('.home-recent-strip'), 'expected strip styles');
    assert.ok(css.includes('.home-recent-card'), 'expected card styles');
  });
  it('dark mode styles exist for home-recent', () => {
    const css = readFileSync('src/assets/css/theme.css', 'utf8');
    assert.ok(css.includes('.home-recent-card'), 'expected dark mode card styles');
  });
});
