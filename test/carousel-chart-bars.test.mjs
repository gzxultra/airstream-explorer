import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderExploreCard, renderExploreSections, esc } from '../src/lib/render.mjs';
import { loadTrailers, computeFleetRanges } from '../src/lib/data.mjs';

const trailers = loadTrailers();
const ranges = computeFleetRanges(trailers);
const t2026 = trailers.find((x) => x.year === 2026 && x.cccLb > 0 && x.offGridScore > 0 && x.freshGal > 0);

// =========================================================================
// Feature 1: Explore cards are editorial — range bars retired
// =========================================================================
describe('explore card has no range bars (retired)', () => {
  it('renders no CCC range bar even when cccLb is present', () => {
    const html = renderExploreCard(t2026, undefined, false, ranges);
    assert.ok(!html.includes('Cargo (CCC)'), 'no CCC spec row on editorial card');
    assert.ok(!html.includes('range-bar'), 'no range bars on editorial card');
  });

  it('renders no off-grid / fresh-tank range bars', () => {
    const html = renderExploreCard(t2026, undefined, false, ranges);
    assert.ok(!html.includes('Off-grid score'), 'no off-grid bar on editorial card');
    assert.ok(!html.includes('Fresh tank'), 'no fresh tank row on editorial card');
  });

  it('cards without CCC still render', () => {
    const noCcc = { ...t2026, cccLb: 0 };
    const html = renderExploreCard(noCcc, undefined, false, ranges);
    assert.ok(html.includes('xcard'), 'should render card');
  });
});

// =========================================================================
// Feature 2: Fleet scatter chart retired from explore sections
// =========================================================================
describe('fleet scatter chart retired', () => {
  it('explore sections do not include the fleet chart', () => {
    const html = renderExploreSections(trailers);
    assert.ok(!html.includes('fleet-chart'), 'no fleet-chart element');
    assert.ok(!html.includes('fleet-chart-svg'), 'no SVG chart');
    assert.ok(!html.includes('fc-dot'), 'no chart dots');
  });
});

// =========================================================================
// Feature 3: Card carousel data attribute
// =========================================================================
describe('explore card carousel data', () => {
  it('cards embed data-gallery-urls for the carousel', () => {
    const html = renderExploreCard(t2026, undefined, false, ranges);
    assert.ok(html.includes('data-gallery-urls='), 'should have gallery URLs data attribute');
  });

  it('gallery URLs are pipe-separated', () => {
    const html = renderExploreCard(t2026, undefined, false, ranges);
    const m = html.match(/data-gallery-urls="([^"]*)"/);
    if (m && m[1]) {
      const urls = m[1].split('|').filter(Boolean);
      assert.ok(urls.length >= 1, 'should have at least 1 gallery URL');
      for (const url of urls) {
        assert.ok(url.includes('.'), 'each URL should be a file path');
      }
    }
  });
});
