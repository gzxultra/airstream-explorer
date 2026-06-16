// Curated editorial collections for the Campground Finder.
// ---------------------------------------------------------------------------
// Each collection is a one-tap "lens" over the baked dataset — a derived
// predicate computed from the FULL campground record at build time. Membership
// is baked into every slim client record (field `cl`, see toClientRecord) so
// the chip COUNT (computed here from the full data) and the live FILTER (which
// reads the baked `cl` array) can never disagree. This mirrors the same honesty
// discipline the fit logic follows: one source of truth, no client-side
// re-derivation that could silently drift from the labelled number.
//
// Why bake instead of recompute client-side? The slim record only ships the
// top-4 activities, so e.g. dark-sky membership can't be recomputed reliably in
// the browser. Baking the membership keys solves that for every collection at
// once and keeps the predicate logic in exactly one place (here).

// Match "... National Park" but NOT "... National Parkway" (e.g. Blue Ridge
// Parkway, Natchez Trace Parkway are parkways, not parks).
const NP_RE = /national park(?!way)/i;

function activitiesText(c) {
  return Array.isArray(c.activities) ? c.activities.join(' ').toLowerCase() : '';
}

// Each entry:
//   key     — stable 2-char code baked into client records (ships x2561; short)
//   label   — chip + collection-header title
//   eyebrow — small uppercase editorial kicker above the title
//   blurb   — one-line magazine subhead shown when the collection is active
//   test    — predicate over a FULL campground record -> boolean
export const COLLECTIONS = [
  {
    key: 'ed',
    label: "Editor's Picks",
    eyebrow: 'CRITICALLY ACCLAIMED',
    blurb: 'The highest-rated, most-reviewed campgrounds on Recreation.gov — 4.5\u2605 and up, each with a deep body of reviews behind the score.',
    test: (c) => (c.rating || 0) >= 4.5 && (c.reviews || 0) >= 100,
  },
  {
    key: 'np',
    label: 'Inside a National Park',
    eyebrow: 'ICONIC',
    blurb: 'Wake up inside the parks themselves \u2014 campgrounds within National Park boundaries, from Yosemite to Acadia.',
    test: (c) => NP_RE.test(c.parent || ''),
  },
  {
    key: 'ds',
    label: 'Dark-Sky & Stargazing',
    eyebrow: 'AFTER DARK',
    blurb: 'Campgrounds that call out stargazing \u2014 remote enough to put a real night sky over your Airstream.',
    test: (c) => /star|astronom/.test(activitiesText(c)),
  },
  {
    key: 'al',
    label: 'Alpine & High Country',
    eyebrow: 'HIGH COUNTRY',
    blurb: 'Camp at 7,000 ft and up \u2014 thin mountain air, cool summer nights, and the long views that only come with elevation.',
    test: (c) => (c.elevationFt || 0) >= 7000,
  },
  {
    key: 'lk',
    label: 'Lakeside \u2014 Army Corps',
    eyebrow: 'ON THE WATER',
    blurb: 'Army Corps of Engineers lakeshore campgrounds \u2014 a long-loved RV sweet spot: big water, roomy sites, low fees.',
    test: (c) => /army corps|corps of engineers|usace/i.test(c.org || ''),
  },
  {
    key: 'fh',
    label: 'Full Hookups',
    eyebrow: 'FULLY CONNECTED',
    blurb: 'Water, power, and sewer right at the site \u2014 the rarer full-hookup public campgrounds, for long stays without breaking camp.',
    test: (c) => c.hookups === 'full',
  },
];

export const COLLECTION_KEYS = COLLECTIONS.map((c) => c.key);

const BY_KEY = Object.create(null);
for (const col of COLLECTIONS) BY_KEY[col.key] = col;

/** Look up a collection definition by its key, or undefined. */
export function collectionByKey(key) {
  return key ? BY_KEY[key] : undefined;
}

/** Is `key` a known collection key? */
export function isCollectionKey(key) {
  return !!key && Object.prototype.hasOwnProperty.call(BY_KEY, key);
}

/**
 * All collection keys a FULL campground record belongs to, in COLLECTIONS
 * order. Returns [] when it matches none. This is what gets baked into the
 * slim client record's `cl` field.
 */
export function collectionsFor(c) {
  const out = [];
  if (!c) return out;
  for (const col of COLLECTIONS) {
    if (col.test(c)) out.push(col.key);
  }
  return out;
}

/**
 * Count of campgrounds in each collection across the full dataset, for honest
 * chip labels. Returns a plain object { key: count, ... } with every key
 * present (0 when empty).
 */
export function collectionCounts(campgrounds) {
  const counts = Object.create(null);
  for (const col of COLLECTIONS) counts[col.key] = 0;
  if (!Array.isArray(campgrounds)) return counts;
  for (const c of campgrounds) {
    for (const col of COLLECTIONS) {
      if (col.test(c)) counts[col.key]++;
    }
  }
  return counts;
}
