import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadTrailers, validateTrailer, validateDataset, groupByModel,
  modelNames, years, filterTrailers, assetPaths,
} from '../src/lib/data.mjs';

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
