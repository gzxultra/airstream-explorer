// Explore-page logic: tow-vehicle matching, sorting, filtering, compare.
// Pure functions over the trailer array — no DOM, no I/O. Mirrors the data
// the client carries in card data-* attributes, so the same rules are testable
// here and applied there.

/**
 * Tow-fit verdict for a trailer against a tow vehicle's max tow rating.
 *
 * Airstream's own guidance: a trailer's GVWR (its fully-loaded max weight) must
 * not exceed the tow vehicle's tow rating. We add a comfort band on top of that
 * hard limit, because towing right at the ceiling handles and stops poorly:
 *   - 'comfortable' : GVWR ≤ 80% of tow rating (plenty of headroom)
 *   - 'within'      : 80% < GVWR ≤ 100% (legal, but near the limit)
 *   - 'over'        : GVWR > tow rating (exceeds — unsafe)
 *
 * @param {number} gvwrLb     trailer GVWR (fully loaded), lb
 * @param {number} towRating  tow vehicle's max tow rating, lb
 * @returns {{status:'comfortable'|'within'|'over', headroomLb:number, usedPct:number}}
 */
export function towFit(gvwrLb, towRating) {
  const headroomLb = Math.round(towRating - gvwrLb);
  const usedPct = towRating > 0 ? Math.round((gvwrLb / towRating) * 100) : Infinity;
  let status;
  if (gvwrLb > towRating) status = 'over';
  else if (gvwrLb > towRating * 0.8) status = 'within';
  else status = 'comfortable';
  return { status, headroomLb, usedPct };
}

/** Human label + recommended note for a tow-fit status. */
export function towFitLabel(status) {
  switch (status) {
    case 'comfortable': return 'Comfortable tow';
    case 'within': return 'Within limit';
    case 'over': return 'Exceeds rating';
    default: return '';
  }
}

// Sort keys the explore UI exposes. Each maps to a numeric/string accessor and
// a sensible default direction. 'asc' = small→large, 'desc' = large→small.
export const SORT_KEYS = {
  'price-asc': { label: 'Price: low to high', get: (t) => t.msrp, dir: 1 },
  'price-desc': { label: 'Price: high to low', get: (t) => t.msrp, dir: -1 },
  'weight-asc': { label: 'Lightest first', get: (t) => t.weightLb, dir: 1 },
  'length-asc': { label: 'Shortest first', get: (t) => t.lengthFt, dir: 1 },
  'length-desc': { label: 'Longest first', get: (t) => t.lengthFt, dir: -1 },
  'sleeps-desc': { label: 'Sleeps most', get: (t) => t.sleeps, dir: -1 },
  'offgrid-desc': { label: 'Best off-grid', get: (t) => t.offGridScore, dir: -1 },
  'ccc-desc': { label: 'Most cargo capacity', get: (t) => t.cccLb || 0, dir: -1 },
  'hitch-asc': { label: 'Lightest hitch', get: (t) => t.hitchWeightLb || Infinity, dir: 1 },
  'value-asc': { label: 'Best value ($/ft)', get: (t) => t.lengthFt > 0 ? t.msrp / t.lengthFt : Infinity, dir: 1 },
  'value-lb-asc': { label: 'Best value ($/lb)', get: (t) => t.weightLb > 0 ? t.msrp / t.weightLb : Infinity, dir: 1 },
  'fresh-desc': { label: 'Most fresh water', get: (t) => t.freshGal || 0, dir: -1 },
  'year-desc': { label: 'Year: newest first', get: (t) => t.year, dir: -1 },
};

/**
 * Stable sort of trailers by a SORT_KEYS key. Falls back to model+floorplan
 * name for ties so order is deterministic (matters for snapshot-style tests).
 */
export function sortTrailers(list, key) {
  const def = SORT_KEYS[key] || SORT_KEYS['price-asc'];
  return [...list].sort((a, b) => {
    const d = (def.get(a) - def.get(b)) * def.dir;
    if (d !== 0) return d;
    return `${a.model} ${a.floorplan}`.localeCompare(`${b.model} ${b.floorplan}`);
  });
}

