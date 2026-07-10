import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTrailers, groupByFamily, assetPaths } from '../src/lib/data.mjs';
import { renderExploreCard, renderDetail } from '../src/lib/render.mjs';

const trailers = loadTrailers();
const families = groupByFamily(trailers);

// ---------------------------------------------------------------------------
// 1. Explore card lifestyle tag pills
// ---------------------------------------------------------------------------
describe('explore card lifestyle tag pills', () => {
  it('renders tag pills for trailers with tags', () => {
    const tagged = trailers.find((t) => t.tags && t.tags.length > 0);
    assert.ok(tagged, 'at least one trailer has tags');
    const html = renderExploreCard(tagged, assetPaths);
    assert.ok(html.includes('xcard-tags'), 'should have xcard-tags container');
    for (const tag of tagged.tags) {
      assert.ok(
        html.includes(`xcard-tag--${tag}`),
        `should have pill for tag "${tag}"`,
      );
    }
  });

  it('does not render tag container when tags are empty', () => {
    const stub = { ...trailers[0], tags: [], slug: 'test-no-tags', model: 'Test', floorplan: '00', year: 2026 };
    const html = renderExploreCard(stub, assetPaths);
    assert.ok(!html.includes('xcard-tags'), 'should not have xcard-tags when empty');
  });

  it('every real trailer has at least one tag pill', () => {
    for (const t of trailers) {
      if (!t.tags || t.tags.length === 0) continue;
      const html = renderExploreCard(t, assetPaths);
      assert.ok(html.includes('xcard-tags'), `${t.slug} should show tag pills`);
    }
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
  it('renders 4 season cards on every detail page', () => {
    for (const t of trailers.slice(0, 5)) {
      const html = renderDetail(t, assetPaths, null, null, trailers);
      assert.ok(html.includes('seasonal-guide'), `${t.slug} should have seasonal guide`);
      assert.ok(html.includes('id="seasonal"'), `${t.slug} should have #seasonal anchor`);
      // 4 seasons
      const cardCount = (html.match(/season-card/g) || []).length;
      assert.equal(cardCount, 4, `${t.slug} should have 4 season cards`);
    }
  });

  it('shows season names: Spring, Summer, Fall, Winter', () => {
    const html = renderDetail(trailers[0], assetPaths, null, null, trailers);
    for (const name of ['Spring', 'Summer', 'Fall', 'Winter']) {
      assert.ok(html.includes(name), `should mention ${name}`);
    }
  });

  it('has season dots for scoring (1-5 scale)', () => {
    const html = renderDetail(trailers[0], assetPaths, null, null, trailers);
    // Each season has 5 dots. The dots use class="season-dot" or "season-dot season-dot--filled".
    // The container uses "season-dots" (plural) — exclude it.
    const allDotClasses = (html.match(/class="season-dot(?:\s|")/g) || []).length;
    const filledDots = (html.match(/season-dot--filled/g) || []).length;
    assert.equal(allDotClasses, 20, 'should have 20 total dots (4 seasons × 5)');
    assert.ok(filledDots >= 4 && filledDots <= 20, 'filled dots should be between 4 and 20');
  });

  it('includes seasonal guide in section nav', () => {
    const html = renderDetail(trailers[0], assetPaths, null, null, trailers);
    assert.ok(html.includes('#seasonal'), 'section nav should link to #seasonal');
    assert.ok(html.includes('Seasons'), 'section nav should label it "Seasons"');
  });

  it('uses real spec values in tips', () => {
    const t = trailers.find((tr) => tr.solarW >= 200 && tr.freshGal >= 30);
    assert.ok(t, 'need a trailer with solar >= 200 and fresh >= 30');
    const html = renderDetail(t, assetPaths, null, null, trailers);
    assert.ok(
      html.includes(`${t.solarW}W solar`),
      `should reference actual solar wattage ${t.solarW}W`,
    );
    assert.ok(
      html.includes(`${t.freshGal}-gal fresh`),
      `should reference actual fresh tank ${t.freshGal} gal`,
    );
  });
});
