// Estimators: off-grid (boondocking) endurance.
// Pure functions over a trailer's real spec fields — no DOM, no I/O — so the
// exact same math is unit-tested here and mirrored in the client.
//
// Every constant below is a documented, sourced real-world assumption. We never
// invent a trailer's specs; we only model how its REAL battery/solar/tank/price
// numbers play out under transparent usage assumptions the user can see.

// ===========================================================================
// OFF-GRID (BOONDOCKING) ENDURANCE
// ===========================================================================
//
// How many nights can this trailer sit off-grid (no hookups) before EITHER the
// house battery runs flat OR a water tank fills/empties? We model power and
// water independently, then the shorter of the two is the real limit — and we
// say which one binds, because that's the number that actually ends a trip.

/**
 * Daily electrical load presets, in watt-hours/day. Sourced from published
 * boondocking power budgets (Off-Road.com 2026 solar guide; BlackSeries off-grid
 * calculator: "light use ~1,500 Wh/day … heavy use with electric cooking
 * ~5,000–6,000 Wh/day"). These are 12V house loads only — they deliberately
 * EXCLUDE rooftop air conditioning, which no Airstream house battery can run
 * for a meaningful stretch (a single AC pulls ~3,300 Wh in just 3 hours).
 */
export const LOAD_PRESETS = {
  light: { wh: 1500, label: 'Light', blurb: 'Lights, fridge, water pump, phones' },
  moderate: { wh: 2800, label: 'Moderate', blurb: 'Adds Starlink, laptops, fan, more cooking' },
  heavy: { wh: 5000, label: 'Heavy', blurb: 'Electric cooking, big inverter loads, full hook-up habits' },
};

/**
 * Peak sun hours (PSH) by season — the number of equivalent full-sun hours a
 * panel sees per day. Sourced from BlackSeries / NREL PVWatts guidance
 * ("Summer 5–6h, Winter 2–3h"). Spring/fall interpolated. PSH already bakes in
 * latitude/day-length seasonality; a separate system derate is applied below.
 */
export const PEAK_SUN_HOURS = {
  summer: 5.5,
  shoulder: 4.0, // spring / fall
  winter: 2.5,
};

// Fraction of nameplate battery kWh we treat as usable. A blended, conservative
// figure: lithium (LiFePO4) tolerates ~90% depth of discharge, lead-acid/AGM
// only ~50%. Airstream ships a mix by model/year and we don't track chemistry
// per row, so we use a single transparent 0.8 and disclose it.
export const BATTERY_USABLE_FRACTION = 0.8;

// Solar system derate: real-world losses (controller, wiring, heat, dust,
// imperfect panel angle) vs. nameplate watts. 0.7 is the standard planning
// figure used across the cited solar calculators.
export const SOLAR_DERATE = 0.7;

/**
 * Per-person-per-day water use, in gallons, by usage intensity. Boondocking
 * (conserving) figures — well below the ~80–100 gal/day a hookup household uses.
 * fresh = total drawn; gray ≈ 80% of fresh (sink + shower; the rest is drunk or
 * cooked off); black = toilet only. Aligned with conservation guidance in the
 * cited RV water-management sources.
 */
export const WATER_PRESETS = {
  light: { fresh: 3.0, black: 0.75 },
  moderate: { fresh: 5.0, black: 1.0 },
  heavy: { fresh: 8.0, black: 1.5 },
};
export const GRAY_FROM_FRESH = 0.8; // gray water produced per gallon of fresh used

/**
 * Estimate off-grid endurance for one trailer.
 *
 * @param {object} t                trailer (needs batteryKwh, solarW, freshGal, grayGal, blackGal)
 * @param {object} opts
 * @param {number} [opts.people=2]      number of campers
 * @param {'light'|'moderate'|'heavy'} [opts.intensity='moderate']
 * @param {'summer'|'shoulder'|'winter'} [opts.season='summer']
 * @param {boolean} [opts.useSolar=true]  count rooftop solar harvest
 * @returns {{
 *   days:number, limiter:'power'|'water', limiterDetail:string,
 *   power:{loadWh:number, solarWh:number, usableWh:number, netWh:number, days:number|null},
 *   water:{freshDays:number, grayDays:number, blackDays:number, days:number, binds:string}
 * }}
 */
export function estimateOffGrid(t, opts = {}) {
  const people = Math.max(1, opts.people || 2);
  const intensity = LOAD_PRESETS[opts.intensity] ? opts.intensity : 'moderate';
  const season = PEAK_SUN_HOURS[opts.season] != null ? opts.season : 'summer';
  const useSolar = opts.useSolar !== false;

  // ---- Power ----
  const usableWh = (t.batteryKwh || 0) * 1000 * BATTERY_USABLE_FRACTION;
  const loadWh = LOAD_PRESETS[intensity].wh;
  const psh = PEAK_SUN_HOURS[season];
  const solarWh = useSolar ? (t.solarW || 0) * psh * SOLAR_DERATE : 0;
  const netWh = loadWh - solarWh; // net battery draw per day after solar
  // If solar covers the load, power never runs out (days = null => "not limited").
  const powerDays = netWh > 0 ? usableWh / netWh : null;

  // ---- Water ----
  const w = WATER_PRESETS[intensity];
  const freshPerDay = w.fresh * people;
  const grayPerDay = w.fresh * GRAY_FROM_FRESH * people;
  const blackPerDay = w.black * people;
  const freshDays = freshPerDay > 0 ? (t.freshGal || 0) / freshPerDay : Infinity;
  const grayDays = grayPerDay > 0 && t.grayGal != null ? t.grayGal / grayPerDay : Infinity;
  const blackDays = blackPerDay > 0 && t.blackGal != null ? t.blackGal / blackPerDay : Infinity;
  const waterDays = Math.min(freshDays, grayDays, blackDays);
  const binds = waterDays === freshDays ? 'fresh water'
    : waterDays === grayDays ? 'gray tank'
    : 'black tank';

  // ---- Combine: the shorter of power vs. water ends the trip ----
  let days, limiter, limiterDetail;
  if (powerDays == null || waterDays <= powerDays) {
    days = waterDays;
    limiter = 'water';
    limiterDetail = `${binds} fills first`;
  } else {
    days = powerDays;
    limiter = 'power';
    limiterDetail = 'house battery runs down first';
  }
  // If solar fully covers load AND water is effectively unlimited, cap sensibly.
  if (!Number.isFinite(days)) days = 14; // practical planning ceiling

  return {
    days: Math.max(0, days),
    limiter,
    limiterDetail,
    power: {
      loadWh, solarWh: Math.round(solarWh), usableWh: Math.round(usableWh),
      netWh: Math.round(netWh), days: powerDays,
    },
    water: {
      freshDays, grayDays, blackDays, days: waterDays, binds,
    },
  };
}

/** Round nights to a friendly value: <2 → 1 decimal, else whole nights. */
export function formatNights(days) {
  if (!Number.isFinite(days)) return '14+ nights';
  if (days >= 13.5) return '14+ nights';
  if (days < 2) return `${days.toFixed(1)} nights`;
  return `${Math.round(days)} nights`;
}
