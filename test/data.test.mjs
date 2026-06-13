import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadTrailers, validateTrailer, validateDataset, groupByModel,
  modelNames, years, filterTrailers, assetPaths,
  slugify, twinSlug, resolveAssets,
} from '../src/lib/data.mjs';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const hasAsset = (rel) => existsSync(join(PUBLIC, rel));

const trailers = loadTrailers();

test('dataset loads with 59 floorplans', () => {
  assert.equal(trailers.length, 59);
});

test('dataset passes full validation', () => {
  assert.equal(validateDataset(trailers), true);
});

test('year split is 31x2026 + 28x2025', () => {
  const c = trailers.reduce((m, t) => ((m[t.year] = (m[t.year] || 0) + 1), m), {});
  assert.equal(c[2026], 31);
  assert.equal(c[2025], 28);
});

test('all slugs unique', () => {
  assert.equal(new Set(trailers.map((t) => t.slug)).size, 59);
});

test('CCC always equals GVWR minus dry weight', () => {
  for (const t of trailers) assert.equal(t.cccLb, t.gvwrLb - t.weightLb, t.slug);
});

// The audited specs Ernie explicitly cares about — lock them with tests.
test('audited specs: Classic 33FB 2026', () => {
  const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
  assert.ok(t, 'classic-33fb-2026 exists');
  assert.equal(t.msrp, 222900);
  assert.equal(t.weightLb, 8425);
  assert.equal(t.gvwrLb, 10000);
  assert.equal(t.cccLb, 1575);
});

test('audited specs: Flying Cloud 25FB 2026', () => {
  const t = trailers.find((x) => x.slug === 'flying-cloud-25fb-2026');
  assert.ok(t);
  assert.equal(t.msrp, 118900);
});

test('audited specs: Basecamp 16X 2026', () => {
  const t = trailers.find((x) => x.slug === 'basecamp-16x-2026');
  assert.ok(t);
  assert.equal(t.weightLb, 2650);
  assert.equal(t.msrp, 54900);
});

test('validateTrailer catches a ccc mismatch', () => {
  const bad = { slug: 'x-1y-2026', model: 'X', floorplan: '1Y', year: 2026,
    msrp: 1000, weightLb: 100, gvwrLb: 200, cccLb: 999, sleeps: 2 };
  assert.ok(validateTrailer(bad).some((p) => p.includes('ccc mismatch')));
});

test('validateTrailer catches bad slug', () => {
  assert.ok(validateTrailer({ slug: 'Bad Slug!' }).some((p) => p.includes('bad slug')));
});

test('groupByModel covers all 12 families and every trailer', () => {
  const g = groupByModel(trailers);
  assert.equal(g.size, 12);
  assert.equal([...g.values()].reduce((n, a) => n + a.length, 0), 59);
});

test('filterTrailers by year', () => {
  assert.equal(filterTrailers(trailers, { year: 2026 }).length, 31);
  assert.equal(filterTrailers(trailers, { year: 2025 }).length, 28);
  assert.equal(filterTrailers(trailers, { year: 'all' }).length, 59);
});

test('filterTrailers by model + year together', () => {
  const r = filterTrailers(trailers, { year: 2026, model: 'Bambi' });
  assert.ok(r.length > 0);
  assert.ok(r.every((t) => t.year === 2026 && t.model === 'Bambi'));
});

test('modelNames + years', () => {
  assert.equal(modelNames(trailers).length, 12);
  assert.deepEqual(years(trailers), [2026, 2025]);
});

test('assetPaths shape', () => {
  const t = trailers.find((x) => x.slug === 'classic-33fb-2026');
  const a = assetPaths(t);
  assert.equal(a.thumb, 'assets/img/thumbs/classic-33fb-2026.jpg');
  assert.equal(a.hero, 'assets/img/heroes/classic.jpg');
  assert.equal(a.gallery.length, 3);
});

// --- Image-resolution regressions (the broken-image bugs we fixed) ---

test('slugify maps names to file slugs', () => {
  assert.equal(slugify('Flying Cloud'), 'flying-cloud');
  assert.equal(slugify('Basecamp XE'), 'basecamp-xe');
  assert.equal(slugify('Frank Lloyd Wright Limited Edition'), 'frank-lloyd-wright-limited-edition');
  assert.equal(slugify('Stetson 6666 Special Edition'), 'stetson-6666-special-edition');
});

test('every trailer hero is derived from the model (not heroFamily) and exists on disk', () => {
  for (const t of trailers) {
    const a = assetPaths(t);
    assert.equal(a.hero, `assets/img/heroes/${slugify(t.model)}.jpg`, t.slug);
    assert.ok(hasAsset(a.hero), `missing hero file for ${t.slug}: ${a.hero}`);
  }
});

test('all 12 model families have a hero file on disk', () => {
  const families = [...new Set(trailers.map((t) => slugify(t.model)))];
  assert.equal(families.length, 12);
  for (const f of families) {
    assert.ok(hasAsset(`assets/img/heroes/${f}.jpg`), `missing hero: ${f}`);
  }
});

test('twinSlug flips the model year', () => {
  assert.equal(twinSlug({ slug: 'bambi-16rb-2026', year: 2026 }), 'bambi-16rb-2025');
  assert.equal(twinSlug({ slug: 'bambi-16rb-2025', year: 2025 }), 'bambi-16rb-2026');
});

test('resolveAssets: every emitted gallery + hero path exists on disk', () => {
  for (const t of trailers) {
    const a = resolveAssets(t, hasAsset);
    if (a.hero) assert.ok(hasAsset(a.hero), `${t.slug} hero ${a.hero}`);
    for (const g of a.gallery) assert.ok(hasAsset(g), `${t.slug} gallery ${g}`);
  }
});

test('resolveAssets: 2026 models with no own gallery fall back to their 2025 twin', () => {
  const t = trailers.find((x) => x.slug === 'bambi-16rb-2026');
  assert.ok(t);
  const a = resolveAssets(t, hasAsset);
  assert.equal(a.gallery.length, 3);
  assert.ok(a.gallery.every((g) => g.includes('bambi-16rb-2025-')), 'should use 2025 twin files');
});

test('resolveAssets: orphan with no gallery + no twin renders hero-only, never broken', () => {
  const t = trailers.find((x) => x.slug === 'world-traveler-22rb-2026');
  assert.ok(t);
  const a = resolveAssets(t, hasAsset);
  assert.equal(a.gallery.length, 0);           // no broken <img> emitted
  assert.ok(a.hero && hasAsset(a.hero));        // but still has its family hero
});

test('resolveAssets: no trailer is missing BOTH hero and gallery', () => {
  for (const t of trailers) {
    const a = resolveAssets(t, hasAsset);
    assert.ok(a.hero || a.gallery.length > 0, `${t.slug} would render image-less`);
  }
});
