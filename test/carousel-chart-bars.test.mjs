import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderExploreCard, renderExploreSections, esc } from '../src/lib/render.mjs';
import { loadTrailers, computeFleetRanges } from '../src/lib/data.mjs';

const trailers = loadTrailers();
const ranges = computeFleetRanges(trailers);
const t2026 = trailers.find((x) => x.year === 2026 && x.cccLb > 0 && x.offGridScore > 0 && x.freshGal > 0);

// =========================================================================
// Feature 1: Explore card range bars — CCC, off-grid, fresh tank
// =========================================================================
describe('explore card extended range bars', () => {
  it('renders CCC range bar when cccLb is present', () => {
    const html = renderExploreCard(t2026, undefined, false, ranges);
    assert.ok(html.includes('Cargo capacity'), 'should have CCC range bar aria label');
    assert.ok(html.includes('Cargo (CCC)'), 'should render CCC spec row');
  });

  it('renders off-grid score range bar', () => {
    const html = renderExploreCard(t2026, undefined, false, ranges);
    assert.ok(html.includes('Off-grid score'), 'should have off-grid range bar aria label');
    const offgridRow = html.includes('/100');
    assert.ok(offgridRow, 'should show off-grid score value');
  });

  it('renders fresh tank range bar', () => {
    const html = renderExploreCard(t2026, undefined, false, ranges);
    assert.ok(html.includes('Fresh water'), 'should have fresh water range bar aria label');
    assert.ok(html.includes('Fresh tank'), 'should render fresh tank spec row');
  });

  it('cards without CCC still render', () => {
    const noCcc = { ...t2026, cccLb: 0 };
    const html = renderExploreCard(noCcc, undefined, false, ranges);
    assert.ok(html.includes('xcard'), 'should render card');
  });
});

// =========================================================================
// Feature 2: Fleet scatter chart
// =========================================================================
describe('fleet scatter chart', () => {
  it('explore sections include the fleet chart', () => {
    const html = renderExploreSections(trailers);
    assert.ok(html.includes('fleet-chart'), 'should have fleet-chart element');
    assert.ok(html.includes('fleet-chart-svg'), 'should have SVG chart');
  });

  it('chart contains dots for trailers with valid price/weight', () => {
    const html = renderExploreSections(trailers);
    const dotCount = (html.match(/class="fc-dot"/g) || []).length;
    const validCount = trailers.filter((t) => t.msrp > 0 && t.weightLb > 0).length;
    assert.equal(dotCount, validCount, 'one dot per valid trailer');
  });

  it('chart dots carry data-slug for filter syncing', () => {
    const html = renderExploreSections(trailers);
    assert.ok(html.includes('data-slug='), 'dots should have data-slug');
  });

  it('chart is wrapped in a details/summary (collapsible)', () => {
    const html = renderExploreSections(trailers);
    assert.ok(html.includes('<details'), 'should use details element');
    assert.ok(html.includes('<summary'), 'should use summary element');
    assert.ok(html.includes('Fleet map'), 'should have toggle label');
  });

  it('chart has axis labels', () => {
    const html = renderExploreSections(trailers);
    assert.ok(html.includes('Base MSRP'), 'should have x-axis label');
    assert.ok(html.includes('Dry weight'), 'should have y-axis label');
  });

  it('chart dots link to detail pages', () => {
    const html = renderExploreSections(trailers);
    assert.ok(html.includes('fc-dot-link'), 'should have clickable dot links');
    assert.ok(html.includes('href="m/'), 'dots should link to m/ detail pages');
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
