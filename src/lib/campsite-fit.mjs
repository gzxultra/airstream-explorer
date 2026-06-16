// Campsite-level fusion intelligence: "THIS Airstream at THIS campground."
//
// Pure functions over (a) a trailer's real spec fields and (b) the per-campsite
// data baked from Recreation.gov's public endpoints (see scripts/campdata/
// enrich.mjs): trailerMaxFt, trailerLenHistogram, hookups, ampService,
// elevationFt. No DOM, no I/O — the exact same math is unit-tested here and
// mirrored in the client, so the two can never silently drift.
//
// HONESTY CONTRACT (the user's #1 value):
//   - Every output that depends on enriched data degrades to a clearly-labeled
//     'unverified' state when that data is missing. We NEVER invent a fit, a
//     hookup level, or a nights count. Missing reads as missing.
//   - Percentages always carry their N. A "62% of sites take your rig" claim is
//     meaningless without "(97 of 156 trailer sites)".
//   - The latitude PSH refinement only SHARPENS the existing, sourced seasonal
//     model; it never fabricates more sun than the season allows.

import { estimateOffGrid, PEAK_SUN_HOURS, SOLAR_DERATE } from './estimate.mjs';

const CLEARANCE = 3; // ft maneuvering buffer — identical to campgrounds.mjs

// ===========================================================================
// 1. LATITUDE-REFINED PEAK SUN HOURS
// ===========================================================================
//
// The base estimator uses one PSH per season for the whole country. But a panel
// at 25°N (Florida Keys) sees materially more winter sun than one at 48°N
// (northern Montana). We refine the SEASONAL baseline by latitude with a small,
// transparent multiplier anchored to NREL insolation norms, then CLAMP so the
// refinement can only move within a defensible band — never inventing sun.
//
// Anchors (NREL/PVWatts flat-plate seasonal norms, simplified):
//   - Summer is fairly latitude-flat in the lower 48 (long days up north
//     compensate for lower sun angle): keep within ±10%.
//   - Winter is strongly latitude-driven: low latitudes hold up, high latitudes
//     fall off sharply (short days + low angle): allow a wider band.
//   - Shoulder sits between.
// We express this as a multiplier on the season's base PSH as a function of the
// |latitude - 35°| reference (35°N ≈ the latitude the base figures suit best,
// e.g. Flagstaff/Albuquerque/the desert-Southwest boondocking belt).
const PSH_LAT_REF = 35; // degrees; the latitude the base PEAK_SUN_HOURS suits
const PSH_BAND = {
  // perDeg: fractional PSH change per degree away from the reference latitude
  // (negative = less sun as you move away). min/max: clamp on the final factor.
  summer: { perDeg: -0.004, min: 0.9, max: 1.06 },
  shoulder: { perDeg: -0.010, min: 0.72, max: 1.12 },
  winter: { perDeg: -0.020, min: 0.5, max: 1.25 },
};

/**
 * Latitude-refined peak sun hours for a season.
 * @param {'summer'|'shoulder'|'winter'} season
 * @param {number|null|undefined} lat   campground latitude (degrees, may be <0)
 * @returns {{ psh:number, base:number, factor:number, refined:boolean }}
 *   refined=false when no latitude is known (we fall back to the base figure).
 */
export function peakSunHoursAt(season, lat) {
  const s = PEAK_SUN_HOURS[season] != null ? season : 'summer';
  const base = PEAK_SUN_HOURS[s];
  if (lat == null || !Number.isFinite(lat)) {
    return { psh: base, base, factor: 1, refined: false };
  }
  const band = PSH_BAND[s];
  const dist = Math.abs(Math.abs(lat) - PSH_LAT_REF); // degrees from reference
  let factor = 1 + band.perDeg * dist;
  factor = Math.max(band.min, Math.min(band.max, factor));
  const psh = Math.round(base * factor * 100) / 100;
  return { psh, base, factor: Math.round(factor * 1000) / 1000, refined: true };
}

