// Tow-safety calculator: can a given vehicle safely tow a given Airstream?
//
// Pure functions over a trailer's REAL spec fields and a tow vehicle's OFFICIAL
// ratings — no DOM, no I/O — so the exact same math is unit-tested here and
// mirrored in the client. We never invent a number; we model how the trailer's
// real loaded weight plays against the vehicle's published limits, and we say
// which limit binds, because that's the number that actually decides safety.
//
// The four limits a tow setup must respect (all from the vehicle's spec sheet):
//   1. Max trailer tow rating  — the towed weight ceiling, properly equipped.
//   2. GCWR (gross combined)   — truck + trailer + everything, all-up ceiling.
//   3. Payload                 — cargo + passengers the truck itself can carry;
//                                the trailer's TONGUE WEIGHT eats into this.
//   4. Hitch receiver rating   — not modeled per-vehicle (varies by hitch);
//                                disclosed as a caveat instead of guessed.
//
// Tongue (hitch) weight is the quiet killer: a heavy trailer can be under the
// tow rating yet blow the truck's payload once the tongue, passengers, and gear
// are added. We surface payload explicitly for that reason.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// PLANNING ASSUMPTIONS (all transparent, all disclosed in the UI)
// ---------------------------------------------------------------------------

// We compare against the trailer's GVWR (fully loaded), not its dry weight,
// because you tow it loaded. This is the honest, conservative basis: a tow
// setup that only works at dry weight is not actually safe.
//
// Tongue weight when loaded: Airstream publishes a dry hitch weight, but loaded
// tongue weight rises. The accepted planning rule is 10-15% of loaded trailer
// weight for a conventional (bumper-pull) travel trailer. We use 13% as a
// realistic loaded figure when we compute against payload, and also show the
// published dry hitch weight for reference.
export const TONGUE_PCT_LOADED = 0.13; // 13% of GVWR — mid of the 10-15% rule
export const TONGUE_PCT_MIN = 0.10;
export const TONGUE_PCT_MAX = 0.15;

// Safety headroom guidance. Towing right at 100% of a rating is legal but
// unpleasant and unforgiving. We grade the result so users see margin, not just
// pass/fail. Thresholds are the fraction of the binding limit that is USED.
export const COMFORT_CEILING = 0.80; // <=80% used  -> comfortable
export const CAUTION_CEILING = 1.00; // 80-100% used -> tight but legal
//                                     >100% used    -> over the limit

// How much the people + gear in the TRUCK weigh (separate from the trailer).
// Used so payload math isn't just tongue weight in isolation. Default models a
// typical travelling load; the client lets the user change it.
export const DEFAULT_TRUCK_OCCUPANT_LB = 300; // ~2 adults + modest gear in cab

// ---------------------------------------------------------------------------
// DATA LOADING + VALIDATION
// ---------------------------------------------------------------------------

/**
 * Load the tow-vehicle dataset. Each vehicle carries OFFICIAL, SOURCED ratings
 * for one clearly-stated representative configuration.
 */
export function loadVehicles(file = join(__dirname, '..', 'data', 'tow-vehicles.json')) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(raw) ? raw : raw.vehicles;
}

const VEHICLE_NUMERIC = ['maxTowLb', 'payloadLb', 'gvwrLb', 'gcwrLb', 'curbWeightLb'];

/** One vehicle is valid if it has an id, name, year, config note, a source URL,
 *  and positive numeric ratings (curb weight may be "not published" => null). */
