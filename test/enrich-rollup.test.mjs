import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollupCampsites } from '../scripts/campdata/enrich.mjs';

// Locks the per-campsite rollup that enrich.mjs bakes into campgrounds.json.
// Exercised against the two committed Recreation.gov fixtures so the honest
// trailer-length / hookup derivations can't silently regress.
const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const sites = (f) => JSON.parse(readFileSync(join(FIX, f), 'utf8')).campsites;
const amen = (f) => {
  const d = JSON.parse(readFileSync(join(FIX, f), 'utf8'));
  return (d.campground || d).amenities || null;
};

const MATHER = () => rollupCampsites(
  sites('recgov-campsites-mather-232490.json'),
  amen('recgov-facility-mather-232490.json'),
);
const GUNTER = () => rollupCampsites(
  sites('recgov-campsites-gunterhill-232593.json'),
  amen('recgov-facility-gunterhill-232593.json'),
);

// ---------------------------------------------------------------------------
// Mather (Grand Canyon) — a NO-hookup park. The honest trailer cap is 30 ft and
// the spread is wide (44 sites cap at 15 ft); the old single maxLengthFt hid it.
// ---------------------------------------------------------------------------
test('Mather: hookups derived as "none" (no electric attribute anywhere)', () => {
  assert.equal(MATHER().hookups, 'none');
  assert.deepEqual(MATHER().ampService, []);
});

test('Mather: trailerMaxFt is the honest 30 ft, not a bus figure', () => {
  assert.equal(MATHER().trailerMaxFt, 30);
});

test('Mather: histogram shows the real spread, including short caps', () => {
  const h = MATHER().trailerLenHistogram;
  assert.equal(h['15'], 44, '44 sites cap at 15 ft');
  assert.equal(h['30'], 22, '22 sites reach 30 ft');
  assert.ok(!h['33'], 'ZERO sites take 33 ft — the accuracy fix');
});

test('Mather: facility amenities read correctly (dump + flush, no showers)', () => {
  const r = MATHER();
  assert.equal(r.dumpStation, true);
  assert.equal(r.flushToilets, true);
  assert.equal(r.showers, false);
});

test('Mather: MANAGEMENT sites excluded from public/site rollups', () => {
  // 357 raw sites, 69 MANAGEMENT → 288 guest-bookable.
  assert.equal(MATHER().publicSiteCount, 288);
});

// ---------------------------------------------------------------------------
// Gunter Hill (USACE) — full hookups, 50 amp. Proves the NONELECTRIC substring
// trap is avoided and sewer/full upgrades the verdict to "full".
// ---------------------------------------------------------------------------
test('Gunter Hill: hookups "full" (75 sites carry Sewer/Full Hookup)', () => {
  assert.equal(GUNTER().hookups, 'full');
});

test('Gunter Hill: 50-amp service detected', () => {
  assert.deepEqual(GUNTER().ampService, [50]);
});

test('Gunter Hill: showers true from facility amenities', () => {
  assert.equal(GUNTER().showers, true);
});

test('Gunter Hill: pull-through sites detected', () => {
  assert.equal(GUNTER().hasPullThrough, true);
});

// ---------------------------------------------------------------------------
// Honesty guarantees — missing data must READ as missing, never invented.
// ---------------------------------------------------------------------------
test('empty campsites → unverified, never zeroed', () => {
  const r = rollupCampsites([], {});
  assert.equal(r.unverified, true);
  assert.equal(r.hookups, undefined, 'no fabricated "none"');
  assert.equal(r.trailerMaxFt, undefined, 'no fabricated 0');
});

test('all-MANAGEMENT campground → unverified (no guest-bookable sites)', () => {
  const r = rollupCampsites([
    { campsite_type: 'MANAGEMENT', type_of_use: 'Overnight', permitted_equipment: [], attributes: [] },
  ], {});
  assert.equal(r.unverified, true);
});

test('NONELECTRIC substring trap: type string never decides hookups', () => {
  // A site typed "STANDARD NONELECTRIC" with NO electric attribute must be "none".
  const r = rollupCampsites([{
    campsite_type: 'STANDARD NONELECTRIC',
    type_of_use: 'Overnight',
    permitted_equipment: [{ equipment_name: 'Trailer', max_length: 25 }],
    attributes: [{ attribute_name: 'Max Vehicle Length', attribute_value: 25 }],
  }], {});
  assert.equal(r.hookups, 'none');
  assert.equal(r.trailerMaxFt, 25);
});

test('electric without sewer → "electric"; with sewer → "full"', () => {
  const base = (attrs) => rollupCampsites([{
    campsite_type: 'STANDARD ELECTRIC', type_of_use: 'Overnight',
    permitted_equipment: [{ equipment_name: 'RV', max_length: 40 }],
    attributes: attrs,
  }], {});
  assert.equal(base([{ attribute_name: 'Electricity Hookup', attribute_value: '30' }]).hookups, 'electric');
  assert.equal(base([
    { attribute_name: 'Electricity Hookup', attribute_value: '50' },
    { attribute_name: 'Sewer Hookup', attribute_value: 'Y' },
  ]).hookups, 'full');
});

test('trailerMaxFt uses Trailer/RV/Fifth equipment, ignores Tent/Car length', () => {
  const r = rollupCampsites([{
    campsite_type: 'STANDARD NONELECTRIC', type_of_use: 'Overnight',
    permitted_equipment: [
      { equipment_name: 'Tent', max_length: 99 }, // must NOT win
      { equipment_name: 'Trailer', max_length: 28 },
    ],
    attributes: [],
  }], {});
  assert.equal(r.trailerMaxFt, 28);
});