// ===========================================================================
// 2. "HOW MANY NIGHTS HERE, OFF-GRID"
// ===========================================================================
//
// When a campground has NO hookups, how long does THIS rig last there? We reuse
// the authoritative estimateOffGrid() but feed it a latitude-refined PSH for the
// chosen season by temporarily overriding the season constant via a thin shim:
// estimateOffGrid reads PEAK_SUN_HOURS[season] internally, so instead of
// mutating that global we re-derive the solar term using the refined PSH and the
// SAME constants, then defer everything else (water, limiter logic) to the
// canonical function by calling it and substituting the refined power leg.
//
// To stay DRY and parity-safe we don't re-implement the combine logic; we call
// estimateOffGrid for the WATER side + structure, then recompute the POWER days
// with refined PSH and re-pick the binding limit with the identical rule.

/**
 * Off-grid endurance for a trailer AT a specific campground location/season.
 * Identical math to estimateOffGrid, except solar harvest uses latitude-refined
 * PSH. Returns the same shape plus { psh, pshRefined, lat }.
 *
 * @param {object} t      trailer (batteryKwh, solarW, freshGal, grayGal, blackGal)
 * @param {object} opts   { people, intensity, season, useSolar, lat }
 */
export function nightsHere(t, opts = {}) {
  const season = PEAK_SUN_HOURS[opts.season] != null ? opts.season : 'summer';
  const { psh, refined } = peakSunHoursAt(season, opts.lat);

  // Canonical estimate (uses the base seasonal PSH). We keep its water leg and
  // structure verbatim, then override the power leg with refined PSH below.
  const base = estimateOffGrid(t, { ...opts, season });

  // Recompute the power leg with refined PSH, reusing the SAME constants and the
  // SAME raw formula estimateOffGrid uses (solarWh = solarW * PSH * SOLAR_DERATE,
  // UN-rounded), so that with no latitude (psh === basePSH) this reproduces the
  // canonical days EXACTLY — no rounding drift. We only round solarWh for display.
  const useSolar = opts.useSolar !== false;
  const solarWhRaw = useSolar ? (t.solarW || 0) * psh * SOLAR_DERATE : 0;
  const netWh = base.power.loadWh - solarWhRaw;
  const powerDays = netWh > 0 ? base.power.usableWh / netWh : null;

  // Re-pick the binding limit with the IDENTICAL rule estimateOffGrid uses.
  const waterDays = base.water.days;
  let days, limiter, limiterDetail;
  if (powerDays == null || waterDays <= powerDays) {
    days = waterDays;
    limiter = 'water';
    limiterDetail = `${base.water.binds} fills first`;
  } else {
    days = powerDays;
    limiter = 'power';
    limiterDetail = 'house battery runs down first';
  }
  if (!Number.isFinite(days)) days = 14;

  return {
    days: Math.max(0, days),
    limiter,
    limiterDetail,
    psh,
    pshRefined: refined,
    lat: opts.lat == null ? null : opts.lat,
    power: { ...base.power, solarWh: Math.round(solarWhRaw), netWh: Math.round(netWh), days: powerDays },
    water: base.water,
  };
}

// ===========================================================================
// 3. HOOKUP MATCH — is solar a must-have or a nice-to-have here?
// ===========================================================================

export const HOOKUP_LABEL = {
  full: 'Full hookups',
  electric: 'Electric hookups',
  none: 'No hookups (dry camping)',
  unknown: 'Hookups unverified',
};

/**
 * Given a campground's derived hookup level and a trailer, classify how much the
 * rig depends on its own power here. HONEST: 'unknown' when hookups weren't
 * verified from per-site data.
 *
 * @param {'full'|'electric'|'none'|null|undefined} hookups
 * @param {number[]} [ampService]  e.g. [30,50]
 * @returns {{ level:string, label:string, solar:'not-needed'|'nice'|'must'|'unknown', note:string }}
 */
