// Tests for R16 features: Editor's Picks, animated hero counters,
// scroll fade indicators, and payload packing presets.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderIndex, renderDetail, esc } from '../src/lib/render.mjs';
import { loadTrailers, groupByFamily, assetPaths } from '../src/lib/data.mjs';

const trailers = loadTrailers();
const families = groupByFamily(trailers);

// ---------------------------------------------------------------------------
// 1. EDITOR'S PICKS on home page
// ---------------------------------------------------------------------------
describe('Editor\'s Picks', () => {
  const html = renderIndex(families, trailers);

  it('renders the editors-picks section', () => {
    assert.ok(html.includes('class="editors-picks"'), 'editors-picks section missing');
    assert.ok(html.includes('id="editors-picks"'), 'editors-picks id missing');
  });

  it('renders all 4 recommendation strips', () => {
    assert.ok(html.includes('data-pick="easy-tow"'), 'easy-tow strip missing');
    assert.ok(html.includes('data-pick="off-grid"'), 'off-grid strip missing');
    assert.ok(html.includes('data-pick="spacious"'), 'spacious strip missing');
    assert.ok(html.includes('data-pick="value"'), 'value strip missing');
  });

  it('each strip has at least 2 pick cards', () => {
    const strips = ['easy-tow', 'off-grid', 'spacious', 'value'];
    for (const strip of strips) {
      const start = html.indexOf(`data-pick="${strip}"`);
      assert.ok(start > 0, `strip ${strip} not found`);
      // Find the next strip or section end to bound our search
      const nextStrip = html.indexOf('data-pick="', start + 20);
      const sectionEnd = html.indexOf('</section>', start);
      const end = nextStrip > 0 && nextStrip < sectionEnd ? nextStrip : sectionEnd;
      const chunk = html.slice(start, end);
      const cardCount = (chunk.match(/class="pick-card"/g) || []).length;
      assert.ok(cardCount >= 2, `strip ${strip} has only ${cardCount} cards, need >= 2`);
    }
  });

  it('pick cards have thumbnails and links to detail pages', () => {
    const cardMatch = html.match(/class="pick-card" href="m\/([^"]+)\.html"/g);
    assert.ok(cardMatch && cardMatch.length >= 8, `expected >= 8 pick card links, got ${cardMatch ? cardMatch.length : 0}`);
  });

  it('pick cards show stat text', () => {
    assert.ok(html.includes('pick-card-stat'), 'pick-card-stat class missing');
    // Easiest to tow shows GVWR
    assert.ok(html.includes('GVWR'), 'GVWR stat missing from easiest to tow');
    // Best off-grid shows off-grid score
    assert.ok(html.includes('/100 off-grid'), 'off-grid score stat missing');
  });

  it('editors picks are inside the families view (not all-floorplans)', () => {
    const familiesViewIdx = html.indexOf('id="view-families"');
    const allViewIdx = html.indexOf('id="view-all"');
    const picksIdx = html.indexOf('id="editors-picks"');
    assert.ok(picksIdx > familiesViewIdx, 'picks should be after families view start');
    assert.ok(picksIdx < allViewIdx, 'picks should be before all-floorplans view');
  });
});

// ---------------------------------------------------------------------------
// 2. ANIMATED HERO COUNTERS
// ---------------------------------------------------------------------------
describe('animated hero counters', () => {
  const html = renderIndex(families, trailers);

  it('hero stats have data-hero-num attributes', () => {
    const matches = html.match(/data-hero-num="(\d+)"/g);
    assert.ok(matches && matches.length >= 2, 'expected at least 2 hero-num data attrs');
  });

  it('hero stat values are correct family/floorplan counts', () => {
    const allFamilies = families.length;
    assert.ok(html.includes(`data-hero-num="${allFamilies}"`), `family count ${allFamilies} not in hero stat`);
  });

  it('app.js contains heroCounters IIFE', () => {
    const appJs = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(appJs.includes('function heroCounters'), 'heroCounters function missing from app.js');
    assert.ok(appJs.includes('is-counting'), 'is-counting class missing from heroCounters');
    assert.ok(appJs.includes('easeOutQuart'), 'easeOutQuart easing missing');
  });
});

// ---------------------------------------------------------------------------
// 3. SCROLL FADE INDICATORS
// ---------------------------------------------------------------------------
describe('scroll fade indicators', () => {
  it('CSS has mask-image rules for scroll containers', () => {
    const css = readFileSync('src/assets/css/site.css', 'utf8');
    assert.ok(css.includes('.snav-list'), 'snav-list not in scroll fade CSS');
    assert.ok(css.includes('scroll-start'), 'scroll-start class missing');
    assert.ok(css.includes('scroll-end'), 'scroll-end class missing');
    assert.ok(css.includes('scroll-both-end'), 'scroll-both-end class missing');
    assert.ok(css.includes('mask-image'), 'mask-image property missing');
  });

  it('app.js contains scrollFades IIFE', () => {
    const appJs = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(appJs.includes('function scrollFades'), 'scrollFades function missing from app.js');
    assert.ok(appJs.includes('scroll-start'), 'scroll-start toggle missing');
    assert.ok(appJs.includes('scroll-end'), 'scroll-end toggle missing');
  });

  it('pick strip scroll container has fade mask in CSS', () => {
    const css = readFileSync('src/assets/css/site.css', 'utf8');
    assert.ok(css.includes('.pick-strip-scroll'), 'pick-strip-scroll not styled with fade');
  });
});

// ---------------------------------------------------------------------------
// 4. PAYLOAD PACKING PRESETS
// ---------------------------------------------------------------------------
describe('payload packing presets removed (redesign 2026-09-27)', () => {
  const t = trailers.find((x) => x.slug === 'classic-33fb-2026') || trailers.find((x) => x.cccLb > 0);
  const html = renderDetail(t, assetPaths, null, trailers);

  it('no preset buttons on detail page', () => {
    assert.ok(!html.includes('id="payload-presets"'), 'no payload-presets container');
    assert.ok(!html.includes('data-preset="weekend"'), 'no weekend preset');
  });

  it('no preset labels', () => {
    assert.ok(!html.includes('Weekend trip'), 'no Weekend trip label');
  });

  it('no weeklong preset on detail page (redesign 2026-09-27)', () => {
    assert.ok(!html.includes('data-preset="weeklong"'), 'no weeklong preset');
    assert.ok(!html.includes('Week-long trip'), 'no Week-long trip label');
  });

  it('no preset weight values in detail HTML (redesign 2026-09-27)', () => {
    assert.ok(!html.includes('preset-weight'), 'no preset-weight markup');
  });

  it('payload preset UI absent but app.js handlers untouched (scope: render only)', () => {
    // app.js is outside the allowed modification scope; handlers remain but have no UI to bind to
    assert.ok(!html.includes('id="payload-presets"'), 'no preset container in HTML');
  });

  it('dark mode styles exist for editor picks', () => {
    const theme = readFileSync('src/assets/css/theme.css', 'utf8');
    assert.ok(theme.includes('.pick-card'), 'pick-card dark mode missing');
  });
});
