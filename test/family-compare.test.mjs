import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderFamily } from '../src/lib/render.mjs';
import { loadTrailers, groupByFamily, assetPaths } from '../src/lib/data.mjs';

const trailers = loadTrailers();
const families = groupByFamily(trailers);

describe('family page spec comparison table', () => {
  it('multi-floorplan families render a comparison table', () => {
    const multi = families.filter((f) => {
      const latest = f.years[0];
      return f.trailers.filter((t) => t.year === latest).length >= 2;
    });
    assert.ok(multi.length >= 5, `expected at least 5 multi-floorplan families, got ${multi.length}`);
    for (const fam of multi) {
      const html = renderFamily(fam, assetPaths);
      assert.ok(html.includes('fam-compare'), `${fam.family} missing .fam-compare section`);
      assert.ok(html.includes('fc-table'), `${fam.family} missing .fc-table`);
      assert.ok(html.includes(`Compare ${fam.family} floorplans`), `${fam.family} missing heading`);
    }
  });

  it('single-floorplan families do NOT render a comparison table', () => {
    const single = families.filter((f) => {
      const latest = f.years[0];
      return f.trailers.filter((t) => t.year === latest).length < 2;
    });
    assert.ok(single.length >= 1, 'expected at least 1 single-floorplan family');
    for (const fam of single) {
      const html = renderFamily(fam, assetPaths);
      assert.ok(!html.includes('fam-compare'), `${fam.family} should NOT have .fam-compare`);
    }
  });

  it('comparison table has correct column headers', () => {
    const fam = families.find((f) => f.family === 'Flying Cloud');
    assert.ok(fam, 'Flying Cloud family must exist');
    const html = renderFamily(fam, assetPaths);
    for (const h of ['Floorplan', 'Length', 'Dry wt', 'GVWR', 'CCC', 'Sleeps', 'Off-grid', 'MSRP']) {
      assert.ok(html.includes('<th>' + h), 'missing header: ' + h);
    }
    assert.ok(html.includes('F/G/B gal'), 'missing tank sub-header');
  });

  it('comparison table links to detail pages', () => {
    const fam = families.find((f) => f.family === 'Bambi');
    assert.ok(fam, 'Bambi family must exist');
    const html = renderFamily(fam, assetPaths);
    const latest = fam.years[0];
    const plans = fam.trailers.filter((t) => t.year === latest);
    for (const t of plans) {
      assert.ok(html.includes('href="../m/' + t.slug + '.html"'), 'missing link for ' + t.slug);
    }
  });

  it('highlights best-in-family values with fc-best class', () => {
    const fam = families.find((f) => f.family === 'Classic');
    assert.ok(fam, 'Classic family must exist');
    const html = renderFamily(fam, assetPaths);
    assert.ok(html.includes('fc-best'), 'should highlight at least one best value');
  });

  it('comparison table is in section reveal targets', () => {
    const appJs = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(appJs.includes('.fam-compare'), 'app.js sectionReveal must observe .fam-compare');
  });
});

describe('lazy-load image fade-in', () => {
  it('site.css includes lazy-load fade-in rules', () => {
    const css = readFileSync('src/assets/css/site.css', 'utf8');
    assert.ok(css.includes('img[loading="lazy"]'), 'CSS must target lazy images');
    assert.ok(css.includes('.is-loaded'), 'CSS must define .is-loaded');
    assert.ok(css.includes('opacity'), 'CSS must animate opacity');
  });

  it('app.js includes lazyFade module', () => {
    const appJs = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(appJs.includes('lazyFade'), 'app.js must have lazyFade module');
    assert.ok(appJs.includes('is-loaded'), 'app.js must add is-loaded class');
  });

  it('respects prefers-reduced-motion for lazy fade', () => {
    const css = readFileSync('src/assets/css/site.css', 'utf8');
    assert.ok(
      css.includes('prefers-reduced-motion') && css.includes('img[loading="lazy"]'),
      'CSS must have reduced-motion override for lazy images',
    );
  });
});

describe('explore shareable filter URL', () => {
  it('app.js includes exploreShareUrl module', () => {
    const appJs = readFileSync('src/assets/js/app.js', 'utf8');
    assert.ok(appJs.includes('exploreShareUrl'), 'app.js must have exploreShareUrl module');
    assert.ok(appJs.includes('scheduleHashUpdate'), 'must schedule hash updates');
    assert.ok(appJs.includes('applyHashOnLoad'), 'must apply hash on load');
  });

  it('handles all explore filter parameters', () => {
    const appJs = readFileSync('src/assets/js/app.js', 'utf8');
    for (const key of ['sort', 'year', 'sleeps', 'tow', 'type', 'price', 'tags']) {
      assert.ok(appJs.includes("'" + key + "'"), 'must handle param: ' + key);
    }
  });
});
