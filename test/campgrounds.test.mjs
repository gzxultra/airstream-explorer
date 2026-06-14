import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fitClass, canPark, campgroundsForLength, fitSummary,
  statesWithCounts, toClientRecord, orgShort, fitExplain,
} from '../src/lib/campgrounds.mjs';
import { renderCampgroundsPage } from '../src/lib/campgrounds-render.mjs';

test('fitClass: clearance, tight band, too-long, and unknown', () => {
  // 3 ft clearance rule
  assert.equal(fitClass(25, 30), 'fits');   // 30 >= 25+3
  assert.equal(fitClass(25, 28), 'fits');   // exactly clearance
  assert.equal(fitClass(25, 27), 'tight');  // between exact and clearance
  assert.equal(fitClass(25, 25), 'tight');  // exact fit = tight
  assert.equal(fitClass(25, 24), 'no');     // too long
  assert.equal(fitClass(25, null), 'unknown');
  assert.equal(fitClass(25, undefined), 'unknown');
});

test('canPark: true unless posted limit is shorter than the rig', () => {
  assert.equal(canPark(30, 40), true);
  assert.equal(canPark(30, 30), true);
  assert.equal(canPark(30, 29), false);
  assert.equal(canPark(30, null), true); // no posted limit ⇒ not excluded
});

test('campgroundsForLength filters out too-short and respects includeUnknown', () => {
  const data = [
    { id: '1', name: 'A', maxLengthFt: 40, lat: 1, lon: 1 },
    { id: '2', name: 'B', maxLengthFt: 26, lat: 1, lon: 1 }, // tight for 25
    { id: '3', name: 'C', maxLengthFt: 20, lat: 1, lon: 1 }, // too short for 25
    { id: '4', name: 'D', maxLengthFt: null, lat: 1, lon: 1 },
  ];
  const all = campgroundsForLength(data, 25);
  assert.ok(!all.find((c) => c.id === '3'), 'excludes too-short');
  assert.ok(all.find((c) => c.id === '4'), 'keeps unknown by default');
  const noUnknown = campgroundsForLength(data, 25, { includeUnknown: false });
  assert.ok(!noUnknown.find((c) => c.id === '4'), 'drops unknown when asked');
  assert.ok(all.every((c) => c.fit && c.fit !== 'no'), 'annotates fit, never "no"');
});

test('fitSummary counts add up to the dataset', () => {
  const data = [
    { maxLengthFt: 40 }, { maxLengthFt: 26 }, { maxLengthFt: 20 }, { maxLengthFt: null },
  ];
  const s = fitSummary(data, 25);
  assert.equal(s.fits + s.tight + s.no + s.unknown, data.length);
});

test('toClientRecord carries coordinates so the map can plot every site', () => {
  const c = {
    id: '232490', name: 'MATHER CAMPGROUND', parent: 'Grand Canyon National Park',
    state: 'Arizona', org: 'NPS', rating: 4.6, reviews: 6116, maxLengthFt: 30,
    price: { min: 6 }, photo: 'https://x/y.webp', url: 'https://r.gov/c/232490',
    lat: 36.04972, lon: -112.12047, activities: ['Camping', 'Biking', 'Hiking', 'Fishing', 'Boating'],
  };
  const r = toClientRecord(c);
  assert.equal(typeof r.la, 'number');
  assert.equal(typeof r.lo, 'number');
  assert.ok(Math.abs(r.la - 36.04972) < 1e-4);
  assert.ok(Math.abs(r.lo + 112.12047) < 1e-4);
  assert.equal(r.m, 30);
  assert.ok(r.a.length <= 4, 'activities trimmed to keep payload lean');
});

test('orgShort normalizes long agency names', () => {
  assert.equal(orgShort('National Park Service'), 'NPS');
  assert.equal(orgShort('USDA Forest Service'), 'USFS');
});

