// boondock-enhanced.mjs — Enriches boondocking sites with computed intelligence.
//
// Combines three data sources at build time:
//  1. Solar harvest (NREL-based, solar-harvest.mjs)
//  2. Dark sky score (NASA VIIRS-based, dark-sky.mjs)
//  3. Nearest water/dump stations (OSM-based, boondock-resources.mjs)
//
// All enrichment is STATIC — computed at build time, no runtime API calls.
// Every data source is labeled honestly in the UI.

import { solarHarvestAt } from './solar-harvest.mjs';
import { estimateLightPollution } from './dark-sky.mjs';
import { loadResourcePoints, nearestResources } from './boondock-resources.mjs';

// Lazy-load the resource points once
let _resourcePoints = null;
function getResourcePoints() {
  if (!_resourcePoints) {
    try {
      _resourcePoints = loadResourcePoints();
    } catch {
      _resourcePoints = [];
    }
  }
  return _resourcePoints;
}

// Month indices for seasonal calculations
const SUMMER_MONTHS = [5, 6, 7];  // Jun, Jul, Aug
const WINTER_MONTHS = [11, 0, 1]; // Dec, Jan, Feb

/**
 * Enrich a boondocking site with computed intelligence.
 *
 * @param {object} site   A boondocking site from boondocking.json
 * @param {object} opts   { trailer?: { batteryKwh, solarW, freshGal, grayGal, blackGal } }
 * @returns {object}      Enriched site with solar, darkSky, nearestWater, nearestDump, offGrid
 */
export function enrichBoondockSite(site, opts = {}) {
  const { trailer } = opts;

  // 1. Solar harvest
  const panelWatts = trailer?.solarW ?? 300; // default 300W for display
  const summerSolar = solarHarvestAt({ lat: site.lat, panelWatts, month: 6 }); // July
  const winterSolar = solarHarvestAt({ lat: site.lat, panelWatts, month: 0 }); // January
  const solar = {
    summerDailyWh: summerSolar.dailyWh,
    winterDailyWh: winterSolar.dailyWh,
    summerPSH: summerSolar.peakSunHours,
    winterPSH: winterSolar.peakSunHours,
    panelWatts,
    source: 'NREL NSRDB TMY averages (latitude-based model)',
  };

  // 2. Dark sky score
  const darkSky = estimateLightPollution(site.lat, site.lon);

  // 3. Nearest resources
  const resources = getResourcePoints();
  const nearestWaterArr = nearestResources(
    { lat: site.lat, lon: site.lon }, resources, { type: 'water', limit: 1 }
  );
  const nearestDumpArr = nearestResources(
    { lat: site.lat, lon: site.lon }, resources, { type: 'dump', limit: 1 }
  );
  const nearestWater = nearestWaterArr[0] || null;
  const nearestDump = nearestDumpArr[0] || null;

  // 4. Off-grid endurance (only if trailer provided)
  let offGrid = null;
  if (trailer) {
    offGrid = computeOffGridEndurance(site, trailer, solar);
  }

  return {
    ...site,
    solar,
    darkSky,
    nearestWater,
    nearestDump,
    offGrid,
  };
}

/**
 * Compute how many nights a trailer can stay off-grid at this site.
 * Uses the same logic as estimate.mjs but with location-specific solar.
 */
function computeOffGridEndurance(site, trailer, solar) {
  const { batteryKwh = 0, solarW = 0, freshGal = 40, grayGal = 30, blackGal = 30 } = trailer;

  // Daily consumption estimates (conservative defaults)
  const dailyKwh = 1.5;       // kWh/day typical RV consumption
  const dailyWaterGal = 5;    // gallons/day conservative use

  // Summer scenario
  const summerSolarKwh = solar.summerDailyWh / 1000;
  const summerNetKwh = summerSolarKwh - dailyKwh;
  const summerBattNights = batteryKwh > 0 ? batteryKwh / Math.max(0.01, dailyKwh - summerSolarKwh) : 999;
  const summerWaterNights = freshGal / dailyWaterGal;
  const summerNights = Math.min(
    summerNetKwh >= 0 ? 999 : Math.max(1, summerBattNights),
    summerWaterNights
  );

  // Winter scenario
  const winterSolarKwh = solar.winterDailyWh / 1000;
  const winterNetKwh = winterSolarKwh - dailyKwh;
  const winterBattNights = batteryKwh > 0 ? batteryKwh / Math.max(0.01, dailyKwh - winterSolarKwh) : 999;
  const winterWaterNights = freshGal / dailyWaterGal;
  const winterNights = Math.min(
    winterNetKwh >= 0 ? 999 : Math.max(1, winterBattNights),
    winterWaterNights
  );

  // Determine what limits the stay
  const limiterSummer = summerNights === summerWaterNights ? 'water' : 'battery';
  const limiterWinter = winterNights === winterWaterNights ? 'water' : 'battery';

  return {
    summerNights: Math.round(Math.min(summerNights, 30)),
    winterNights: Math.round(Math.min(winterNights, 30)),
    limiter: limiterSummer,
    limiterWinter,
  };
}

