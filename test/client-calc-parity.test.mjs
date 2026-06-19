// CLIENT CALCULATOR CONSTANT PARITY TRIPWIRE  (T-1)
// ----------------------------------------------------------------------------
// Four detail-page calculators run client-side in app.js so they respond with
// no network round-trip: the off-grid estimator, the tow-match checker, the
// fuel-cost estimator, and the payload/packing calculator. Each one carries a
// HAND-COPIED set of the planning constants that live authoritatively in
// src/lib/{estimate,tow,fuel,payload}.mjs.
//
// That duplication is a silent-drift hazard: edit MAX_PENALTY in fuel.mjs and
// forget the copy in app.js, and the shipped calculator quietly disagrees with
// every server-side test — with nothing red to warn you. This test slices each
// client IIFE straight out of app.js, pulls the literal constants back out, and
// asserts they still equal the imported source-of-truth values (and, for the
// payload status thresholds that aren't exported, the literals in payload.mjs).
// Change a number on one side only and this goes red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  LOAD_PRESETS, PEAK_SUN_HOURS, BATTERY_USABLE_FRACTION, SOLAR_DERATE,
  GRAY_FROM_FRESH, WATER_PRESETS,
} from '../src/lib/estimate.mjs';
import { COMFORT_CEILING, CAUTION_CEILING, TONGUE_PCT_LOADED } from '../src/lib/tow.mjs';
import {
  BASE_PENALTY, WEIGHT_FACTOR, MAX_PENALTY, MIN_TOWING_MPG, DEFAULT_UNLADEN_MPG,
} from '../src/lib/fuel.mjs';
import { WATER_LB_PER_GAL } from '../src/lib/payload.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(__dirname, '..', 'src', 'assets', 'js', 'app.js'), 'utf8');
const PAYLOAD_SRC = readFileSync(join(__dirname, '..', 'src', 'lib', 'payload.mjs'), 'utf8');

