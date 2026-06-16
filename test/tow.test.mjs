import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateTow, gradeFraction, formatPct,
  loadVehicles, validateVehicle, validateVehicles,
  TONGUE_PCT_LOADED, COMFORT_CEILING, CAUTION_CEILING, DEFAULT_TRUCK_OCCUPANT_LB,
} from '../src/lib/tow.mjs';

// A representative half-ton-ish truck and a mid-size trailer, round numbers so
// the arithmetic is checkable by hand.
const TRUCK = {
  id: 'test-truck', name: 'Test Truck', year: 2025, config: '4x4 V8',
  maxTowLb: 11000, payloadLb: 2000, gvwrLb: 7600, gcwrLb: 18000, curbWeightLb: 5600,
  sources: ['https://example.com/spec'],
};
// Trailer loaded to GVWR 7600, dry 6000, dry hitch 850.
const TRAILER = { gvwrLb: 7600, weightLb: 6000, hitchWeightLb: 850 };

test('evaluateTow: tongue weight is a loaded % of trailer GVWR, not the dry figure', () => {
  const r = evaluateTow(TRUCK, TRAILER, { truckLoadLb: 0 });
  // 7600 * 0.13 = 988 (rounded). NOT the published dry 850.
  assert.equal(r.tongueLoadedLb, Math.round(7600 * TONGUE_PCT_LOADED));
  assert.equal(r.tongueLoadedLb, 988);
  assert.equal(r.trailerLoadedLb, 7600);
});

test('evaluateTow: three checks computed against the real ratings', () => {
  const r = evaluateTow(TRUCK, TRAILER, { truckLoadLb: 300 });
  const byKey = Object.fromEntries(r.checks.map((c) => [c.key, c]));
  // tow: 7600 / 11000
  assert.ok(Math.abs(byKey.tow.frac - 7600 / 11000) < 1e-9);
  // payload: tongue(988) + truckLoad(300) = 1288 / 2000
  assert.equal(byKey.payload.used, 988 + 300);
  assert.ok(Math.abs(byKey.payload.frac - 1288 / 2000) < 1e-9);
  // gcwr: trailer 7600 + curb 5600 + load 300 = 13500 / 18000
  assert.equal(byKey.gcwr.used, 7600 + 5600 + 300);
  assert.ok(Math.abs(byKey.gcwr.frac - 13500 / 18000) < 1e-9);
});

test('evaluateTow: binding limit is the highest usage fraction', () => {
  const r = evaluateTow(TRUCK, TRAILER, { truckLoadLb: 300 });
  // fractions: tow .69, payload .644, gcwr .75 -> gcwr binds
  assert.equal(r.binding.key, 'gcwr');
});

test('evaluateTow: payload is the quiet killer — a truck under tow rating can still fail on payload', () => {
  // Truck that easily tows the trailer (tow rating huge, GCWR huge) but has a
  // tiny payload — the loaded tongue weight blows it.
  const lightPayload = { ...TRUCK, maxTowLb: 20000, gcwrLb: 30000, payloadLb: 1100 };
  const r = evaluateTow(lightPayload, TRAILER, { truckLoadLb: 300 });
  // payload used = 988 + 300 = 1288 > 1100 -> over
  assert.equal(r.binding.key, 'payload');
  assert.equal(r.verdict, 'over');
});

test('evaluateTow: verdict is the worst grade across all checks', () => {
  // comfortable everywhere
  const easy = evaluateTow({ ...TRUCK, maxTowLb: 20000, gcwrLb: 40000, payloadLb: 4000 }, TRAILER, { truckLoadLb: 200 });
  assert.equal(easy.verdict, 'comfortable');
  // push one check into the tight band only
  const tight = evaluateTow({ ...TRUCK, maxTowLb: 9000, gcwrLb: 40000, payloadLb: 4000 }, TRAILER, { truckLoadLb: 200 });
  // tow frac = 7600/9000 = .844 -> tight
  assert.equal(tight.verdict, 'tight');
});

test('gradeFraction: comfortable / tight / over bands', () => {
  assert.equal(gradeFraction(0.5), 'comfortable');
  assert.equal(gradeFraction(COMFORT_CEILING), 'comfortable'); // exactly 80% is still comfortable
  assert.equal(gradeFraction(0.9), 'tight');
  assert.equal(gradeFraction(CAUTION_CEILING), 'tight'); // exactly 100% is tight, not over
  assert.equal(gradeFraction(1.01), 'over');
});

test('evaluateTow: more weight in the truck cab pushes payload + GCWR up', () => {
  const light = evaluateTow(TRUCK, TRAILER, { truckLoadLb: 100 });
  const heavy = evaluateTow(TRUCK, TRAILER, { truckLoadLb: 800 });
  const pLight = light.checks.find((c) => c.key === 'payload').frac;
  const pHeavy = heavy.checks.find((c) => c.key === 'payload').frac;
  assert.ok(pHeavy > pLight);
});

