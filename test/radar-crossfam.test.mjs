// Tests for the spec radar chart and cross-family recommendations
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDetail } from '../src/lib/render.mjs';
import { loadTrailers, assetPaths } from '../src/lib/data.mjs';

const trailers = loadTrailers();
const t2026 = trailers.filter((t) => t.year === 2026);

test('detail page contains a radar chart SVG with 6 axes', () => {
  const t = t2026.find((t) => t.slug === 'classic-33fb-2026');
  const html = renderDetail(t, assetPaths, null, trailers);
  assert.ok(html.includes('radar-chart'), 'radar-chart wrapper present');
  assert.ok(html.includes('radar-svg'), 'radar SVG present');
  // 6 axis labels
  const labelMatches = html.match(/radar-label/g);
  assert.ok(labelMatches && labelMatches.length >= 6, `has 6 radar labels, got ${labelMatches?.length}`);
  // 6 data dots
  const dotMatches = html.match(/radar-dot/g);
  assert.ok(dotMatches && dotMatches.length >= 6, `has 6 radar dots, got ${dotMatches?.length}`);
  // 3 concentric rings
  const ringMatches = html.match(/radar-ring/g);
  assert.ok(ringMatches && ringMatches.length === 3, `has 3 radar rings, got ${ringMatches?.length}`);
  // Polygon data fill and stroke
  assert.ok(html.includes('radar-fill'), 'has radar fill polygon');
  assert.ok(html.includes('radar-stroke'), 'has radar stroke polygon');
});

test('radar chart labels include expected axis names', () => {
  const t = t2026.find((t) => t.slug === 'bambi-16rb-2026');
  const html = renderDetail(t, assetPaths, null, trailers);
  const expectedLabels = ['Off-grid', 'Cargo', 'Sleeps', 'Compact', 'Light', 'Value'];
  for (const label of expectedLabels) {
    assert.ok(html.includes(`>${label}<`), `radar has axis label "${label}"`);
  }
});

test('detail page contains detail-overview wrapper with desc + radar', () => {
  const t = t2026.find((t) => t.slug === 'flying-cloud-25fb-2026');
  const html = renderDetail(t, assetPaths, null, trailers);
  assert.ok(html.includes('detail-overview'), 'detail-overview wrapper present');
  // desc and radar are siblings inside the wrapper
  const overviewIdx = html.indexOf('detail-overview');
  const descIdx = html.indexOf('detail-desc', overviewIdx);
  const radarIdx = html.indexOf('radar-chart', overviewIdx);
  assert.ok(descIdx > overviewIdx, 'desc inside overview');
  assert.ok(radarIdx > overviewIdx, 'radar inside overview');
});

test('cross-family section shows recommendations from OTHER families', () => {
  const t = t2026.find((t) => t.slug === 'classic-33fb-2026');
  const html = renderDetail(t, assetPaths, null, trailers);
  assert.ok(html.includes('cross-family'), 'cross-family section present');
  assert.ok(html.includes('You might also like'), 'heading present');
  // Should have at least 2 recommendation cards
  const cardCount = (html.match(/xfam-card/g) || []).length;
  assert.ok(cardCount >= 2, `at least 2 cross-family cards, got ${cardCount}`);
  // None should be from the same family (Classic)
  const titleMatches = html.match(/xfam-title">([^<]+)/g) || [];
  for (const m of titleMatches) {
    assert.ok(!m.includes('Classic'), `cross-family card should not be same family Classic, found: ${m}`);
  }
});

test('cross-family shows only one floorplan per family (deduplication)', () => {
  const t = t2026.find((t) => t.slug === 'basecamp-16x-2026');
  const html = renderDetail(t, assetPaths, null, trailers);
  const titleMatches = html.match(/xfam-title">([^<]+)/g) || [];
  // Extract model names (before the <span>)
  const models = titleMatches.map((m) => m.replace('xfam-title">', '').split(' <')[0].trim());
  const unique = new Set(models);
  assert.equal(models.length, unique.size, 'each recommended family appears only once');
});

test('small trailer gets similar small cross-family picks', () => {
  const t = t2026.find((t) => t.slug === 'bambi-16rb-2026');
  const html = renderDetail(t, assetPaths, null, trailers);
  // Should recommend other small trailers, not 33ft flagships
  const xfamSection = html.slice(html.indexOf('cross-family'));
  // At least one recommendation should be a compact trailer
  assert.ok(
    xfamSection.includes('Basecamp') || xfamSection.includes('Caravel'),
    'small trailer gets recommended other small models'
  );
});

test('cross-family cards have xfam-traits badges for similar specs', () => {
  const t = t2026.find((t) => t.slug === 'flying-cloud-25fb-2026');
  const html = renderDetail(t, assetPaths, null, trailers);
  // At least some cards should have trait badges (Similar weight, Similar price, etc.)
  const traitCount = (html.match(/xfam-traits/g) || []).length;
  assert.ok(traitCount >= 1, `at least 1 card with trait badges, got ${traitCount}`);
});

test('all detail pages render without error', () => {
  for (const t of trailers) {
    // Should not throw
    const html = renderDetail(t, assetPaths, null, trailers);
    assert.ok(html.includes('radar-chart'), `${t.slug} has radar chart`);
  }
});

test('section nav has data-secnav attribute for scroll spy', () => {
  const t = t2026.find((t) => t.slug === 'classic-33fb-2026');
  const html = renderDetail(t, assetPaths, null, trailers);
  assert.ok(html.includes('data-secnav'), 'section nav has data-secnav');
  assert.ok(html.includes('secnav-link'), 'section nav has links');
});
