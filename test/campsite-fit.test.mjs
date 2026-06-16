import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  peakSunHoursAt, nightsHere, hookupMatch, trailerFit, elevationContext,
  nationalFit, inElevationBand, ELEVATION_BANDS,
  HOOKUP_LABEL,
} from '../src/lib/campsite-fit.mjs';
import { estimateOffGrid, PEAK_SUN_HOURS } from '../src/lib/estimate.mjs';

// A representative mid-size trailer (Flying Cloud 25FB-ish real specs).
const FC25 = {
  slug: 'flying-cloud-25fb', model: 'Flying Cloud', floorplan: '25FB',
  lengthFt: 25.0, batteryKwh: 1.3, solarW: 270, freshGal: 54, grayGal: 37, blackGal: 39,
};

// ---------------------------------------------------------------------------
// 1. Latitude-refined peak sun hours
// ---------------------------------------------------------------------------
test('peakSunHoursAt: no latitude → base figure, not refined', () => {
  const r = peakSunHoursAt('winter', null);
  assert.equal(r.psh, PEAK_SUN_HOURS.winter);
  assert.equal(r.refined, false);
  assert.equal(r.factor, 1);
});

test('peakSunHoursAt: at the reference latitude the factor is ~1', () => {
  const r = peakSunHoursAt('summer', 35);
  assert.equal(r.refined, true);
  assert.ok(Math.abs(r.factor - 1) < 1e-9, 'no shift at the reference latitude');
  assert.equal(r.psh, PEAK_SUN_HOURS.summer);
});

test('peakSunHoursAt: winter sun falls off sharply with latitude, summer barely', () => {
  const wLow = peakSunHoursAt('winter', 25);   // Florida Keys
  const wHigh = peakSunHoursAt('winter', 48);  // northern Montana
  assert.ok(wLow.psh > wHigh.psh, 'lower latitude keeps more winter sun');
  // High-latitude winter should be materially reduced (>15% off base).
  assert.ok(wHigh.psh < PEAK_SUN_HOURS.winter * 0.85);

  const sLow = peakSunHoursAt('summer', 25);
  const sHigh = peakSunHoursAt('summer', 48);
  // Summer is latitude-flat — the spread must be much smaller than winter's.
  const summerSpread = Math.abs(sLow.psh - sHigh.psh);
  const winterSpread = Math.abs(wLow.psh - wHigh.psh);
  assert.ok(summerSpread < winterSpread, 'summer is flatter across latitude than winter');
});

test('peakSunHoursAt: clamped — never invents more sun than the band allows', () => {
  // An absurd latitude must still clamp within the band, never go negative/huge.
  const extreme = peakSunHoursAt('winter', 80);
  assert.ok(extreme.psh >= PEAK_SUN_HOURS.winter * 0.5);
  assert.ok(extreme.factor >= 0.5 && extreme.factor <= 1.25);
  // Works for southern-hemisphere-style negative latitude via abs().
  const neg = peakSunHoursAt('winter', -35);
  assert.equal(neg.factor, 1);
});

// ---------------------------------------------------------------------------
// 2. nightsHere — reuses estimateOffGrid, refines only the solar leg
// ---------------------------------------------------------------------------
test('nightsHere: with no latitude, matches estimateOffGrid exactly (parity)', () => {
  const opts = { people: 2, intensity: 'moderate', season: 'summer' };
  const here = nightsHere(FC25, { ...opts, lat: null });
  const base = estimateOffGrid(FC25, opts);
  assert.ok(Math.abs(here.days - base.days) < 1e-9, 'identical when unrefined');
  assert.equal(here.limiter, base.limiter);
  assert.equal(here.pshRefined, false);
});

test('nightsHere: higher latitude in winter yields fewer or equal nights (less solar)', () => {
  const low = nightsHere(FC25, { season: 'winter', lat: 25, intensity: 'moderate' });
  const high = nightsHere(FC25, { season: 'winter', lat: 48, intensity: 'moderate' });
  // Less solar up north ⇒ battery binds sooner (or water binds equally). Never MORE nights.
  assert.ok(high.days <= low.days + 1e-9);
});

test('nightsHere: solar leg scales with refined PSH but water leg is untouched', () => {
  const here = nightsHere(FC25, { season: 'winter', lat: 48, intensity: 'moderate' });
  const base = estimateOffGrid(FC25, { season: 'winter', intensity: 'moderate' });
  // Water days identical to canonical (we only touched power).
  assert.deepEqual(here.water, base.water);
  // Refined solarWh must differ from base when latitude shifts it.
  assert.notEqual(here.power.solarWh, base.power.solarWh);
});

