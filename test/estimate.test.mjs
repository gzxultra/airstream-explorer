import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateOffGrid, formatNights,
  LOAD_PRESETS, PEAK_SUN_HOURS, BATTERY_USABLE_FRACTION, SOLAR_DERATE,
  WATER_PRESETS, GRAY_FROM_FRESH,
} from '../src/lib/estimate.mjs';

// A representative real trailer (Classic 33FB 2026 values, verified in DB).
const CLASSIC = { batteryKwh: 2.5, solarW: 300, freshGal: 53, grayGal: 34, blackGal: 39 };

test('off-grid: power math matches documented constants', () => {
  // no solar, moderate load: usable = 2.5kWh*0.8 = 2000Wh; load 2800Wh/day
  const r = estimateOffGrid(CLASSIC, { people: 2, intensity: 'moderate', season: 'summer', useSolar: false });
  assert.equal(r.power.usableWh, 2000);
  assert.equal(r.power.loadWh, 2800);
  assert.equal(r.power.solarWh, 0);
  assert.ok(Math.abs(r.power.days - 2000 / 2800) < 1e-9);
});

test('off-grid: solar reduces net draw using PSH and derate', () => {
  // summer PSH 5.5, derate 0.7, 300W -> 300*5.5*0.7 = 1155 Wh/day harvest
  const r = estimateOffGrid(CLASSIC, { intensity: 'moderate', season: 'summer', useSolar: true });
  assert.equal(r.power.solarWh, 1155);
  assert.equal(r.power.netWh, 2800 - 1155); // 1645
});

test('off-grid: when solar >= load, power is not the limiter', () => {
  // huge solar, tiny load -> netWh <= 0 -> powerDays null -> water binds
  const solarRig = { ...CLASSIC, solarW: 2000 };
  const r = estimateOffGrid(solarRig, { intensity: 'light', season: 'summer', useSolar: true });
  assert.equal(r.power.days, null);
  assert.equal(r.limiter, 'water');
});

test('off-grid: water days computed per-person from real tanks', () => {
  // light: fresh 3 gal/person/day, 2 people -> 6/day; 53 gal fresh -> ~8.83 days
  const r = estimateOffGrid(CLASSIC, { people: 2, intensity: 'light', useSolar: false });
  assert.ok(Math.abs(r.water.freshDays - 53 / 6) < 1e-9);
  // gray: 3*0.8=2.4/person -> 4.8/day; 34 gal -> ~7.08 days (binds before fresh)
  assert.ok(Math.abs(r.water.grayDays - 34 / 4.8) < 1e-9);
  assert.equal(r.water.binds, 'gray tank');
});

test('off-grid: overall days is the shorter of power and water, with limiter named', () => {
  // moderate, no solar: power = 2000/2800 = 0.71 days (tiny) -> power binds
  const r = estimateOffGrid(CLASSIC, { intensity: 'moderate', useSolar: false });
  assert.equal(r.limiter, 'power');
  assert.ok(r.days <= r.water.days);
  assert.match(r.limiterDetail, /battery/);
});

test('off-grid: more people shortens water-limited endurance', () => {
  const two = estimateOffGrid(CLASSIC, { people: 2, intensity: 'light', useSolar: true });
  const four = estimateOffGrid(CLASSIC, { people: 4, intensity: 'light', useSolar: true });
  assert.ok(four.days < two.days);
});

test('off-grid: winter solar harvest is less than summer', () => {
  const summer = estimateOffGrid(CLASSIC, { intensity: 'moderate', season: 'summer' });
  const winter = estimateOffGrid(CLASSIC, { intensity: 'moderate', season: 'winter' });
  assert.ok(winter.power.solarWh < summer.power.solarWh);
});

test('off-grid: constants are the documented values', () => {
  assert.equal(LOAD_PRESETS.light.wh, 1500);
  assert.equal(LOAD_PRESETS.heavy.wh, 5000);
  assert.equal(PEAK_SUN_HOURS.summer, 5.5);
  assert.equal(PEAK_SUN_HOURS.winter, 2.5);
  assert.equal(BATTERY_USABLE_FRACTION, 0.8);
  assert.equal(SOLAR_DERATE, 0.7);
  assert.equal(GRAY_FROM_FRESH, 0.8);
  assert.equal(WATER_PRESETS.light.fresh, 3.0);
});

test('formatNights: friendly rounding', () => {
  assert.equal(formatNights(0.7), '0.7 nights');
  assert.equal(formatNights(1.4), '1.4 nights');
  assert.equal(formatNights(3.2), '3 nights');
  assert.equal(formatNights(99), '14+ nights');
  assert.equal(formatNights(Infinity), '14+ nights');
});
