// Tests for: search autocomplete, touch swipe nav, section deep links
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTrailers } from '../src/lib/data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// ---- Search Autocomplete ----

test('search autocomplete: combobox wrapper and suggestion list present in explore HTML', () => {
  const html = read('src/lib/render.mjs');
  assert.ok(html.includes('role="combobox"'), 'combobox role present');
  assert.ok(html.includes('aria-haspopup="listbox"'), 'listbox haspopup');
  assert.ok(html.includes('id="x-suggest"'), 'suggestion list id');
  assert.ok(html.includes('role="listbox"'), 'listbox role on suggestion list');
  assert.ok(html.includes('aria-autocomplete="list"'), 'autocomplete attribute');
  assert.ok(html.includes('autocomplete="off"'), 'native autocomplete disabled');
});

test('search: datalist-based search module present in app.js', () => {
  const js = read('src/assets/js/app.js');
  assert.ok(js.includes('function searchDatalist'), 'datalist search module exists');
  assert.ok(js.includes("getElementById('search')"), 'references search input');
});

test('search autocomplete: CSS styles present', () => {
  const css = read('src/assets/css/site.css');
  assert.ok(css.includes('.x-suggest'), 'suggestion dropdown styles');
  assert.ok(css.includes('.x-suggest-item'), 'suggestion item styles');
  assert.ok(css.includes('.x-sug-thumb'), 'thumbnail styles');
  assert.ok(css.includes('.x-sug-label'), 'label styles');
  assert.ok(css.includes('.x-sug-meta'), 'meta info styles');
});

test('search autocomplete: built index.html has combobox and listbox', { skip: !existsSync(join(ROOT, 'dist', 'index.html')) && 'no dist' }, () => {
  const html = read('dist/index.html');
  assert.ok(html.includes('role="combobox"'), 'combobox in built HTML');
  assert.ok(html.includes('id="x-suggest"'), 'suggestion list in built HTML');
  assert.ok(html.includes('role="listbox"'), 'listbox role in built HTML');
});

// ---- Touch Swipe Navigation ----

test('swipe nav: detail pages carry data-prev-href and data-next-href', () => {
  const render = read('src/lib/render.mjs');
  assert.ok(render.includes('data-prev-href'), 'prev href data attribute in renderer');
  assert.ok(render.includes('data-next-href'), 'next href data attribute in renderer');
});

test('swipe nav: JS module present in app.js', () => {
  const js = read('src/assets/js/app.js');
  assert.ok(js.includes('function swipeNav'), 'swipe nav module exists');
  assert.ok(js.includes('touchstart'), 'touch start listener');
  assert.ok(js.includes('touchmove'), 'touch move listener');
  assert.ok(js.includes('touchend'), 'touch end listener');
  assert.ok(js.includes('touchcancel'), 'touch cancel handler');
  assert.ok(js.includes('THRESHOLD'), 'swipe threshold defined');
  assert.ok(js.includes('prefers-reduced-motion'), 'respects reduced motion');
});

test('swipe nav: CSS hint styles present', () => {
  const css = read('src/assets/css/site.css');
  assert.ok(css.includes('.swipe-hint'), 'swipe hint class');
  assert.ok(css.includes('.swipe-hint--prev'), 'prev hint variant');
  assert.ok(css.includes('.swipe-hint--next'), 'next hint variant');
  assert.ok(css.includes('.swipe-hint.is-visible'), 'visible state');
});

test('swipe nav: built detail page has prev/next data attrs', { skip: !existsSync(join(ROOT, 'dist', 'm')) && 'no dist' }, () => {
  const detailDir = join(ROOT, 'dist', 'm');
  const files = readdirSync(detailDir).filter(f => f.endsWith('.html'));
  assert.ok(files.length > 2, 'multiple detail pages exist');
  const midFile = files[Math.floor(files.length / 2)];
  const html = readFileSync(join(detailDir, midFile), 'utf8');
  const hasPrev = html.includes('data-prev-href');
  const hasNext = html.includes('data-next-href');
  assert.ok(hasPrev || hasNext, `mid-range detail page ${midFile} has at least one nav link`);
});

test('swipe nav: first detail page has no prev, last has no next', { skip: !existsSync(join(ROOT, 'dist', 'm')) && 'no dist' }, () => {
  const trailers = loadTrailers();
  const sorted = [...trailers].sort((a, b) =>
    `${a.model} ${a.floorplan} ${a.year}`.localeCompare(`${b.model} ${b.floorplan} ${b.year}`));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const firstHtml = read(`dist/m/${first.slug}.html`);
  const lastHtml = read(`dist/m/${last.slug}.html`);

  assert.ok(!firstHtml.includes('data-prev-href'), 'first page has no prev link');
  assert.ok(firstHtml.includes('data-next-href'), 'first page has next link');
  assert.ok(lastHtml.includes('data-prev-href'), 'last page has prev link');
  assert.ok(!lastHtml.includes('data-next-href'), 'last page has no next link');
});

// ---- Section Deep Links ----

test('section deep links: JS module present in app.js', () => {
  const js = read('src/assets/js/app.js');
  assert.ok(js.includes('function sectionDeepLinks'), 'deep links module exists');
  assert.ok(js.includes('replaceState'), 'uses replaceState for hash sync');
  assert.ok(js.includes('MutationObserver'), 'observes scroll-spy class changes');
  assert.ok(js.includes('location.hash'), 'reads initial hash');
});

test('section deep links: section IDs match section nav hrefs in detail pages', { skip: !existsSync(join(ROOT, 'dist', 'm')) && 'no dist' }, () => {
  const trailers = loadTrailers();
  const t = trailers.find(x => x.year === 2026);
  assert.ok(t, 'found a 2026 trailer');

  const html = read(`dist/m/${t.slug}.html`);
  const navHrefs = [...html.matchAll(/href="#([^"]+)"[^>]*class="secnav-link"/g)].map(m => m[1]);
  assert.ok(navHrefs.length >= 3, `section nav has ${navHrefs.length} links (>=3)`);

  for (const id of navHrefs) {
    assert.ok(html.includes(`id="${id}"`), `section id="${id}" exists in page`);
  }
});

// ---- Print rules ----

test('print CSS: hides swipe hints and autocomplete', () => {
  const css = read('src/assets/css/site.css');
  const printBlocks = css.split('@media print');
  const hasPrintRule = printBlocks.some(block =>
    block.includes('.swipe-hint') && block.includes('.x-suggest')
  );
  assert.ok(hasPrintRule, 'print stylesheet hides swipe and autocomplete elements');
});

test('print CSS: hides detail pager and cross-family', () => {
  const css = read('src/assets/css/site.css');
  const printBlocks = css.split('@media print');
  const hasPagerRule = printBlocks.some(block =>
    block.includes('.detail-pager') && block.includes('.cross-family')
  );
  assert.ok(hasPagerRule, 'print stylesheet hides pager and cross-family');
});
