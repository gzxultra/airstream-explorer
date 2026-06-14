import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMsrp, formatWeight, formatLength, formatGal, formatTanks,
  trailerTitle, trailerLabel,
} from '../src/lib/format.mjs';

test('formatMsrp', () => {
  assert.equal(formatMsrp(222900), '$222,900');
  assert.equal(formatMsrp(54900), '$54,900');
  assert.equal(formatMsrp(0), 'Price TBA');
  assert.equal(formatMsrp(null), 'Price TBA');
});

test('formatWeight', () => {
  assert.equal(formatWeight(8425), '8,425 lb');
  assert.equal(formatWeight(2650), '2,650 lb');
  assert.equal(formatWeight(null), '—');
});

test('formatLength feet+inches', () => {
  assert.equal(formatLength(33.25), "33' 3\"");
  assert.equal(formatLength(16), "16'");
  assert.equal(formatLength(20.58), "20' 7\"");
});

test('formatGal', () => {
  assert.equal(formatGal(53), '53 gal');
  assert.equal(formatGal(34.5), '34.5 gal');
  assert.equal(formatGal(null), '—');
});

test('formatTanks', () => {
  assert.equal(formatTanks(53, 34, 39), '53 / 34 / 39');
  assert.equal(formatTanks(23, null, 30), '23 / — / 30');
});

test('titles', () => {
  const t = { year: 2026, model: 'Classic', floorplan: '33FB' };
  assert.equal(trailerTitle(t), '2026 Airstream Classic 33FB');
  assert.equal(trailerLabel(t), 'Classic 33FB');
});

import { hitchPctOfGvwr } from '../src/lib/format.mjs';

test('hitchPctOfGvwr returns whole-percent tongue load', () => {
  assert.equal(hitchPctOfGvwr(1150, 10000), 12); // 11.5 -> 12
  assert.equal(hitchPctOfGvwr(410, 3500), 12);
  assert.equal(hitchPctOfGvwr(0, 10000), null);
});
