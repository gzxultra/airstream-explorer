import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadTrailers, groupByFamily } from '../src/lib/data.mjs';
import { renderWhatsNew2026, renderIndex, renderSaved } from '../src/lib/render.mjs';
import { SORT_KEYS, sortTrailers } from '../src/lib/explore.mjs';

const trailers = loadTrailers();
const families = groupByFamily(trailers);

// ---------------------------------------------------------------------------
// 1. What's New in 2026 section
// ---------------------------------------------------------------------------
describe('renderWhatsNew2026', () => {
  const html = renderWhatsNew2026(trailers);

  it('returns non-empty HTML for the current catalog', () => {
    assert.ok(html.length > 0, 'should produce HTML output');
  });

  it('contains the section wrapper with correct id', () => {
    assert.ok(html.includes('id="whats-new-2026"'), 'should have whats-new-2026 id');
    assert.ok(html.includes('wn26-section'), 'should have wn26-section class');
  });

  it('shows new-for-2026 models with links to detail pages', () => {
    // We know FLW LE 28RB, Stetson 27FB, and World Traveler 22RB are new for 2026
    assert.ok(html.includes('href="m/'), 'should contain links to detail pages');
    assert.ok(html.includes('New'), 'should show New badge for new models');
  });

  it('includes the section title', () => {
    assert.ok(html.includes("What's new in 2026") || html.includes("What&#39;s new in 2026"),
      'should include the section title');
  });

  it('includes summary chips', () => {
    assert.ok(html.includes('wn26-chip'), 'should render summary chips');
  });

  it('is present in the home page index output', () => {
    const indexHtml = renderIndex(families, trailers);
    assert.ok(indexHtml.includes('id="whats-new-2026"'), 'home page should include whats-new-2026 section');
  });
});

// ---------------------------------------------------------------------------
// 2. Year: newest first sort option
// ---------------------------------------------------------------------------
describe('SORT_KEYS year-desc', () => {
  it('includes year-desc key', () => {
    assert.ok('year-desc' in SORT_KEYS, 'SORT_KEYS should have year-desc');
  });

  it('has correct label', () => {
    assert.equal(SORT_KEYS['year-desc'].label, 'Year: newest first');
  });

  it('sorts 2026 before 2025', () => {
    const sorted = sortTrailers(trailers, 'year-desc');
    const firstYear = sorted[0].year;
    const lastYear = sorted[sorted.length - 1].year;
    assert.ok(firstYear >= lastYear, '2026 models should appear before 2025 models');
    assert.equal(firstYear, 2026, 'first model should be 2026');
  });
});

// ---------------------------------------------------------------------------
// 3. Saved page export button
// ---------------------------------------------------------------------------
describe('renderSaved export button', () => {
  const savedHtml = renderSaved(trailers);

  it('includes the export button', () => {
    assert.ok(savedHtml.includes('id="saved-export"'), 'should have saved-export button');
  });

  it('has correct button text', () => {
    assert.ok(savedHtml.includes('Export list'), 'should show Export list text');
  });

  it('uses share-btn class', () => {
    assert.ok(savedHtml.includes('class="share-btn" id="saved-export"'), 'should use share-btn styling class');
  });
});
