import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTrailers, computeFleetStandouts } from '../src/lib/data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Fleet-wide standout badges
// ---------------------------------------------------------------------------
describe('fleet-wide standout badges', () => {
  const trailers = loadTrailers();
  const standouts = computeFleetStandouts(trailers);

  it('returns a Map', () => {
    assert.ok(standouts instanceof Map);
  });

  it('awards at least 3 distinct badge types across the catalog', () => {
    const allBadges = new Set();
    for (const [, badges] of standouts) {
      for (const b of badges) allBadges.add(b.cls);
    }
    assert.ok(allBadges.size >= 3, `only ${allBadges.size} distinct badge types`);
  });

  it('each badge has label, icon, and cls', () => {
    for (const [, badges] of standouts) {
      for (const b of badges) {
        assert.ok(b.label, 'missing label');
        assert.ok(b.icon, 'missing icon');
        assert.ok(b.cls, 'missing cls');
      }
    }
  });

  it('no slug gets more than 3 badges (sanity check)', () => {
    for (const [slug, badges] of standouts) {
      assert.ok(badges.length <= 3, `${slug} has ${badges.length} badges`);
    }
  });

  it('badges are mutually exclusive per dimension within a year', () => {
    const byYear = new Map();
    for (const t of trailers) {
      if (!byYear.has(t.year)) byYear.set(t.year, []);
      const badges = standouts.get(t.slug) || [];
      byYear.get(t.year).push(...badges.map((b) => ({ slug: t.slug, ...b })));
    }
    for (const [year, badges] of byYear) {
      const clsCounts = {};
      for (const b of badges) {
        clsCounts[b.cls] = (clsCounts[b.cls] || 0) + 1;
        assert.ok(clsCounts[b.cls] <= 1, `${b.cls} awarded twice in ${year}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Fleet badges render in explore cards
// ---------------------------------------------------------------------------
describe('fleet badges in explore HTML', () => {
  const indexHtml = readFileSync(join(root, 'dist/index.html'), 'utf8');

  it('explore page contains fleet-badge elements', () => {
    assert.ok(indexHtml.includes('fleet-badge'), 'no fleet-badge found in index.html');
  });

  it('fleet badges have correct class structure', () => {
    const matches = indexHtml.match(/fleet-badge--fleet-[a-z]+/g) || [];
    assert.ok(matches.length >= 4, `only ${matches.length} fleet badge class matches`);
  });

  it('fleet badges are inside xcard-fleet-badges container', () => {
    assert.ok(indexHtml.includes('xcard-fleet-badges'), 'missing xcard-fleet-badges container');
  });
});

// ---------------------------------------------------------------------------
// Gallery slideshow button
// ---------------------------------------------------------------------------
describe('gallery slideshow autoplay', () => {
  const detailHtml = readFileSync(join(root, 'dist/m/classic-33fb-2026.html'), 'utf8');

  it('detail page has gallery-autoplay button', () => {
    assert.ok(detailHtml.includes('gallery-autoplay'), 'missing gallery-autoplay button');
  });

  it('gallery section has gallery-head wrapper', () => {
    assert.ok(detailHtml.includes('gallery-head'), 'missing gallery-head wrapper');
  });

  it('app.js contains gallerySlideshow IIFE', () => {
    const appJs = readFileSync(join(root, 'src/assets/js/app.js'), 'utf8');
    assert.ok(appJs.includes('gallerySlideshow'), 'missing gallerySlideshow in app.js');
  });
});

// ---------------------------------------------------------------------------
// Homepage hero counter animation
// ---------------------------------------------------------------------------
describe('homepage hero counter animation', () => {
  const indexHtml = readFileSync(join(root, 'dist/index.html'), 'utf8');

  it('hero text contains data-hero-num spans', () => {
    const matches = indexHtml.match(/data-hero-num/g) || [];
    assert.ok(matches.length >= 1, 'no data-hero-num found');
  });

  it('app.js contains heroCountUp IIFE', () => {
    const appJs = readFileSync(join(root, 'src/assets/js/app.js'), 'utf8');
    assert.ok(appJs.includes('heroCountUp'), 'missing heroCountUp in app.js');
  });
});

// ---------------------------------------------------------------------------
// CSS coverage
// ---------------------------------------------------------------------------
describe('new CSS rules exist', () => {
  const css = readFileSync(join(root, 'src/assets/css/site.css'), 'utf8');

  it('fleet-badge styles exist', () => {
    assert.ok(css.includes('.fleet-badge'), 'missing .fleet-badge CSS');
    assert.ok(css.includes('.fleet-badge--fleet-lightest'), 'missing lightest variant');
    assert.ok(css.includes('.fleet-badge--fleet-affordable'), 'missing affordable variant');
  });

  it('gallery-autoplay styles exist', () => {
    assert.ok(css.includes('.gallery-autoplay'), 'missing .gallery-autoplay CSS');
  });

  it('dark theme fleet badge styles exist', () => {
    assert.ok(css.includes('[data-theme="dark"] .fleet-badge'), 'missing dark theme fleet badge');
  });
});
