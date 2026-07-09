// Tests for: financing calculator, new sort options, and next-steps section.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { calculateMonthly, renderFinancingTool, renderDetail, renderExploreSections } from '../src/lib/render.mjs';
import { SORT_KEYS, sortTrailers } from '../src/lib/explore.mjs';
import { loadTrailers } from '../src/lib/data.mjs';

const trailers = loadTrailers();

// ---------------------------------------------------------------------------
// 1. calculateMonthly — amortization math
// ---------------------------------------------------------------------------
describe('calculateMonthly', () => {
  test('returns correct monthly payment for standard scenario', () => {
    // $100k, 20% down, 6.99% APR, 15 years
    const r = calculateMonthly(100000, 20, 6.99, 15);
    assert.equal(r.down, 20000);
    assert.equal(r.principal, 80000);
    // Monthly ~ $718 (standard amortization)
    assert.ok(r.monthly >= 710 && r.monthly <= 730, `monthly ${r.monthly} not in expected range`);
    assert.ok(r.totalInterest > 0, 'total interest should be positive');
    assert.ok(r.totalCost > 100000, 'total cost should exceed MSRP');
  });

  test('100% down means zero monthly', () => {
    const r = calculateMonthly(50000, 100, 7, 10);
    assert.equal(r.monthly, 0);
    assert.equal(r.principal, 0);
    assert.equal(r.down, 50000);
    assert.equal(r.totalCost, 50000);
    assert.equal(r.totalInterest, 0); // totalCost = down = MSRP, no interest
  });

  test('0% APR gives simple division', () => {
    const r = calculateMonthly(120000, 0, 0, 10);
    assert.equal(r.monthly, 1000); // 120000 / 120 months
    assert.equal(r.principal, 120000);
  });

  test('handles very short term (5 years)', () => {
    const r = calculateMonthly(68900, 10, 8, 5);
    assert.ok(r.monthly > 0, 'monthly should be positive');
    assert.equal(r.down, 6890);
    assert.equal(r.principal, 62010);
  });
});

// ---------------------------------------------------------------------------
// 2. renderFinancingTool — HTML output
// ---------------------------------------------------------------------------
describe('renderFinancingTool', () => {
  test('renders for a trailer with valid MSRP', () => {
    const t = trailers.find((t) => t.msrp > 0);
    const html = renderFinancingTool(t);
    assert.ok(html.includes('id="finance"'), 'has finance section id');
    assert.ok(html.includes('finance-down'), 'has down payment slider');
    assert.ok(html.includes('finance-apr'), 'has APR slider');
    assert.ok(html.includes('finance-term'), 'has term select');
    assert.ok(html.includes('finance-monthly'), 'has monthly output');
    assert.ok(html.includes('finance-data'), 'has data island');
    assert.ok(html.includes('per month'), 'has per-month label');
    assert.ok(html.includes('For planning purposes only'), 'has disclaimer');
  });

  test('returns empty for zero MSRP', () => {
    const html = renderFinancingTool({ msrp: 0, model: 'Test', floorplan: 'X' });
    assert.equal(html, '');
  });

  test('data island does not contain raw </ breakout', () => {
    for (const t of trailers) {
      const html = renderFinancingTool(t);
      if (!html) continue;
      const match = html.match(/<script type="application\/json" id="finance-data">([\s\S]*?)<\/script>/);
      if (match) {
        assert.ok(!match[1].includes('</'), `${t.slug} finance data island has un-neutralized </`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Finance section appears in full detail page
// ---------------------------------------------------------------------------
describe('detail page finance section', () => {
  test('every trailer with MSRP has the finance section', () => {
    for (const t of trailers) {
      if (!(t.msrp > 0)) continue;
      const html = renderDetail(t);
      assert.ok(html.includes('id="finance"'), `${t.slug} missing finance section`);
      assert.ok(html.includes('Estimated monthly payment'), `${t.slug} missing finance heading`);
    }
  });

  test('section nav includes Finance link', () => {
    const t = trailers.find((t) => t.msrp > 0);
    const html = renderDetail(t);
    assert.ok(html.includes('href="#finance"'), 'section nav has finance link');
  });
});

// ---------------------------------------------------------------------------
// 4. New sort options: ccc-desc and hitch-asc
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
// 5. Next steps section
// ---------------------------------------------------------------------------
describe('next-steps section', () => {
  test('every detail page has the next-steps section', () => {
    for (const t of trailers) {
      const html = renderDetail(t);
      assert.ok(html.includes('class="next-steps"'), `${t.slug} missing next-steps section`);
      assert.ok(html.includes('Find a dealer'), `${t.slug} missing dealer link`);
      assert.ok(html.includes('Build &amp; price'), `${t.slug} missing build-and-price link`);
      assert.ok(html.includes('Ready for the next step?'), `${t.slug} missing next-steps heading`);
    }
  });

  test('next-steps links are real external URLs', () => {
    const t = trailers[0];
    const html = renderDetail(t);
    assert.ok(html.includes('href="https://www.airstream.com/find-a-dealer/"'), 'dealer link URL');
    assert.ok(html.includes('href="https://www.airstream.com/build-your-own/"'), 'build link URL');
    assert.ok(html.includes('target="_blank"'), 'links open in new tab');
    assert.ok(html.includes('rel="noopener"'), 'links have noopener');
  });

  test('next-steps includes official model link when available', () => {
    // Flying Cloud should have an official URL
    const fc = trailers.find((t) => t.model === 'Flying Cloud');
    if (fc) {
      const html = renderDetail(fc);
      assert.ok(html.includes('Official Flying Cloud page'), 'has official model link');
    }
  });
});