export function hookupMatch(hookups, ampService = []) {
  if (hookups == null) {
    return {
      level: 'unknown', label: HOOKUP_LABEL.unknown, solar: 'unknown',
      note: 'No per-site hookup data published for this campground — confirm on Recreation.gov before counting on power.',
    };
  }
  const amps = Array.isArray(ampService) ? ampService.filter((a) => a === 30 || a === 50) : [];
  const ampTxt = amps.length ? `${amps.join('/')}-amp` : '';
  if (hookups === 'full') {
    return {
      level: 'full', label: HOOKUP_LABEL.full, solar: 'not-needed',
      note: `Water, ${ampTxt || 'electric'} and sewer at the site — your battery and solar are backup only here.`.replace('  ', ' '),
    };
  }
  if (hookups === 'electric') {
    return {
      level: 'electric', label: HOOKUP_LABEL.electric, solar: 'nice',
      note: `Shore power (${ampTxt || 'electric'}) covers the battery, but there's no sewer — you'll still manage your own tanks.`,
    };
  }
  return {
    level: 'none', label: HOOKUP_LABEL.none, solar: 'must',
    note: 'No hookups here — your battery, solar and tanks are all you have. See the nights-here estimate below.',
  };
}

// ===========================================================================
// 4. TRAILER-TRUE LENGTH FIT (fixes the all-equipment maxLengthFt bug)
// ===========================================================================
//
// Our legacy campground.maxLengthFt is the MAX across ALL equipment types
// (motorhome/bus-dominated) and badly overstates trailer fit (Mather posts 30
// but ZERO sites take 33ft; Gunter Hill posts 138 — a bus figure). When the
// enrich pass gives us a per-site trailer length histogram, we answer the only
// question that matters honestly: what FRACTION of this park's trailer sites
// actually take YOUR rig (+ the maneuvering clearance)?

/**
 * @param {object} cg      campground with optional { trailerLenHistogram, trailerMaxFt, rvSiteCount }
 * @param {number} lengthFt   the rig's real length
 * @returns {{
 *   conf:'per-site'|'unverified',
 *   sitesTotal:number|null, sitesFit:number|null, sitesTight:number|null,
 *   pct:number|null, maxFt:number|null, cls:'fits'|'tight'|'no'|'unknown', why:string
 * }}
 */
export function trailerFit(cg, lengthFt) {
  const hist = cg && cg.trailerLenHistogram;
  if (!hist || typeof hist !== 'object' || !(lengthFt > 0)) {
    return {
      conf: 'unverified', sitesTotal: null, sitesFit: null, sitesTight: null,
      pct: null, maxFt: (cg && cg.trailerMaxFt) || null, cls: 'unknown',
      why: 'No per-site trailer-length data published here — fit can’t be confirmed; check Recreation.gov.',
    };
  }
  let total = 0; let fit = 0; let tight = 0; let maxFt = 0;
  for (const [lenStr, count] of Object.entries(hist)) {
    const cap = Number(lenStr); const n = Number(count) || 0;
    if (!(cap > 0) || n <= 0) continue;
    total += n;
    if (cap > maxFt) maxFt = cap;
    if (cap >= lengthFt + CLEARANCE) fit += n;
    else if (cap >= lengthFt) tight += n;
  }
  if (total === 0) {
    return {
      conf: 'unverified', sitesTotal: 0, sitesFit: 0, sitesTight: 0,
      pct: null, maxFt: maxFt || null, cls: 'unknown',
      why: 'No per-site trailer-length data published here — fit can’t be confirmed; check Recreation.gov.',
    };
  }
  const usable = fit + tight;
  const pct = Math.round((usable / total) * 100);
  const rig = (Math.round(lengthFt * 10) / 10);
  let cls; let why;
  if (fit > 0 && pct >= 50) {
    cls = 'fits';
    why = `${fit} of ${total} trailer sites take your ${rig}′ with room to maneuver (${pct}% usable incl. tight).`;
  } else if (usable > 0) {
    cls = 'tight';
    why = `Only ${usable} of ${total} trailer sites (${pct}%) take your ${rig}′ — and ${tight} of those are a tight squeeze. Book carefully.`;
  } else {
    cls = 'no';
    why = `None of this park's ${total} trailer sites take your ${rig}′ (biggest is ${maxFt}′). Look elsewhere.`;
  }
  return { conf: 'per-site', sitesTotal: total, sitesFit: fit, sitesTight: tight, pct, maxFt, cls, why };
}