test('statesWithCounts returns sorted, de-duped states', () => {
  const data = [
    { state: 'Utah' }, { state: 'Utah' }, { state: 'California' },
  ];
  const s = statesWithCounts(data);
  const utah = s.find((x) => x.state === 'Utah');
  assert.equal(utah.count, 2);
});

test('renderCampgroundsPage embeds coords + leaflet mount + live-fetch controls', () => {
  const campgrounds = [
    { id: '1', name: 'Mather', parent: 'Grand Canyon NP', state: 'Arizona', org: 'NPS',
      rating: 4.6, reviews: 6116, maxLengthFt: 30, price: { min: 6 },
      photo: 'https://x/y.webp', url: 'https://r.gov/c/1', lat: 36.05, lon: -112.12, activities: [] },
  ];
  const trailers = [
    { slug: 'bambi-16rb-2026', model: 'Bambi', floorplan: '16RB', lengthFt: 16.3, year: 2026 },
    { slug: 'classic-33fb-2026', model: 'Classic', floorplan: '33FB', lengthFt: 33.0, year: 2026 },
  ];
  const { body } = renderCampgroundsPage(campgrounds, trailers);
  assert.ok(body.includes('id="cg-map"'), 'has map mount');
  assert.ok(body.includes('id="cg-data"'), 'has data block');
  assert.ok(body.includes('id="cg-rig"'), 'has rig picker');
  // rig options expose real lengths
  assert.ok(body.includes('16RB') && body.includes('33FB'));
  // embedded payload parses and carries coordinates
  const m = body.match(/<script type="application\/json" id="cg-data">([\s\S]*?)<\/script>/);
  assert.ok(m, 'data block present');
  const payload = JSON.parse(m[1].replace(/\\u003c/g, '<'));
  assert.equal(payload.campgrounds.length, 1);
  assert.equal(typeof payload.campgrounds[0].la, 'number');
  assert.equal(typeof payload.campgrounds[0].lo, 'number');
});

test('fitExplain: verdict, confidence, and the arithmetic in the "why"', () => {
  // Comfortable fit: shows feet-to-spare and references the 3' buffer.
  const fits = fitExplain(25, 30);
  assert.equal(fits.cls, 'fits');
  assert.equal(fits.conf, 'posted');
  assert.match(fits.why, /30′ max/);
  assert.match(fits.why, /your 25′/);
  assert.match(fits.why, /5′ to spare/);

  // Tight band: under the buffer, tells the user to verify the exact site.
  const tight = fitExplain(25, 27);
  assert.equal(tight.cls, 'tight');
  assert.equal(tight.conf, 'posted');
  assert.match(tight.why, /just 2′/);
  assert.match(tight.why, /verify/i);

  // Too long: states the overage explicitly.
  const no = fitExplain(30, 24);
  assert.equal(no.cls, 'no');
  assert.match(no.why, /6′ over/);
});

test('fitExplain: no posted limit is honestly "unverified", never a fabricated fit', () => {
  const unknown = fitExplain(25, null);
  assert.equal(unknown.cls, 'unknown');
  assert.equal(unknown.conf, 'unverified');
  assert.equal(unknown.label, 'Fit unverified');
  assert.match(unknown.why, /can’t be confirmed/);
  // Never claims it fits.
  assert.doesNotMatch(unknown.why, /to spare|fits/i);
});

test('fitExplain: no rig chosen reports the posted limit, with no "why"', () => {
  const posted = fitExplain(0, 30);
  assert.equal(posted.cls, 'limit');
  assert.equal(posted.label, 'Up to 30′');
  assert.equal(posted.why, '');

  const nolimit = fitExplain(0, null);
  assert.equal(nolimit.cls, 'unknown');
  assert.equal(nolimit.conf, 'unverified');
  assert.equal(nolimit.why, '');
});

test('fitExplain labels/classes stay consistent with fitClass', () => {
  for (const [len, max] of [[25, 30], [25, 27], [25, 25], [30, 24]]) {
    assert.equal(fitExplain(len, max).cls, fitClass(len, max));
  }
});
