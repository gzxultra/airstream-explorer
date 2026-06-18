import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichBoondockSite,
  renderBoondockDetail,
  seasonalRecommendation,
} from '../src/lib/boondock-enhanced.mjs';
import { loadBoondocking } from '../src/lib/campsites.mjs';

// ---------------------------------------------------------------------------
// Enhanced Boondocking Site Intelligence — enriches each boondocking site with
// computed fields derived from reliable data sources:
//
//  1. Solar harvest estimate (from solar-harvest.mjs, NREL-based)
//  2. Nearest water/dump stations (from boondock-resources.mjs, OSM-based)
//  3. Dark sky score (from dark-sky.mjs, modeled estimate)
//  4. Seasonal recommendation (best months to visit based on solar + weather)
//
// All enrichment is computed at BUILD TIME from static, pre-validated datasets.
// No runtime API calls. Every data source is labeled honestly.
// ---------------------------------------------------------------------------

const SAMPLE_SITE = {
  id: 'osm-test-1',
  name: 'Test Canyon Dispersed',
  agency: 'BLM',
  state: 'Utah',
  lat: 38.5,
  lon: -111.5,
  fee: 'free',
  reservation: 'first-come',
  hookups: 'none',
  elevationFt: 5200,
};

// A trailer spec for off-grid calculations
const TRAILER = { batteryKwh: 2.5, solarW: 300, freshGal: 53, grayGal: 34, blackGal: 39 };

test('enrichBoondockSite adds solar harvest data', () => {
  const enriched = enrichBoondockSite(SAMPLE_SITE, { trailer: TRAILER });
  assert.ok('solar' in enriched, 'enriched site has solar field');
  assert.equal(typeof enriched.solar.summerDailyWh, 'number');
  assert.equal(typeof enriched.solar.winterDailyWh, 'number');
  assert.ok(enriched.solar.summerDailyWh > enriched.solar.winterDailyWh,
    'summer harvest exceeds winter');
  assert.ok(enriched.solar.summerDailyWh > 0);
});

test('enrichBoondockSite adds dark sky score', () => {
  const enriched = enrichBoondockSite(SAMPLE_SITE, { trailer: TRAILER });
  assert.ok('darkSky' in enriched, 'enriched site has darkSky field');
  assert.equal(typeof enriched.darkSky.bortle, 'number');
  assert.ok(enriched.darkSky.bortle >= 1 && enriched.darkSky.bortle <= 9);
  assert.equal(typeof enriched.darkSky.score, 'number');
  assert.equal(typeof enriched.darkSky.label, 'string');
});

test('enrichBoondockSite adds nearest resources', () => {
  const enriched = enrichBoondockSite(SAMPLE_SITE, { trailer: TRAILER });
  assert.ok('nearestWater' in enriched, 'enriched site has nearestWater');
  assert.ok('nearestDump' in enriched, 'enriched site has nearestDump');
  // Each should be an object with distanceKm and name (name may be null —
  // real OSM water/dump nodes are frequently unnamed).
  if (enriched.nearestWater) {
    assert.equal(typeof enriched.nearestWater.distanceKm, 'number');
    assert.ok(
      typeof enriched.nearestWater.name === 'string' || enriched.nearestWater.name === null,
      'nearestWater.name is a string or null',
    );
  }
  if (enriched.nearestDump) {
    assert.equal(typeof enriched.nearestDump.distanceKm, 'number');
    assert.ok(
      typeof enriched.nearestDump.name === 'string' || enriched.nearestDump.name === null,
      'nearestDump.name is a string or null',
    );
  }
});

test('enrichBoondockSite adds off-grid endurance estimate', () => {
  const enriched = enrichBoondockSite(SAMPLE_SITE, { trailer: TRAILER });
  assert.ok('offGrid' in enriched, 'enriched site has offGrid field');
  assert.equal(typeof enriched.offGrid.summerNights, 'number');
  assert.equal(typeof enriched.offGrid.winterNights, 'number');
  assert.equal(typeof enriched.offGrid.limiter, 'string');
  assert.ok(enriched.offGrid.summerNights > 0);
});

test('enrichBoondockSite preserves original fields', () => {
  const enriched = enrichBoondockSite(SAMPLE_SITE, { trailer: TRAILER });
  assert.equal(enriched.id, SAMPLE_SITE.id);
  assert.equal(enriched.name, SAMPLE_SITE.name);
  assert.equal(enriched.lat, SAMPLE_SITE.lat);
  assert.equal(enriched.lon, SAMPLE_SITE.lon);
  assert.equal(enriched.state, SAMPLE_SITE.state);
});

test('enrichBoondockSite works without trailer (no off-grid estimate)', () => {
  const enriched = enrichBoondockSite(SAMPLE_SITE, {});
  // Solar and dark sky should still be present (location-only)
  assert.ok('solar' in enriched);
  assert.ok('darkSky' in enriched);
  // Off-grid should be null or absent without a trailer
  assert.ok(!enriched.offGrid || enriched.offGrid === null);
});

// Seasonal recommendation
test('seasonalRecommendation returns best months for a location', () => {
  const rec = seasonalRecommendation(SAMPLE_SITE);
  assert.ok(Array.isArray(rec.bestMonths));
  assert.ok(rec.bestMonths.length >= 2 && rec.bestMonths.length <= 12,);
  // Each month is 0-11
  for (const m of rec.bestMonths) {
    assert.ok(m >= 0 && m <= 11);
  }
  assert.equal(typeof rec.reason, 'string');
});

test('seasonalRecommendation: high-elevation sites avoid winter', () => {
  const highSite = { ...SAMPLE_SITE, elevationFt: 9000 };
  const rec = seasonalRecommendation(highSite);
  // December (11) and January (0) should NOT be in best months for 9000ft
  assert.ok(!rec.bestMonths.includes(11) || !rec.bestMonths.includes(0),
    'high-elevation sites should avoid deep winter');
});

test('seasonalRecommendation: desert sites avoid peak summer', () => {
  const desertSite = { ...SAMPLE_SITE, state: 'Arizona', lat: 32.0, elevationFt: 2000 };
  const rec = seasonalRecommendation(desertSite);
  // July (6) and August (7) should NOT be recommended for low-desert AZ
  assert.ok(!rec.bestMonths.includes(6) && !rec.bestMonths.includes(7),
    'low-desert AZ should avoid July/August');
});

// Render detail (HTML output for the enhanced boondock card)
test('renderBoondockDetail produces HTML with solar, dark sky, and resource info', () => {
  const enriched = enrichBoondockSite(SAMPLE_SITE, { trailer: TRAILER });
  const html = renderBoondockDetail(enriched);
  assert.equal(typeof html, 'string');
  assert.ok(html.includes('solar') || html.includes('Solar'), 'mentions solar');
  assert.ok(html.includes('Bortle') || html.includes('dark') || html.includes('Dark'), 'mentions dark sky');
});

// Integration: enrich all shipped boondocking sites
test('all shipped boondocking sites can be enriched without errors', () => {
  const boon = loadBoondocking();
  for (const site of boon.sites) {
    const enriched = enrichBoondockSite(site, { trailer: TRAILER });
    assert.ok(enriched.solar, `${site.name}: has solar data`);
    assert.ok(enriched.darkSky, `${site.name}: has dark sky data`);
  }
});