test('evaluateTow: default truck occupant load applies when not specified', () => {
  const r = evaluateTow(TRUCK, TRAILER);
  const payload = r.checks.find((c) => c.key === 'payload');
  assert.equal(payload.used, 988 + DEFAULT_TRUCK_OCCUPANT_LB);
});

test('formatPct: rounds to whole percent', () => {
  assert.equal(formatPct(0.694), '69%');
  assert.equal(formatPct(1.0), '100%');
  assert.equal(formatPct(Infinity), '—');
});

// ---- dataset contract ----

test('vehicle dataset loads and passes validation', () => {
  const vehicles = loadVehicles();
  assert.ok(vehicles.length >= 10, 'at least 10 tow vehicles');
  assert.equal(validateVehicles(vehicles), true);
});

test('validateVehicle: rejects missing sources / non-http source', () => {
  const base = { id: 'x', name: 'X', year: 2025, config: 'c', maxTowLb: 1, payloadLb: 1, gcwrLb: 1, sources: ['https://a.b'] };
  assert.equal(validateVehicle(base), true);
  assert.equal(validateVehicle({ ...base, sources: [] }), false);
  assert.equal(validateVehicle({ ...base, sources: ['ftp://a.b'] }), false);
  assert.equal(validateVehicle({ ...base, maxTowLb: 0 }), false);
  assert.equal(validateVehicle({ ...base, id: undefined }), false);
});

test('validateVehicles: rejects duplicate ids', () => {
  const a = { id: 'dup', name: 'A', year: 2025, config: 'c', maxTowLb: 1, payloadLb: 1, gcwrLb: 1, sources: ['https://a.b'] };
  const b = { ...a, name: 'B' };
  assert.equal(validateVehicles([a, b]), false);
});

test('every vehicle states a model year and a representative config', () => {
  for (const v of loadVehicles()) {
    assert.ok(v.year >= 2023 && v.year <= 2027, `${v.id} year in range`);
    assert.ok(typeof v.config === 'string' && v.config.length > 3, `${v.id} has config note`);
  }
});

// ---- default-vehicle picker ----

import { pickDefaultVehicle } from '../src/lib/tow.mjs';

test('pickDefaultVehicle: returns the lightest-duty vehicle that still tows comfortably', () => {
  const vehicles = [
    { id: 'heavy', name: 'Heavy', year: 2025, config: 'big', maxTowLb: 13000, payloadLb: 2000, gvwrLb: 7000, curbWeightLb: 5000, gcwrLb: 19000, sources: ['https://a.b'] },
    { id: 'mid', name: 'Mid', year: 2025, config: 'mid', maxTowLb: 9000, payloadLb: 1800, gvwrLb: 7400, curbWeightLb: 5500, gcwrLb: 14800, sources: ['https://a.b'] },
    { id: 'light', name: 'Light', year: 2025, config: 'small', maxTowLb: 3500, payloadLb: 1300, gvwrLb: 5000, curbWeightLb: 3700, gcwrLb: 8000, sources: ['https://a.b'] },
  ];
  // A light ~2,700 lb trailer: the Light tows it comfortably (tow 77%, payload ~50%,
  // combined 6,700/8,000 = 84%... ensure comfortable by keeping combined under 80%).
  const light = pickDefaultVehicle(vehicles, { gvwrLb: 2400, weightLb: 2000 });
  assert.equal(light.id, 'light');
  // A 7,600 lb trailer is too much for Light and Mid (payload/gcwr bind); Heavy is the comfortable one.
  const big = pickDefaultVehicle(vehicles, { gvwrLb: 7600, weightLb: 5650 });
  assert.equal(big.id, 'heavy');
});

test('pickDefaultVehicle: falls back to most capable when nothing is comfortable', () => {
  const vehicles = [
    { id: 'a', name: 'A', year: 2025, config: 'c', maxTowLb: 3500, payloadLb: 1300, gvwrLb: 6400, curbWeightLb: 5100, gcwrLb: 8900, sources: ['https://a.b'] },
    { id: 'b', name: 'B', year: 2025, config: 'c', maxTowLb: 6000, payloadLb: 1500, gvwrLb: 6400, curbWeightLb: 4800, gcwrLb: 11100, sources: ['https://a.b'] },
  ];
  // A 9,000 lb trailer is over both — expect the most capable (b) as best shot.
  const r = pickDefaultVehicle(vehicles, { gvwrLb: 9000, weightLb: 7500 });
  assert.equal(r.id, 'b');
});

test('pickDefaultVehicle: empty list returns null', () => {
  assert.equal(pickDefaultVehicle([], { gvwrLb: 5000 }), null);
});

test('the real dataset can default-match a representative trailer without throwing', () => {
  const vehicles = loadVehicles();
  const chosen = pickDefaultVehicle(vehicles, { gvwrLb: 7600, weightLb: 5650 });
  assert.ok(chosen && chosen.id, 'a vehicle is chosen');
});