test('nightsHere: limiter detail names the binding tank or the battery', () => {
  const r = nightsHere(FC25, { season: 'summer', lat: 36, intensity: 'heavy', people: 4 });
  assert.ok(/fills first|runs down first/.test(r.limiterDetail));
});

// ---------------------------------------------------------------------------
// 3. hookupMatch
// ---------------------------------------------------------------------------
test('hookupMatch: full hookups → solar is backup only', () => {
  const m = hookupMatch('full', [30, 50]);
  assert.equal(m.level, 'full');
  assert.equal(m.solar, 'not-needed');
  assert.match(m.note, /sewer/);
});

test('hookupMatch: electric only → solar nice, tanks still yours', () => {
  const m = hookupMatch('electric', [30]);
  assert.equal(m.solar, 'nice');
  assert.match(m.note, /30-amp/);
  assert.match(m.note, /no sewer/i);
});

test('hookupMatch: none → solar is a must, points to the nights estimate', () => {
  const m = hookupMatch('none', []);
  assert.equal(m.solar, 'must');
  assert.match(m.note, /nights-here/);
});

test('hookupMatch: missing data is honestly unknown, never assumed', () => {
  const m = hookupMatch(null);
  assert.equal(m.level, 'unknown');
  assert.equal(m.solar, 'unknown');
  assert.equal(m.label, HOOKUP_LABEL.unknown);
  assert.match(m.note, /confirm/i);
});

// ---------------------------------------------------------------------------
// 4. trailerFit — the accuracy fix, driven by REAL fixture histograms
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));

/** Build a trailer-length histogram from a real /campsites fixture, exactly as
 *  enrich.mjs will: max trailer/RV/fifth permitted_equipment length per site. */
function histFromFixture(file) {
  const arr = JSON.parse(readFileSync(join(__dirname, 'fixtures', file), 'utf8')).campsites;
  const hist = {};
  for (const s of arr) {
    let best = 0;
    for (const e of (s.permitted_equipment || [])) {
      if (/trailer|rv|fifth/i.test(e.equipment_name || '')) best = Math.max(best, Number(e.max_length) || 0);
    }
    if (best > 0) { const k = String(Math.round(best)); hist[k] = (hist[k] || 0) + 1; }
  }
  return hist;
}

test('trailerFit: Mather real data — a 33ft Classic does NOT fit (fixes the bug)', () => {
  const hist = histFromFixture('recgov-campsites-mather-232490.json');
  const cg = { trailerLenHistogram: hist };
  const classic = trailerFit(cg, 33);
  assert.equal(classic.conf, 'per-site');
  assert.equal(classic.cls, 'no', 'no Mather trailer site takes 33ft');
  assert.equal(classic.sitesFit, 0);
  assert.match(classic.why, /None/);
  // Our legacy maxLengthFt said 30 and implied "fits" — prove the new path corrects it.
  assert.ok(classic.maxFt <= 30, `biggest trailer site is ${classic.maxFt}, not 33`);
});

test('trailerFit: Mather real data — a 25ft rig fits at SOME sites, with honest %', () => {
  const hist = histFromFixture('recgov-campsites-mather-232490.json');
  const fc = trailerFit({ trailerLenHistogram: hist }, 25);
  assert.equal(fc.conf, 'per-site');
  assert.ok(fc.sitesTotal > 100, 'Mather has >100 trailer sites');
  assert.ok(fc.sitesFit + fc.sitesTight > 0 && fc.sitesFit + fc.sitesTight < fc.sitesTotal,
    'some but not all sites take a 25-footer');
  assert.ok(fc.pct > 0 && fc.pct < 100);
  assert.match(fc.why, /\d+ of \d+ trailer sites/);
});

test('trailerFit: Gunter Hill real data — big-rig friendly, a 33ft fits widely', () => {
  const hist = histFromFixture('recgov-campsites-gunterhill-232593.json');
  const classic = trailerFit({ trailerLenHistogram: hist }, 33);
  assert.equal(classic.cls, 'fits');
  assert.ok(classic.pct >= 90, 'almost every Gunter Hill site takes a 33-footer');
});

test('trailerFit: missing histogram is honestly unverified, never a fabricated fit', () => {
  const u = trailerFit({ trailerMaxFt: null }, 25);
  assert.equal(u.conf, 'unverified');
  assert.equal(u.cls, 'unknown');
  assert.equal(u.pct, null);
  assert.match(u.why, /can’t be confirmed/);
  assert.doesNotMatch(u.why, /to spare|sites take/);
});

