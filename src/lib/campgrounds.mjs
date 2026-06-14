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

/** Round to at most one decimal and append a foot mark (e.g. 4.5′). */
function ftShort(n) { return (Math.round(n * 10) / 10) + '\u2032'; }

/**
 * Full fit verdict for a rig against a campground's posted max length, with
 * an HONEST confidence flag and a plain-language explanation of the math.
 *   conf: 'posted'     — Recreation.gov posts a real max length we used.
 *         'unverified' — no posted length; we will not invent a fit.
 * The `label`/`cls` mirror fitClass; `why` is empty when no rig is chosen.
 * This is the single source of truth the client's fitInfo() mirrors.
 */
export function fitExplain(lengthFt, maxLengthFt) {
  // No rig chosen: report the campground's own posted limit, nothing more.
  if (!(lengthFt > 0)) {
    if (maxLengthFt != null) return { cls: 'limit', label: `Up to ${maxLengthFt}\u2032`, conf: 'posted', why: '' };
    return { cls: 'unknown', label: 'No posted limit', conf: 'unverified', why: '' };
  }
  const rig = ftShort(lengthFt);
  if (maxLengthFt == null) {
    return {
      cls: 'unknown', label: 'Fit unverified', conf: 'unverified',
      why: `No max length is posted here, so a ${rig} fit can\u2019t be confirmed \u2014 check Recreation.gov.`,
    };
  }
  if (maxLengthFt >= lengthFt + CLEARANCE) {
    return {
      cls: 'fits', label: 'Fits comfortably', conf: 'posted',
      why: `Posted ${maxLengthFt}\u2032 max \u2212 your ${rig} = ${ftShort(maxLengthFt - lengthFt)} to spare (clears the 3\u2032 buffer).`,
    };
  }
  if (maxLengthFt >= lengthFt) {
    return {
      cls: 'tight', label: 'Fits \u2014 tight', conf: 'posted',
      why: `Posted ${maxLengthFt}\u2032 max leaves just ${ftShort(maxLengthFt - lengthFt)} over your ${rig}, under the 3\u2032 buffer \u2014 verify the exact site.`,
    };
  }
  return {
    cls: 'no', label: 'Too long', conf: 'posted',
    why: `Your ${rig} is ${ftShort(lengthFt - maxLengthFt)} over the posted ${maxLengthFt}\u2032 max.`,
  };
}

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
// Common URL prefixes, factored OUT of every per-campground record to shrink the
// shipped payload. The client rebuilds the full URLs from these (see app.js).
//  - Every Recreation.gov campground page is REC_URL_PREFIX + id, so `.u` is 100%
//    derivable from `.i` and never needs shipping (~150 KB saved across 2561 rows).
//  - Every campground photo lives under REC_PHOTO_PREFIX on the Recreation.gov CDN,
//    so we ship only the tail in `.g` and prepend the prefix client-side (~60 KB).
export const REC_URL_PREFIX = 'https://www.recreation.gov/camping/campgrounds/';
export const REC_PHOTO_PREFIX = 'https://cdn.recreation.gov/';

export function toClientRecord(c) {
  // Strip the shared CDN prefix from the photo URL when present; the client
  // prepends it back. Anything not under that prefix is kept whole (defensive).
  let g;
  if (c.photo) g = c.photo.startsWith(REC_PHOTO_PREFIX) ? c.photo.slice(REC_PHOTO_PREFIX.length) : c.photo;
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
    g: g || undefined,
    // .u (Recreation.gov page URL) intentionally OMITTED — it's always
    // REC_URL_PREFIX + i, so the client reconstructs it. See app.js hydrate().
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
