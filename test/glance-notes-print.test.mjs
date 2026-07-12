import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');
const require_fs = { readdirSync };

// Load modules
const { generateGlanceSummary, towClass, loadTrailers } = await import(join(ROOT, 'src/lib/data.mjs'));
const { renderDetail, esc } = await import(join(ROOT, 'src/lib/render.mjs'));

const trailers = loadTrailers();

describe('At a Glance summary', () => {
  it('generateGlanceSummary returns 1-4 items for a normal trailer', () => {
    const bc = trailers.find((t) => t.slug === 'basecamp-16x-2026');
    const points = generateGlanceSummary(bc, trailers);
    assert.ok(points.length >= 1 && points.length <= 4, `expected 1-4 points, got ${points.length}`);
    for (const p of points) {
      assert.ok(p.icon, 'each point has an icon');
      assert.ok(p.text && p.text.length > 10, 'each point has meaningful text');
    }
  });

  it('returns empty for insufficient data', () => {
    const points = generateGlanceSummary(trailers[0], [trailers[0]]);
    assert.deepStrictEqual(points, []);
  });

  it('Basecamp 16X mentions weight and affordability', () => {
    const bc = trailers.find((t) => t.slug === 'basecamp-16x-2026');
    const points = generateGlanceSummary(bc, trailers);
    const allText = points.map((p) => p.text).join(' ');
    assert.ok(allText.includes('2,700'), 'mentions weight');
    assert.ok(allText.includes('lighter') || allText.includes('lightest'), 'mentions being light');
    assert.ok(allText.includes('affordable') || allText.includes('$55,900'), 'mentions price');
  });

  it('Classic 33FB mentions full-size and premium', () => {
    const cl = trailers.find((t) => t.slug === 'classic-33fb-2026');
    const points = generateGlanceSummary(cl, trailers);
    const allText = points.map((p) => p.text).join(' ');
    assert.ok(allText.includes('8,425') || allText.includes('full-size'), 'mentions size/weight');
    assert.ok(allText.includes('Premium') || allText.includes('222,900'), 'mentions premium pricing');
  });

  it('all summaries use real spec data only (no NaN, undefined, null)', () => {
    for (const t of trailers) {
      const points = generateGlanceSummary(t, trailers);
      for (const p of points) {
        assert.ok(!p.text.includes('NaN'), `NaN in text for ${t.slug}: ${p.text}`);
        assert.ok(!p.text.includes('undefined'), `undefined in text for ${t.slug}`);
        assert.ok(!p.text.includes('null'), `null in text for ${t.slug}`);
      }
    }
  });

  it('glance-summary appears in rendered detail HTML', () => {
    const t = trailers.find((x) => x.slug === 'basecamp-16x-2026');
    const html = renderDetail(t, undefined, null, trailers);
    assert.ok(html.includes('class="glance-summary"'), 'has glance-summary section');
    assert.ok(html.includes('class="glance-heading"'), 'has heading');
    assert.ok(html.includes('class="glance-item"'), 'has at least one item');
  });
});

describe('Personal notes', () => {
  it('notes section appears in detail HTML with correct slug', () => {
    const t = trailers.find((x) => x.slug === 'bambi-16rb-2026');
    const html = renderDetail(t, undefined, null, trailers);
    assert.ok(html.includes('class="personal-notes"'), 'has notes section');
    assert.ok(html.includes('id="notes-input"'), 'has notes textarea');
    assert.ok(html.includes('data-slug="bambi-16rb-2026"'), 'slug is set correctly');
    assert.ok(html.includes('id="notes-status"'), 'has status indicator');
  });

  it('notes placeholder mentions dealer quotes', () => {
    const t = trailers[0];
    const html = renderDetail(t, undefined, null, trailers);
    assert.ok(html.includes('dealer quotes'), 'placeholder mentions dealer context');
  });
});

describe('Personal notes JS module', () => {
  it('app.js contains personalNotes IIFE', () => {
    const appJs = readFileSync(join(ROOT, 'src/assets/js/app.js'), 'utf8');
    assert.ok(appJs.includes('function personalNotes'), 'personalNotes function exists');
    assert.ok(appJs.includes("ae:notes:"), 'uses ae:notes: localStorage key');
    assert.ok(appJs.includes('notes-input'), 'targets notes-input element');
  });
});

describe('Print spec sheet CSS', () => {
  it('site.css has comprehensive print rules', () => {
    const css = readFileSync(join(ROOT, 'src/assets/css/site.css'), 'utf8');
    // Check key print rules exist
    assert.ok(css.includes('.topnav,'), 'hides topnav in print');
    assert.ok(css.includes('.site-footer,'), 'hides footer in print');
    assert.ok(css.includes('.gallery,'), 'hides gallery in print');
    assert.ok(css.includes('.detail-pager,'), 'hides pager in print');
    assert.ok(css.includes('page-break-inside: avoid'), 'has page break control');
    assert.ok(css.includes('@page'), 'has @page rules');
    assert.ok(css.includes('.personal-notes'), 'notes section in print');
    assert.ok(css.includes('.glance-summary'), 'glance summary in print');
  });
});

describe('Dark mode support', () => {
  it('theme.css has dark rules for new components', () => {
    const css = readFileSync(join(ROOT, 'src/assets/css/theme.css'), 'utf8');
    assert.ok(css.includes('.glance-summary'), 'dark mode for glance');
    assert.ok(css.includes('.personal-notes'), 'dark mode for notes');
    assert.ok(css.includes('.notes-input'), 'dark mode for notes input');
  });
});

describe('Build output verification', () => {
  it('all 59 detail pages have glance and notes sections', () => {
    const detailDir = join(ROOT, 'dist/m');
    const { readdirSync } = require_fs;
    const htmlFiles = readdirSync(detailDir).filter((f) => f.endsWith('.html'));
    assert.ok(htmlFiles.length >= 59, `expected >=59 detail pages, got ${htmlFiles.length}`);
    let withGlance = 0;
    let withNotes = 0;
    for (const f of htmlFiles) {
      const content = readFileSync(join(detailDir, f), 'utf8');
      if (content.includes('glance-summary')) withGlance++;
      if (content.includes('personal-notes')) withNotes++;
    }
    assert.ok(withGlance >= 59, `expected >=59 pages with glance, got ${withGlance}`);
    assert.strictEqual(withNotes, htmlFiles.length, 'every detail page has notes');
  });
});
