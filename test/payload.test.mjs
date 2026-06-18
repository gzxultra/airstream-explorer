import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  waterWeight, calculatePayload, formatRemaining, formatLb,
  WATER_LB_PER_GAL, PROPANE_PRESETS, DEFAULT_PROPANE, GEAR_PRESETS,
} from '../src/lib/payload.mjs';

// ---------------------------------------------------------------------------
// waterWeight
// ---------------------------------------------------------------------------

test('waterWeight: full tank at 8.34 lb/gal', () => {
  // 39 gal × 8.34 = 325.26 → rounds to 325
  assert.equal(waterWeight(39), 325);
  // 23 gal × 8.34 = 191.82 → rounds to 192
  assert.equal(waterWeight(23), 192);
});

test('waterWeight: partial fill', () => {
  // 50 gal × 0.5 × 8.34 = 208.5 → rounds to 209
  assert.equal(waterWeight(50, 0.5), 209);
  // 50 gal × 0.0 = 0
  assert.equal(waterWeight(50, 0), 0);
});

test('waterWeight: zero or null tank returns 0', () => {
  assert.equal(waterWeight(0), 0);
  assert.equal(waterWeight(null), 0);
  assert.equal(waterWeight(undefined), 0);
});

test('waterWeight: fill clamped to 0–1 range', () => {
  // fill > 1 treated as 1
  assert.equal(waterWeight(10, 1.5), waterWeight(10, 1.0));
  // fill < 0 treated as 0
  assert.equal(waterWeight(10, -0.5), 0);
});

// ---------------------------------------------------------------------------
// calculatePayload
// ---------------------------------------------------------------------------

test('calculatePayload: basic calculation with defaults', () => {
  // Bambi 20FB: CCC 1100 lb, fresh 39 gal
  const trailer = { cccLb: 1100, freshGal: 39 };
  const r = calculatePayload(trailer);
  // water = 39 × 8.34 = 325 lb (rounded)
  assert.equal(r.waterLb, 325);
  // propane = dual20 = 40 lb
  assert.equal(r.propaneLb, 40);
  // consumables = 325 + 40 = 365
  assert.equal(r.consumablesLb, 365);
  // remaining = 1100 - 365 = 735
  assert.equal(r.remainingLb, 735);
  assert.equal(r.status, 'ok');
});

test('calculatePayload: empty water tank leaves more capacity', () => {
  const trailer = { cccLb: 500, freshGal: 39 };
  const full = calculatePayload(trailer, { waterFillPct: 1.0 });
  const empty = calculatePayload(trailer, { waterFillPct: 0 });
  assert.ok(empty.remainingLb > full.remainingLb);
  assert.equal(empty.waterLb, 0);
});

test('calculatePayload: propane presets work correctly', () => {
  const trailer = { cccLb: 1000, freshGal: 20 };
  const none = calculatePayload(trailer, { propane: 'none' });
  const dual30 = calculatePayload(trailer, { propane: 'dual30' });
  assert.equal(none.propaneLb, 0);
  assert.equal(dual30.propaneLb, 60);
  assert.ok(none.remainingLb > dual30.remainingLb);
});

test('calculatePayload: additional cargo weight reduces remaining', () => {
  const trailer = { cccLb: 1000, freshGal: 20 };
  const base = calculatePayload(trailer);
  const loaded = calculatePayload(trailer, { additionalLb: 200 });
  assert.equal(loaded.remainingLb, base.remainingLb - 200);
  assert.equal(loaded.additionalLb, 200);
});

test('calculatePayload: status is "over" when exceeding CCC', () => {
  // Small CCC, full water + propane + heavy gear
  const trailer = { cccLb: 350, freshGal: 23 }; // Bambi 16RB
  // water = 192, propane = 40, additional = 200 → total 432 > 350
  const r = calculatePayload(trailer, { additionalLb: 200 });
  assert.equal(r.status, 'over');
  assert.ok(r.remainingLb < 0);
});

test('calculatePayload: status is "tight" when 85-100% used', () => {
  const trailer = { cccLb: 500, freshGal: 30 };
  // water = 250, propane = 40 → consumables = 290
  // need additional to push to 85-100%: 500*0.85=425, so additional = 425-290 = 135
  const r = calculatePayload(trailer, { additionalLb: 140 });
  // total = 290 + 140 = 430, pct = 430/500 = 0.86 → tight
  assert.equal(r.status, 'tight');
});