// ===========================================================================
// 4b. NATIONAL FIT ROLLUP (honest headline for the detail page)
// ===========================================================================
//
// The OLD detail headline summed fitClass() over the legacy single maxLengthFt
// — the all-equipment figure that overstates trailer fit. This rollup answers
// the honest question across the whole dataset using the SAME trailerFit()
// per-site logic: at how many parks does your rig fit at least one trailer
// site, and how many actual trailer sites nationwide can take it? Parks with no
// per-site data are counted separately as 'unverified' — never folded into a
// fit or a miss.
//
// Returns:
//   parksFit       parks where >=1 trailer site takes the rig (cls fits|tight)
//   parksNo        parks where the rig is too long for every trailer site
//   parksUnverified parks with no per-site trailer data
//   sitesFit       total trailer sites nationwide that take the rig (fit+tight)
//   sitesTotal     total trailer sites with published lengths
//   parksTotal     dataset size
export function nationalFit(campgrounds, lengthFt) {
  let parksFit = 0; let parksNo = 0; let parksUnverified = 0;
  let sitesFit = 0; let sitesTotal = 0;
  for (const cg of campgrounds) {
    const f = trailerFit(cg, lengthFt);
    if (f.conf !== 'per-site') { parksUnverified++; continue; }
    sitesTotal += f.sitesTotal || 0;
    const usable = (f.sitesFit || 0) + (f.sitesTight || 0);
    sitesFit += usable;
    if (usable > 0) parksFit++; else parksNo++;
  }
  return {
    parksFit, parksNo, parksUnverified, sitesFit, sitesTotal,
    parksTotal: campgrounds.length,
    parksVerified: parksFit + parksNo,
  };
}

// ===========================================================================
// 5. ELEVATION CONTEXT (boondocking temperature / altitude framing)
// ===========================================================================

/**
 * Plain-language elevation context. Honest: returns null framing when no
 * elevation was baked. We do NOT predict temperature — we flag altitude bands
 * that materially affect a boondocker (cold nights, thinner air for generators).
 */
export function elevationContext(elevationFt) {
  if (elevationFt == null || !Number.isFinite(elevationFt)) return null;
  const ft = Math.round(elevationFt);
  let band; let note;
  if (ft >= 8000) { band = 'high'; note = 'High altitude — expect cold nights even in summer and noticeably weaker generator/engine output; plan battery for heating loads.'; }
  else if (ft >= 5000) { band = 'elevated'; note = 'Elevated — nights run cold in shoulder/winter seasons; factor heater draw into the off-grid estimate.'; }
  else if (ft >= 2000) { band = 'moderate'; note = 'Moderate elevation — mild altitude effects only.'; }
  else { band = 'low'; note = 'Low elevation — no significant altitude effects.'; }
  return { ft, band, note };
}

// Elevation filter bands for the finder. Kept in ONE place so the server-render
// control labels and the client filter use identical thresholds (parity).
// Bands are inclusive-low, exclusive-high, matching elevationContext().
export const ELEVATION_BANDS = [
  { key: 'low', label: 'Low (under 2,000′)', min: -1000, max: 2000 },
  { key: 'moderate', label: 'Moderate (2,000–5,000′)', min: 2000, max: 5000 },
  { key: 'elevated', label: 'Elevated (5,000–8,000′)', min: 5000, max: 8000 },
  { key: 'high', label: 'High (8,000′+)', min: 8000, max: 100000 },
];

/** True if an elevation (ft) falls in the named band. Unknown elevation → false. */
export function inElevationBand(elevationFt, key) {
  if (!key) return true;
  if (elevationFt == null || !Number.isFinite(elevationFt)) return false;
  const b = ELEVATION_BANDS.find((x) => x.key === key);
  if (!b) return true;
  return elevationFt >= b.min && elevationFt < b.max;
}
