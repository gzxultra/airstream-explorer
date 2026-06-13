import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  towFit, towFitLabel, sortTrailers, filterExplore, exploreTags, tagLabel, SORT_KEYS,
} from '../src/lib/explore.mjs';
import { loadTrailers } from '../src/lib/data.mjs';

const trailers = loadTrailers();

// ---- towFit: the safety math buyers depend on -----------------------------

test('towFit: comfortable when GVWR is well under tow rating', () => {
  const r = towFit(4000, 7000); // 57% used
  assert.equal(r.status, 'comfortable');
  assert.equal(r.headroomLb, 3000);
  assert.equal(r.usedPct, 57);
});

test('towFit: within-limit in the 80–100% band', () => {
  const r = towFit(6800, 7000); // 97% used — legal but tight
  assert.equal(r.status, 'within');
  assert.equal(r.headroomLb, 200);
});

test('towFit: exactly 80% is still comfortable (boundary)', () => {
  assert.equal(towFit(5600, 7000).status, 'comfortable'); // 5600 = 0.8*7000
});

test('towFit: just over 80% tips to within', () => {
  assert.equal(towFit(5601, 7000).status, 'within');
});

test('towFit: GVWR over tow rating is over (unsafe)', () => {
  const r = towFit(8000, 7000);
  assert.equal(r.status, 'over');
  assert.equal(r.headroomLb, -1000);
});

test('towFit: GVWR equal to tow rating is within (not over)', () => {
  assert.equal(towFit(7000, 7000).status, 'within');
});

test('towFitLabel covers all statuses', () => {
  assert.equal(towFitLabel('comfortable'), 'Comfortable tow');
  assert.equal(towFitLabel('within'), 'Within limit');
  assert.equal(towFitLabel('over'), 'Exceeds rating');
});

// ---- sorting ---------------------------------------------------------------

test('sortTrailers price-asc puts cheapest first, price-desc the reverse', () => {
  const asc = sortTrailers(trailers, 'price-asc');
  const desc = sortTrailers(trailers, 'price-desc');
  assert.ok(asc[0].msrp <= asc[asc.length - 1].msrp);
  assert.ok(desc[0].msrp >= desc[desc.length - 1].msrp);
  assert.equal(asc[0].msrp, 54900); // cheapest Basecamp
  assert.equal(desc[0].msrp, 222900); // Classic 33FB
});

test('sortTrailers is stable & deterministic for ties', () => {
  const a = sortTrailers(trailers, 'sleeps-desc');
  const b = sortTrailers(trailers, 'sleeps-desc');
  assert.deepEqual(a.map((t) => t.slug), b.map((t) => t.slug));
});

test('every SORT_KEYS entry has a label and accessor', () => {
  for (const [k, def] of Object.entries(SORT_KEYS)) {
    assert.ok(def.label, `${k} label`);
    assert.equal(typeof def.get, 'function', `${k} get`);
    assert.ok(def.dir === 1 || def.dir === -1, `${k} dir`);
  }
});

// ---- filtering -------------------------------------------------------------

test('filterExplore by towRating drops trailers that exceed it', () => {
  const out = filterExplore(trailers, { towRating: 5000 });
  assert.ok(out.length > 0);
  for (const t of out) assert.ok(t.gvwrLb <= 5000, `${t.slug} gvwr ${t.gvwrLb}`);
});

test('filterExplore free-text matches model or floorplan, case-insensitive', () => {
  const out = filterExplore(trailers, { q: 'bambi' });
  assert.ok(out.length > 0);
  for (const t of out) assert.match(`${t.model} ${t.floorplan}`.toLowerCase(), /bambi/);
  assert.equal(filterExplore(trailers, { q: '33fb' }).every((t) => /33fb/i.test(t.floorplan)), true);
});

test('filterExplore sleeps + price combine (AND)', () => {
  const out = filterExplore(trailers, { sleepsMin: 6, msrpMax: 140000 });
  for (const t of out) {
    assert.ok(t.sleeps >= 6, t.slug);
    assert.ok(t.msrp <= 140000, t.slug);
  }
});

test('filterExplore tags require ALL listed tags', () => {
  const out = filterExplore(trailers, { tags: ['off-grid', 'luxury'] });
  for (const t of out) {
    assert.ok(t.tags.includes('off-grid') && t.tags.includes('luxury'), t.slug);
  }
});

test('filterExplore year narrows to one model year', () => {
  assert.ok(filterExplore(trailers, { year: 2026 }).every((t) => t.year === 2026));
  assert.equal(filterExplore(trailers, { year: 2026 }).length, 31);
});

test('filterExplore with no opts returns everything', () => {
  assert.equal(filterExplore(trailers, {}).length, trailers.length);
});

// ---- tags ------------------------------------------------------------------

test('exploreTags returns curated order, only present tags', () => {
  const tags = exploreTags(trailers);
  assert.ok(tags.includes('off-grid'));
  assert.ok(tags.includes('family'));
  // curated order: couples/solo/family before luxury
  assert.ok(tags.indexOf('family') < tags.indexOf('luxury'));
});

test('tagLabel prettifies underscores and casing', () => {
  assert.equal(tagLabel('national_parks'), 'National parks');
  assert.equal(tagLabel('off-grid'), 'Off-grid');
  assert.equal(tagLabel('solo'), 'Solo');
});
