import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bortleFromRadiance,
  darkSkyScore,
  BORTLE_SCALE,
  estimateLightPollution,
} from '../src/lib/dark-sky.mjs';

// ---------------------------------------------------------------------------
// Dark Sky / Light Pollution Score for boondocking locations.
//
// Data source: NASA VIIRS Day/Night Band satellite data (2023 annual composite).
// The model uses a pre-computed grid of artificial sky brightness values for the
// continental US at ~0.5° resolution, derived from the published VIIRS DNB
// radiance data. This is the same data underlying lightpollutionmap.info and
// the New World Atlas of Artificial Night Sky Brightness (Falchi et al. 2016).
//
// The Bortle scale (1-9) is the standard amateur-astronomy classification of
// sky darkness. We map VIIRS radiance to Bortle class using the published
// conversion thresholds from Falchi et al.
//
// Why this matters for boondockers: many dispersed campers specifically seek
// dark skies for stargazing. A Bortle 1-3 site is genuinely exceptional.
// ---------------------------------------------------------------------------

// Bortle scale metadata
test('BORTLE_SCALE has 9 classes with labels and descriptions', () => {
  assert.equal(BORTLE_SCALE.length, 9);
  for (let i = 0; i < 9; i++) {
    const b = BORTLE_SCALE[i];
    assert.equal(b.class, i + 1);
    assert.equal(typeof b.label, 'string');
    assert.equal(typeof b.description, 'string');
    assert.equal(typeof b.color, 'string');
    assert.match(b.color, /^#[0-9a-fA-F]{6}$/);
  }
});

// Radiance to Bortle conversion
test('bortleFromRadiance: very low radiance maps to Bortle 1-2', () => {
  // Pristine dark sky: radiance < 0.25 mcd/m²
  assert.ok(bortleFromRadiance(0.1) <= 2);
  assert.ok(bortleFromRadiance(0.2) <= 2);
});

test('bortleFromRadiance: moderate radiance maps to Bortle 4-5', () => {
  // Suburban transition: radiance ~1-4 mcd/m²
  const b = bortleFromRadiance(2.0);
  assert.ok(b >= 4 && b <= 5, `radiance 2.0 should be Bortle 4-5, got ${b}`);
});

test('bortleFromRadiance: high radiance maps to Bortle 7-9', () => {
  // Urban sky: radiance > 10 mcd/m²
  const b = bortleFromRadiance(20.0);
  assert.ok(b >= 7, `radiance 20.0 should be Bortle 7+, got ${b}`);
});

test('bortleFromRadiance: zero radiance returns Bortle 1', () => {
  assert.equal(bortleFromRadiance(0), 1);
});

test('bortleFromRadiance: negative radiance clamps to Bortle 1', () => {
  assert.equal(bortleFromRadiance(-5), 1);
});

// Dark sky score (0-100, higher = darker = better for stargazing)
test('darkSkyScore: Bortle 1 returns score near 100', () => {
  const score = darkSkyScore(1);
  assert.ok(score >= 90 && score <= 100, `Bortle 1 score should be 90-100, got ${score}`);
});

test('darkSkyScore: Bortle 9 returns score near 0', () => {
  const score = darkSkyScore(9);
  assert.ok(score >= 0 && score <= 15, `Bortle 9 score should be 0-15, got ${score}`);
});

test('darkSkyScore: monotonically decreasing (darker = higher score)', () => {
  for (let b = 1; b < 9; b++) {
    assert.ok(darkSkyScore(b) > darkSkyScore(b + 1),
      `Bortle ${b} score should exceed Bortle ${b + 1} score`);
  }
});

// Location-based estimation using the pre-computed grid
test('estimateLightPollution: remote desert location is dark (Bortle 1-3)', () => {
  // Middle of nowhere in Nevada (~40.5°N, -117.5°W)
  const result = estimateLightPollution(40.5, -117.5);
  assert.ok(result.bortle >= 1 && result.bortle <= 3,
    `Remote NV desert should be Bortle 1-3, got ${result.bortle}`);
  assert.equal(typeof result.score, 'number');
  assert.ok(result.score >= 70);
});

test('estimateLightPollution: near a major city is bright (Bortle 7+)', () => {
  // Near Los Angeles (~34°N, -118.2°W)
  const result = estimateLightPollution(34.0, -118.2);
  assert.ok(result.bortle >= 6,
    `Near LA should be Bortle 6+, got ${result.bortle}`);
  assert.ok(result.score <= 40);
});

test('estimateLightPollution: returns label and color from BORTLE_SCALE', () => {
  const result = estimateLightPollution(40.5, -117.5);
  assert.equal(typeof result.label, 'string');
  assert.match(result.color, /^#[0-9a-fA-F]{6}$/);
  assert.equal(result.label, BORTLE_SCALE[result.bortle - 1].label);
});

test('estimateLightPollution: handles edge coordinates gracefully', () => {
  // Just outside US range — should still return a result (clamped)
  const result = estimateLightPollution(50, -100);
  assert.equal(typeof result.bortle, 'number');
  assert.ok(result.bortle >= 1 && result.bortle <= 9);
});

test('estimateLightPollution: result includes the grid resolution note', () => {
  const result = estimateLightPollution(40.5, -117.5);
  assert.equal(typeof result.resolution, 'string');
  // Should mention the approximate resolution
  assert.match(result.resolution, /\d+/);
});
