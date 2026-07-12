import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTrailers, computeStandouts, groupByFamily, assetPaths } from '../src/lib/data.mjs';
import { renderDetail, renderIndex } from '../src/lib/render.mjs';

const trailers = loadTrailers();

describe('spec glossary tooltips', () => {
  const t = trailers.find((r) => r.slug === 'flying-cloud-25fb-2026');
  const html = renderDetail(t, assetPaths, null, trailers);

  it('renders spec-tip wrapper on detail page spec labels', () => {
    assert.ok(html.includes('class="spec-tip"'), 'should have spec-tip class');
    assert.ok(html.includes('spec-tip-text'), 'should have tooltip text element');
  });

  it('includes a GVWR explanation', () => {
    assert.ok(html.includes('Gross Vehicle Weight Rating'), 'should explain GVWR');
  });

  it('includes a CCC explanation', () => {
    assert.ok(html.includes('GVWR minus dry weight'), 'should explain CCC');
  });

  it('includes an MSRP explanation', () => {
    assert.ok(html.includes('Manufacturer&#39;s Suggested Retail Price'), 'should explain MSRP');
  });

  it('has tabindex for keyboard accessibility', () => {
    assert.ok(html.includes('tabindex="0"'), 'spec-tip should be focusable');
  });

  it('does NOT add tooltips to related card spec rows', () => {
    const relIdx = html.indexOf('<section class="related"');
    if (relIdx !== -1) {
      const relSection = html.slice(relIdx);
      assert.ok(!relSection.includes('spec-tip'), 'related cards should not have tooltips');
    }
  });
});

describe('standout badges', () => {
  it('computeStandouts returns badges for family-leading trailers', () => {
    const fc23 = trailers.find((t) => t.slug === 'flying-cloud-23fb-2026');
    const badges = computeStandouts(fc23, trailers);
    assert.ok(badges.length > 0, 'FC 23FB should have at least one badge');
    const labels = badges.map((b) => b.label);
    assert.ok(labels.includes('Lightest in family'), 'FC 23FB should be lightest');
    assert.ok(labels.includes('Most affordable'), 'FC 23FB should be most affordable');
  });

  it('returns empty for single-entry pools', () => {
    const fc23 = trailers.find((t) => t.slug === 'flying-cloud-23fb-2026');
    const badges = computeStandouts(fc23, [fc23]);
    assert.equal(badges.length, 0, 'single-entry family should have no badges');
  });

  it('renders badges in detail page HTML when earned', () => {
    const fc23 = trailers.find((t) => t.slug === 'flying-cloud-23fb-2026');
    const html = renderDetail(fc23, assetPaths, null, trailers);
    assert.ok(html.includes('standout-badges'), 'should render badges container');
    assert.ok(html.includes('Lightest in family'), 'should show lightest badge');
  });

  it('does not render badges container when none earned', () => {
    const classic33 = trailers.find((t) => t.slug === 'classic-33fb-2026');
    const html = renderDetail(classic33, assetPaths, null, trailers);
    assert.ok(!html.includes('standout-badges'), 'classic-33fb should have no badge container');
  });
});

describe('explore stats summary bar', () => {
  const families = groupByFamily(trailers);
  const html = renderIndex(families, trailers);

  it('renders x-stats element in explore section', () => {
    assert.ok(html.includes('id="x-stats"'), 'should have x-stats element');
  });

  it('x-stats has aria-live for accessibility', () => {
    assert.ok(html.includes('aria-live="polite"'), 'x-stats should have aria-live');
  });
});

describe('section reveal animation', () => {
  const js = readFileSync('src/assets/js/app.js', 'utf8');
  const css = readFileSync('src/assets/css/site.css', 'utf8');

  it('app.js contains sectionReveal module', () => {
    assert.ok(js.includes('sectionReveal'), 'should have sectionReveal function');
  });

  it('respects prefers-reduced-motion in JS', () => {
    assert.ok(js.includes('prefers-reduced-motion: reduce'), 'should check reduced motion');
  });

  it('uses IntersectionObserver', () => {
    assert.ok(js.includes('IntersectionObserver'), 'should use IntersectionObserver');
  });

  it('adds is-revealed class on intersection', () => {
    assert.ok(js.includes("'is-revealed'"), 'should add is-revealed class');
  });

  it('CSS defines reveal-ready with opacity transition', () => {
    assert.ok(css.includes('.reveal-ready'), 'should have .reveal-ready rule');
    assert.ok(css.includes('.reveal-ready.is-revealed'), 'should have .is-revealed rule');
  });

  it('CSS has reduced-motion override', () => {
    assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'should have reduced motion query');
  });
});
