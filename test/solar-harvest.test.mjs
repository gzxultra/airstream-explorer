import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  solarHarvestAt,
  monthlySolarProfile,
  SOLAR_CONSTANTS,
} from '../src/lib/solar-harvest.mjs';

// ---------------------------------------------------------------------------
// Solar Harvest Estimator — location-aware solar energy calculation.
//
// Uses NREL-sourced latitude-based irradiance model (Global Horizontal
// Irradiance lookup table derived from published NREL PVWatts data for
// representative US locations). This is a STATIC model — no API calls at
// build time — but the underlying data is sourced from NREL's 30-year TMY
// (Typical Meteorological Year) averages, which are the gold standard for
// solar resource estimation in the US.
//
// Reference: NREL PVWatts Calculator v8, Solar Resource Data (GHI values
// for US locations between 25°N and 49°N latitude).
// ---------------------------------------------------------------------------

// A representative southern AZ location (Tucson area, ~32°N)
const TUCSON = { lat: 32.2, lon: -110.9 };
// A northern location (Seattle area, ~47.6°N)
const SEATTLE = { lat: 47.6, lon: -122.3 };
// Mid-latitude (Denver, ~39.7°N)
const DENVER = { lat: 39.7, lon: -104.9 };

test('SOLAR_CONSTANTS exports the documented reference values', () => {
  // System derate factor (same as estimate.mjs for consistency)
  assert.equal(SOLAR_CONSTANTS.SYSTEM_DERATE, 0.7);
  // The latitude reference bands must cover the continental US
  assert.ok(SOLAR_CONSTANTS.LAT_BANDS.length >= 5, 'at least 5 latitude bands');
  // Each band has lat, and monthly GHI values (12 months)
  for (const band of SOLAR_CONSTANTS.LAT_BANDS) {
    assert.equal(typeof band.lat, 'number');
    assert.equal(band.ghi.length, 12, `band at ${band.lat}°N has 12 monthly GHI values`);
    for (const v of band.ghi) {
      // Northern latitudes in deep winter can legitimately be below 1.5 kWh/m²/day
    assert.ok(v >= 0.8 && v <= 8.5, `GHI ${v} at ${band.lat}°N in plausible range (0.8-8.5 kWh/m²/day)`);
    }
  }
});

test('solarHarvestAt returns daily Wh for a given panel size and location', () => {
  // 300W panel in Tucson in summer (month index 6 = July) should produce well
  const result = solarHarvestAt({ lat: TUCSON.lat, panelWatts: 300, month: 6 });
  assert.equal(typeof result.dailyWh, 'number');
  assert.ok(result.dailyWh > 800, `Tucson July 300W should produce >800 Wh/day, got ${result.dailyWh}`);
  assert.ok(result.dailyWh < 2000, `Tucson July 300W should produce <2000 Wh/day, got ${result.dailyWh}`);
  assert.equal(typeof result.peakSunHours, 'number');
  assert.ok(result.peakSunHours >= 4 && result.peakSunHours <= 8);
});

test('solarHarvestAt: southern locations produce more than northern in winter', () => {
  const tucsonWinter = solarHarvestAt({ lat: TUCSON.lat, panelWatts: 300, month: 0 }); // January
  const seattleWinter = solarHarvestAt({ lat: SEATTLE.lat, panelWatts: 300, month: 0 });
  assert.ok(tucsonWinter.dailyWh > seattleWinter.dailyWh,
    `Tucson winter (${tucsonWinter.dailyWh}) should beat Seattle winter (${seattleWinter.dailyWh})`);
});

test('solarHarvestAt: summer produces more than winter at same location', () => {
  const summer = solarHarvestAt({ lat: DENVER.lat, panelWatts: 300, month: 6 });
  const winter = solarHarvestAt({ lat: DENVER.lat, panelWatts: 300, month: 0 });
  assert.ok(summer.dailyWh > winter.dailyWh,
    `Denver summer (${summer.dailyWh}) should beat winter (${winter.dailyWh})`);
});

test('solarHarvestAt: larger panels produce proportionally more', () => {
  const small = solarHarvestAt({ lat: DENVER.lat, panelWatts: 200, month: 6 });
  const large = solarHarvestAt({ lat: DENVER.lat, panelWatts: 400, month: 6 });
  // Should be exactly 2x (linear scaling)
  assert.ok(Math.abs(large.dailyWh / small.dailyWh - 2.0) < 0.01,
    'harvest scales linearly with panel size');
});

test('solarHarvestAt: zero panel watts returns zero harvest', () => {
  const result = solarHarvestAt({ lat: DENVER.lat, panelWatts: 0, month: 6 });
  assert.equal(result.dailyWh, 0);
});

test('solarHarvestAt: handles edge latitudes gracefully (clamp to US range)', () => {
  // Latitude below US range should clamp to southernmost band
  const south = solarHarvestAt({ lat: 20, panelWatts: 300, month: 6 });
  assert.ok(south.dailyWh > 0, 'sub-US latitude still produces a result');
  // Latitude above US range should clamp to northernmost band
  const north = solarHarvestAt({ lat: 55, panelWatts: 300, month: 6 });
  assert.ok(north.dailyWh > 0, 'super-US latitude still produces a result');
});

test('monthlySolarProfile returns 12-month array of daily Wh', () => {
  const profile = monthlySolarProfile({ lat: DENVER.lat, panelWatts: 300 });
  assert.equal(profile.length, 12, 'one entry per month');
  for (let i = 0; i < 12; i++) {
    assert.equal(typeof profile[i].dailyWh, 'number');
    assert.equal(typeof profile[i].peakSunHours, 'number');
    assert.equal(typeof profile[i].monthName, 'string');
    assert.ok(profile[i].dailyWh >= 0);
  }
  // Summer months (May-Aug, indices 4-7) should average higher than winter (Nov-Feb, 10,11,0,1)
  const summerAvg = (profile[4].dailyWh + profile[5].dailyWh + profile[6].dailyWh + profile[7].dailyWh) / 4;
  const winterAvg = (profile[10].dailyWh + profile[11].dailyWh + profile[0].dailyWh + profile[1].dailyWh) / 4;
  assert.ok(summerAvg > winterAvg, 'summer average exceeds winter average');
});

test('solarHarvestAt: result includes the interpolated GHI used', () => {
  const result = solarHarvestAt({ lat: DENVER.lat, panelWatts: 300, month: 6 });
  assert.equal(typeof result.ghiUsed, 'number');
  assert.ok(result.ghiUsed >= 2 && result.ghiUsed <= 8, 'GHI in plausible range');
});
