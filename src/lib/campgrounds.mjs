// Campground data access + trailer/site fit logic. Pure functions over the
// baked Recreation.gov dataset (src/data/campgrounds.json). Zero runtime deps.
//
// The whole point of this feature: pair each Airstream's REAL length against a
// campground's posted max trailer length, so an owner can see — at a glance —
// where their specific rig actually fits, nationwide.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load the baked campground dataset. Throws on structural problems. */
export function loadCampgrounds(path) {
  const p = path || join(__dirname, '..', 'data', 'campgrounds.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  if (!data || !Array.isArray(data.campgrounds) || data.campgrounds.length === 0) {
    throw new Error('campgrounds.json is empty or malformed');
  }
  return data;
}

/** Validate the dataset: unique ids, required fields, RV-capable, geo present. */
export function validateCampgrounds(data) {
  const problems = [];
  const seen = new Set();
  const RV = /RV|Trailer|Fifth/i;
  for (const c of data.campgrounds) {
    if (!c.id) problems.push('campground with no id');
    else if (seen.has(c.id)) problems.push(`duplicate id: ${c.id}`);
    seen.add(c.id);
    if (!c.name) problems.push(`${c.id}: missing name`);
    if (typeof c.lat !== 'number' || typeof c.lon !== 'number') problems.push(`${c.id}: missing geo`);
    if (!Array.isArray(c.equipment) || !c.equipment.some((e) => RV.test(e))) {
      problems.push(`${c.id}: not RV-capable`);
    }
    if (c.maxLengthFt != null && !(c.maxLengthFt > 0)) problems.push(`${c.id}: bad maxLengthFt`);
  }
  if (problems.length) throw new Error('Campgrounds invalid:\n' + problems.slice(0, 20).join('\n'));
  return true;
}

const CLEARANCE = 3; // ft of maneuvering room we want beyond the rig's own length

/**
 * Classify how a trailer of `lengthFt` fits a campground's posted `maxLengthFt`.
 * Returns one of: 'unknown' (no posted limit), 'fits', 'tight', 'no'.
 */
export function fitClass(lengthFt, maxLengthFt) {
  if (maxLengthFt == null) return 'unknown';
  if (maxLengthFt >= lengthFt + CLEARANCE) return 'fits';
  if (maxLengthFt >= lengthFt) return 'tight';
  return 'no';
}

export const FIT_LABEL = {
  fits: 'Fits comfortably',
  tight: 'Fits — tight',
  no: 'Too long',
  unknown: 'No posted limit',
};

/** True if the rig can physically use the site (fits/tight/unknown, not 'no'). */
export function canPark(lengthFt, maxLengthFt) {
  return fitClass(lengthFt, maxLengthFt) !== 'no';
}

/**
 * Given a trailer length, return campgrounds it can use, ranked.
 * opts: { state, limit, fitOnly }. Ranking favors well-rated, well-reviewed,
 * and (mildly) sites with a comfortable clearance over barely-tight ones.
 */
export function campgroundsForLength(campgrounds, lengthFt, opts = {}) {
  const { state = null, limit = null, includeUnknown = true } = opts;
  const out = [];
  for (const c of campgrounds) {
    if (state && c.state !== state) continue;
    const fit = fitClass(lengthFt, c.maxLengthFt);
    if (fit === 'no') continue;
    if (fit === 'unknown' && !includeUnknown) continue;
    out.push({ ...c, fit });
  }
  out.sort((a, b) => {
    // primary: rating × log(reviews) popularity weight
    const ra = (a.rating || 0) * Math.log10((a.reviews || 0) + 1);
    const rb = (b.rating || 0) * Math.log10((b.reviews || 0) + 1);
    if (rb !== ra) return rb - ra;
    return (b.reviews || 0) - (a.reviews || 0);
  });
  return limit ? out.slice(0, limit) : out;
}

/** Count how a trailer fits across the whole dataset (for the detail headline). */
export function fitSummary(campgrounds, lengthFt) {
  let fits = 0; let tight = 0; let unknown = 0; let no = 0;
  for (const c of campgrounds) {
    const f = fitClass(lengthFt, c.maxLengthFt);
    if (f === 'fits') fits++;
    else if (f === 'tight') tight++;
    else if (f === 'unknown') unknown++;
    else no++;
  }
  return { fits, tight, unknown, no, usable: fits + tight + unknown, total: campgrounds.length };
}

/** Distinct states present, with counts, sorted by count desc. */
export function statesWithCounts(campgrounds) {
  const m = new Map();
  for (const c of campgrounds) {
    if (!c.state) continue;
    m.set(c.state, (m.get(c.state) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([state, count]) => ({ state, count }));
}

/** Slim per-record shape for the client browser (keeps the payload lean). */
export function toClientRecord(c) {
  return {
    i: c.id,
    n: c.name,
    p: c.parent || undefined,
    s: c.state || undefined,
    o: orgShort(c.org),
    r: c.rating || undefined,
    v: c.reviews || undefined,
    m: c.maxLengthFt || undefined, // max length; absent = no posted limit
    pr: c.price ? c.price.min : undefined,
    g: c.photo || undefined,
    u: c.url || undefined,
    la: c.lat != null ? Math.round(c.lat * 1e5) / 1e5 : undefined,
    lo: c.lon != null ? Math.round(c.lon * 1e5) / 1e5 : undefined,
    a: (c.activities || []).slice(0, 4),
  };
}

const ORG_MAP = {
  'National Park Service': 'NPS',
  'USDA Forest Service': 'USFS',
  'Forest Service': 'USFS',
  'Bureau of Land Management': 'BLM',
  'US Army Corps of Engineers': 'USACE',
  'Bureau of Reclamation': 'BOR',
  'US Fish & Wildlife Service': 'USFWS',
  'National Archives and Records Administration': 'NARA',
  'Tennessee Valley Authority': 'TVA',
};
export function orgShort(org) {
  if (!org) return undefined;
  return ORG_MAP[org] || org;
}
