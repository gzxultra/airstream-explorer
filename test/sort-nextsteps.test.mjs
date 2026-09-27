// Tests for: new explore sort options + next-steps section (post-1A red line).
// Finance calculators were removed per ruling 1A (2026-06-13, reaffirmed
// 2026-09-27); the no-finance regression test lives in no-finance.test.mjs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { renderDetail, renderExploreSections } from '../src/lib/render.mjs';
import { SORT_KEYS, sortTrailers } from '../src/lib/explore.mjs';
import { loadTrailers } from '../src/lib/data.mjs';

const trailers = loadTrailers();

// ---------------------------------------------------------------------------
// 1. New sort options: ccc-desc and hitch-asc
// ---------------------------------------------------------------------------
describe('new explore sort options', () => {
  test('SORT_KEYS includes ccc-desc', () => {
    assert.ok(SORT_KEYS['ccc-desc'], 'ccc-desc sort key exists');
    assert.equal(SORT_KEYS['ccc-desc'].label, 'Most cargo capacity');
    assert.equal(SORT_KEYS['ccc-desc'].dir, -1);
  });

  test('SORT_KEYS includes hitch-asc', () => {
    assert.ok(SORT_KEYS['hitch-asc'], 'hitch-asc sort key exists');
    assert.equal(SORT_KEYS['hitch-asc'].label, 'Lightest hitch');
    assert.equal(SORT_KEYS['hitch-asc'].dir, 1);
  });

  test('sortTrailers by ccc-desc puts highest CCC first', () => {
    const sorted = sortTrailers(trailers, 'ccc-desc');
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(
        (sorted[i - 1].cccLb || 0) >= (sorted[i].cccLb || 0),
        `ccc-desc: ${sorted[i - 1].slug} (${sorted[i - 1].cccLb}) should be >= ${sorted[i].slug} (${sorted[i].cccLb})`,
      );
    }
  });

  test('sortTrailers by hitch-asc puts lightest hitch first', () => {
    const sorted = sortTrailers(trailers, 'hitch-asc');
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1].hitchWeightLb || Infinity;
      const b = sorted[i].hitchWeightLb || Infinity;
      assert.ok(a <= b, `hitch-asc: ${sorted[i - 1].slug} (${a}) should be <= ${sorted[i].slug} (${b})`);
    }
  });

  test('explore page sort select includes new options', () => {
    const html = renderExploreSections(trailers);
    assert.ok(html.includes('ccc-desc'), 'explore sort has ccc-desc option');
    assert.ok(html.includes('hitch-asc'), 'explore sort has hitch-asc option');
    assert.ok(html.includes('Most cargo capacity'), 'explore sort has CCC label');
    assert.ok(html.includes('Lightest hitch'), 'explore sort has hitch label');
  });
});

// ---------------------------------------------------------------------------
// 2. Next steps section — reference only, NO purchase funnel (ruling 1A)
// ---------------------------------------------------------------------------
describe('next-steps section', () => {
  test('no detail page has the next-steps section (redesign 2026-09-27: removed)', () => {
    for (const t of trailers) {
      const html = renderDetail(t);
      assert.ok(!html.includes('class="next-steps"'), `${t.slug} still has next-steps section`);
      assert.ok(!html.includes('Ready for the next step?'), `${t.slug} still has next-steps heading`);
    }
  });

  test('next-steps has NO purchase funnel: no dealer or build-and-price links', () => {
    for (const t of trailers) {
      const html = renderDetail(t);
      assert.ok(!html.includes('find-a-dealer'), `${t.slug} has dealer funnel link`);
      assert.ok(!html.includes('build-your-own'), `${t.slug} has build-and-price funnel link`);
      assert.ok(!html.includes('Find a dealer'), `${t.slug} has dealer funnel text`);
      assert.ok(!html.includes('Build &amp; price'), `${t.slug} has build-and-price text`);
    }
  });

  test('next-steps keeps the official model page link when available', () => {
    // Flying Cloud should have an official URL
    const fc = trailers.find((t) => t.model === 'Flying Cloud');
    if (fc) {
      const html = renderDetail(fc);
      assert.ok(html.includes('Official Flying Cloud page'), 'has official model link');
      assert.ok(html.includes('target="_blank"'), 'link opens in new tab');
      assert.ok(html.includes('rel="noopener"'), 'link has noopener');
    }
  });
});
