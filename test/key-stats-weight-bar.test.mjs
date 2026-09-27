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
  const html = renderDetail(t, resolve, null, trailers);

  it('renders key-stats container on trailer detail', () => {
    assert.ok(html.includes('class="key-stats"'));
  });

  it('shows length, weight, sleeps, price stats (redesign 2026-09-27: exactly 4)', () => {
    assert.ok(html.includes('key-stat-label">Length</span>'));
    assert.ok(html.includes('key-stat-label">Dry weight</span>'));
    assert.ok(html.includes('key-stat-label">Sleeps</span>'));
    assert.ok(html.includes('key-stat-label">Base MSRP</span>'));
    assert.ok(!html.includes('key-stat-label">Off-grid</span>'), 'no Off-grid stat');
  });

  it('shows correct values for Classic 33FB', () => {
    assert.ok(html.includes('8,425 lb'));  // dry weight
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
  const html = renderDetail(t, resolve, null, trailers);

  it('no weight-bar on trailer detail (redesign 2026-09-27: removed)', () => {
    assert.ok(!html.includes('class="weight-bar"'), 'weight bar removed from trailer detail');
  });

  it('spec lede carries dry weight, GVWR and CCC (redesign 2026-09-27)', () => {
    // Classic 33FB: 8425 dry / 10000 GVWR / 1575 CCC
    assert.ok(html.includes('8,425 lb'), 'dry weight in spec lede');
    assert.ok(html.includes('10,000 lb'), 'GVWR in spec lede');
    assert.ok(html.includes('1,575 lb'), 'CCC in spec lede');
    assert.ok(html.includes('Cargo capacity'), 'CCC label in spec lede');
  });

  it('key stats are exactly four: Length, Dry weight, Sleeps, Base MSRP (redesign 2026-09-27)', () => {
    const stats = html.match(/class="key-stat-label"/g) || [];
    assert.strictEqual(stats.length, 4, `expected 4 key stats, got ${stats.length}`);
    assert.ok(html.includes('>Length<'), 'Length stat present');
    assert.ok(html.includes('>Dry weight<'), 'Dry weight stat present');
    assert.ok(html.includes('>Sleeps<'), 'Sleeps stat present');
    assert.ok(html.includes('>Base MSRP<'), 'Base MSRP stat present');
  });

  it('key stats exclude Off-grid and Water days (redesign 2026-09-27)', () => {
    // Extract just the key-stats div content
    const start = html.indexOf('<div class="key-stats"');
    const end = html.indexOf('</div></div>', start);
    const keyStatsHtml = html.slice(start, end);
    assert.ok(!keyStatsHtml.includes('>Off-grid<'), 'no Off-grid in key stats');
    assert.ok(!keyStatsHtml.includes('Water days'), 'no Water days in key stats');
  });

  it('spec lede GVWR has explanatory title attribute (redesign 2026-09-27)', () => {
    assert.ok(html.includes('title="Gross Vehicle Weight Rating'), 'GVWR title explains the term');
  });

  it('renders weight-bar on motorhome detail with NCC label', () => {
    const m = motorhomes[0];
    const mhtml = renderMotorhomeDetail(m, mResolve, motorhomes);
    assert.ok(mhtml.includes('class="weight-bar"'));
    assert.ok(mhtml.includes('Net carrying capacity (NCC)'));
  });

  it('omits weight bar when data is missing', () => {
    const noWeight = { ...t, weightLb: 0, gvwrLb: 0 };
    const html2 = renderDetail(noWeight, resolve, null, trailers);
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
