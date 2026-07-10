// Tests for tow class badges, weight range on family cards, and water autonomy.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { towClass, waterAutonomy, groupByFamily, loadTrailers } from '../src/lib/data.mjs';
import { formatWeightRange } from '../src/lib/format.mjs';
import { renderFamilyCard, renderExploreCard } from '../src/lib/render.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('towClass', () => {
  it('classifies half-ton (GVWR ≤ 7500)', () => {
    const tc = towClass(5000);
    assert.equal(tc.cls, 'half-ton');
    assert.equal(tc.label, 'Half-ton towable');
  });

  it('classifies at the 7500 boundary as half-ton', () => {
    assert.equal(towClass(7500).cls, 'half-ton');
  });

  it('classifies three-quarter ton (7500 < GVWR ≤ 10000)', () => {
    const tc = towClass(8800);
    assert.equal(tc.cls, 'three-quarter');
    assert.equal(tc.label, '¾-ton required');
  });

  it('classifies at the 10000 boundary as three-quarter', () => {
    assert.equal(towClass(10000).cls, 'three-quarter');
  });

  it('classifies one-ton (GVWR > 10000)', () => {
    const tc = towClass(12000);
    assert.equal(tc.cls, 'one-ton');
    assert.equal(tc.label, '1-ton required');
  });
});

describe('waterAutonomy', () => {
  it('computes days for 2 people at 3 gal/person/day', () => {
    // 53 gal / (3 * 2) = 8.833... → 8.8
    assert.equal(waterAutonomy(53, 2), 8.8);
  });

  it('computes days for Basecamp 16X (21 gal)', () => {
    assert.equal(waterAutonomy(21, 2), 3.5);
  });

  it('computes days for Bambi 16RB (23 gal)', () => {
    const days = waterAutonomy(23, 2);
    assert.equal(days, 3.8);
  });

  it('returns null for missing freshGal', () => {
    assert.equal(waterAutonomy(null), null);
    assert.equal(waterAutonomy(0), null);
    assert.equal(waterAutonomy(undefined), null);
  });

  it('handles 1 person', () => {
    // 21 gal / (3 * 1) = 7
    assert.equal(waterAutonomy(21, 1), 7);
  });
});

describe('formatWeightRange', () => {
  it('formats a range with comma-separated thousands', () => {
    const r = formatWeightRange(2650, 8425);
    assert.match(r, /2,650/);
    assert.match(r, /8,425/);
    assert.match(r, /–/);
  });

  it('collapses equal min/max', () => {
    const r = formatWeightRange(5000, 5000);
    assert.match(r, /5,000/);
    assert.ok(!r.includes('–'), 'should not contain dash for equal values');
  });

  it('returns dash for null', () => {
    assert.equal(formatWeightRange(null, null), '—');
  });
});

describe('groupByFamily includes weight + GVWR aggregation', () => {
  const trailers = loadTrailers();
  const families = groupByFamily(trailers);

  it('every family has weightMin, weightMax, gvwrMax', () => {
    for (const fam of families) {
      assert.ok(fam.weightMin > 0, `${fam.family} weightMin > 0`);
      assert.ok(fam.weightMax >= fam.weightMin, `${fam.family} weightMax >= weightMin`);
      assert.ok(fam.gvwrMax > 0, `${fam.family} gvwrMax > 0`);
    }
  });
});

describe('rendered family card contains tow badge + weight', () => {
  const trailers = loadTrailers();
  const families = groupByFamily(trailers);
  const classic = families.find((f) => f.family === 'Classic');

  it('family card contains tow-badge', () => {
    const html = renderFamilyCard(classic);
    assert.match(html, /tow-badge/);
    assert.match(html, /tow-badge--three-quarter/);
  });

  it('family card contains dry weight spec', () => {
    const html = renderFamilyCard(classic);
    assert.match(html, /Dry weight/);
  });
});

describe('rendered explore card contains tow badge', () => {
  const trailers = loadTrailers();
  const bambi = trailers.find((t) => t.slug === 'bambi-16rb-2026');

  it('explore card has xcard-tow badge', () => {
    const html = renderExploreCard(bambi);
    assert.match(html, /xcard-tow/);
    assert.match(html, /tow-badge/);
  });

  it('Bambi 16RB (GVWR 3500) is half-ton', () => {
    const html = renderExploreCard(bambi);
    assert.match(html, /half-ton/);
  });
});

describe('built detail pages have water days key-stat', () => {
  it('Classic 33FB has ~8.8 water days', () => {
    const html = readFileSync(join(__dirname, '..', 'dist', 'm', 'classic-33fb-2026.html'), 'utf8');
    assert.match(html, /~8\.8/);
    assert.match(html, /Water days/);
  });

  it('Basecamp 16X has ~3.5 water days', () => {
    const html = readFileSync(join(__dirname, '..', 'dist', 'm', 'basecamp-16x-2026.html'), 'utf8');
    assert.match(html, /~3\.5/);
    assert.match(html, /Water days/);
  });
});

describe('built explore page has tow badges', () => {
  it('index.html has both half-ton and three-quarter badges', () => {
    const html = readFileSync(join(__dirname, '..', 'dist', 'index.html'), 'utf8');
    assert.match(html, /tow-badge--half-ton/);
    assert.match(html, /tow-badge--three-quarter/);
  });

  it('index.html family cards have dry weight', () => {
    const html = readFileSync(join(__dirname, '..', 'dist', 'index.html'), 'utf8');
    const weightRows = (html.match(/Dry weight<\/dt>/g) || []).length;
    assert.ok(weightRows >= 12, `expected ≥12 dry weight rows on family cards, got ${weightRows}`);
  });
});
