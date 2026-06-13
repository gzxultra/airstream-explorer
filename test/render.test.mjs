import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTrailers, modelNames } from '../src/lib/data.mjs';
import { esc, renderCard, renderIndex, renderDetail } from '../src/lib/render.mjs';

const trailers = loadTrailers();
const classic = trailers.find((t) => t.slug === 'classic-33fb-2026');

test('esc neutralizes HTML', () => {
  assert.equal(esc('<script>"x"&\'y\''), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;');
});

test('renderCard links to detail page and carries filter data-attrs', () => {
  const html = renderCard(classic);
  assert.match(html, /href="m\/classic-33fb-2026\.html"/);
  assert.match(html, /data-year="2026"/);
  assert.match(html, /data-model="Classic"/);
  assert.match(html, /assets\/img\/thumbs\/classic-33fb-2026\.jpg/);
  assert.match(html, /loading="lazy"/);
});

test('renderIndex is a full valid document with all 59 cards', () => {
  const html = renderIndex(trailers, modelNames(trailers));
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.trimEnd().endsWith('</html>'));
  // 59 cards
  assert.equal((html.match(/class="card"/g) || []).length, 59);
  // filter controls present
  assert.match(html, /data-year="2026"/);
  assert.match(html, /id="model-filter"/);
  assert.match(html, /id="result-count"/);
  // model dropdown has all 12 + "all"
  assert.equal((html.match(/<option /g) || []).length, 13);
});

test('renderDetail has full spec table with audited numbers', () => {
  const html = renderDetail(classic);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.trimEnd().endsWith('</html>'));
  assert.match(html, /\$222,900/);
  assert.match(html, /8,425 lb/);          // dry weight
  assert.match(html, /10,000 lb/);         // gvwr
  assert.match(html, /1,575 lb/);          // ccc
  assert.match(html, /Cargo capacity/);
  assert.match(html, /Off-grid score/);
  assert.match(html, /← All floorplans/);
  // hero + assets use ../ root from m/ subdir
  assert.match(html, /\.\.\/assets\/img\/heroes\/classic\.jpg/);
});

test('renderDetail escapes and never emits raw script payloads from data', () => {
  const evil = { ...classic, description: '<img src=x onerror=alert(1)>', model: 'X', floorplan: '1Y', slug: 'x-1y-2026', tags: [], pros: [], cons: [] };
  const html = renderDetail(evil);
  assert.ok(!html.includes('<img src=x onerror'));
  assert.match(html, /&lt;img src=x onerror/);
});

test('every trailer renders a detail page without throwing', () => {
  for (const t of trailers) {
    const html = renderDetail(t);
    assert.ok(html.startsWith('<!DOCTYPE html>'), t.slug);
    assert.ok(html.includes('Specifications'), t.slug);
  }
});

test('no detail page contains an unescaped data-driven angle bracket in body text', () => {
  // crude CSP/XSS guard: rendered descriptions should not introduce real tags
  for (const t of trailers) {
    const html = renderDetail(t);
    // the only <script> tag allowed is our own app.js include
    const scripts = html.match(/<script/g) || [];
    assert.equal(scripts.length, 1, `${t.slug} has unexpected <script> count`);
  }
});
