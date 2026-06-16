// CLIENT PARITY TRIPWIRE
// ----------------------------------------------------------------------------
// app.js ships a hand-written copy of the campsite-fit math (trailerFit,
// hookupMatch, nightsHere, elevationContext, inElevationBand) so the finder can
// compute fit without a network round-trip. That copy MUST stay byte-for-output
// identical to the source of truth in src/lib/campsite-fit.mjs — otherwise the
// finder and the detail page would silently disagree about whether a rig fits.
//
// This test extracts the marked PARITY-MIRROR block straight out of app.js,
// evaluates it in isolation, and runs BOTH copies over the same fixtures,
// asserting identical outputs. If anyone edits one copy and not the other, the
// extracted functions diverge and this test fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import {
  trailerFit as srcTrailerFit,
  hookupMatch as srcHookupMatch,
  nightsHere as srcNightsHere,
  elevationContext as srcElevationContext,
  peakSunHoursAt as srcPeakSunHoursAt,
  inElevationBand as srcInElevationBand,
  ELEVATION_BANDS as SRC_BANDS,
} from '../src/lib/campsite-fit.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = join(__dirname, '..', 'src', 'assets', 'js', 'app.js');

// ---- extract the marked mirror block out of app.js and eval it -------------
function loadClientMirror() {
  const src = readFileSync(APP, 'utf8');
  const begin = src.indexOf('/* PARITY-MIRROR:BEGIN');
  const end = src.indexOf('/* PARITY-MIRROR:END */');
  assert.ok(begin >= 0 && end > begin, 'PARITY-MIRROR markers must exist in app.js');
  const block = src.slice(src.indexOf('*/', begin) + 2, end);
  // The block references CLEARANCE from the enclosing app.js scope; supply it.
  const wrapped = `'use strict';
    var CLEARANCE = 3;
    ${block}
    ({ trailerFit: trailerFit, hookupMatch: hookupMatch, nightsHere: nightsHere,
       elevationContext: elevationContext, peakSunHoursAt: peakSunHoursAt,
       inElevationBand: inElevationBand, ELEVATION_BANDS: ELEVATION_BANDS });`;
  return vm.runInThisContext(wrapped);
}

const client = loadClientMirror();

// A representative trailer (Flying Cloud 25FB-ish), same as campsite-fit.test.
const FC25 = {
  slug: 'flying-cloud-25fb', model: 'Flying Cloud', floorplan: '25FB',
  lengthFt: 25.0, batteryKwh: 1.3, solarW: 270, freshGal: 54, grayGal: 37, blackGal: 39,
};

// Fixtures expressed in BOTH shapes: the source reads camelCase fields, the
// client reads the slim record keys (th/tm). Histograms are identical content.
const HISTS = [
  { '15': 44, '16': 4, '21': 6, '25': 23, '27': 37, '30': 22 }, // Mather-like
  { '44': 1, '50': 2, '55': 7, '90': 9, '175': 1 },             // big-rig park
  { '20': 5 },                                                   // tiny park
  {},                                                            // empty → unverified
];

test('parity: trailerFit identical for source vs client mirror across lengths', () => {
  const lengths = [16.25, 19, 22.5, 25, 28.83, 31.42, 33.25, 40];
  for (const hist of HISTS) {
    const srcCg = { trailerLenHistogram: hist, trailerMaxFt: 30 };
    const cliCg = { th: hist, tm: 30 };
    for (const L of lengths) {
      const a = srcTrailerFit(srcCg, L);
      const b = client.trailerFit(cliCg, L);
      assert.deepEqual(b, a, `trailerFit mismatch at ${L}ft on ${JSON.stringify(hist)}`);
    }
  }
  // null/absent histogram → both unverified
  assert.deepEqual(client.trailerFit({ tm: 12 }, 25), srcTrailerFit({ trailerMaxFt: 12 }, 25));
});

test('parity: hookupMatch identical for every level + amp combo', () => {
  const levels = ['full', 'electric', 'none', null, undefined];
  const amps = [[], [30], [50], [30, 50], [20, 30]];
  for (const h of levels) {
    for (const a of amps) {
      assert.deepEqual(client.hookupMatch(h, a), srcHookupMatch(h, a),
        `hookupMatch mismatch for ${h} / ${JSON.stringify(a)}`);
    }
  }
});

test('parity: peakSunHoursAt identical across seasons + latitudes', () => {
  for (const season of ['summer', 'shoulder', 'winter', 'bogus']) {
    for (const lat of [null, 25, 35, 48, 64.5, -33]) {
      assert.deepEqual(client.peakSunHoursAt(season, lat), srcPeakSunHoursAt(season, lat),
        `peakSunHoursAt mismatch ${season}/${lat}`);
    }
  }
});

test('parity: nightsHere days/limiter identical at varied parks', () => {
  const opts = [
    { people: 2, intensity: 'moderate', season: 'summer', useSolar: true, lat: 36.05 },
    { people: 4, intensity: 'heavy', season: 'winter', useSolar: true, lat: 47.6 },
    { people: 1, intensity: 'light', season: 'shoulder', useSolar: false, lat: 25.7 },
    { people: 2, intensity: 'moderate', season: 'summer', useSolar: true, lat: null },
  ];
  for (const o of opts) {
    const a = srcNightsHere(FC25, o);
    const b = client.nightsHere(FC25, o);
    // The client returns a slim shape; compare the fields it ships.
    assert.equal(b.limiter, a.limiter, `limiter mismatch ${JSON.stringify(o)}`);
    assert.ok(Math.abs(b.days - a.days) < 1e-9, `days mismatch ${JSON.stringify(o)}: ${b.days} vs ${a.days}`);
    assert.equal(b.pshRefined, a.pshRefined);
    assert.ok(Math.abs(b.psh - a.psh) < 1e-9);
  }
});

test('parity: elevationContext + ELEVATION_BANDS + inElevationBand identical', () => {
  for (const ft of [null, undefined, 0, 1999, 2000, 4999, 5000, 7999, 8000, 11000]) {
    assert.deepEqual(client.elevationContext(ft), srcElevationContext(ft), `elevationContext mismatch ${ft}`);
  }
  assert.deepEqual(client.ELEVATION_BANDS, SRC_BANDS, 'elevation bands must match');
  for (const key of ['', 'low', 'moderate', 'elevated', 'high', 'bogus']) {
    for (const ft of [null, 500, 3000, 6000, 9000]) {
      assert.equal(client.inElevationBand(ft, key), srcInElevationBand(ft, key),
        `inElevationBand mismatch ${ft}/${key}`);
    }
  }
});