export function validateVehicle(v) {
  if (!v || typeof v !== 'object') return false;
  if (!v.id || !v.name || !v.year || !v.config) return false;
  // At least one real http(s) source — accuracy is the whole point.
  if (!Array.isArray(v.sources) || !v.sources.length) return false;
  if (!v.sources.every((s) => typeof s === 'string' && /^https?:\/\//.test(s))) return false;
  // The three ceilings we actually compute against must be positive numbers.
  for (const k of ['maxTowLb', 'payloadLb', 'gcwrLb']) {
    if (typeof v[k] !== 'number' || !(v[k] > 0)) return false;
  }
  // gvwr/curb are nice-to-have; if present must be positive numbers.
  for (const k of ['gvwrLb', 'curbWeightLb']) {
    if (v[k] != null && !(typeof v[k] === 'number' && v[k] > 0)) return false;
  }
  return true;
}

export function validateVehicles(list) {
  if (!Array.isArray(list) || list.length === 0) return false;
  const ids = new Set();
  for (const v of list) {
    if (!validateVehicle(v)) return false;
    if (ids.has(v.id)) return false; // ids unique
    ids.add(v.id);
  }
  return true;
}

// ---------------------------------------------------------------------------
// THE CALCULATION
// ---------------------------------------------------------------------------

/** Clamp helper. */
function pct(used, limit) {
  if (!(limit > 0)) return Infinity;
  return used / limit;
}

/** Grade a usage fraction into a verdict band. */
export function gradeFraction(frac) {
  if (frac > CAUTION_CEILING) return 'over';
  if (frac > COMFORT_CEILING) return 'tight';
  return 'comfortable';
}

/**
 * Evaluate one (vehicle, trailer) tow pairing.
 *
 * @param {object} vehicle  tow-vehicle record (maxTowLb, payloadLb, gcwrLb, ...)
 * @param {object} trailer  trailer record (gvwrLb, weightLb, hitchWeightLb, ...)
 * @param {object} [opts]
 * @param {number} [opts.truckLoadLb=300]  people + gear carried IN the truck
 * @param {number} [opts.tonguePct=0.13]   loaded tongue-weight fraction of trailer GVWR
 * @returns {{
 *   verdict:'comfortable'|'tight'|'over',
 *   binding:{key:string,label:string,used:number,limit:number,frac:number},
 *   checks:Array<{key,label,used,limit,frac,grade,note}>,
 *   trailerLoadedLb:number, tongueLoadedLb:number
 * }}
 */
export function evaluateTow(vehicle, trailer, opts = {}) {
  const truckLoad = opts.truckLoadLb != null ? opts.truckLoadLb : DEFAULT_TRUCK_OCCUPANT_LB;
  const tonguePct = opts.tonguePct != null ? opts.tonguePct : TONGUE_PCT_LOADED;

  // Trailer is towed LOADED: use GVWR as its weight (honest, conservative).
  const trailerLoaded = trailer.gvwrLb || trailer.weightLb || 0;
  // Loaded tongue weight = a realistic % of loaded trailer weight.
  const tongueLoaded = Math.round(trailerLoaded * tonguePct);

  // Combined weight = trailer (all-up) + truck curb + truck occupants/gear.
  // (Tongue weight is part of the trailer's weight, already counted in trailerLoaded;
  //  it transfers to the truck's axles but does NOT add to the COMBINED total.)
  const curb = vehicle.curbWeightLb || 0;
  const combined = trailerLoaded + curb + truckLoad;

  // Payload consumed in the truck = tongue weight + occupants/gear in the cab.
  const payloadUsed = tongueLoaded + truckLoad;

  const checks = [
    {
      key: 'tow', label: 'Trailer tow rating',
      used: trailerLoaded, limit: vehicle.maxTowLb,
      note: 'Trailer at its loaded weight (GVWR) vs. the truck’s max tow rating.',
    },
    {
      key: 'payload', label: 'Truck payload',
      used: payloadUsed, limit: vehicle.payloadLb,
      note: 'Loaded tongue weight + people & gear in the cab vs. the truck’s payload.',
    },
    {
      key: 'gcwr', label: 'Combined weight (GCWR)',
      used: combined, limit: vehicle.gcwrLb,
      note: 'Truck + trailer + everything vs. the gross combined weight rating.',
    },
  ].map((c) => {
    const frac = pct(c.used, c.limit);
    return { ...c, frac, grade: gradeFraction(frac) };
  });

  // The binding limit is the one with the highest usage fraction.
  const binding = checks.reduce((a, b) => (b.frac > a.frac ? b : a));
  // Overall verdict = the worst grade among all checks.
  const order = { comfortable: 0, tight: 1, over: 2 };
  const verdict = checks.reduce((worst, c) =>
    order[c.grade] > order[worst] ? c.grade : worst, 'comfortable');

  return {
    verdict,
    binding: { key: binding.key, label: binding.label, used: binding.used, limit: binding.limit, frac: binding.frac },
    checks,
    trailerLoadedLb: trailerLoaded,
    tongueLoadedLb: tongueLoaded,
  };
}

/** Friendly percentage label for a usage fraction. */
export function formatPct(frac) {
  if (!Number.isFinite(frac)) return '—';
  return `${Math.round(frac * 100)}%`;
}

/**
 * Pick a sensible DEFAULT tow vehicle to show first for a given trailer, so the
 * server-rendered page and the client agree without guessing. The pick is
 * deterministic and honest: the LIGHTEST-duty vehicle that still tows this
 * trailer *comfortably* (so the first thing a reader sees is a realistic, safe
 * match, not an overkill dually or an alarming "over"). If nothing tows it
 * comfortably, fall back to the most capable vehicle (highest tow rating) — the
 * reader's best shot — rather than pretending. Vehicles are ranked by tow
 * rating so "lightest-duty" is well-defined.
 *
 * @param {object[]} vehicles  validated vehicle dataset
 * @param {object}  trailer    trailer record (gvwrLb / weightLb)
 * @returns {object|null}      chosen vehicle, or null if list is empty
 */
export function pickDefaultVehicle(vehicles, trailer, opts = {}) {
  if (!Array.isArray(vehicles) || !vehicles.length) return null;
  // Ascending tow rating → first comfortable match is the lightest-duty one.
  const byCapability = vehicles
    .slice()
    .sort((a, b) => a.maxTowLb - b.maxTowLb);
  const comfortable = byCapability.find(
    (v) => evaluateTow(v, trailer, opts).verdict === 'comfortable',
  );
  if (comfortable) return comfortable;
  // Nothing comfortable — show the most capable (last in ascending order).
  return byCapability[byCapability.length - 1];
}
