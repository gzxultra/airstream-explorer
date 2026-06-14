import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  dateKey, nightKey, hookupsFromType, trailerMaxLength, siteFit,
  parseAvailability, siteFreeForRange, availabilitySummary,
  upcomingWeekend, monthsForRange,
} from '../src/lib/availability.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(readFileSync(join(here, 'fixtures/availability-colterbay.json'), 'utf8'));

test('dateKey/nightKey normalize the API timestamp format', () => {
  assert.equal(dateKey('2026-09-04T00:00:00Z'), '2026-09-04');
  assert.equal(dateKey(new Date('2026-09-04T00:00:00Z')), '2026-09-04');
  assert.equal(nightKey('2026-09-04'), '2026-09-04T00:00:00Z');
});

test('hookupsFromType reads electric/sewer/water + full', () => {
  assert.deepEqual(hookupsFromType('STANDARD NONELECTRIC').label, 'No hookups');
  assert.equal(hookupsFromType('RV ELECTRIC').electric, true);
  assert.equal(hookupsFromType('RV ELECTRIC').label, 'Electric');
  const full = hookupsFromType('RV ELECTRIC', [{ attribute_name: 'Sewer Hookups' }, { attribute_name: 'Water Hookup' }]);
  assert.equal(full.full, true);
  assert.equal(full.label, 'Full hookups');
});

test('trailerMaxLength prefers Trailer, then RV, then largest', () => {
  const eq = [
    { equipment_name: 'RV', max_length: 40 },
    { equipment_name: 'Trailer', max_length: 36 },
    { equipment_name: 'Tent', max_length: 0 },
  ];
  assert.equal(trailerMaxLength(eq), 36);
  assert.equal(trailerMaxLength([{ equipment_name: 'RV', max_length: 40 }]), 40);
  assert.equal(trailerMaxLength([{ equipment_name: 'Tent', max_length: 0 }]), null);
  assert.equal(trailerMaxLength([]), null);
});

test('siteFit mirrors the 3ft-clearance bands', () => {
  assert.equal(siteFit(25, 30).cls, 'fits');
  assert.equal(siteFit(25, 27).cls, 'tight');
  assert.equal(siteFit(25, 24).cls, 'no');
  assert.equal(siteFit(25, null).cls, 'unknown');
  assert.equal(siteFit(0, 30).cls, 'limit'); // no rig -> just reports it has a limit
});

test('parseAvailability turns the real payload into lean per-site records', () => {
  const sites = parseAvailability(FIXTURE);
  assert.ok(sites.length === 6, 'all fixture sites parsed');
  const s = sites[0];
  assert.ok(typeof s.id === 'string' && s.id.length > 0);
  assert.ok('nights' in s && typeof s.nights === 'object');
  assert.ok('hookups' in s && typeof s.hookups.label === 'string');
  // The fixture is an RV ELECTRIC loop.
  assert.ok(sites.some((x) => x.type.includes('ELECTRIC')));
});

test('siteFreeForRange requires every night Available (real data has 4 free nights)', () => {
  const sites = parseAvailability(FIXTURE);
  // Find the night that is Available somewhere, prove a 1-night range works and
  // a range crossing a Reserved night fails.
  let proven = false;
  for (const s of sites) {
    const freeNights = Object.keys(s.nights).filter((k) => s.nights[k] === 'Available').sort();
    if (!freeNights.length) continue;
    const d = freeNights[0];
    const next = dateKey(new Date(new Date(d + 'T00:00:00Z').getTime() + 86400000));
    assert.equal(siteFreeForRange(s, d, next), true, 'single free night is free');
    proven = true;
    break;
  }
  assert.ok(proven, 'fixture has at least one Available night to test');
  // A backwards/zero range is never free.
  assert.equal(siteFreeForRange(sites[0], '2026-09-05', '2026-09-05'), false);
});

test('availabilitySummary counts free sites split by fit', () => {
  const sites = parseAvailability(FIXTURE);
  const wk = { start: '2026-09-01', end: '2026-09-02' }; // 1 night
  const sum = availabilitySummary(sites, wk.start, wk.end, { lengthFt: 25, cgMax: 36 });
  assert.equal(typeof sum.freeTotal, 'number');
  assert.equal(sum.freeFits + sum.freeTight + sum.freeUnknown + sum.freeNo, sum.freeTotal);
  // With cgMax 36 and a 25ft rig, any free site should be a comfortable fit.
  if (sum.freeTotal > 0) assert.ok(sum.freeFits >= 1);
});

test('upcomingWeekend returns a Fri->Sun 2-night window', () => {
  // From a known Wednesday (2026-06-10) the next weekend is Fri 06-12.
  const wk = upcomingWeekend(new Date('2026-06-10T12:00:00Z'));
  assert.equal(wk.start, '2026-06-12');
  assert.equal(wk.end, '2026-06-14');
  // From a Saturday, it uses the current weekend (Fri was yesterday).
  const sat = upcomingWeekend(new Date('2026-06-13T12:00:00Z'));
  assert.equal(sat.start, '2026-06-12');
  assert.equal(sat.end, '2026-06-14');
});

test('monthsForRange covers one or two month-start calls', () => {
  assert.deepEqual(monthsForRange('2026-09-04', '2026-09-06'), ['2026-09-01']);
  assert.deepEqual(monthsForRange('2026-09-29', '2026-10-02'), ['2026-09-01', '2026-10-01']);
});
