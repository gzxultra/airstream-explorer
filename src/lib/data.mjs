// Data access + derived/aggregate logic. Pure functions over the trailers array.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Per-image gallery background classification, keyed by slug -> [bool], where
 * true = studio cutout on a white background (gets the cream-blend treatment)
 * and false = a full-bleed photo (interior/lifestyle, rendered clean with no
 * blend). Built offline by sampling each image's edge pixels. Loaded once.
 * Falls back to an empty map (everything treated as photo) if absent.
 */
let _cutoutFlags = null;
export function galleryCutoutFlags() {
  if (_cutoutFlags) return _cutoutFlags;
  try {
    _cutoutFlags = JSON.parse(
      readFileSync(join(__dirname, '..', 'data', 'gallery-cutout-flags.json'), 'utf8'),
    );
  } catch {
    _cutoutFlags = {};
  }
  return _cutoutFlags;
}


/** Load and validate the trailer dataset. Throws on structural problems. */
export function loadTrailers(path) {
  const p = path || join(__dirname, '..', 'data', 'trailers.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('trailers.json is empty or not an array');
  }
  // Tag every trailer record with its product type so the unified Explore grid,
  // filters and compare can tell trailers and motorhomes apart. We add it at
  // load time rather than editing the audited JSON. (motorhomes carry
  // type:'motorhome' in their own dataset.)
  for (const t of data) if (t.type == null) t.type = 'trailer';
  return data;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// Layout feature derivation — parse the description (and slug) to extract
// filterable layout characteristics shoppers actually care about.
// ---------------------------------------------------------------------------

/**
 * Layout rules: each has a stable key for data-attributes and filters, a
 * human label for the chip, and a test predicate over the trailer record.
 * Order determines chip display order on the Explore page.
 */
const LAYOUT_RULES = [
  { key: 'rear-bed', label: 'Rear bed', test: (t) => /rear\s+(?:primary\s+|convertible\s+|v-shape)/i.test(t.description || '') },
  { key: 'front-bed', label: 'Front bed', test: (t) => /front\s+primary\s+bed/i.test(t.description || '') },
  { key: 'wet-bath', label: 'Wet bath', test: (t) => /wet\s+bath/i.test(t.description || '') },
  { key: 'bunk', label: 'Bunk beds', test: (t) => /bunk/i.test(t.description || '') || /bunk/i.test(t.slug || '') },
  { key: 'rear-hatch', label: 'Rear hatch', test: (t) => /rear\s+hatch/i.test(t.description || '') },
  { key: 'u-dinette', label: 'U-seat dinette', test: (t) => /u-seated/i.test(t.description || '') },
];

/** Derive layout feature keys from a trailer record. */
export function deriveLayoutFeatures(t) {
  return LAYOUT_RULES.filter((r) => r.test(t)).map((r) => r.key);
}

/** All known layout feature keys in display order. */
export const LAYOUT_META = LAYOUT_RULES.map((r) => ({ key: r.key, label: r.label }));

/** Validate one trailer record. Returns array of problem strings (empty = ok). */
export function validateTrailer(t) {
  const problems = [];
  if (!t.slug || !SLUG_RE.test(t.slug)) problems.push(`bad slug: ${t.slug}`);
  if (!t.model) problems.push(`${t.slug}: missing model`);
  if (!t.floorplan) problems.push(`${t.slug}: missing floorplan`);
  if (![2025, 2026].includes(t.year)) problems.push(`${t.slug}: bad year ${t.year}`);
  if (!(t.msrp > 0)) problems.push(`${t.slug}: bad msrp`);
  if (!(t.weightLb > 0)) problems.push(`${t.slug}: bad weight`);
  if (!(t.gvwrLb > 0)) problems.push(`${t.slug}: bad gvwr`);
  if (t.cccLb == null || t.cccLb !== t.gvwrLb - t.weightLb) {
    problems.push(`${t.slug}: ccc mismatch (${t.cccLb} vs ${t.gvwrLb - t.weightLb})`);
  }
  if (!(t.sleeps > 0)) problems.push(`${t.slug}: bad sleeps`);
  return problems;
}

/** Validate the whole dataset: per-record + unique slugs. Throws on any problem. */
export function validateDataset(trailers) {
  const all = [];
  const seen = new Set();
  for (const t of trailers) {
    all.push(...validateTrailer(t));
    if (seen.has(t.slug)) all.push(`duplicate slug: ${t.slug}`);
    seen.add(t.slug);
  }
  if (all.length) throw new Error('Dataset invalid:\n' + all.join('\n'));
  return true;
}

/** Group trailers by model family, preserving a stable model order. */
export function groupByModel(trailers) {
  const map = new Map();
  for (const t of trailers) {
    if (!map.has(t.model)) map.set(t.model, []);
    map.get(t.model).push(t);
  }
  return map;
}

/** Distinct sorted model names. */
export function modelNames(trailers) {
  return [...new Set(trailers.map((t) => t.model))].sort();
}

/** Distinct sorted years, descending (2026 first). */
export function years(trailers) {
  return [...new Set(trailers.map((t) => t.year))].sort((a, b) => b - a);
}

/** Filter by year ('all' | 2025 | 2026) and model ('all' | name). */
export function filterTrailers(trailers, { year = 'all', model = 'all' } = {}) {
  return trailers.filter(
    (t) =>
      (year === 'all' || t.year === Number(year)) &&
      (model === 'all' || t.model === model),
  );
}

/**
 * URL/file slug from arbitrary text. "Flying Cloud" -> "flying-cloud".
 * This is the single source of truth that maps a model name to its hero file.
 */
export function slugify(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

/** The same floorplan in the other model year. bambi-16rb-2026 <-> bambi-16rb-2025. */
export function twinSlug(t) {
  const other = t.year === 2026 ? 2025 : 2026;
  return t.slug.replace(/-20(25|26)$/, `-${other}`);
}

/** Family (model) slug — the single source of truth, also names the hero file. */
export function familySlug(model) {
  return slugify(model);
}

/**
 * Official airstream.com model page for each family, keyed by family slug.
 * Every URL was probed and returns HTTP 200 (verified 2026-06-15) — these are
 * the manufacturer's own pages, NOT guessed paths. Used to give each model and
 * floorplan a "view on airstream.com" link back to the authoritative source.
 */
export const OFFICIAL_URLS = {
  bambi: 'https://www.airstream.com/travel-trailers/bambi/',
  caravel: 'https://www.airstream.com/travel-trailers/caravel/',
  basecamp: 'https://www.airstream.com/travel-trailers/basecamp/',
  'basecamp-xe': 'https://www.airstream.com/travel-trailers/basecamp-xe/',
  'flying-cloud': 'https://www.airstream.com/travel-trailers/flying-cloud/',
  international: 'https://www.airstream.com/travel-trailers/international/',
  globetrotter: 'https://www.airstream.com/travel-trailers/globetrotter/',
  'trade-wind': 'https://www.airstream.com/travel-trailers/trade-wind/',
  classic: 'https://www.airstream.com/travel-trailers/classic/',
  'world-traveler': 'https://www.airstream.com/travel-trailers/world-traveler/',
  'frank-lloyd-wright-limited-edition':
    'https://www.airstream.com/explore-products/travel-trailers/dual-axle/frank-lloyd-wright-limited-edition',
  'stetson-6666-special-edition':
    'https://www.airstream.com/explore-products/travel-trailers/dual-axle/stetson-6666-special-edition',
};

/** The official airstream.com page for a model name, or null if unmapped. */
export function officialUrl(model) {
  return OFFICIAL_URLS[familySlug(model)] || null;
}

/**
 * Group trailers into model families with display-ready summary stats.
 * Returns an ordered array (entry price ascending: budget -> flagship), each:
 *   { family, slug, hero, trailers[], floorplanCount, entryCount,
 *     priceMin, priceMax, lengthMin, lengthMax, sleepsMax, years[], limited }
 * `trailers` within a family are sorted year desc, then length asc.
 */
export function groupByFamily(trailers) {
  const map = new Map();
  for (const t of trailers) {
    if (!map.has(t.model)) map.set(t.model, []);
    map.get(t.model).push(t);
  }
  const families = [...map.entries()].map(([family, rows]) => {
    const sorted = [...rows].sort(
      (a, b) => b.year - a.year || a.lengthFt - b.lengthFt || a.msrp - b.msrp,
    );
    const prices = rows.map((r) => r.msrp).filter((n) => n > 0);
    const lengths = rows.map((r) => r.lengthFt).filter((n) => n > 0);
    const floorplans = new Set(rows.map((r) => r.floorplan));
    return {
      family,
      slug: familySlug(family),
      hero: `assets/img/heroes/${familySlug(family)}.webp`,
      trailers: sorted,
      floorplanCount: floorplans.size,
      entryCount: rows.length,
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      lengthMin: lengths.length ? Math.min(...lengths) : null,
      lengthMax: lengths.length ? Math.max(...lengths) : null,
      sleepsMax: Math.max(...rows.map((r) => r.sleeps || 0)),
      years: [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a),
      limited: /\b(limited|special)\b.*edition/i.test(family),
    };
  });
  // Flagship -> budget: lead with the premium families (Classic on top), step
  // down to the entry models (Basecamp). Families with no price sink to the end.
  families.sort((a, b) => {
    if (a.priceMin == null) return 1;
    if (b.priceMin == null) return -1;
    return b.priceMin - a.priceMin || a.family.localeCompare(b.family);
  });
  return families;
}

/**
 * Catalog-wide stats derived from the live dataset — the single source of
 * truth for the global footer line so it can never drift from the data
 * (no more hardcoded `${31}` that silently lies when the catalog changes).
 * Memoized: the dataset is static within a build.
 */
let _catalogStats = null;
export function catalogStats(trailers) {
  if (!trailers) {
    if (_catalogStats) return _catalogStats;
    trailers = loadTrailers();
  }
  const families = new Set(trailers.map((t) => t.model));
  const floorplans = new Set(trailers.map((t) => `${t.model}\u0000${t.floorplan}`));
  const years = [...new Set(trailers.map((t) => t.year))].sort((a, b) => b - a);
  const stats = {
    familyCount: families.size,
    floorplanCount: floorplans.size,
    entryCount: trailers.length,
    years,
  };
  _catalogStats = stats;
  return stats;
}

/**
 * Canonical (pure) asset paths for a trailer, relative + CF-root friendly.
 * Hero is derived from the model name via slugify() — NOT the legacy
 * `heroFamily` field, which was unreliable and is no longer used.
 */
/**
 * Max gallery slots probed per floorplan. Galleries are now variable-length:
 * we collect every `<slug>-N.webp` that exists on disk (1..MAX), so a floorplan
 * with 10 official photos shows 10 and one with 5 shows 5. The renderers map
 * over whatever array comes back, so nothing here is hardcoded to 3 anymore.
 */
export const MAX_GALLERY = 12;

export function assetPaths(t) {
  return {
    thumb: `assets/img/thumbs/${t.slug}.webp`,
    hero: `assets/img/heroes/${slugify(t.model)}.webp`,
    gallery: Array.from({ length: MAX_GALLERY }, (_, i) => `assets/img/gallery/${t.slug}-${i + 1}.webp`),
    floorplan: `assets/img/floorplans/${t.slug}.webp`,
  };
}

/**
 * Existence-aware asset resolution for the build. `hasAsset(relPath)` returns
 * whether a file exists under public/. Resolves real, on-disk paths only:
 *   - hero: the model's hero file (null if somehow absent).
 *   - gallery: this slug's own photos (slots 1..MAX_GALLERY), falling back to
 *     its cross-year twin's photo for that slot when the slug has none of its
 *     own; any slot with neither is dropped rather than emitted as a broken
 *     <img>. Variable length: returns as many real photos as exist.
 * A trailer with no gallery at all (no twin either) simply renders hero-only.
 */
export function resolveAssets(t, hasAsset) {
  const canon = assetPaths(t);
  const twin = twinSlug(t);
  const flags = galleryCutoutFlags();
  const gallery = [];
  const galleryCutout = [];
  for (let i = 1; i <= MAX_GALLERY; i++) {
    const own = `assets/img/gallery/${t.slug}-${i}.webp`;
    const tw = `assets/img/gallery/${twin}-${i}.webp`;
    let rel = null;
    let srcSlug = null;
    if (hasAsset(own)) {
      rel = own;
      srcSlug = t.slug;
    } else if (hasAsset(tw)) {
      rel = tw;
      srcSlug = twin;
    }
    if (!rel) continue;
    gallery.push(rel);
    // cutout (white-bg studio) => true gets the cream-blend; photo => false.
    // Default to photo (false) when unknown, so we never wrongly blend a photo.
    const arr = flags[srcSlug];
    galleryCutout.push(Array.isArray(arr) && arr[i - 1] === true);
  }

  // Floor-plan diagram: this slug's own, falling back to its cross-year twin's
  // (the 2025/2026 of one floorplan share an identical official diagram).
  let floorplan = null;
  if (hasAsset(canon.floorplan)) floorplan = canon.floorplan;
  else if (hasAsset(`assets/img/floorplans/${twin}.webp`))
    floorplan = `assets/img/floorplans/${twin}.webp`;
  return {
    thumb: canon.thumb,
    hero: hasAsset(canon.hero) ? canon.hero : null,
    gallery,
    galleryCutout,

    floorplan,
  };
}

// ---------------------------------------------------------------------------
// Décor options: official Airstream interior material palettes, keyed by family
// slug. Each scheme = { name, slug, description, swatches:[{kind,file}] }.
// Swatch image files live under public/assets/img/decor/. Same family applies
// to every floorplan in that family (Airstream offers décor by family).
// ---------------------------------------------------------------------------

/** Load the décor-options map (family slug -> scheme[]). Returns {} if absent. */
export function loadDecor(path) {
  const p = path || join(__dirname, '..', 'data', 'decor-options.json');
  try {
    const data = JSON.parse(readFileSync(p, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

/**
 * Décor schemes for a trailer's family, with on-disk image paths resolved and
 * existence-checked. Drops any swatch whose file is missing, and any scheme
 * left with no swatches. Returns [] when the family has no décor data.
 */
export function resolveDecor(t, decorMap, hasAsset) {
  const schemes = decorMap[familySlug(t.model)];
  if (!Array.isArray(schemes)) return [];
  return schemes
    .map((s) => ({
      name: s.name,
      slug: s.slug,
      description: s.description || '',
      swatches: (s.swatches || [])
        .map((sw) => ({ kind: sw.kind, src: `assets/img/decor/${sw.file}` }))
        .filter((sw) => hasAsset(sw.src)),
    }))
    .filter((s) => s.swatches.length > 0);
}

// ---------------------------------------------------------------------------
// STANDOUT BADGES — per-family superlatives computed from real spec data.
// Each badge highlights a genuine standout trait relative to family siblings.
// ---------------------------------------------------------------------------

/**
 * Compute standout badges for a trailer within its family context.
 * Returns an array of { label, icon } objects (may be empty).
 * Only awarded when the family has 2+ entries for that year.
 */
export function computeStandouts(trailer, allTrailers) {
  // Compare within same model + same year only
  const siblings = allTrailers.filter(
    (t) => t.model === trailer.model && t.year === trailer.year && t.slug !== trailer.slug,
  );
  if (siblings.length < 1) return [];
  const pool = [trailer, ...siblings];
  const badges = [];

  // Lightest in family
  const minWeight = Math.min(...pool.map((t) => t.weightLb));
  if (trailer.weightLb === minWeight && pool.filter((t) => t.weightLb === minWeight).length === 1) {
    badges.push({ label: 'Lightest in family', icon: '⚡' });
  }

  // Most affordable in family
  const minMsrp = Math.min(...pool.map((t) => t.msrp));
  if (trailer.msrp === minMsrp && pool.filter((t) => t.msrp === minMsrp).length === 1) {
    badges.push({ label: 'Most affordable', icon: '💰' });
  }

  // Best off-grid score in family
  const maxOG = Math.max(...pool.map((t) => t.offGridScore || 0));
  if (maxOG > 0 && (trailer.offGridScore || 0) === maxOG && pool.filter((t) => (t.offGridScore || 0) === maxOG).length === 1) {
    badges.push({ label: 'Best off-grid', icon: '🌲' });
  }

  // Most spacious (sleeps) in family
  const maxSleeps = Math.max(...pool.map((t) => t.sleeps || 0));
  if (maxSleeps > 0 && trailer.sleeps === maxSleeps && pool.filter((t) => t.sleeps === maxSleeps).length === 1) {
    badges.push({ label: 'Most spacious', icon: '🛏️' });
  }

  // Most cargo capacity (CCC) in family
  const maxCCC = Math.max(...pool.map((t) => t.cccLb || 0));
  if (maxCCC > 0 && (trailer.cccLb || 0) === maxCCC && pool.filter((t) => (t.cccLb || 0) === maxCCC).length === 1) {
    badges.push({ label: 'Most cargo capacity', icon: '📦' });
  }

  // Largest tanks (total water) in family
  const totalWater = (t) => (t.freshGal || 0) + (t.grayGal || 0) + (t.blackGal || 0);
  const maxWater = Math.max(...pool.map(totalWater));
  if (maxWater > 0 && totalWater(trailer) === maxWater && pool.filter((t) => totalWater(t) === maxWater).length === 1) {
    badges.push({ label: 'Largest tanks', icon: '🚿' });
  }

  return badges;
}

// ---------------------------------------------------------------------------
// SPEC PERCENTILE RANKINGS — where does this floorplan sit in the full lineup?
// Computed at build time from the same-year catalog so the detail page can
// show "Lighter than 85% of models" etc. without any client-side computation.
// ---------------------------------------------------------------------------

/**
 * For each numeric spec field, compute the percentile rank of every trailer
 * relative to same-year peers. Returns a Map<slug, rankings> where rankings
 * is { fieldName: { pct, rank, total, direction } }.
 *
 * `direction` indicates whether high or low is "better" for user context:
 *   'lower' = lower is better (weight, price, length for towability)
 *   'higher' = higher is better (CCC, off-grid, tanks, solar)
 *
 * `pct` is the percentage of peers this trailer beats (0–100).
 * E.g. pct=85 on weightLb (direction='lower') means "lighter than 85% of models".
 */
export function computePercentiles(trailers) {
  const FIELDS = [
    { key: 'weightLb', dir: 'lower' },
    { key: 'lengthFt', dir: 'lower' },
    { key: 'msrp', dir: 'lower' },
    { key: 'cccLb', dir: 'higher' },
    { key: 'offGridScore', dir: 'higher' },
    { key: 'freshGal', dir: 'higher' },
    { key: 'hitchWeightLb', dir: 'lower' },
  ];

  // Group by year so percentiles compare like with like
  const byYear = new Map();
  for (const t of trailers) {
    if (!byYear.has(t.year)) byYear.set(t.year, []);
    byYear.get(t.year).push(t);
  }

  const result = new Map();
  for (const [, yearGroup] of byYear) {
    const total = yearGroup.length;
    if (total < 3) {
      // Too few to rank meaningfully — skip percentiles for this year
      for (const t of yearGroup) result.set(t.slug, null);
      continue;
    }
    for (const { key, dir } of FIELDS) {
      const vals = yearGroup
        .filter((t) => t[key] != null && t[key] > 0)
        .sort((a, b) => a[key] - b[key]);
      const n = vals.length;
      if (n < 3) continue; // not enough data for this field
      for (let i = 0; i < n; i++) {
        const t = vals[i];
        if (!result.has(t.slug)) result.set(t.slug, {});
        const rankings = result.get(t.slug);
        // For 'lower is better': being at index 0 (smallest) means you beat
        // everyone, so pct = ((n - 1 - i) / (n - 1)) * 100.
        // For 'higher is better': being at index n-1 (largest) means you beat
        // everyone, so pct = (i / (n - 1)) * 100.
        const pct = dir === 'lower'
          ? Math.round(((n - 1 - i) / (n - 1)) * 100)
          : Math.round((i / (n - 1)) * 100);
        rankings[key] = { pct, rank: i + 1, total: n, dir };
      }
    }
  }
  return result;
}

/**
 * Format a percentile as a concise human label.
 * Only returns a label for notable rankings (top/bottom 30%).
 */
export function percentileLabel(field, pctData) {
  if (!pctData || pctData.pct == null) return null;
  const { pct, dir } = pctData;
  // Only highlight when the model is notably good (top 30%)
  if (pct < 70) return null;
  const LABELS = {
    weightLb: { lower: 'lighter', higher: 'heavier' },
    lengthFt: { lower: 'shorter', higher: 'longer' },
    msrp: { lower: 'more affordable', higher: 'pricier' },
    cccLb: { lower: 'less cargo', higher: 'more cargo capacity' },
    offGridScore: { lower: 'less off-grid capable', higher: 'better off-grid' },
    freshGal: { lower: 'smaller fresh tank', higher: 'more fresh water' },
    hitchWeightLb: { lower: 'lighter tongue weight', higher: 'heavier tongue' },
  };
  const label = LABELS[field]?.[dir];
  if (!label) return null;
  // "Top 10%" is pct >= 90
  if (pct >= 90) return `Top 10% — ${label} than 90% of lineup`;
  if (pct >= 80) return `Top 20% — ${label} than 80%`;
  return `Top 30% — ${label} than 70%`;
}

// ---------------------------------------------------------------------------
// FLEET RANGES — min/max for key numeric fields across the whole catalog.
// Used by explore cards to show where a model sits in the lineup via tiny
// inline range bars. Computed once at build time, passed to card renderers.
// ---------------------------------------------------------------------------

/**
 * Compute min/max ranges for key spec fields across a mixed fleet of trailers
 * and motorhomes. Returns { field: { min, max } } for weight, msrp, length.
 */
export function computeFleetRanges(trailers, motorhomes = []) {
  const all = [...trailers, ...motorhomes];
  if (!all.length) return {};
  const fields = ['weightLb', 'msrp', 'lengthFt'];
  const ranges = {};
  for (const f of fields) {
    const vals = all.map((t) => t[f]).filter((v) => typeof v === 'number' && v > 0);
    if (vals.length < 2) continue;
    ranges[f] = { min: Math.min(...vals), max: Math.max(...vals) };
  }
  return ranges;
}

/**
 * Compute position (0–100) of a single value within a range.
 * Returns null if the range is degenerate or value is missing.
 */
export function rangePosition(value, range) {
  if (!range || typeof value !== 'number' || value <= 0) return null;
  const span = range.max - range.min;
  if (span <= 0) return null;
  return Math.round(((value - range.min) / span) * 100);
}
