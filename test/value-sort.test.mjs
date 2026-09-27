// Tests for the explore $/lb ("Best value") sort option.
// Resale projector + trip-cost estimator were removed per ruling 1A
// (2026-06-13, reaffirmed 2026-09-27); regression lock: no-finance.test.mjs.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderIndex } from '../src/lib/render.mjs';
import { SORT_KEYS, sortTrailers } from '../src/lib/explore.mjs';
import { loadTrailers, groupByFamily } from '../src/lib/data.mjs';

const trailers = loadTrailers();
const families = groupByFamily(trailers);

describe('explore sort: $/lb', () => {
  it('SORT_KEYS includes value-lb-asc', () => {
    assert.ok(SORT_KEYS['value-lb-asc']);
    assert.equal(SORT_KEYS['value-lb-asc'].label, 'Best value ($/lb)');
  });

  it('sorts trailers by $/lb ascending', () => {
    const sorted = sortTrailers(trailers, 'value-lb-asc');
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      const valA = a.weightLb > 0 ? a.msrp / a.weightLb : Infinity;
      const valB = b.weightLb > 0 ? b.msrp / b.weightLb : Infinity;
      if (valA === valB) continue;
      assert.ok(valA < valB, `${a.slug} < ${b.slug}`);
    }
  });

  it('$/lb option in explore page', () => {
    const html = renderIndex(families, trailers);
    assert.ok(html.includes('value="value-lb-asc"'));
    assert.ok(html.includes('Best value ($/lb)'));
  });
});
