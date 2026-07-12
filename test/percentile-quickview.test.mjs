// Tests for percentile rankings, quick-view modal, and animated key stats
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePercentiles, percentileLabel, loadTrailers } from '../src/lib/data.mjs';
import { renderExploreCard, renderDetail } from '../src/lib/render.mjs';

const trailers = loadTrailers();
const t2026 = trailers.filter((t) => t.year === 2026);

describe('computePercentiles', () => {
  it('returns a Map with entries for each trailer', () => {
    const pctMap = computePercentiles(trailers);
    assert.ok(pctMap instanceof Map);
    // Every 2026 trailer should have an entry (2026 has 31 models, well above minimum 3)
    for (const t of t2026) {
      assert.ok(pctMap.has(t.slug), `missing percentile for ${t.slug}`);
    }
  });

  it('ranks the lightest trailer at top percentile for weightLb', () => {
    const pctMap = computePercentiles(trailers);
    const lightest = [...t2026].sort((a, b) => a.weightLb - b.weightLb)[0];
    const r = pctMap.get(lightest.slug);
    assert.ok(r, `no rankings for lightest trailer ${lightest.slug}`);
    assert.ok(r.weightLb, `no weightLb ranking for ${lightest.slug}`);
    assert.equal(r.weightLb.pct, 100, 'lightest should be 100th percentile');
    assert.equal(r.weightLb.dir, 'lower');
  });

  it('ranks the most expensive trailer at 0 percentile for msrp', () => {
    const pctMap = computePercentiles(trailers);
    const priciest = [...t2026].sort((a, b) => b.msrp - a.msrp)[0];
    const r = pctMap.get(priciest.slug);
    assert.ok(r.msrp, `no msrp ranking for ${priciest.slug}`);
    assert.equal(r.msrp.pct, 0, 'most expensive should be 0th percentile (lower is better)');
  });

  it('ranks the best off-grid at top percentile', () => {
    const pctMap = computePercentiles(trailers);
    const withOG = t2026.filter((t) => t.offGridScore > 0);
    const bestOG = [...withOG].sort((a, b) => b.offGridScore - a.offGridScore)[0];
    const r = pctMap.get(bestOG.slug);
    assert.ok(r.offGridScore, `no offGridScore ranking for ${bestOG.slug}`);
    assert.ok(r.offGridScore.pct >= 90, `best off-grid should be top 10% (got ${r.offGridScore.pct})`);
    assert.equal(r.offGridScore.dir, 'higher');
  });

  it('percentile values are 0–100', () => {
    const pctMap = computePercentiles(trailers);
    for (const [slug, rankings] of pctMap) {
      if (!rankings) continue;
      for (const [field, data] of Object.entries(rankings)) {
        assert.ok(data.pct >= 0 && data.pct <= 100, `${slug}.${field}.pct=${data.pct} out of range`);
      }
    }
  });
});

describe('percentileLabel', () => {
  it('returns null for mediocre rankings (below 70)', () => {
    assert.equal(percentileLabel('weightLb', { pct: 50, dir: 'lower' }), null);
    assert.equal(percentileLabel('msrp', { pct: 69, dir: 'lower' }), null);
  });

  it('returns a label for top 30%', () => {
    const label = percentileLabel('weightLb', { pct: 75, dir: 'lower' });
    assert.ok(label);
    assert.ok(label.includes('Top 30%'));
    assert.ok(label.includes('lighter'));
  });

  it('returns a label for top 10%', () => {
    const label = percentileLabel('offGridScore', { pct: 95, dir: 'higher' });
    assert.ok(label);
    assert.ok(label.includes('Top 10%'));
    assert.ok(label.includes('off-grid'));
  });

  it('returns null for null/undefined input', () => {
    assert.equal(percentileLabel('weightLb', null), null);
    assert.equal(percentileLabel('weightLb', undefined), null);
  });
});

describe('renderDetail percentile indicators', () => {
  it('renders spec-pct elements for notable rankings', () => {
    // The lightest 2026 trailer should definitely get a percentile badge
    const lightest = [...t2026].sort((a, b) => a.weightLb - b.weightLb)[0];
    const html = renderDetail(lightest, undefined, null, trailers);
    assert.ok(html.includes('spec-pct'), `detail page for ${lightest.slug} should have percentile indicators`);
    assert.ok(html.includes('spec-pct-bar'), 'should have visual bar');
    assert.ok(html.includes('spec-pct-text'), 'should have text label');
  });

  it('percentile tiers use correct CSS classes', () => {
    // Check that the CSS class tiers exist in the rendered output
    const lightest = [...t2026].sort((a, b) => a.weightLb - b.weightLb)[0];
    const html = renderDetail(lightest, undefined, null, trailers);
    // Lightest trailer should have top10 badges
    assert.ok(html.includes('spec-pct--top10'), 'lightest trailer should get top10 badges');
  });
});

describe('explore card quick-view', () => {
  it('renders a data-peek button on each card', () => {
    for (const t of t2026.slice(0, 5)) {
      const html = renderExploreCard(t);
      assert.ok(html.includes('data-peek'), `card for ${t.slug} should have peek button`);
      assert.ok(html.includes('xcard-peek'), `card for ${t.slug} should have peek class`);
    }
  });

  it('card carries data attributes for quick-view population', () => {
    const t = t2026[0];
    const html = renderExploreCard(t);
    assert.ok(html.includes('data-ccc='), 'card should have CCC data attribute');
    assert.ok(html.includes('data-fresh='), 'card should have fresh tank data attribute');
    assert.ok(html.includes('data-desc='), 'card should have description data attribute');
    assert.ok(html.includes('data-thumb='), 'card should have thumbnail data attribute');
  });

  it('quick-view modal markup is in the page shell', () => {
    const t = t2026[0];
    const html = renderDetail(t, undefined, null, trailers);
    assert.ok(html.includes('id="quick-view"'), 'page should have quick-view modal');
    assert.ok(html.includes('qv-panel'), 'page should have quick-view panel');
    assert.ok(html.includes('qv-specs'), 'page should have quick-view specs container');
  });
});

describe('key-stats markup for animation', () => {
  it('key-stats are present with value elements on detail pages', () => {
    const t = t2026[0];
    const html = renderDetail(t, undefined, null, trailers);
    assert.ok(html.includes('key-stat-value'), 'detail should have key-stat-value elements');
    assert.ok(html.includes('key-stats'), 'detail should have key-stats container');
  });
});