// Split app.js on its top-level IIFE boundaries (`\n  (function NAME() {`) so a
// regex run over one calculator's body can never read a literal that actually
// belongs to a different calculator.
const CHUNKS = APP.split(/\n {2}\(function /);
function iifeBody(name) {
  const chunk = CHUNKS.find((c) => c.startsWith(name + '('));
  assert.ok(chunk, `top-level IIFE ${name}() must exist in app.js`);
  return chunk;
}

// Pull one capture group as a number, asserting the pattern was actually found
// (a renamed/removed literal must fail loudly, not silently pass).
function grab(body, re, label) {
  const m = body.match(re);
  assert.ok(m, `${label}: expected literal not found in client mirror`);
  return Number(m[1]);
}

test('off-grid estimator constants mirror estimate.mjs', () => {
  const og = iifeBody('offGrid');

  const load = og.match(/LOAD = \{\s*light:\s*(\d+),\s*moderate:\s*(\d+),\s*heavy:\s*(\d+)/);
  assert.ok(load, 'LOAD preset literal must be present');
  assert.equal(Number(load[1]), LOAD_PRESETS.light.wh, 'LOAD.light');
  assert.equal(Number(load[2]), LOAD_PRESETS.moderate.wh, 'LOAD.moderate');
  assert.equal(Number(load[3]), LOAD_PRESETS.heavy.wh, 'LOAD.heavy');

  const psh = og.match(/PSH = \{\s*summer:\s*([\d.]+),\s*shoulder:\s*([\d.]+),\s*winter:\s*([\d.]+)/);
  assert.ok(psh, 'PSH literal must be present');
  assert.equal(Number(psh[1]), PEAK_SUN_HOURS.summer, 'PSH.summer');
  assert.equal(Number(psh[2]), PEAK_SUN_HOURS.shoulder, 'PSH.shoulder');
  assert.equal(Number(psh[3]), PEAK_SUN_HOURS.winter, 'PSH.winter');

  assert.equal(grab(og, /USABLE = ([\d.]+)/, 'USABLE'), BATTERY_USABLE_FRACTION);
  assert.equal(grab(og, /DERATE = ([\d.]+)/, 'DERATE'), SOLAR_DERATE);
  assert.equal(grab(og, /GRAY_FRAC = ([\d.]+)/, 'GRAY_FRAC'), GRAY_FROM_FRESH);

  const water = og.match(
    /WATER = \{[\s\S]*?light:\s*\{\s*fresh:\s*([\d.]+),\s*black:\s*([\d.]+)\s*\},[\s\S]*?moderate:\s*\{\s*fresh:\s*([\d.]+),\s*black:\s*([\d.]+)\s*\},[\s\S]*?heavy:\s*\{\s*fresh:\s*([\d.]+),\s*black:\s*([\d.]+)/,
  );
  assert.ok(water, 'WATER preset literal must be present');
  assert.equal(Number(water[1]), WATER_PRESETS.light.fresh, 'WATER.light.fresh');
  assert.equal(Number(water[2]), WATER_PRESETS.light.black, 'WATER.light.black');
  assert.equal(Number(water[3]), WATER_PRESETS.moderate.fresh, 'WATER.moderate.fresh');
  assert.equal(Number(water[4]), WATER_PRESETS.moderate.black, 'WATER.moderate.black');
  assert.equal(Number(water[5]), WATER_PRESETS.heavy.fresh, 'WATER.heavy.fresh');
  assert.equal(Number(water[6]), WATER_PRESETS.heavy.black, 'WATER.heavy.black');
});

test('tow-match constants mirror tow.mjs', () => {
  const tt = iifeBody('towTool');
  const ceil = tt.match(/COMFORT = ([\d.]+), CAUTION = ([\d.]+)/);
  assert.ok(ceil, 'COMFORT/CAUTION literal must be present');
  assert.equal(Number(ceil[1]), COMFORT_CEILING, 'COMFORT_CEILING');
  assert.equal(Number(ceil[2]), CAUTION_CEILING, 'CAUTION_CEILING');
  // fallback used when data.tonguePct is absent — must equal the loaded default
  assert.equal(grab(tt, /data\.tonguePct\s*:\s*([\d.]+)/, 'tonguePct fallback'), TONGUE_PCT_LOADED);
});

test('fuel-cost constants mirror fuel.mjs', () => {
  const ft = iifeBody('fuelTool');
  assert.equal(grab(ft, /BASE_PENALTY = ([\d.]+)/, 'BASE_PENALTY'), BASE_PENALTY);
  assert.equal(grab(ft, /WEIGHT_FACTOR = ([\d.]+)/, 'WEIGHT_FACTOR'), WEIGHT_FACTOR);
  assert.equal(grab(ft, /MAX_PENALTY = ([\d.]+)/, 'MAX_PENALTY'), MAX_PENALTY);
  assert.equal(grab(ft, /MIN_MPG = ([\d.]+)/, 'MIN_MPG'), MIN_TOWING_MPG);
  assert.equal(grab(ft, /DEFAULT_MPG = (\d+)/, 'DEFAULT_MPG'), DEFAULT_UNLADEN_MPG);
});

test('payload calculator constants mirror payload.mjs', () => {
  const pt = iifeBody('payloadTool');
  // water density fallback
  assert.equal(
    grab(pt, /WATER_LB = data\.waterLbPerGal \|\| ([\d.]+)/, 'WATER_LB fallback'),
    WATER_LB_PER_GAL,
  );
  // status thresholds aren't exported constants, so compare client literals
  // against the inline thresholds in payload.mjs directly.
  const clientTh = pt.match(/usedPct > ([\d.]+) \? 'over' : \(usedPct > ([\d.]+) \?/);
  assert.ok(clientTh, 'client payload status thresholds must be present');
  const srcOver = grab(PAYLOAD_SRC, /usedPct > ([\d.]+)\) status = 'over'/, 'payload.mjs over');
  const srcTight = grab(PAYLOAD_SRC, /usedPct > ([\d.]+)\) status = 'tight'/, 'payload.mjs tight');
  assert.equal(Number(clientTh[1]), srcOver, 'over threshold');
  assert.equal(Number(clientTh[2]), srcTight, 'tight threshold');
});
