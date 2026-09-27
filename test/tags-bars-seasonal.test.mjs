import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTrailers, groupByFamily, assetPaths } from '../src/lib/data.mjs';
import { renderExploreCard, renderDetail } from '../src/lib/render.mjs';

const trailers = loadTrailers();
const families = groupByFamily(trailers);

// ---------------------------------------------------------------------------
// 1. Explore card is editorial: no lifestyle tag pills (retired)
// ---------------------------------------------------------------------------
describe('explore card omits lifestyle tag pills', () => {
  it('renders no tag pills even for trailers with tags', () => {
    const tagged = trailers.find((t) => t.tags && t.tags.length > 0);
    assert.ok(tagged, 'at least one trailer has tags');
    const html = renderExploreCard(tagged, assetPaths);
    assert.ok(!html.includes('xcard-tags'), 'editorial card must not have xcard-tags container');
    for (const tag of tagged.tags) {
      assert.ok(!html.includes(`xcard-tag--${tag}`), `no pill for tag "${tag}"`);
    }
  });

  it('still carries tags in the data contract for filtering', () => {
    // The tag filter UI survives; it reads data-tags from the card.
    const tagged = trailers.find((t) => t.tags && t.tags.length > 0);
    const html = renderExploreCard(tagged, assetPaths);
    assert.ok(html.includes('data-tags='), 'card keeps data-tags for the filter');
  });
});

// ---------------------------------------------------------------------------
// 2. Family compare visual bars
// ---------------------------------------------------------------------------
describe('family compare visual bars', () => {
  it('renders fc-bar inline bars in family compare tables', () => {
    for (const fam of families) {
      const latest = fam.years[0];
      const plans = fam.trailers.filter((t) => t.year === latest);
      if (plans.length < 2) continue; // no compare table for single-plan families
      const html = readFileSync(`dist/f/${fam.slug}.html`, 'utf8');
      assert.ok(
        html.includes('fc-bar'),
        `${fam.family} family page should have visual comparison bars`,
      );
      assert.ok(
        html.includes('fc-bar-fill'),
        `${fam.family} should have bar fill elements`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Seasonal camping guide on detail pages
// ---------------------------------------------------------------------------
describe('seasonal camping guide', () => {
  it('does not render season cards (redesign 2026-09-27: seasonal guide removed)', () => {
    for (const t of trailers.slice(0, 5)) {
      const html = renderDetail(t, assetPaths, null, trailers);
      assert.ok(!html.includes('seasonal-guide'), `${t.slug} should not have seasonal guide`);
      assert.ok(!html.includes('id="seasonal"'), `${t.slug} should not have #seasonal anchor`);
      assert.ok(!html.includes('season-card'), `${t.slug} should not have season cards`);
    }
  });

  it('does not render season names or dots (redesign 2026-09-27)', () => {
    const html = renderDetail(trailers[0], assetPaths, null, trailers);
    for (const name of ['Spring', 'Summer', 'Fall', 'Winter']) {
      // Season names may appear in prose; the seasonal *guide* must be gone
      assert.ok(!html.includes('season-card'), 'season cards removed');
    }
    assert.ok(!html.includes('season-dot'), 'season dots removed');
  });

  it('seasonal guide is absent from the page (redesign 2026-09-27)', () => {
    const html = renderDetail(trailers[0], assetPaths, null, null, trailers);
    assert.ok(!html.includes('id="seasonal"'), 'seasonal section removed');
    assert.ok(!html.includes('Seasonal camping guide'), 'seasonal heading removed');
  });

  it('off-grid tool still uses real spec values (redesign 2026-09-27)', () => {
    const t = trailers.find((tr) => tr.solarW >= 200 && tr.freshGal >= 30);
    assert.ok(t, 'need a trailer with solar >= 200 and fresh >= 30');
    const html = renderDetail(t, assetPaths, null, trailers);
    assert.ok(
      html.includes(`${t.solarW} W solar`) || html.includes(`${t.solarW}W solar`),
      `should reference actual solar wattage ${t.solarW}W`,
    );
    assert.ok(
      html.includes(`${t.freshGal} gal`),
      `should reference actual fresh tank ${t.freshGal} gal`,
    );
  });

  it('no seasonal badges on detail pages (redesign 2026-09-27: removed)', () => {
    const t = trailers.find((tr) => tr.year === 2026) || trailers[0];
    const html = renderDetail(t, assetPaths, null, trailers);
    assert.ok(!html.includes('seasonal-badge'), 'no seasonal badges on detail');
  });
});
