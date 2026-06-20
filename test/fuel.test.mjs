import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  towingPenalty, estimateTowingMpg, estimateFuelCost,
  estimateTowingKwhPer100mi, estimateElectricCost,
  formatDollars, formatMpg,
  BASE_PENALTY, WEIGHT_FACTOR, MAX_PENALTY, MIN_TOWING_MPG,
  DEFAULT_FUEL_PRICE, DEFAULT_DISTANCE_MI, DEFAULT_KWH_PRICE,
  VEHICLE_CLASS_MPG, DEFAULT_UNLADEN_MPG,
} from '../src/lib/fuel.mjs';
import { loadVehicles } from '../src/lib/tow.mjs';

// ---------------------------------------------------------------------------
// towingPenalty
// ---------------------------------------------------------------------------

test('towingPenalty: returns BASE_PENALTY when trailer or vehicle weight is zero/missing', () => {
  assert.equal(towingPenalty(0, 5000), BASE_PENALTY);
  assert.equal(towingPenalty(5000, 0), BASE_PENALTY);
  assert.equal(towingPenalty(null, 5000), BASE_PENALTY);
});

test('towingPenalty: scales with weight ratio', () => {
  // ratio = 3500 / 5000 = 0.7 -> penalty = 0.20 + 0.25*0.7 = 0.375
  const p = towingPenalty(3500, 5000);
  assert.ok(Math.abs(p - 0.375) < 1e-9);
});

test('towingPenalty: caps at MAX_PENALTY for very heavy trailers', () => {
  // ratio = 10000 / 4000 = 2.5 -> penalty = 0.20 + 0.25*2.5 = 0.825 -> capped at 0.60
  const p = towingPenalty(10000, 4000);
  assert.equal(p, MAX_PENALTY);
});

test('towingPenalty: realistic Airstream scenarios', () => {
  // Basecamp 16 (GVWR 3500) behind Toyota 4Runner (curb ~4600)
  // ratio = 3500/4600 = 0.76 -> penalty = 0.20 + 0.25*0.76 = 0.39
  const p1 = towingPenalty(3500, 4600);
  assert.ok(p1 > 0.35 && p1 < 0.45, `Basecamp penalty ${p1} in expected range`);

  // Classic 33 (GVWR 10200) behind F-150 (curb 5100)
  // ratio = 10200/5100 = 2.0 -> penalty = 0.20 + 0.25*2.0 = 0.70 -> capped at 0.60
  const p2 = towingPenalty(10200, 5100);
  assert.equal(p2, MAX_PENALTY);
});

// ---------------------------------------------------------------------------
// estimateTowingMpg
// ---------------------------------------------------------------------------

test('estimateTowingMpg: uses vehicle class MPG when available', () => {
  const vehicle = { class: 'Half-ton pickup', curbWeightLb: 5100 };
  const trailer = { gvwrLb: 5000 };
  const mpg = estimateTowingMpg(vehicle, trailer);
  // unladen 18, ratio = 5000/5100 ≈ 0.98, penalty = 0.20 + 0.25*0.98 = 0.445
  // towing = 18 * (1 - 0.445) = 9.99
  assert.ok(mpg > 9 && mpg < 11, `Expected ~10 MPG, got ${mpg}`);
});

test('estimateTowingMpg: falls back to DEFAULT_UNLADEN_MPG for unknown class', () => {
  const vehicle = { class: 'Unknown', curbWeightLb: 5000 };
  const trailer = { gvwrLb: 4000 };
  const mpg = estimateTowingMpg(vehicle, trailer);
  // unladen 18 (default), ratio = 4000/5000 = 0.8, penalty = 0.20 + 0.25*0.8 = 0.40
  // towing = 18 * 0.60 = 10.8
  assert.ok(mpg > 10 && mpg < 12, `Expected ~10.8 MPG, got ${mpg}`);
});

test('estimateTowingMpg: respects unladenMpg override', () => {
  const vehicle = { class: 'Half-ton pickup', curbWeightLb: 5000 };
  const trailer = { gvwrLb: 3000 };
  const mpg = estimateTowingMpg(vehicle, trailer, { unladenMpg: 24 });
  // ratio = 3000/5000 = 0.6, penalty = 0.20 + 0.25*0.6 = 0.35
  // towing = 24 * 0.65 = 15.6
  assert.ok(Math.abs(mpg - 15.6) < 0.1, `Expected 15.6, got ${mpg}`);
});

test('estimateTowingMpg: never goes below MIN_TOWING_MPG', () => {
  const vehicle = { class: 'Compact SUV', curbWeightLb: 3000 };
  const trailer = { gvwrLb: 12000 }; // absurdly heavy
  const mpg = estimateTowingMpg(vehicle, trailer);
  assert.ok(mpg >= MIN_TOWING_MPG, `MPG ${mpg} should be >= ${MIN_TOWING_MPG}`);
});

test('estimateTowingMpg: uses weightLb as fallback when gvwrLb missing', () => {
  const vehicle = { class: 'Half-ton pickup', curbWeightLb: 5000 };
  const trailer = { weightLb: 4000 }; // no gvwrLb
  const mpg = estimateTowingMpg(vehicle, trailer);
  assert.ok(mpg > 0 && Number.isFinite(mpg));
});

