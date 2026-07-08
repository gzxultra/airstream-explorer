import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTrailers } from '../src/lib/data.mjs';
import { renderDetail } from '../src/lib/render.mjs';
import { loadMotorhomes } from '../src/lib/motorhome-data.mjs';
import { renderMotorhomeDetail } from '../src/lib/motorhome-render.mjs';

const trailers = loadTrailers();
const motorhomes = loadMotorhomes();
const trailer = trailers.find((t) => t.slug === 'classic-33fb-2026');
const motorhome = motorhomes.find((m) => m.slug === 'atlas-25ms-2027');
const html = renderDetail(trailer, undefined, null, null, trailers);
const mhtml = renderMotorhomeDetail(motorhome, undefined, motorhomes);

// --- Trailer detail page ---

test('trailer detail emits share-actions with 3 buttons', () => {
  assert.ok(html.includes('data-share-actions'), 'missing share-actions');
  assert.ok(html.includes('id="detail-share"'), 'missing share button');
  assert.ok(html.includes('id="detail-copy-specs"'), 'missing copy-specs button');
  assert.ok(html.includes('id="detail-print"'), 'missing print button');
});

test('trailer detail emits data-spec-text with || separator', () => {
  const m = html.match(/data-spec-text="([^"]*)"/);
  assert.ok(m, 'data-spec-text not found');
  assert.ok(m[1].includes(' || '), 'should use || separator');
  assert.ok(m[1].includes('GVWR'), 'should include GVWR');
  assert.ok(m[1].includes('MSRP'), 'should include MSRP');
});

test('trailer detail emits data-canonical for print', () => {
  assert.match(html, /data-canonical="m\/classic-33fb-2026\.html"/);
});

test('trailer detail emits reading-progress bar', () => {
  assert.ok(html.includes('id="reading-progress"'), 'missing progress bar');
  assert.ok(html.includes('class="reading-progress"'), 'missing class');
});

// --- Motorhome detail page ---

test('motorhome detail emits share-actions with 3 buttons', () => {
  assert.ok(mhtml.includes('data-share-actions'), 'missing share-actions');
  assert.ok(mhtml.includes('id="detail-share"'), 'missing share button');
  assert.ok(mhtml.includes('id="detail-copy-specs"'), 'missing copy-specs button');
  assert.ok(mhtml.includes('id="detail-print"'), 'missing print button');
});

test('motorhome detail emits reading-progress bar', () => {
  assert.ok(mhtml.includes('id="reading-progress"'), 'missing progress bar');
});

test('motorhome detail emits data-canonical', () => {
  assert.match(mhtml, /data-canonical="mm\/atlas-25ms-2027\.html"/);
});

// --- CSS ---

test('site.css has @media print rules hiding chrome', () => {
  const css = readFileSync('src/assets/css/site.css', 'utf8');
  assert.ok(css.includes('@media print'), 'missing @media print');
  // Key elements hidden
  assert.ok(css.includes('.reading-progress'), 'print should reference reading-progress');
});

test('site.css has share-btn and reading-progress styles', () => {
  const css = readFileSync('src/assets/css/site.css', 'utf8');
  assert.ok(css.includes('.share-btn'), 'missing .share-btn');
  assert.ok(css.includes('.share-actions'), 'missing .share-actions');
  assert.ok(css.includes('.reading-progress'), 'missing .reading-progress');
});

// --- Client JS ---

test('app.js has detailActions and readingProgress modules', () => {
  const js = readFileSync('src/assets/js/app.js', 'utf8');
  assert.ok(js.includes('function detailActions'), 'missing detailActions');
  assert.ok(js.includes('function readingProgress'), 'missing readingProgress');
});

test('app.js uses Web Share API with clipboard fallback', () => {
  const js = readFileSync('src/assets/js/app.js', 'utf8');
  assert.ok(js.includes('navigator.share'), 'missing Web Share API check');
  assert.ok(js.includes('navigator.clipboard'), 'missing clipboard API');
});