test('calculatePayload: usedPct is correct', () => {
  const trailer = { cccLb: 1000, freshGal: 0 };
  const r = calculatePayload(trailer, { propane: 'none', additionalLb: 500 });
  assert.equal(r.usedPct, 0.5);
});

test('calculatePayload: handles zero CCC gracefully', () => {
  const trailer = { cccLb: 0, freshGal: 20 };
  const r = calculatePayload(trailer);
  assert.ok(r.remainingLb <= 0);
  // usedPct should be 0 when CCC is 0 (avoid division by zero)
  assert.equal(r.usedPct, 0);
});

test('calculatePayload: handles missing freshGal gracefully', () => {
  const trailer = { cccLb: 1000 }; // no freshGal
  const r = calculatePayload(trailer);
  assert.equal(r.waterLb, 0);
  assert.equal(r.remainingLb, 1000 - PROPANE_PRESETS[DEFAULT_PROPANE].weightLb);
});

// ---------------------------------------------------------------------------
// Real-world Airstream scenarios
// ---------------------------------------------------------------------------

test('real-world: Bambi 16RB has very limited cargo after water', () => {
  // CCC 350, fresh 23 gal → water 192, propane 40 → only 118 lb for gear
  const trailer = { cccLb: 350, freshGal: 23 };
  const r = calculatePayload(trailer);
  assert.equal(r.waterLb, 192);
  assert.equal(r.remainingLb, 350 - 192 - 40); // 118 lb
  assert.ok(r.remainingLb < 150, 'Bambi 16RB should have <150 lb remaining');
});

test('real-world: Classic 30RB has generous cargo capacity', () => {
  // CCC ~2100, fresh 51 gal → water 425, propane 40 → 1635 lb for gear
  const trailer = { cccLb: 2100, freshGal: 51 };
  const r = calculatePayload(trailer);
  assert.ok(r.remainingLb > 1500, 'Classic should have >1500 lb remaining');
  assert.equal(r.status, 'ok');
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

test('formatRemaining: positive values show "remaining"', () => {
  assert.equal(formatRemaining(425), '425 lb remaining');
  assert.equal(formatRemaining(1250), '1,250 lb remaining');
});

test('formatRemaining: negative values show "OVER"', () => {
  assert.equal(formatRemaining(-125), '125 lb OVER');
  assert.equal(formatRemaining(-50), '50 lb OVER');
});

test('formatRemaining: zero shows remaining', () => {
  assert.equal(formatRemaining(0), '0 lb remaining');
});

test('formatRemaining: null/undefined returns dash', () => {
  assert.equal(formatRemaining(null), '—');
  assert.equal(formatRemaining(undefined), '—');
});

test('formatLb: formats weight correctly', () => {
  assert.equal(formatLb(167), '167 lb');
  assert.equal(formatLb(1250), '1,250 lb');
  assert.equal(formatLb(0), '0 lb');
  assert.equal(formatLb(null), '—');
});

// ---------------------------------------------------------------------------
// Data integrity: PROPANE_PRESETS and GEAR_PRESETS
// ---------------------------------------------------------------------------

test('PROPANE_PRESETS: all have label and non-negative weight', () => {
  for (const [key, preset] of Object.entries(PROPANE_PRESETS)) {
    assert.ok(typeof preset.label === 'string' && preset.label.length > 0, `${key} has label`);
    assert.ok(typeof preset.weightLb === 'number' && preset.weightLb >= 0, `${key} has valid weight`);
  }
});

test('GEAR_PRESETS: all have label, weight, and description', () => {
  for (const [key, preset] of Object.entries(GEAR_PRESETS)) {
    assert.ok(typeof preset.label === 'string' && preset.label.length > 0, `${key} has label`);
    assert.ok(typeof preset.weightLb === 'number' && preset.weightLb > 0, `${key} has positive weight`);
    assert.ok(typeof preset.description === 'string' && preset.description.length > 0, `${key} has description`);
  }
});

test('DEFAULT_PROPANE key exists in PROPANE_PRESETS', () => {
  assert.ok(PROPANE_PRESETS[DEFAULT_PROPANE], 'default propane key is valid');
});