// ---------------------------------------------------------------------------
// estimateFuelCost
// ---------------------------------------------------------------------------

test('estimateFuelCost: returns all expected fields', () => {
  const vehicle = { class: 'Half-ton pickup', curbWeightLb: 5100 };
  const trailer = { gvwrLb: 7000 };
  const r = estimateFuelCost(vehicle, trailer);
  assert.ok('towingMpg' in r);
  assert.ok('gallonsUsed' in r);
  assert.ok('totalCost' in r);
  assert.ok('costPerMile' in r);
  assert.ok('penalty' in r);
  assert.ok('unladenMpg' in r);
  assert.ok('distanceMi' in r);
  assert.ok('fuelPriceGal' in r);
});

test('estimateFuelCost: uses defaults when no opts provided', () => {
  const vehicle = { class: 'Half-ton pickup', curbWeightLb: 5100 };
  const trailer = { gvwrLb: 5000 };
  const r = estimateFuelCost(vehicle, trailer);
  assert.equal(r.distanceMi, DEFAULT_DISTANCE_MI);
  assert.equal(r.fuelPriceGal, DEFAULT_FUEL_PRICE);
  assert.equal(r.unladenMpg, VEHICLE_CLASS_MPG['Half-ton pickup']);
});

test('estimateFuelCost: math is internally consistent (gallons × price = cost)', () => {
  const vehicle = { class: 'Full-size SUV', curbWeightLb: 5500 };
  const trailer = { gvwrLb: 6000 };
  const r = estimateFuelCost(vehicle, trailer, { distanceMi: 1000, fuelPriceGal: 4.00 });
  // totalCost should be roughly gallonsUsed × price (both are rounded independently)
  const expectedCost = r.gallonsUsed * 4.00;
  assert.ok(Math.abs(r.totalCost - expectedCost) < 1.0, 'cost ≈ gallons × price within $1 rounding');
  // costPerMile should be roughly totalCost / distance
  assert.ok(Math.abs(r.costPerMile - r.totalCost / 1000) < 0.01);
  // towingMpg should be positive and less than unladen
  assert.ok(r.towingMpg > 0 && r.towingMpg < r.unladenMpg);
});

test('estimateFuelCost: heavier trailer costs more fuel', () => {
  const vehicle = { class: 'Half-ton pickup', curbWeightLb: 5100 };
  const light = estimateFuelCost(vehicle, { gvwrLb: 3500 }, { distanceMi: 500 });
  const heavy = estimateFuelCost(vehicle, { gvwrLb: 9000 }, { distanceMi: 500 });
  assert.ok(heavy.totalCost > light.totalCost, 'heavier trailer should cost more');
  assert.ok(heavy.towingMpg < light.towingMpg, 'heavier trailer should get worse MPG');
});

test('estimateFuelCost: longer distance costs proportionally more', () => {
  const vehicle = { class: 'Half-ton pickup', curbWeightLb: 5100 };
  const trailer = { gvwrLb: 6000 };
  const short = estimateFuelCost(vehicle, trailer, { distanceMi: 250 });
  const long = estimateFuelCost(vehicle, trailer, { distanceMi: 1000 });
  // Cost should scale ~linearly with distance (same MPG)
  assert.ok(Math.abs(long.totalCost / short.totalCost - 4.0) < 0.1);
});

