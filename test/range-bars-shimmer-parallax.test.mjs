// Tests for: spec range bars, shimmer skeleton, hero parallax
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeFleetRanges, rangePosition, loadTrailers } from '../src/lib/data.mjs';
import { renderExploreCard } from '../src/lib/render.mjs';
import { renderMotorhomeExploreCard } from '../src/lib/motorhome-render.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const trailers = loadTrailers();

describe('computeFleetRanges', () => {
  it('returns ranges for weight, msrp, and length', () => {
    const ranges = computeFleetRanges(trailers);
    assert.ok(ranges.weightLb, 'should have weightLb range');
    assert.ok(ranges.msrp, 'should have msrp range');
    assert.ok(ranges.lengthFt, 'should have lengthFt range');
    assert.ok(ranges.weightLb.min < ranges.weightLb.max, 'weight min < max');
    assert.ok(ranges.msrp.min < ranges.msrp.max, 'msrp min < max');
    assert.ok(ranges.lengthFt.min < ranges.lengthFt.max, 'length min < max');
  });

  it('returns empty for empty input', () => {
    const ranges = computeFleetRanges([]);
    assert.deepStrictEqual(ranges, {});
  });

  it('handles mixed trailers and motorhomes', () => {
    const motorhomes = [{ weightLb: 99999, msrp: 999999, lengthFt: 99 }];
    const ranges = computeFleetRanges(trailers, motorhomes);
    assert.equal(ranges.weightLb.max, 99999, 'max weight includes motorhome');
    assert.equal(ranges.msrp.max, 999999, 'max msrp includes motorhome');
  });
});

describe('rangePosition', () => {
  const range = { min: 100, max: 200 };

  it('returns 0 for min value', () => {
    assert.equal(rangePosition(100, range), 0);
  });

  it('returns 100 for max value', () => {
    assert.equal(rangePosition(200, range), 100);
  });

  it('returns 50 for midpoint', () => {
    assert.equal(rangePosition(150, range), 50);
  });

  it('returns null for missing value', () => {
    assert.equal(rangePosition(null, range), null);
    assert.equal(rangePosition(undefined, range), null);
  });

  it('returns null for missing range', () => {
    assert.equal(rangePosition(150, null), null);
    assert.equal(rangePosition(150, undefined), null);
  });

  it('returns null for degenerate range', () => {
    assert.equal(rangePosition(100, { min: 100, max: 100 }), null);
  });
});

describe('explore card range bars', () => {
  const ranges = computeFleetRanges(trailers);

  it('trailer explore cards include range-bar elements', () => {
    const t = trailers.find((x) => x.year === 2026);
    const html = renderExploreCard(t, undefined, false, ranges);
    assert.ok(html.includes('range-bar'), 'should have range-bar class');
    assert.ok(html.includes('range-bar-track'), 'should have track');
    assert.ok(html.includes('range-bar-fill'), 'should have fill');
    // Should have 3 range bars (length, weight, msrp — not sleeps)
    const barCount = (html.match(/range-bar-fill/g) || []).length;
    assert.equal(barCount, 3, 'should have exactly 3 range bars');
  });

  it('explore cards without ranges still render correctly', () => {
    const t = trailers[0];
    const html = renderExploreCard(t, undefined, false, {});
    assert.ok(html.includes('xcard'), 'card renders');
    const barCount = (html.match(/range-bar-fill/g) || []).length;
    assert.equal(barCount, 0, 'no range bars without ranges');
  });
});

describe('motorhome explore card range bars', () => {
  it('motorhome explore cards include range-bar elements when ranges provided', () => {
    let mhData;
    try { mhData = JSON.parse(readFileSync('src/data/motorhomes.json', 'utf8')); }
    catch { return; /* skip if no motorhome data */ }
    if (!mhData.length) return;
    const ranges = computeFleetRanges(trailers, mhData);
    const html = renderMotorhomeExploreCard(mhData[0], undefined, false, ranges);
    assert.ok(html.includes('range-bar'), 'should have range-bar');
    const barCount = (html.match(/range-bar-fill/g) || []).length;
    assert.equal(barCount, 3, 'should have 3 range bars');
  });
});

describe('image shimmer CSS', () => {
  it('site.css contains shimmer keyframes', () => {
    const css = readFileSync('src/assets/css/site.css', 'utf8');
    assert.ok(css.includes('@keyframes img-shimmer'), 'shimmer keyframes defined');
    assert.ok(css.includes('img[loading="lazy"]:not(.is-loaded)'), 'shimmer targets lazy images');
    assert.ok(css.includes('background-size: 200% 100%'), 'shimmer uses double-width bg');
  });

  it('shimmer respects prefers-reduced-motion', () => {
    const css = readFileSync('src/assets/css/site.css', 'utf8');
    // Find the reduced-motion block that disables shimmer
    assert.ok(
      css.includes('prefers-reduced-motion') && css.includes('animation: none'),
      'shimmer disabled under reduced-motion',
    );
  });

  it('dark mode shimmer overrides exist in theme.css', () => {
    const css = readFileSync('src/assets/css/theme.css', 'utf8');
    assert.ok(
      css.includes('[data-theme="dark"] img[loading="lazy"]:not(.is-loaded)'),
      'dark shimmer override exists',
    );
  });
});

describe('hero parallax', () => {
  it('app.js contains heroParallax module', () => {
    const js = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(js.includes('heroParallax'), 'parallax module exists');
    assert.ok(js.includes('prefers-reduced-motion'), 'respects reduced motion');
    assert.ok(js.includes('.detail-hero'), 'targets detail hero');
    assert.ok(js.includes('requestAnimationFrame'), 'uses rAF for performance');
    assert.ok(js.includes('IntersectionObserver'), 'uses IO for viewport gating');
  });

  it('parallax CSS exists with overflow hidden', () => {
    const css = readFileSync('src/assets/css/site.css', 'utf8');
    assert.ok(css.includes('.detail-hero {'), 'detail-hero rule exists');
    assert.ok(css.includes('overflow: hidden'), 'hero has overflow hidden');
    assert.ok(css.includes('will-change: transform'), 'hero img uses will-change');
  });

  it('parallax disabled under reduced-motion in CSS', () => {
    const css = readFileSync('src/assets/css/site.css', 'utf8');
    assert.ok(css.includes('will-change: auto'), 'will-change reset in reduced motion');
  });
});

describe('built output includes new features', () => {
  it('built index.html has range bars on explore cards', () => {
    const html = readFileSync('dist/index.html', 'utf8');
    const barCount = (html.match(/range-bar-fill/g) || []).length;
    assert.ok(barCount >= 30, `expected 30+ range bars in index, got ${barCount}`);
  });

  it('built detail page has parallax hero class', () => {
    const html = readFileSync('dist/m/bambi-16rb-2026.html', 'utf8');
    assert.ok(html.includes('detail-hero'), 'detail hero exists');
    // Range bars should NOT be on detail pages (only explore cards)
    assert.ok(!html.includes('range-bar-fill'), 'no range bars on detail page');
  });

  it('built CSS has shimmer and range-bar rules', () => {
    const files = readdirSync('dist/assets/css');
    const siteCss = files.find((f) => f.startsWith('site.') && f.endsWith('.css'));
    assert.ok(siteCss, 'fingerprinted site.css exists');
    const css = readFileSync(`dist/assets/css/${siteCss}`, 'utf8');
    assert.ok(css.includes('img-shimmer'), 'shimmer in built CSS');
    assert.ok(css.includes('range-bar'), 'range-bar in built CSS');
  });
});
