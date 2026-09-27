import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

function readDist(rel) {
  return readFileSync(join(DIST, rel), 'utf8');
}

describe('Explore layout toggle', () => {
  it('renders grid/list toggle buttons on the explore hub', () => {
    const html = readDist('index.html');
    assert.ok(html.includes('id="x-layout"'), 'layout toggle wrapper present');
    assert.ok(html.includes('data-layout="grid"'), 'grid button present');
    assert.ok(html.includes('data-layout="list"'), 'list button present');
  });

  it('grid button is active by default', () => {
    const html = readDist('index.html');
    assert.ok(html.includes('data-layout="grid" aria-pressed="true"'), 'grid pressed');
    assert.ok(html.includes('data-layout="list" aria-pressed="false"'), 'list not pressed');
  });

  it('list-view CSS is present in site.css', () => {
    // site.css is fingerprinted; read the source
    const css = readFileSync(join(__dirname, '..', 'src', 'assets', 'css', 'site.css'), 'utf8');
    assert.ok(css.includes('.xgrid.is-list'), 'list-view grid styles');
    assert.ok(css.includes('.xc-layout-btn'), 'layout toggle button styles');
  });
});

describe('Detail page prev/next pager', () => {
  it('every trailer detail page has a pager nav', () => {
    const trailers = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'trailers.json'), 'utf8'));
    for (const t of trailers) {
      const html = readDist(`m/${t.slug}.html`);
      assert.ok(html.includes('detail-pager'), `${t.slug} has pager`);
      assert.ok(html.includes('aria-label="Browse floorplans"'), `${t.slug} pager accessible`);
    }
  });

  it('first trailer has no previous, last has no next', () => {
    const trailers = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'trailers.json'), 'utf8'));
    const sorted = [...trailers].sort((a, b) =>
      `${a.model} ${a.floorplan} ${a.year}`.localeCompare(`${b.model} ${b.floorplan} ${b.year}`));
    const firstSlug = sorted[0].slug;
    const lastSlug = sorted[sorted.length - 1].slug;

    const firstHtml = readDist(`m/${firstSlug}.html`);
    assert.ok(!firstHtml.includes('detail-pager-link--prev'), `first (${firstSlug}) has no prev link`);
    assert.ok(firstHtml.includes('detail-pager-link--next'), `first (${firstSlug}) has next link`);

    const lastHtml = readDist(`m/${lastSlug}.html`);
    assert.ok(lastHtml.includes('detail-pager-link--prev'), `last (${lastSlug}) has prev link`);
    assert.ok(!lastHtml.includes('detail-pager-link--next'), `last (${lastSlug}) has no next link`);
  });

  it('pager links point to valid sibling detail pages', () => {
    const html = readDist('m/bambi-16rb-2026.html');
    // Should link to bambi-16rb-2025 (prev) and bambi-20fb-2025 (next) or similar
    const prevMatch = html.match(/detail-pager-link--prev" href="([^"]+)"/);
    const nextMatch = html.match(/detail-pager-link--next" href="([^"]+)"/);
    assert.ok(prevMatch, 'has prev link');
    assert.ok(nextMatch, 'has next link');
    // Verify linked files exist
    assert.ok(prevMatch[1].endsWith('.html'), 'prev is html');
    assert.ok(nextMatch[1].endsWith('.html'), 'next is html');
  });
});

describe('Saved page retired: no saved.html output', () => {
  it('dist has no saved.html page', () => {
    assert.ok(!existsSync(join(DIST, 'saved.html')), 'saved.html must not be generated');
  });

  it('build.mjs does not write saved.html', () => {
    const build = readFileSync(join(__dirname, '..', 'scripts', 'build.mjs'), 'utf8');
    assert.ok(!/saved\.html/.test(build.replace(/saved\.html retired/g, '')),
      'build must not write a saved.html page');
  });
});

describe('app.js has new modules', () => {
  it('has recently viewed module', () => {
    const js = readFileSync(join(__dirname, '..', 'src', 'assets', 'js', 'app.js'), 'utf8');
    assert.ok(js.includes('recentlyViewed'), 'recentlyViewed function');
    assert.ok(js.includes("ae:' + KEY"), 'uses ae: namespace');
  });

  it('has layout toggle module', () => {
    const js = readFileSync(join(__dirname, '..', 'src', 'assets', 'js', 'app.js'), 'utf8');
    assert.ok(js.includes('layoutToggle'), 'layoutToggle function');
    assert.ok(js.includes("ae:layout"), 'persists layout pref');
  });
});

describe('Size scale diagram removed (redesign 2026-09-27)', () => {
  it('no size-scale section on detail pages', () => {
    const html = readDist('m/classic-33fb-2026.html');
    assert.ok(!html.includes('id="size-scale"'), 'size-scale removed');
  });
});

// Cost-per-night calculator REMOVED per ruling 1A (2026-09-27).
// This describe locks the removal: no detail page may carry it.
describe('Cost per night calculator is GONE (ruling 1A)', () => {
  it('no detail page contains cost-night markup or data islands', () => {
    for (const f of ['m/classic-33fb-2026.html', 'm/bambi-16rb-2026.html']) {
      const html = readDist(f);
      assert.ok(!html.includes('id="cost-night"'), `${f} still has cost-night section`);
      assert.ok(!html.includes('cost-night-data'), `${f} still has cost-night data island`);
      assert.ok(!html.includes('cn-comparison'), `${f} still has cost-night layout`);
      assert.ok(!html.includes('per camping night'), `${f} still has per-night label`);
    }
  });
});

describe('Tow vehicle persistence (app.js)', () => {
  it('app.js saves tow vehicle to localStorage', () => {
    const js = readFileSync(join(__dirname, '..', 'src', 'assets', 'js', 'app.js'), 'utf8');
    assert.ok(js.includes('ae:towVehicle'), 'stores tow vehicle key');
    assert.ok(js.includes('tow-banner'), 'tow banner module exists');
  });

});

describe('No section nav (redesign 2026-09-27)', () => {
  it('detail pages have no section nav', () => {
    const html = readDist('m/classic-33fb-2026.html');
    assert.ok(!html.includes('class="secnav"'), 'no section nav');
    assert.ok(!html.includes('href="#cost-night"'), 'cost-night not present');
  });

  it('size-scale section removed from detail pages (redesign 2026-09-27)', () => {
    const html = readDist('m/classic-33fb-2026.html');
    assert.ok(!html.includes('id="size-scale"'), 'no size-scale section');
    assert.ok(!html.includes('size-scale'), 'no size-scale markup');
  });

  it('fit check appears in Towing section, not as standalone (redesign 2026-09-27)', () => {
    const html = readDist('m/classic-33fb-2026.html');
    assert.ok(html.includes('id="tow"'), 'towing section present');
    assert.ok(html.includes('fit-check'), 'fit check in towing section');
  });
});
