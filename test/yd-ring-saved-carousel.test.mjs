import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load render module
const { renderDetail } = await import(join(ROOT, 'src/lib/render.mjs'));
const { loadTrailers, resolveAssets, computeYearDiff } = await import(join(ROOT, 'src/lib/data.mjs'));
const { existsSync } = await import('node:fs');

const trailers = loadTrailers();
const hasAsset = (rel) => existsSync(join(ROOT, 'public', rel));

describe('year-over-year spec delta indicators', () => {
  it('specRow accepts yearDelta parameter without error', () => {
    // The specRow function should work with and without yearDelta
    const t2026 = trailers.find((t) => t.year === 2026);
    assert.ok(t2026, 'should have at least one 2026 trailer');
    const html = renderDetail(t2026, (t) => resolveAssets(t, hasAsset), null, null, trailers);
    assert.ok(html.includes('class="spec"'), 'should have spec rows');
  });

  it('computeYearDiff returns null for 2025 trailers', () => {
    const t2025 = trailers.find((t) => t.year === 2025);
    if (!t2025) return; // skip if no 2025 data
    const diff = computeYearDiff(t2025, trailers);
    assert.equal(diff, null, 'should return null for 2025');
  });

  it('computeYearDiff returns data structure when specs differ', () => {
    // Create a synthetic test with different specs
    const t2026 = trailers.find((t) => t.year === 2026 && trailers.some(
      (t2) => t2.model === t.model && t2.floorplan === t.floorplan && t2.year === 2025
    ));
    if (!t2026) return;
    // Mutate a copy to force a diff
    const allCopy = trailers.map((t) => ({...t}));
    const prev = allCopy.find(
      (t) => t.model === t2026.model && t.floorplan === t2026.floorplan && t.year === 2025
    );
    if (!prev) return;
    prev.msrp = prev.msrp + 1000; // force a diff
    const diff = computeYearDiff(t2026, allCopy);
    assert.ok(diff, 'should return diff object');
    assert.ok(Array.isArray(diff.diffs), 'should have diffs array');
    assert.ok(diff.diffs.some((d) => d.key === 'msrp'), 'should include msrp diff');
  });

  it('spec-yd markup appears when yearDelta is provided', () => {
    // Force a spec diff by modifying a copy
    const t2026 = trailers.find((t) => t.year === 2026 && trailers.some(
      (t2) => t2.model === t.model && t2.floorplan === t.floorplan && t2.year === 2025
    ));
    if (!t2026) return;
    const allCopy = trailers.map((t) => ({...t}));
    const prev = allCopy.find(
      (t) => t.model === t2026.model && t.floorplan === t2026.floorplan && t.year === 2025
    );
    if (!prev) return;
    prev.msrp = prev.msrp - 2000; // 2026 is +$2000
    const html = renderDetail(t2026, (t) => resolveAssets(t, hasAsset), null, null, allCopy);
    assert.ok(html.includes('spec-yd'), 'should contain spec-yd markup');
    assert.ok(html.includes('spec-yd--up') || html.includes('spec-yd--down'), 'should have direction class');
  });
});

describe('progress ring on back-to-top', () => {
  const appJs = readFileSync(join(ROOT, 'src/assets/js/app.js'), 'utf8');
  
  it('creates SVG progress ring in backToTop module', () => {
    assert.ok(appJs.includes('progress-ring'), 'should reference progress-ring class');
    assert.ok(appJs.includes('ring-bg'), 'should create ring-bg circle');
    assert.ok(appJs.includes('ring-fg'), 'should create ring-fg circle');
    assert.ok(appJs.includes('strokeDasharray'), 'should set strokeDasharray');
    assert.ok(appJs.includes('strokeDashoffset'), 'should update strokeDashoffset');
  });

  it('CSS has progress ring styles', () => {
    const css = readFileSync(join(ROOT, 'src/assets/css/site.css'), 'utf8');
    assert.ok(css.includes('.progress-ring'), 'should have .progress-ring rule');
    assert.ok(css.includes('.ring-bg'), 'should have .ring-bg rule');
    assert.ok(css.includes('.ring-fg'), 'should have .ring-fg rule');
  });
});

describe('saved badges on explore cards', () => {
  const appJs = readFileSync(join(ROOT, 'src/assets/js/app.js'), 'utf8');
  
  it('savedBadgesOnCards module exists', () => {
    assert.ok(appJs.includes('savedBadgesOnCards'), 'should have savedBadgesOnCards function');
    assert.ok(appJs.includes('xcard-saved-badge'), 'should create saved badge elements');
  });

  it('dispatches ae:save-change event on save', () => {
    assert.ok(appJs.includes("ae:save-change"), 'should dispatch custom save-change event');
  });

  it('listens for both storage and custom events', () => {
    assert.ok(appJs.includes("addEventListener('storage'"), 'should listen for storage events');
    assert.ok(appJs.includes("addEventListener('ae:save-change'"), 'should listen for ae:save-change');
  });

  it('CSS has saved badge styles', () => {
    const css = readFileSync(join(ROOT, 'src/assets/css/site.css'), 'utf8');
    assert.ok(css.includes('.xcard-saved-badge'), 'should have .xcard-saved-badge rule');
    assert.ok(css.includes('saved-pop'), 'should have saved-pop animation');
  });
});

describe('related trailers carousel', () => {
  it('related-grid uses flex layout for horizontal scroll', () => {
    const css = readFileSync(join(ROOT, 'src/assets/css/site.css'), 'utf8');
    // The related-grid should have flex + scroll-snap
    assert.ok(css.includes('.related-grid') && css.includes('scroll-snap-type'), 
      'related-grid should have scroll-snap');
    assert.ok(css.includes('.rel-card') && css.includes('scroll-snap-align'),
      'rel-card should have snap alignment');
  });

  it('has scroll fade hint on related section', () => {
    const css = readFileSync(join(ROOT, 'src/assets/css/site.css'), 'utf8');
    assert.ok(css.includes('.related::after'), 'should have fade hint pseudo-element');
    assert.ok(css.includes('.is-scrolled-end::after'), 'should hide fade at scroll end');
  });

  it('relatedScroll module detects scroll end', () => {
    const appJs = readFileSync(join(ROOT, 'src/assets/js/app.js'), 'utf8');
    assert.ok(appJs.includes('relatedScroll'), 'should have relatedScroll function');
    assert.ok(appJs.includes('is-scrolled-end'), 'should toggle is-scrolled-end class');
  });

  it('detail pages render related section with carousel markup', () => {
    const t = trailers.find((t) => t.year === 2026);
    if (!t) return;
    const html = renderDetail(t, (t) => resolveAssets(t, hasAsset), null, null, trailers);
    assert.ok(html.includes('related-grid'), 'should have related-grid');
    assert.ok(html.includes('rel-card'), 'should have rel-card items');
  });
});

describe('dark mode theme support for new features', () => {
  const theme = readFileSync(join(ROOT, 'src/assets/css/theme.css'), 'utf8');
  
  it('year-delta dark mode overrides', () => {
    assert.ok(theme.includes('.spec-yd--up'), 'should have dark mode spec-yd--up');
    assert.ok(theme.includes('.spec-yd--down'), 'should have dark mode spec-yd--down');
  });

  it('saved badge dark mode override', () => {
    assert.ok(theme.includes('.xcard-saved-badge'), 'should have dark mode saved badge');
  });

  it('related fade dark mode override', () => {
    assert.ok(theme.includes('.related::after'), 'should have dark mode related fade');
  });

  it('progress ring dark mode override', () => {
    assert.ok(theme.includes('.ring-bg'), 'should have dark mode ring-bg');
  });
});
