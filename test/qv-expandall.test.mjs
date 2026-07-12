// Tests for quick-view enhancements (save/compare/gallery) and expand-all/collapse-all toggle.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appJs = readFileSync('src/assets/js/app.js', 'utf8');
const siteCSS = readFileSync('src/assets/css/site.css', 'utf8');
const themeCSS = readFileSync('src/assets/css/theme.css', 'utf8');

// Use a lazy-loaded render to avoid importing data.mjs at top level
// when run outside the build context.
let _renderMod;
function getRender() {
  if (!_renderMod) _renderMod = import('../src/lib/render.mjs');
  return _renderMod;
}

describe('quick-view enhancements', () => {
  it('quick-view panel contains save button', async () => {
    const { renderIndex } = await getRender();
    // renderIndex embeds the quick-view dialog in the page shell
    const html = renderIndex([], []);
    assert.ok(html.includes('id="qv-save"'), 'save button missing from quick-view');
    assert.ok(html.includes('id="qv-save-label"'), 'save label missing from quick-view');
  });

  it('quick-view panel contains compare checkbox', async () => {
    const { renderIndex } = await getRender();
    const html = renderIndex([], []);
    assert.ok(html.includes('id="qv-compare"'), 'compare checkbox missing from quick-view');
    assert.ok(html.includes('qv-compare-label'), 'compare label class missing');
  });

  it('quick-view panel contains gallery strip container', async () => {
    const { renderIndex } = await getRender();
    const html = renderIndex([], []);
    assert.ok(html.includes('id="qv-gallery"'), 'gallery strip container missing');
    assert.ok(html.includes('qv-gallery-strip'), 'gallery strip class missing');
  });

  it('app.js wires quick-view save button', () => {
    assert.ok(appJs.includes("getElementById('qv-save')"), 'qv-save not referenced in app.js');
    assert.ok(appJs.includes('Saved.has('), 'Saved.has check missing for qv save');
    assert.ok(appJs.includes('Saved.add('), 'Saved.add missing for qv save');
    assert.ok(appJs.includes('Saved.remove('), 'Saved.remove missing for qv save');
  });

  it('app.js wires quick-view compare checkbox', () => {
    assert.ok(appJs.includes("getElementById('qv-compare')"), 'qv-compare not referenced in app.js');
    // Should sync with grid compare checkboxes
    assert.ok(appJs.includes("'.cmp-box[data-slug=\"'"), 'compare sync with grid boxes missing');
  });

  it('app.js wires quick-view gallery thumbnail clicks', () => {
    assert.ok(appJs.includes("getElementById('qv-gallery')"), 'qv-gallery not referenced in app.js');
    assert.ok(appJs.includes('qv-gallery-thumb'), 'gallery thumb click handler missing');
  });

  it('CSS includes quick-view save/compare/gallery styles', () => {
    assert.ok(siteCSS.includes('.qv-save-btn'), 'qv-save-btn style missing');
    assert.ok(siteCSS.includes('.qv-compare-label'), 'qv-compare-label style missing');
    assert.ok(siteCSS.includes('.qv-gallery-strip'), 'qv-gallery-strip style missing');
    assert.ok(siteCSS.includes('.qv-gallery-thumb'), 'qv-gallery-thumb style missing');
  });

  it('dark mode covers quick-view enhancements', () => {
    assert.ok(themeCSS.includes('.qv-save-btn'), 'dark mode qv-save-btn missing');
    assert.ok(themeCSS.includes('.qv-gallery-thumb'), 'dark mode qv-gallery-thumb missing');
  });
});

describe('explore card gallery URLs', () => {
  it('explore card includes data-gallery-urls attribute', async () => {
    const { renderExploreCard, esc } = await getRender();
    const t = {
      slug: 'test-20fb-2026', model: 'Test', floorplan: '20FB', year: 2026,
      msrp: 100000, weightLb: 4000, gvwrLb: 5500, lengthFt: 23.5,
      sleeps: 4, offGridScore: 65, tags: [], description: 'Test trailer',
      freshGal: 30, grayGal: 20, blackGal: 18, solarW: 200, hitchWeightLb: 600,
    };
    const resolve = () => ({
      thumb: 'assets/img/thumbs/test.webp',
      hero: 'assets/img/heroes/test.webp',
      gallery: ['assets/img/gallery/test-1.webp', 'assets/img/gallery/test-2.webp'],
      galleryCutout: [false, false],
    });
    const html = renderExploreCard(t, resolve);
    assert.ok(html.includes('data-gallery-urls='), 'data-gallery-urls attribute missing');
    assert.ok(html.includes('test-1.webp|assets/img/gallery/test-2.webp'), 'gallery URLs not pipe-separated');
  });
});

describe('expand-all / collapse-all toggle', () => {
  it('section nav includes expand-all button', async () => {
    const { renderDetail } = await getRender();
    const t = {
      slug: 'test-20fb-2026', model: 'Test', floorplan: '20FB', year: 2026,
      msrp: 100000, weightLb: 4000, gvwrLb: 5500, lengthFt: 23.5,
      sleeps: 4, offGridScore: 65, tags: [], description: 'Test trailer',
      freshGal: 30, grayGal: 20, blackGal: 18, solarW: 200, hitchWeightLb: 600,
      cccLb: 1500, extWidthFt: 8, extHeightFt: 9.5, intHeightFt: 6.5,
      batteryKwh: 0, solarStandard: false,
    };
    const resolve = () => ({
      thumb: 'assets/img/thumbs/test.webp',
      hero: 'assets/img/heroes/test.webp',
      gallery: [],
      galleryCutout: [],
      floorplan: null,
    });
    const html = renderDetail(t, resolve, null, null, [t]);
    assert.ok(html.includes('id="secnav-expand-all"'), 'expand-all button missing from section nav');
    assert.ok(html.includes('secnav-expand-all'), 'expand-all class missing');
  });

  it('app.js contains expandCollapseAll IIFE', () => {
    assert.ok(appJs.includes('expandCollapseAll'), 'expandCollapseAll function missing');
    assert.ok(appJs.includes("getElementById('secnav-expand-all')"), 'expand-all button not wired');
    assert.ok(appJs.includes('is-expanded'), 'is-expanded class toggle missing');
  });

  it('CSS includes expand-all button styles', () => {
    assert.ok(siteCSS.includes('.secnav-expand-all'), 'secnav-expand-all style missing');
    assert.ok(siteCSS.includes('.secnav-expand-all.is-expanded'), 'is-expanded style missing');
  });
});