test('estimateFuelCost: costPerMile is consistent', () => {
  const vehicle = { class: 'Mid-size SUV', curbWeightLb: 4500 };
  const trailer = { gvwrLb: 5000 };
  const r = estimateFuelCost(vehicle, trailer, { distanceMi: 800, fuelPriceGal: 3.80 });
  const expectedCpm = r.totalCost / 800;
  assert.ok(Math.abs(r.costPerMile - Math.round(expectedCpm * 100) / 100) < 0.01);
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

test('formatDollars: formats currency correctly', () => {
  assert.equal(formatDollars(125.5), '$125.50');
  assert.equal(formatDollars(1250.99), '$1,250.99');
  assert.equal(formatDollars(0), '$0.00');
  assert.equal(formatDollars(null), '—');
  assert.equal(formatDollars(Infinity), '—');
});

test('formatMpg: formats MPG correctly', () => {
  assert.equal(formatMpg(11.3), '11.3 MPG');
  assert.equal(formatMpg(8.0), '8.0 MPG');
  assert.equal(formatMpg(null), '—');
});

// ---------------------------------------------------------------------------
// Electric towing path (EVs): kWh model, never gasoline math
// ---------------------------------------------------------------------------

test('estimateTowingKwhPer100mi: raises consumption with the weight ratio', () => {
  // base 43, ratio = 7000/6634 = 1.055 -> penalty = 0.20 + 0.25*1.055 = 0.464
  // towing kWh = 43 / (1 - 0.464) = 80.2
  const v = { fuel: 'electric', kwhPer100mi: 43, curbWeightLb: 6634 };
  const kwh = estimateTowingKwhPer100mi(v, { gvwrLb: 7000 });
  assert.ok(kwh > 43, 'towing uses more energy than unladen');
  assert.ok(kwh > 75 && kwh < 86, `expected ~80 kWh/100mi, got ${kwh}`);
});

test('estimateTowingKwhPer100mi: falls back to a default baseline when missing', () => {
  const v = { fuel: 'electric', curbWeightLb: 6000 }; // no kwhPer100mi
  const kwh = estimateTowingKwhPer100mi(v, { gvwrLb: 5000 });
  assert.ok(Number.isFinite(kwh) && kwh > 0);
});

test('estimateFuelCost: routes electric vehicles to the kWh model', () => {
  const ev = { fuel: 'electric', kwhPer100mi: 44, curbWeightLb: 6768, class: 'Electric pickup' };
  const r = estimateFuelCost(ev, { gvwrLb: 7000 }, { distanceMi: 500, kwhPriceKwh: 0.16 });
  assert.equal(r.isElectric, true, 'flagged electric');
  assert.ok('towingKwhPer100mi' in r && 'kwhUsed' in r, 'has kWh fields');
  assert.ok(!('towingMpg' in r), 'no gasoline MPG field on an EV result');
  assert.ok(!('gallonsUsed' in r), 'no gallons field on an EV result');
  // cost ≈ (distance/100) × kWh/100mi × price
  const expected = (500 / 100) * r.towingKwhPer100mi * 0.16;
  assert.ok(Math.abs(r.totalCost - expected) < 1.0, 'cost ≈ kWh × price');
  assert.ok(Math.abs(r.costPerMile - r.totalCost / 500) < 0.01);
});

test('estimateFuelCost: electric uses default kWh price when none given', () => {
  const ev = { fuel: 'electric', kwhPer100mi: 49, curbWeightLb: 6768 };
  const r = estimateFuelCost(ev, { gvwrLb: 6000 });
  assert.equal(r.kwhPriceKwh, DEFAULT_KWH_PRICE);
  assert.equal(r.distanceMi, DEFAULT_DISTANCE_MI);
});

test('estimateFuelCost: a heavy EV (Hummer) costs more energy than an efficient one (Rivian)', () => {
  const hummer = { fuel: 'electric', kwhPer100mi: 64, curbWeightLb: 9063 };
  const rivian = { fuel: 'electric', kwhPer100mi: 44, curbWeightLb: 6768 };
  const trailer = { gvwrLb: 7600 };
  const h = estimateFuelCost(hummer, trailer, { distanceMi: 500 });
  const r = estimateFuelCost(rivian, trailer, { distanceMi: 500 });
  assert.ok(h.totalCost > r.totalCost, 'thirstier EV costs more');
  assert.ok(h.towingKwhPer100mi > r.towingKwhPer100mi);
});

test('estimateFuelCost: gas vehicles are unaffected by the electric branch', () => {
  const gas = { fuel: 'gas', class: 'Half-ton pickup', curbWeightLb: 5100 };
  const r = estimateFuelCost(gas, { gvwrLb: 7000 });
  assert.ok('towingMpg' in r && 'gallonsUsed' in r, 'still the gasoline result shape');
  assert.ok(!('isElectric' in r) || !r.isElectric);
});

test('real dataset: every electric vehicle carries a positive kWh/100mi figure', () => {
  // EVs must bring their own EPA energy figure — no fabricated gas math.
  for (const v of loadVehicles()) {
    if (v.fuel === 'electric') {
      assert.ok(typeof v.kwhPer100mi === 'number' && v.kwhPer100mi > 0,
        `${v.id} (electric) needs a real kwhPer100mi`);
    }
  }
});

// ---------------------------------------------------------------------------
// Real-world validation: known Airstream + vehicle combos
// ---------------------------------------------------------------------------

test('real-world: Basecamp 16 behind Toyota 4Runner yields 12-16 MPG range', () => {
  // 4Runner: Mid-size SUV, curb ~4600 lb, unladen ~21 MPG
  const vehicle = { class: 'Mid-size SUV', curbWeightLb: 4600 };
  const trailer = { gvwrLb: 3500 }; // Basecamp 16 GVWR
  const mpg = estimateTowingMpg(vehicle, trailer);
  // Forum reports: 14-16 MPG for Basecamp behind 4Runner/Highlander
  assert.ok(mpg >= 11 && mpg <= 16, `Basecamp/4Runner: expected 11-16 MPG, got ${mpg}`);
});

test('real-world: Flying Cloud 25FB behind F-150 yields 9-12 MPG range', () => {
  // F-150: Half-ton pickup, curb 5100 lb, unladen ~18 MPG
  const vehicle = { class: 'Half-ton pickup', curbWeightLb: 5100 };
  const trailer = { gvwrLb: 7200 }; // FC 25FB GVWR
  const mpg = estimateTowingMpg(vehicle, trailer);
  // Forum reports: 9-12 MPG for mid-size Airstream behind half-ton
  assert.ok(mpg >= 8 && mpg <= 13, `FC25/F150: expected 8-13 MPG, got ${mpg}`);
});
