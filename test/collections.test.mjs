import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  COLLECTIONS, COLLECTION_KEYS, collectionByKey, isCollectionKey,
  collectionsFor, collectionCounts,
} from '../src/lib/collections.mjs';
import { toClientRecord } from '../src/lib/campgrounds.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'data', 'campgrounds.json'), 'utf8'),
).campgrounds;

test('every collection has the required editorial fields + a function test', () => {
  assert.ok(COLLECTIONS.length >= 5, 'expect a meaningful rail of collections');
  const seen = new Set();
  for (const c of COLLECTIONS) {
    assert.match(c.key, /^[a-z]{2}$/, `key "${c.key}" is a stable 2-char code`);
    assert.ok(!seen.has(c.key), `key "${c.key}" is unique`);
    seen.add(c.key);
    assert.ok(c.label && typeof c.label === 'string', `${c.key} has a label`);
    assert.ok(c.eyebrow && typeof c.eyebrow === 'string', `${c.key} has an eyebrow`);
    assert.ok(c.blurb && c.blurb.length > 30, `${c.key} has a real editorial blurb`);
    assert.equal(typeof c.test, 'function', `${c.key} has a predicate`);
  }
});

test('COLLECTION_KEYS mirrors COLLECTIONS order', () => {
  assert.deepEqual(COLLECTION_KEYS, COLLECTIONS.map((c) => c.key));
});

test('collectionByKey / isCollectionKey lookups', () => {
  assert.equal(collectionByKey('ed').label, "Editor's Picks");
  assert.equal(collectionByKey('zz'), undefined);
  assert.equal(collectionByKey(''), undefined);
  assert.equal(collectionByKey(undefined), undefined);
  assert.ok(isCollectionKey('np'));
  assert.ok(!isCollectionKey('zz'));
  assert.ok(!isCollectionKey(''));
  assert.ok(!isCollectionKey(null));
});

test("Editor's Picks: rating >= 4.5 AND reviews >= 100", () => {
  const ed = collectionByKey('ed').test;
  assert.ok(ed({ rating: 4.6, reviews: 200 }));
  assert.ok(ed({ rating: 4.5, reviews: 100 }));   // boundary
  assert.ok(!ed({ rating: 4.4, reviews: 9999 }));  // rating too low
  assert.ok(!ed({ rating: 5.0, reviews: 99 }));    // too few reviews
  assert.ok(!ed({}));                               // missing -> not a pick
});

test('Inside a National Park: matches "National Park" but NOT "National Parkway"', () => {
  const np = collectionByKey('np').test;
  assert.ok(np({ parent: 'Yosemite National Park' }));
  assert.ok(np({ parent: 'GRAND CANYON NATIONAL PARK' })); // case-insensitive
  assert.ok(!np({ parent: 'Blue Ridge Parkway' }));
  assert.ok(!np({ parent: 'Natchez Trace National Parkway' })); // the trap
  assert.ok(!np({ parent: 'Coconino National Forest' }));
  assert.ok(!np({}));
});

test('Dark-sky: stargazing/astronomy in activities only', () => {
  const ds = collectionByKey('ds').test;
  assert.ok(ds({ activities: ['Hiking', 'Star Gazing'] }));
  assert.ok(ds({ activities: ['Astronomy'] }));
  assert.ok(!ds({ activities: ['Hiking', 'Fishing'] }));
  assert.ok(!ds({ activities: [] }));
  assert.ok(!ds({})); // no activities -> not dark-sky (never guesses)
});

test('Alpine: elevation >= 7000 ft', () => {
  const al = collectionByKey('al').test;
  assert.ok(al({ elevationFt: 7000 }));   // boundary
  assert.ok(al({ elevationFt: 9200 }));
  assert.ok(!al({ elevationFt: 6999 }));
  assert.ok(!al({ elevationFt: 0 }));
  assert.ok(!al({}));                      // unknown elevation -> excluded
});

test('Lakeside: Army Corps of Engineers org variants', () => {
  const lk = collectionByKey('lk').test;
  assert.ok(lk({ org: 'US Army Corps of Engineers' }));
  assert.ok(lk({ org: 'Army Corps of Engineers' }));
  assert.ok(!lk({ org: 'National Park Service' }));
  assert.ok(!lk({}));
});

test('Full hookups: exact match on hookups === "full"', () => {
  const fh = collectionByKey('fh').test;
  assert.ok(fh({ hookups: 'full' }));
  assert.ok(!fh({ hookups: 'electric' }));
  assert.ok(!fh({ hookups: 'none' }));
  assert.ok(!fh({}));
});

test('collectionsFor returns membership keys in COLLECTIONS order', () => {
  // A campground that is an Editor's pick, inside an NP, and alpine.
  const c = { rating: 4.7, reviews: 500, parent: 'Rocky Mountain National Park', elevationFt: 8500 };
  assert.deepEqual(collectionsFor(c), ['ed', 'np', 'al']);
  assert.deepEqual(collectionsFor({}), []);
  assert.deepEqual(collectionsFor(null), []);
});

test('collectionCounts: every key present, matches manual count over live data', () => {
  const counts = collectionCounts(DATA);
  for (const k of COLLECTION_KEYS) assert.ok(k in counts, `count present for ${k}`);
  // Independent manual recount must agree exactly with the helper.
  for (const col of COLLECTIONS) {
    const manual = DATA.filter((c) => col.test(c)).length;
    assert.equal(counts[col.key], manual, `${col.key} count agrees with manual recount`);
    assert.ok(manual > 0, `${col.key} has at least one real campground (no empty chip)`);
  }
});

test('collectionCounts handles empty / non-array input safely', () => {
  const empty = collectionCounts([]);
  for (const k of COLLECTION_KEYS) assert.equal(empty[k], 0);
  const bad = collectionCounts(null);
  for (const k of COLLECTION_KEYS) assert.equal(bad[k], 0);
});

test('baked client record carries collection membership in .cl', () => {
  // Pick a known editor's-pick + NP campground from the live data and confirm
  // toClientRecord bakes the same keys collectionsFor computes from full data.
  const sample = DATA.find((c) => collectionsFor(c).length >= 2);
  assert.ok(sample, 'dataset has a multi-collection campground');
  const rec = toClientRecord(sample);
  assert.deepEqual(rec.cl, collectionsFor(sample),
    'baked .cl equals the full-record membership (no client-side drift)');
});

test('client record omits .cl when a campground is in no collection', () => {
  const none = { id: 'x', name: 'Nowhere', lat: 1, lon: 1, rating: 3.0, reviews: 5 };
  assert.equal(collectionsFor(none).length, 0);
  const rec = toClientRecord(none);
  assert.ok(rec.cl === undefined, '.cl omitted (slim) when membership is empty');
});
