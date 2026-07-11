import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderWeightContext } from '../src/lib/render.mjs';
import { renderDetail } from '../src/lib/render.mjs';
import { loadTrailers, assetPaths } from '../src/lib/data.mjs';

const trailer = {
  model: 'Flying Cloud', floorplan: '25FB', year: 2026, slug: 'flying-cloud-25fb-2026',
  lengthFt: 25.9, weightLb: 5650, gvwrLb: 7300, hitchWeightLb: 690, cccLb: 1650,
  freshGal: 39, grayGal: 38, blackGal: 39, sleeps: 5, msrp: 118900,
  solarW: 200, batteryKwh: 0.6, offGridScore: 35, tags: ['couples'],
};

describe('renderWeightContext', () => {
  it('renders section with weight-context id', () => {
    const html = renderWeightContext(trailer);
    assert.ok(html.includes('id="weight-context"'));
    assert.ok(html.includes('aria-label="Weight in context"'));
  });

  it('shows trailer model and weight in intro', () => {
    const html = renderWeightContext(trailer);
    assert.ok(html.includes('Flying Cloud'));
    assert.ok(html.includes('25FB'));
    assert.ok(html.includes('5,650'));
  });

  it('renders exactly 3 comparison items', () => {
    const html = renderWeightContext(trailer);
    const count = (html.match(/class="wctx-item"/g) || []).length;
    assert.equal(count, 3);
  });

  it('includes both trailer and reference bars', () => {
    const html = renderWeightContext(trailer);
    assert.ok(html.includes('wctx-bar--trailer'));
    assert.ok(html.includes('wctx-bar--ref'));
  });

  it('returns empty for trailer without weight', () => {
    assert.equal(renderWeightContext({ ...trailer, weightLb: 0 }), '');
  });

  it('handles very light trailers (Basecamp 16X)', () => {
    const html = renderWeightContext({ ...trailer, model: 'Basecamp', floorplan: '16X', weightLb: 2650 });
    assert.ok(html.includes('wctx-item'));
    assert.ok(html.includes('2,650'));
  });

  it('handles very heavy trailers (Classic 33FB)', () => {
    const html = renderWeightContext({ ...trailer, model: 'Classic', floorplan: '33FB', weightLb: 8425 });
    assert.ok(html.includes('wctx-item'));
    assert.ok(html.includes('8,425'));
  });
});

describe('scroll-reveal CSS', () => {
  const css = readFileSync('src/assets/css/site.css', 'utf8');

  it('defines .reveal-section base state', () => {
    assert.ok(css.includes('.reveal-section'));
    assert.ok(css.includes('opacity: 0') || css.includes('opacity:0'));
  });

  it('defines .is-revealed target state', () => {
    assert.ok(css.includes('.reveal-section.is-revealed'));
  });

  it('respects prefers-reduced-motion', () => {
    assert.ok(css.includes('prefers-reduced-motion'));
    assert.ok(css.includes('reveal-section'));
  });
});

describe('scroll-reveal JS', () => {
  const js = readFileSync('src/assets/js/app.js', 'utf8');

  it('has scrollReveal IIFE', () => {
    assert.ok(js.includes('function scrollReveal'));
  });

  it('uses IntersectionObserver', () => {
    const idx = js.indexOf('scrollReveal');
    const chunk = js.substring(idx, idx + 1200);
    assert.ok(chunk.includes('IntersectionObserver'));
  });

  it('adds reveal-section class', () => {
    const idx = js.indexOf('scrollReveal');
    const chunk = js.substring(idx, idx + 1200);
    assert.ok(chunk.includes('reveal-section'));
  });

  it('adds is-revealed on intersection', () => {
    const idx = js.indexOf('scrollReveal');
    const chunk = js.substring(idx, idx + 1200);
    assert.ok(chunk.includes('is-revealed'));
  });
});

describe('smooth collapsible CSS', () => {
  const css = readFileSync('src/assets/css/site.css', 'utf8');

  it('section-collapse-body has max-height transition', () => {
    assert.ok(css.includes('.section-collapse-body'));
    const idx = css.indexOf('.section-collapse-body');
    const chunk = css.substring(idx, idx + 200);
    assert.ok(chunk.includes('transition'));
    assert.ok(chunk.includes('max-height'));
  });

  it('collapsed state sets max-height: 0', () => {
    assert.ok(css.includes('.is-collapsed .section-collapse-body'));
  });

  it('collapsible-body hidden override uses smooth transition', () => {
    assert.ok(css.includes('.collapsible .collapsible-body[hidden]'));
    const idx = css.indexOf('.collapsible .collapsible-body[hidden]');
    const chunk = css.substring(idx, idx + 200);
    assert.ok(chunk.includes('max-height'));
  });
});

describe('smooth collapsible JS', () => {
  const js = readFileSync('src/assets/js/app.js', 'utf8');

  it('collapsibleSections sets max-height on toggle', () => {
    const idx = js.indexOf('collapsibleSections');
    const chunk = js.substring(idx, idx + 3000);
    assert.ok(chunk.includes('scrollHeight'));
    assert.ok(chunk.includes('maxHeight'));
  });

  it('trip-ready collapsible uses smooth animation', () => {
    const idx = js.indexOf('tripReady');
    const chunk = js.substring(idx, idx + 3000);
    assert.ok(chunk.includes('scrollHeight'));
    assert.ok(chunk.includes('maxHeight'));
  });

  it('genericCollapsible handler exists', () => {
    assert.ok(js.includes('genericCollapsible'));
  });

  it('genericCollapsible skips trip-ready', () => {
    const idx = js.indexOf('genericCollapsible');
    const chunk = js.substring(idx, idx + 800);
    assert.ok(chunk.includes('trip-ready'));
  });
});

describe('weight context in detail page', () => {
  const trailers = loadTrailers();
  const t = trailers.find((x) => x.slug === 'flying-cloud-25fb-2026') || trailers[0];

  it('detail page includes weight-context section', () => {
    const html = renderDetail(t, assetPaths, null, null, trailers);
    assert.ok(html.includes('id="weight-context"'));
  });

  it('section nav includes Weight link', () => {
    const html = renderDetail(t, assetPaths, null, null, trailers);
    assert.ok(html.includes('#weight-context'));
  });
});
