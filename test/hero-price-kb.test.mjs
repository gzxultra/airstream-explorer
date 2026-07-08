// Tests for: hero click-to-lightbox, explore price filter, keyboard help overlay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDetail, renderIndex, page } from '../src/lib/render.mjs';
import fs from 'node:fs';

const trailers = JSON.parse(fs.readFileSync('src/data/trailers.json', 'utf8'));
const classic = trailers.find((t) => t.slug === 'classic-33fb-2026');

// ---- Hero click-to-lightbox ----
test('detail hero image is wrapped in a lightbox-triggering button', () => {
  const html = renderDetail(classic);
  assert.match(html, /class="detail-hero-btn"/, 'hero button class present');
  assert.match(html, /detail-hero-btn.*data-lightbox/, 'hero button has data-lightbox');
  assert.match(html, /data-full="[^"]*"/, 'hero button has data-full');
  assert.match(html, /data-index="0"/, 'hero takes lightbox index 0');
  assert.match(html, /class="hero-zoom"/, 'zoom affordance icon present');
});

test('hero lightbox index is 0 and first gallery image is 1', () => {
  const html = renderDetail(classic);
  // Hero is index 0
  const heroMatch = html.match(/detail-hero-btn[^>]*data-index="(\d+)"/);
  assert.ok(heroMatch, 'hero has data-index');
  assert.equal(heroMatch[1], '0');
  // First gallery image should be index 1 (hero offset)
  const galleryMatch = html.match(/gallery-img-wrap[^>]*data-index="(\d+)"/);
  assert.ok(galleryMatch, 'gallery has data-index');
  assert.equal(galleryMatch[1], '1');
});

// ---- Explore price filter ----
test('explore page includes a price/budget filter dropdown', () => {
  const html = renderIndex([], trailers);
  assert.match(html, /id="x-price"/, 'price filter select present');
  assert.match(html, /Under \$80k/, '$80k option');
  assert.match(html, /Under \$120k/, '$120k option');
  assert.match(html, /Under \$160k/, '$160k option');
  assert.match(html, /Under \$200k/, '$200k option');
  assert.match(html, /Any price/, 'any-price default');
});

// ---- Keyboard help overlay ----
test('page shell includes keyboard help overlay in both renderers', () => {
  // Trailer renderer
  const html = renderDetail(classic);
  assert.match(html, /id="kb-help"/, 'kb-help element present');
  assert.match(html, /Keyboard shortcuts/, 'help title');
  assert.match(html, /<kbd>\/<\/kbd>/, 'slash shortcut documented');
  assert.match(html, /<kbd>j<\/kbd>/, 'j shortcut documented');
  assert.match(html, /<kbd>d<\/kbd>/, 'd shortcut documented');
  assert.match(html, /data-kb-close/, 'close trigger present');
});

test('keyboard help overlay is hidden by default', () => {
  const html = renderDetail(classic);
  assert.match(html, /id="kb-help" hidden/, 'kb-help starts hidden');
});

// ---- No regressions ----
test('existing gallery caption format is preserved', () => {
  const html = renderDetail(classic);
  // Captions should still say "photo X of N"
  assert.match(html, /photo 1 of \d+/, 'gallery caption format intact');
});

test('explore page still has sleeps and year filters alongside price', () => {
  const html = renderIndex([], trailers);
  assert.match(html, /id="x-sleeps"/, 'sleeps filter present');
  assert.match(html, /id="x-year"/, 'year filter present');
  assert.match(html, /id="x-price"/, 'price filter present');
  assert.match(html, /id="x-search"/, 'search present');
});
