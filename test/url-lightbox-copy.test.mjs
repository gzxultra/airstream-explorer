import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/assets/js/app.js', 'utf8');
const themeCss = readFileSync('src/assets/css/theme.css', 'utf8');
const siteCss = readFileSync('src/assets/css/site.css', 'utf8');

// ======================================================================
// 1. URL-SHAREABLE EXPLORE FILTERS
// ======================================================================

test('app.js contains syncHashFromState function for URL filter sharing', () => {
  assert.ok(app.includes('function syncHashFromState()'), 'missing syncHashFromState');
});

test('app.js contains readHashFilters function', () => {
  assert.ok(app.includes('function readHashFilters()'), 'missing readHashFilters');
});

test('syncHashFromState is called from apply()', () => {
  assert.ok(app.includes('syncHashFromState();'), 'syncHashFromState not called');
});

test('readHashFilters is called before hydrate', () => {
  const readIdx = app.indexOf('readHashFilters();');
  const hydrateIdx = app.indexOf('(function hydrateXControls()');
  assert.ok(readIdx > 0, 'readHashFilters not found');
  assert.ok(hydrateIdx > 0, 'hydrateXControls not found');
  assert.ok(readIdx < hydrateIdx, 'readHashFilters must come before hydrateXControls');
});

test('hash filter encodes year, sleeps, price, tags, sort', () => {
  // Verify the function body references all the expected filter keys
  const fn = app.substring(app.indexOf('function syncHashFromState()'));
  assert.ok(fn.includes("'year='"), 'missing year encoding');
  assert.ok(fn.includes("'sleeps='"), 'missing sleeps encoding');
  assert.ok(fn.includes("'price='"), 'missing price encoding');
  assert.ok(fn.includes("'tags='"), 'missing tags encoding');
  assert.ok(fn.includes("'sort='"), 'missing sort encoding');
  assert.ok(fn.includes("'len='"), 'missing length encoding');
  assert.ok(fn.includes("'wt='"), 'missing weight encoding');
  assert.ok(fn.includes("'tow='"), 'missing tow encoding');
});

test('hash filter reader parses all expected params', () => {
  const fn = app.substring(app.indexOf('function readHashFilters()'));
  assert.ok(fn.includes("params.year"), 'year not parsed');
  assert.ok(fn.includes("params.sleeps"), 'sleeps not parsed');
  assert.ok(fn.includes("params.price"), 'price not parsed');
  assert.ok(fn.includes("params.tags"), 'tags not parsed');
  assert.ok(fn.includes("params.sort"), 'sort not parsed');
  assert.ok(fn.includes("params.len"), 'len not parsed');
  assert.ok(fn.includes("params.wt"), 'wt not parsed');
  assert.ok(fn.includes("params.tow"), 'tow not parsed');
});

// ======================================================================
// 2. LIGHTBOX COUNTER + DOT NAVIGATION
// ======================================================================

test('app.js creates lightbox-counter element', () => {
  assert.ok(app.includes("'lightbox-counter'"), 'missing lightbox-counter class');
});

test('app.js creates lightbox-dots container', () => {
  assert.ok(app.includes("'lightbox-dots'"), 'missing lightbox-dots class');
});

test('app.js creates clickable dot buttons', () => {
  assert.ok(app.includes("'lightbox-dot'"), 'missing lightbox-dot class');
});

test('lightbox counter shows "N / M" format', () => {
  assert.ok(app.includes("(idx + 1) + ' / ' + items.length"), 'counter format missing');
});

test('lightbox dots update active state on render', () => {
  assert.ok(app.includes("'is-active'"), 'dot active toggle missing');
});

test('theme.css has lightbox-counter styles', () => {
  assert.ok(themeCss.includes('.lightbox-counter'), 'missing .lightbox-counter CSS');
});

test('theme.css has lightbox-dots styles', () => {
  assert.ok(themeCss.includes('.lightbox-dots'), 'missing .lightbox-dots CSS');
});

test('theme.css has lightbox-dot styles', () => {
  assert.ok(themeCss.includes('.lightbox-dot'), 'missing .lightbox-dot CSS');
});

test('counter hidden for single-image lightbox', () => {
  assert.ok(themeCss.includes('.lightbox.is-single .lightbox-counter'), 'single-image counter hide missing');
});

test('dots limit to 20 or fewer images', () => {
  assert.ok(app.includes('items.length <= 20'), 'dot limit check missing');
});

// ======================================================================
// 3. SPEC ROW TAP-TO-COPY
// ======================================================================

test('app.js contains specCopy IIFE', () => {
  assert.ok(app.includes('function specCopy()'), 'missing specCopy function');
});

test('specCopy creates copy-toast element', () => {
  assert.ok(app.includes("'copy-toast'"), 'missing copy-toast creation');
});

test('specCopy uses navigator.clipboard.writeText', () => {
  assert.ok(app.includes('navigator.clipboard.writeText'), 'missing clipboard API');
});

test('specCopy adds specs-copyable class', () => {
  assert.ok(app.includes("'specs-copyable'"), 'missing specs-copyable class');
});

test('specCopy adds is-copied visual feedback', () => {
  assert.ok(app.includes("'is-copied'"), 'missing is-copied feedback');
});

test('site.css has specs-copyable styles', () => {
  assert.ok(siteCss.includes('.specs-copyable'), 'missing .specs-copyable CSS');
});

test('site.css has copy-toast styles', () => {
  assert.ok(siteCss.includes('.copy-toast'), 'missing .copy-toast CSS');
});

test('copy-toast has dark theme style', () => {
  assert.ok(siteCss.includes('[data-theme="dark"] .copy-toast'), 'missing dark theme copy-toast');
});

test('specCopy includes model name in copied text', () => {
  assert.ok(app.includes("modelName + ': '"), 'copied text should include model name');
});

test('specCopy avoids interfering with tooltips', () => {
  assert.ok(app.includes('.glossary-tip'), 'should not capture tooltip clicks');
});