/**
 * Filter trailers for the explore page.
 * @param {object} opts
 * @param {number} [opts.year]       2025 | 2026 — omit/0 for all years
 * @param {string} [opts.q]          free text matched against model+floorplan
 * @param {number} [opts.sleepsMin]  minimum sleeping capacity
 * @param {number} [opts.msrpMax]    maximum price
 * @param {string[]} [opts.tags]     use-case tags; trailer must have ALL
 * @param {number} [opts.towRating]  if set, drop trailers whose GVWR exceeds it
 */
export function filterExplore(list, opts = {}) {
  const { year, q, sleepsMin, msrpMax, tags, towRating } = opts;
  const needle = (q || '').trim().toLowerCase();
  const wantTags = tags && tags.length ? tags : null;
  return list.filter((t) => {
    if (year && t.year !== Number(year)) return false;
    if (needle) {
      const hay = `${t.model} ${t.floorplan}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (sleepsMin && t.sleeps < sleepsMin) return false;
    if (msrpMax && t.msrp > msrpMax) return false;
    if (towRating && t.gvwrLb > towRating) return false;
    if (wantTags && !wantTags.every((tag) => (t.tags || []).includes(tag))) return false;
    return true;
  });
}

/**
 * A use-case chip is only worth showing if it actually PARTITIONS the catalog.
 * A tag carried by (nearly) every model — e.g. `off-grid`, which sits on 100%
 * of the lineup — can never narrow a search: tapping it filters out nothing, so
 * it's visual noise masquerading as a control. Likewise a tag on zero models.
 * Drop both. A tag on ≥90% of items is treated as a no-op chip.
 */
export const CHIP_NOOP_RATE = 0.9;

/**
 * The distinct use-case tags worth showing as filter chips, in a curated
 * display order (rarer/more-specific tags last). Tags present but useless as a
 * filter (on ≥90% of the catalog, or on none of it) are dropped — see
 * CHIP_NOOP_RATE. Tags not in the order list are appended alphabetically so new
 * tags still surface. Pass the FULL displayed set (trailers + motorhomes) so
 * the hit-rate reflects what the chips actually filter.
 */
export function exploreTags(trailers) {
  const order = ['couples', 'solo', 'family', 'full-time', 'off-grid', 'national_parks', 'luxury'];
  const total = trailers.length;
  const counts = new Map();
  for (const t of trailers) for (const tag of t.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  // Keep only tags that meaningfully split the catalog.
  const useful = (tag) => {
    const n = counts.get(tag) || 0;
    if (n === 0) return false;
    if (total > 0 && n / total >= CHIP_NOOP_RATE) return false; // on ~everything → no-op
    return true;
  };
  const present = [...counts.keys()].filter(useful);
  const presentSet = new Set(present);
  const ordered = order.filter((t) => presentSet.has(t));
  const extra = present.filter((t) => !order.includes(t)).sort();
  return [...ordered, ...extra];
}

/** Pretty label for a raw tag token. 'national_parks' -> 'National parks'. */
export function tagLabel(tag) {
  const special = { national_parks: 'National parks', 'off-grid': 'Off-grid', 'full-time': 'Full-time' };
  if (special[tag]) return special[tag];
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

// ---------------------------------------------------------------------------
// SMART PRESETS — one-click filter combinations for common buyer scenarios.
// Each preset names filters that map directly to the explore state keys.
// ---------------------------------------------------------------------------
export const SMART_PRESETS = [
  {
    id: 'first-timer',
    label: 'First-timer',
    icon: '🌱',
    desc: 'Easy to tow, budget-friendly',
    filters: { maxWeight: 5500, msrpMax: 120000, axle: 'single' },
  },
  {
    id: 'family-adventure',
    label: 'Family',
    icon: '👨‍👩‍👧‍👦',
    desc: 'Sleeps 5+, room for everyone',
    filters: { sleepsMin: 5, tags: ['family'] },
  },
  {
    id: 'couples-escape',
    label: 'Couples',
    icon: '💑',
    desc: 'Cozy for two',
    filters: { tags: ['couples'], sort: 'value-asc' },
  },
  {
    id: 'off-grid',
    label: 'Off-grid',
    icon: '⛺',
    desc: 'Max boondocking endurance',
    filters: { sort: 'offgrid-desc' },
  },
  {
    id: 'luxury',
    label: 'Luxury',
    icon: '✨',
    desc: 'Premium everything',
    filters: { tags: ['luxury'], sort: 'price-desc' },
  },
  {
    id: 'lightweight',
    label: 'Lightweight',
    icon: '🪶',
    desc: 'Under 4,000 lb dry',
    filters: { maxWeight: 4000, sort: 'weight-asc' },
  },
];

// ---------------------------------------------------------------------------
// NEAREST MATCHES — when filters return 0 results, find the closest trailers
// by relaxing one filter at a time and scoring how close each is.
// ---------------------------------------------------------------------------

/**
 * Given the current filter state and the full trailer list, find the N trailers
 * closest to matching. Returns [{trailer, reason}] explaining which filter
 * each just barely misses.
 */
export function nearestMatches(list, opts = {}, count = 3) {
  const { year, q, sleepsMin, msrpMax, tags, towRating, maxWeight, maxLength, axle } = opts;
  const needle = (q || '').trim().toLowerCase();
  const wantTags = tags && tags.length ? tags : null;

  // Score each trailer: 0 = passes all, higher = further from matching
  const scored = list.map((t) => {
    let penalty = 0;
    const reasons = [];

    if (year && t.year !== Number(year)) {
      penalty += 0.3; // light penalty — year is a soft preference
      reasons.push(`${t.year} model (showing ${year})`);
    }
    if (needle) {
      const hay = `${t.model} ${t.floorplan}`.toLowerCase();
      if (!hay.includes(needle)) { penalty += 5; reasons.push('name mismatch'); }
    }
    if (sleepsMin && t.sleeps < sleepsMin) {
      penalty += (sleepsMin - t.sleeps) * 0.5;
      reasons.push(`sleeps ${t.sleeps} (need ${sleepsMin}+)`);
    }
    if (msrpMax && t.msrp > msrpMax) {
      const over = (t.msrp - msrpMax) / msrpMax;
      penalty += over * 2;
      reasons.push(`$${Math.round((t.msrp - msrpMax) / 1000)}K over budget`);
    }
    if (towRating && t.gvwrLb > towRating) {
      const over = (t.gvwrLb - towRating) / towRating;
      penalty += over * 2;
      reasons.push(`${t.gvwrLb - towRating} lb over tow rating`);
    }
    if (maxWeight && t.weightLb > maxWeight) {
      const over = (t.weightLb - maxWeight) / maxWeight;
      penalty += over * 2;
      reasons.push(`${t.weightLb - maxWeight} lb over weight limit`);
    }
    if (maxLength && t.lengthFt > maxLength) {
      penalty += (t.lengthFt - maxLength) / maxLength;
      reasons.push(`${(t.lengthFt - maxLength).toFixed(0)}' over length limit`);
    }
    if (wantTags) {
      const missing = wantTags.filter((tag) => !(t.tags || []).includes(tag));
      if (missing.length) {
        penalty += missing.length * 0.5;
        reasons.push(`missing: ${missing.map(tagLabel).join(', ')}`);
      }
    }
    if (axle) {
      const tAxle = t.weightLb >= 4000 || t.lengthFt >= 25 ? 'dual' : 'single';
      if (tAxle !== axle) {
        penalty += 0.5;
        reasons.push(`${tAxle} axle (want ${axle})`);
      }
    }
    return { trailer: t, penalty, reasons };
  });

  return scored
    .filter((s) => s.penalty > 0 && s.penalty < 10) // exclude total mismatches
    .sort((a, b) => a.penalty - b.penalty)
    .slice(0, count)
    .map((s) => ({ trailer: s.trailer, reason: s.reasons[0] || 'close match' }));
}
