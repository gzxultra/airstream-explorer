import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderDetail, renderExploreCard } from '../src/lib/render.mjs';
import { renderMotorhomeDetail, renderMotorhomeExploreCard } from '../src/lib/motorhome-render.mjs';
import { loadTrailers, resolveAssets } from '../src/lib/data.mjs';
import { loadMotorhomes, resolveMotorhomeAssets } from '../src/lib/motorhome-data.mjs';
import { existsSync } from 'node:fs';

const hasAsset = (p) => existsSync(`public/${p}`);
const resolve = (t) => resolveAssets(t, hasAsset);
const mResolve = (m) => resolveMotorhomeAssets(m, hasAsset);

const trailers = loadTrailers();
const motorhomes = loadMotorhomes();

// --- Key Stats Dashboard ---

describe('key stats dashboard', () => {
  const t = trailers.find((t) => t.slug === 'classic-33fb-2026');
  const html = renderDetail(t, resolve, null, null, trailers);

  it('renders key-stats container on trailer detail', () => {
    assert.ok(html.includes('class="key-stats"'));
  });

  it('shows length, weight, sleeps, price, off-grid stats', () => {
    assert.ok(html.includes('key-stat-label">Length</span>'));
    assert.ok(html.includes('key-stat-label">Dry weight</span>'));
    assert.ok(html.includes('key-stat-label">Sleeps</span>'));
    assert.ok(html.includes('key-stat-label">Base MSRP</span>'));
    assert.ok(html.includes('key-stat-label">Off-grid</span>'));
  });

  it('shows correct values for Classic 33FB', () => {
    assert.ok(html.includes('8,425 lb'));  // dry weight
    assert.ok(html.includes('65/100'));     // off-grid score
  });

  it('renders key-stats on motorhome detail', () => {
    const m = motorhomes[0];
    const mhtml = renderMotorhomeDetail(m, mResolve, motorhomes);
    assert.ok(mhtml.includes('class="key-stats"'));
    assert.ok(mhtml.includes('key-stat-label">Base MSRP</span>'));
  });
});

// --- Weight Capacity Bar ---

describe('weight capacity bar', () => {
  const t = trailers.find((t) => t.slug === 'classic-33fb-2026');
  const html = renderDetail(t, resolve, null, null, trailers);

  it('renders weight-bar on trailer detail', () => {
    assert.ok(html.includes('class="weight-bar"'));
  });

  it('shows correct dry weight and CCC segments', () => {
    // Classic 33FB: 8425 dry / 10000 GVWR = 84% dry
    assert.ok(html.includes('weight-bar-dry" style="width:84%"'));
    assert.ok(html.includes('weight-bar-ccc" style="width:16%"'));
  });

  it('shows correct weight values in segments', () => {
    assert.ok(html.includes('>8,425 lb<'));  // dry
    assert.ok(html.includes('>1,575 lb<'));  // CCC
  });

  it('shows GVWR in header', () => {
    assert.ok(html.includes('10,000 lb'));
  });

  it('has dry weight + cargo legend', () => {
    assert.ok(html.includes('weight-bar-legend-dry'));
    assert.ok(html.includes('weight-bar-legend-ccc'));
    assert.ok(html.includes('Cargo capacity (CCC)'));
  });

  it('renders weight-bar on motorhome detail with NCC label', () => {
    const m = motorhomes[0];
    const mhtml = renderMotorhomeDetail(m, mResolve, motorhomes);
    assert.ok(mhtml.includes('class="weight-bar"'));
    assert.ok(mhtml.includes('Net carrying capacity (NCC)'));
  });

  it('omits weight bar when data is missing', () => {
    const noWeight = { ...t, weightLb: 0, gvwrLb: 0 };
    const html2 = renderDetail(noWeight, resolve, null, null, trailers);
    assert.ok(!html2.includes('class="weight-bar"'));
  });
});

// --- Photo Count Badge on Explore Cards ---

describe('photo count badge on explore cards', () => {
  it('shows xcard-photos badge when gallery has images', () => {
    const t = trailers[0];
    const card = renderExploreCard(t, resolve);
    if (resolve(t).gallery.length > 0) {
      assert.ok(card.includes('xcard-photos'));
    }
  });

  it('shows correct photo count', () => {
    const t = trailers[0];
    const gLen = resolve(t).gallery.length;
    if (gLen > 0) {
      const card = renderExploreCard(t, resolve);
      assert.ok(card.includes(`> ${gLen}</span>`));
    }
  });

  it('shows xcard-photos badge on motorhome cards', () => {
    const m = motorhomes[0];
    const card = renderMotorhomeExploreCard(m, mResolve);
    if (mResolve(m).gallery.length > 0) {
      assert.ok(card.includes('xcard-photos'));
    }
  });
});