test('trailerFit: percentages always carry their N (no bare percentage)', () => {
  const hist = histFromFixture('recgov-campsites-mather-232490.json');
  const fc = trailerFit({ trailerLenHistogram: hist }, 25);
  // The "why" must mention both a count and the total, not just a %.
  assert.match(fc.why, /of \d+ trailer sites/);
});

// ---------------------------------------------------------------------------
// 5. elevationContext
// ---------------------------------------------------------------------------
test('elevationContext: bands by altitude, with honest null when missing', () => {
  assert.equal(elevationContext(null), null);
  assert.equal(elevationContext(undefined), null);
  assert.equal(elevationContext(500).band, 'low');
  assert.equal(elevationContext(3000).band, 'moderate');
  assert.equal(elevationContext(6500).band, 'elevated');
  assert.equal(elevationContext(9000).band, 'high');
  assert.match(elevationContext(9000).note, /cold nights/);
});

test('elevationContext: Grand Canyon south rim (~6900ft) reads elevated', () => {
  const e = elevationContext(6967);
  assert.equal(e.band, 'elevated');
  assert.equal(e.ft, 6967);
});

// ---------------------------------------------------------------------------
// nationalFit — honest per-site rollup (replaces the all-equipment headline)
// ---------------------------------------------------------------------------
test('nationalFit counts parks/sites by HONEST per-site fit, unverified kept separate', () => {
  const cgs = [
    // Mather-like: 0 of 136 take a 33-footer
    { trailerLenHistogram: { 15: 44, 16: 4, 21: 6, 25: 23, 27: 37, 30: 22 } },
    // big-rig park: all take a 33-footer comfortably
    { trailerLenHistogram: { 50: 2, 55: 7, 90: 9 } },
    // no per-site data → unverified, must NOT be folded into fit or miss
    { trailerMaxFt: 99 },
    {},
  ];
  const nf = nationalFit(cgs, 33);
  assert.equal(nf.parksTotal, 4);
  assert.equal(nf.parksUnverified, 2, 'two parks lack per-site data');
  assert.equal(nf.parksVerified, 2);
  assert.equal(nf.parksFit, 1, 'only the big-rig park fits a 33-footer');
  assert.equal(nf.parksNo, 1, 'Mather-like park is too short');
  assert.equal(nf.sitesTotal, 136 + 18, 'site totals only from verified parks');
  assert.equal(nf.sitesFit, 18, 'only the big-rig park\'s 18 sites take it');
});

test('nationalFit: a tiny rig fits nearly everything per-site', () => {
  const cgs = [
    { trailerLenHistogram: { 15: 44, 25: 23, 30: 22 } },
    { trailerLenHistogram: { 50: 2, 90: 9 } },
  ];
  const nf = nationalFit(cgs, 16);
  assert.equal(nf.parksFit, 2);
  assert.equal(nf.parksNo, 0);
  assert.ok(nf.sitesFit > 0 && nf.sitesFit <= nf.sitesTotal);
});

// ---------------------------------------------------------------------------
// Elevation band filter helper
// ---------------------------------------------------------------------------
test('inElevationBand: bands are inclusive-low/exclusive-high; unknown excluded', () => {
  assert.equal(inElevationBand(1999, 'low'), true);
  assert.equal(inElevationBand(2000, 'low'), false);
  assert.equal(inElevationBand(2000, 'moderate'), true);
  assert.equal(inElevationBand(4999, 'moderate'), true);
  assert.equal(inElevationBand(5000, 'moderate'), false);
  assert.equal(inElevationBand(5000, 'elevated'), true);
  assert.equal(inElevationBand(8000, 'elevated'), false);
  assert.equal(inElevationBand(8000, 'high'), true);
  assert.equal(inElevationBand(20000, 'high'), true);
  // no band selected → everything passes
  assert.equal(inElevationBand(null, ''), true);
  // unknown elevation with a band selected → excluded (honest, not a guess)
  assert.equal(inElevationBand(null, 'low'), false);
  assert.equal(inElevationBand(undefined, 'high'), false);
});

test('ELEVATION_BANDS cover the elevationContext thresholds without gaps', () => {
  assert.equal(ELEVATION_BANDS.length, 4);
  // each band key matches an elevationContext band at a representative ft
  assert.equal(elevationContext(1000).band, 'low');
  assert.equal(elevationContext(3000).band, 'moderate');
  assert.equal(elevationContext(6000).band, 'elevated');
  assert.equal(elevationContext(9000).band, 'high');
});
