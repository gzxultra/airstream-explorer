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
const html = renderDetail(trailer, undefined, null, trailers);
const mhtml = renderMotorhomeDetail(motorhome, undefined, motorhomes);

// --- Trailer detail page ---

test('trailer detail emits share-actions with Share + Compare buttons (redesign 2026-09-27)', () => {
  assert.ok(html.includes('data-share-actions'), 'missing share-actions');
  assert.ok(html.includes('id="detail-share"'), 'missing share button');
  assert.ok(html.includes('id="detail-compare"'), 'missing compare button');
  assert.ok(!html.includes('id="detail-copy-specs"'), 'copy-specs button removed in redesign');
  assert.ok(!html.includes('id="detail-print"'), 'print button removed in redesign');
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

test('trailer detail has no reading-progress bar (redesign 2026-09-27)', () => {
  assert.ok(!html.includes('id="reading-progress"'), 'reading-progress removed in redesign');
  assert.ok(!html.includes('class="reading-progress"'), 'reading-progress class removed in redesign');
});

// --- Motorhome detail page ---

test('motorhome detail emits share-actions with Share + Compare buttons (redesign 2026-09-27)', () => {
  assert.ok(mhtml.includes('data-share-actions'), 'missing share-actions');
  assert.ok(mhtml.includes('id="detail-share"'), 'missing share button');
  assert.ok(mhtml.includes('id="detail-compare"'), 'missing compare button');
  assert.ok(!mhtml.includes('id="detail-copy-specs"'), 'copy-specs button removed in redesign');
  assert.ok(!mhtml.includes('id="detail-print"'), 'print button removed in redesign');
});

test('motorhome detail has no reading-progress bar (redesign 2026-09-27)', () => {
  assert.ok(!mhtml.includes('id="reading-progress"'), 'reading-progress removed in redesign');
});

test('motorhome detail emits data-canonical', () => {
  assert.match(mhtml, /data-canonical="mm\/atlas-25ms-2027\.html"/);
});

// --- CSS ---

test('print.css has @media print rules hiding chrome', () => {
  // Print styles were split out of site.css into print.css (media="print", perf #26).
  const css = readFileSync('src/assets/css/print.css', 'utf8');
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

test('app.js has detailActions module', () => {
  const js = readFileSync('src/assets/js/app.js', 'utf8');
  assert.ok(js.includes('function detailActions'), 'missing detailActions');
});

test('app.js uses Web Share API with clipboard fallback', () => {
  const js = readFileSync('src/assets/js/app.js', 'utf8');
  assert.ok(js.includes('navigator.share'), 'missing Web Share API check');
  assert.ok(js.includes('navigator.clipboard'), 'missing clipboard API');
});