/**
 * Determine the best months to visit a boondocking site.
 * Based on: elevation (avoid deep winter at high elevation), latitude
 * (avoid peak summer at low-desert latitudes), and solar harvest.
 */
export function seasonalRecommendation(site) {
  const { lat, elevationFt = 0, state } = site;

  // Low-desert states to avoid in peak summer
  const desertStates = new Set(['Arizona', 'Nevada', 'New Mexico', 'California']);
  const isLowDesert = desertStates.has(state) && elevationFt < 4000;

  // High elevation: avoid deep winter
  const isHighElevation = elevationFt >= 7000;
  const isMidElevation = elevationFt >= 4000 && elevationFt < 7000;

  const bestMonths = [];
  for (let m = 0; m < 12; m++) {
    let ok = true;

    // High elevation: skip Dec-Mar
    if (isHighElevation && (m === 11 || m <= 2)) ok = false;
    // Mid elevation: skip Dec-Jan
    if (isMidElevation && (m === 11 || m === 0)) ok = false;
    // Low desert: skip Jun-Sep
    if (isLowDesert && m >= 5 && m <= 8) ok = false;
    // Northern latitudes (>= 45°N): skip Dec-Feb
    if (lat >= 45 && (m === 11 || m <= 1)) ok = false;

    if (ok) bestMonths.push(m);
  }

  // If nothing qualifies (unlikely), default to spring/fall
  if (bestMonths.length === 0) {
    bestMonths.push(3, 4, 9, 10);
  }

  let reason = '';
  if (isHighElevation) reason = 'High elevation — avoid winter snow closure';
  else if (isLowDesert) reason = 'Low desert — avoid extreme summer heat';
  else if (lat >= 45) reason = 'Northern location — shoulder seasons best';
  else reason = 'Year-round accessible with mild weather';

  return { bestMonths, reason };
}

/**
 * Render the enhanced boondocking detail HTML snippet.
 * Used inside the boondocking card for the detail panel.
 */
export function renderBoondockDetail(enriched) {
  const { solar, darkSky, nearestWater, nearestDump, offGrid } = enriched;

  const solarBar = renderSolarBar(solar);
  const darkSkyBadge = renderDarkSkyBadge(darkSky);
  const resourceRow = renderResourceRow(nearestWater, nearestDump);
  const offGridRow = offGrid ? renderOffGridRow(offGrid) : '';

  return `<div class="bd-detail">
  ${solarBar}
  ${darkSkyBadge}
  ${resourceRow}
  ${offGridRow}
</div>`;
}

function renderSolarBar(solar) {
  const pct = Math.round((solar.summerDailyWh / (solar.panelWatts * 8)) * 100);
  const safePct = Math.min(100, Math.max(0, pct));
  return `<div class="bd-solar">
  <span class="bd-detail-label">Solar harvest</span>
  <span class="bd-detail-value">${solar.summerDailyWh} Wh/day (summer) · ${solar.winterDailyWh} Wh/day (winter)</span>
  <div class="bd-solar-bar" aria-label="${safePct}% of theoretical max">
    <div class="bd-solar-fill" style="width:${safePct}%"></div>
  </div>
  <span class="bd-detail-note">Based on ${solar.panelWatts}W panels · NREL NSRDB data</span>
</div>`;
}

function renderDarkSkyBadge(darkSky) {
  return `<div class="bd-darksky">
  <span class="bd-detail-label">Dark sky</span>
  <span class="bd-darksky-badge" style="background:${darkSky.color};color:${darkSky.bortle <= 4 ? '#fff' : '#000'}">
    Bortle ${darkSky.bortle}
  </span>
  <span class="bd-detail-value">${darkSky.label}</span>
  <span class="bd-detail-note">NASA VIIRS · ${darkSky.resolution}</span>
</div>`;
}

function renderResourceRow(water, dump) {
  const waterStr = water
    ? `${(water.distanceKm * 0.621371).toFixed(0)} mi`
    : 'Unknown';
  const dumpStr = dump
    ? `${(dump.distanceKm * 0.621371).toFixed(0)} mi`
    : 'Unknown';
  return `<div class="bd-resources">
  <span class="bd-detail-label">Nearest services</span>
  <span class="bd-resource-item">💧 Water: ${waterStr}</span>
  <span class="bd-resource-item">🚽 Dump: ${dumpStr}</span>
  <span class="bd-detail-note">OSM community data · verify before visit</span>
</div>`;
}

function renderOffGridRow(offGrid) {
  const summerLabel = offGrid.summerNights >= 30 ? '30+ nights' : `~${offGrid.summerNights} nights`;
  const winterLabel = offGrid.winterNights >= 30 ? '30+ nights' : `~${offGrid.winterNights} nights`;
  return `<div class="bd-offgrid">
  <span class="bd-detail-label">Est. off-grid stay</span>
  <span class="bd-detail-value">Summer: ${summerLabel} · Winter: ${winterLabel}</span>
  <span class="bd-detail-note">Limit: ${offGrid.limiter} · Based on your trailer config</span>
</div>`;
}
