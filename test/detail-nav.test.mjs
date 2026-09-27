// Tests for detail page section nav, back-to-top, related floorplans, and smooth scroll.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

// Helper: read a built detail page
function readDetail(slug) {
  return readFileSync(join(DIST, 'm', `${slug}.html`), 'utf8');
}
function readMotorhomeDetail(slug) {
  return readFileSync(join(DIST, 'mm', `${slug}.html`), 'utf8');
}

describe('back-to-top button', () => {
  it('trailer detail page has back-to-top button', () => {
    const html = readDetail('classic-33fb-2026');
    assert.ok(html.includes('id="back-to-top"'), 'back-to-top button missing');
    assert.ok(html.includes('class="back-to-top"'), 'back-to-top class missing');
    assert.ok(html.includes('aria-label="Back to top"'), 'back-to-top aria-label missing');
  });
  it('motorhome detail page has back-to-top button', () => {
    const html = readMotorhomeDetail('atlas-25ms-2027');
    assert.ok(html.includes('id="back-to-top"'), 'motorhome back-to-top button missing');
  });
  it('home page has back-to-top button', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    assert.ok(html.includes('id="back-to-top"'), 'home back-to-top button missing');
  });
});

describe('section quick-nav', () => {
  it('trailer detail has no section nav (redesign 2026-09-27: removed)', () => {
    const html = readDetail('classic-33fb-2026');
    assert.ok(!html.includes('data-secnav'), 'secnav removed in redesign');
    assert.ok(!html.includes('class="secnav"'), 'secnav nav removed in redesign');
  });
  it('trailer detail renders the fixed 11-module body in order (redesign 2026-09-27)', () => {
    const html = readDetail('classic-33fb-2026');
    // plan.md §二: the 11 modules in magazine order. The first three use
    // existing class anchors (no test-only ids added).
    const modules = [
      ['header', 'class="detail-head"'],
      ['hero+keystats', 'class="detail-hero"'],
      ['overview', 'detail-overview'],
      ['gallery', 'id="gallery"'],
      ['floorplan', 'id="floorplan"'],
      ['specs', 'id="specs"'],
      ['tow', 'id="tow"'],
      ['offgrid', 'id="offgrid"'],
      ['care', 'id="care"'],
      ['proscons', 'id="proscons"'],
      ['more', 'id="more"'],
    ];
    assert.equal(modules.length, 11, 'must lock all 11 modules');
    const order = modules.map(([name, needle]) => {
      const idx = html.indexOf(needle);
      assert.ok(idx !== -1, `${name} module anchor missing (${needle})`);
      return idx;
    });
    for (let i = 1; i < order.length; i++) {
      assert.ok(order[i] > order[i - 1], `module order wrong: ${modules[i][0]} should come after ${modules[i - 1][0]}`);
    }
    assert.ok(html.includes('dsec-title'), 'dsec-title section heads missing');
  });
  it('section IDs exist on trailer detail page', () => {
    const html = readDetail('classic-33fb-2026');
    assert.ok(html.includes('id="specs"'), 'specs id missing');
    assert.ok(html.includes('id="tow"'), 'tow section id missing');
    assert.ok(html.includes('id="offgrid"'), 'offgrid section id missing');
    assert.ok(html.includes('id="gallery"'), 'gallery id missing');
    assert.ok(html.includes('id="care"'), 'care id missing');
    assert.ok(html.includes('id="more"'), 'more id missing');
  });
  it('motorhome detail page has no section nav (redesign 2026-09-27: removed)', () => {
    const html = readMotorhomeDetail('atlas-25ms-2027');
    assert.ok(!html.includes('data-secnav'), 'motorhome secnav removed in redesign');
    assert.ok(html.includes('id="specs"'), 'motorhome specs id present');
    assert.ok(html.includes('id="offgrid"'), 'motorhome offgrid id present');
  });
});

describe('related floorplans', () => {
  it('multi-floorplan family shows "More [Family] floorplans"', () => {
    const html = readDetail('classic-33fb-2026');
    assert.ok(html.includes('More Classic floorplans'), 'related heading wrong');
    assert.ok(html.includes('class="related-grid"'), 'related grid missing');
    // Should have rel-cards
    const cardCount = (html.match(/class="rel-card"/g) || []).length;
    assert.ok(cardCount >= 2, `expected ≥2 related cards, got ${cardCount}`);
    assert.ok(cardCount <= 4, `expected ≤4 related cards, got ${cardCount}`);
  });
  it('single-floorplan family shows "Explore similar floorplans"', () => {
    const html = readDetail('frank-lloyd-wright-limited-edition-28rb-2026');
    assert.ok(html.includes('Explore similar floorplans'), 'similar heading missing for FLW');
    const cardCount = (html.match(/class="rel-card"/g) || []).length;
    assert.ok(cardCount >= 2, `expected ≥2 similar cards for FLW, got ${cardCount}`);
  });
  it('related cards link to valid detail pages', () => {
    const html = readDetail('bambi-16rb-2026');
    const hrefs = [];
    const re = /class="rel-card" href="([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) hrefs.push(m[1]);
    assert.ok(hrefs.length > 0, 'no related card hrefs found');
    for (const href of hrefs) {
      assert.ok(href.endsWith('.html'), `related href not .html: ${href}`);
      // Should NOT link to self
      assert.ok(!href.includes('bambi-16rb-2026'), 'related should not link to self');
    }
  });
  it('motorhome detail has related section', () => {
    const html = readMotorhomeDetail('atlas-25ms-2027');
    assert.ok(html.includes('class="related-grid"'), 'motorhome related grid missing');
  });
});

describe('smooth scroll CSS', () => {
  it('site.css includes scroll-behavior: smooth', () => {
    const css = readFileSync(join(__dirname, '..', 'src', 'assets', 'css', 'site.css'), 'utf8');
    assert.ok(css.includes('scroll-behavior: smooth'), 'smooth scroll missing from site.css');
  });
  it('respects prefers-reduced-motion', () => {
    const css = readFileSync(join(__dirname, '..', 'src', 'assets', 'css', 'site.css'), 'utf8');
    assert.ok(css.includes('scroll-behavior: auto'), 'reduced-motion fallback missing');
  });
});
