// Tests for the spec radar chart and cross-family recommendations
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDetail } from '../src/lib/render.mjs';
import { loadTrailers, assetPaths } from '../src/lib/data.mjs';

const trailers = loadTrailers();
const t2026 = trailers.filter((t) => t.year === 2026);

test('detail page has no radar chart (redesign 2026-09-27: removed)', () => {
  const t = t2026.find((t) => t.slug === 'classic-33fb-2026');
  const html = renderDetail(t, assetPaths, null, trailers);
  assert.ok(!html.includes('radar-chart'), 'radar-chart removed');
  assert.ok(!html.includes('radar-svg'), 'radar SVG removed');
  assert.ok(!html.includes('radar-label'), 'radar labels removed');
});

test('no radar axis labels (redesign 2026-09-27: removed)', () => {
  const t = t2026.find((t) => t.slug === 'bambi-16rb-2026');
  const html = renderDetail(t, assetPaths, null, trailers);
  assert.ok(!html.includes('radar-chart'), 'no radar chart');
});

test('detail page contains detail-overview wrapper with desc + amenity summary (redesign 2026-09-27)', () => {
  const t = t2026.find((t) => t.slug === 'flying-cloud-25fb-2026');
  const html = renderDetail(t, assetPaths, null, trailers);
  assert.ok(html.includes('detail-overview'), 'detail-overview wrapper present');
  // desc and amenity summary are inside the wrapper; radar is gone
  const overviewIdx = html.indexOf('detail-overview');
  const descIdx = html.indexOf('detail-desc', overviewIdx);
  assert.ok(descIdx > overviewIdx, 'desc inside overview');
  assert.ok(!html.includes('radar-chart'), 'no radar in overview');
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
    assert.ok(html.includes('dsec-title'), `${t.slug} has section titles`);
  }
});

test('no section nav (redesign 2026-09-27: removed)', () => {
  const t = t2026.find((t) => t.slug === 'classic-33fb-2026');
  const html = renderDetail(t, assetPaths, null, trailers);
  assert.ok(!html.includes('data-secnav'), 'no data-secnav');
  assert.ok(!html.includes('secnav-link'), 'no secnav links');
});
