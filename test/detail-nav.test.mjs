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
  it('trailer detail page has section nav with all expected sections', () => {
    const html = readDetail('classic-33fb-2026');
    assert.ok(html.includes('data-secnav'), 'secnav missing');
    assert.ok(html.includes('href="#specs"'), 'Specs link missing');
    assert.ok(html.includes('href="#tow"'), 'Tow link missing');
    assert.ok(html.includes('href="#fuel"'), 'Fuel link missing');
    assert.ok(html.includes('href="#payload"'), 'Payload link missing');
    assert.ok(html.includes('href="#offgrid"'), 'Off-grid link missing');
    assert.ok(html.includes('href="#floorplan"'), 'Floor plan link missing');
    assert.ok(html.includes('href="#gallery"'), 'Gallery link missing');
  });
  it('section IDs exist on trailer detail page', () => {
    const html = readDetail('classic-33fb-2026');
    assert.ok(html.includes('id="specs"'), 'specs id missing');
    assert.ok(html.includes('id="tow"'), 'tow id missing');
    assert.ok(html.includes('id="fuel"'), 'fuel id missing');
    assert.ok(html.includes('id="payload"'), 'payload id missing');
    assert.ok(html.includes('id="offgrid"'), 'offgrid id missing');
    assert.ok(html.includes('id="gallery"'), 'gallery id missing');
  });
  it('motorhome detail page has section nav', () => {
    const html = readMotorhomeDetail('atlas-25ms-2027');
    assert.ok(html.includes('data-secnav'), 'motorhome secnav missing');
    assert.ok(html.includes('href="#specs"'), 'motorhome Specs link missing');
    assert.ok(html.includes('href="#offgrid"'), 'motorhome Off-grid link missing');
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
