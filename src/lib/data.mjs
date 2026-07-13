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
    const weights = rows.map((r) => r.weightLb).filter((n) => n > 0);
    const gvwrs = rows.map((r) => r.gvwrLb).filter((n) => n > 0);
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
      weightMin: weights.length ? Math.min(...weights) : null,
      weightMax: weights.length ? Math.max(...weights) : null,
      gvwrMax: gvwrs.length ? Math.max(...gvwrs) : null,
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
 * When `motorhomes` is passed, counts include both trailers and motorhomes.
 */
let _catalogStats = null;
export function catalogStats(trailers, motorhomes) {
  if (!trailers) {
    if (_catalogStats) return _catalogStats;
    trailers = loadTrailers();
  }
  const families = new Set(trailers.map((t) => t.model));
  const floorplans = new Set(trailers.map((t) => `${t.model}\u0000${t.floorplan}`));
  const years = [...new Set(trailers.map((t) => t.year))].sort((a, b) => b - a);
  // Include motorhomes in the totals when provided
  if (motorhomes && motorhomes.length) {
    for (const m of motorhomes) families.add(m.model);
    for (const m of motorhomes) floorplans.add(`${m.model}\u0000${m.floorplan}`);
    for (const m of motorhomes) { if (!years.includes(m.year)) years.push(m.year); }
    years.sort((a, b) => b - a);
  }
  const stats = {
    familyCount: families.size,
    floorplanCount: floorplans.size,
    entryCount: trailers.length + (motorhomes ? motorhomes.length : 0),
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
// FLEET-WIDE STANDOUTS — best-in-class across the entire catalog (not just
// within a family). Returned as Map<slug, badge[]> so explore cards can show
// them. Badges are mutually exclusive per dimension: only one slug per trait.
// ---------------------------------------------------------------------------

/**
 * Compute fleet-wide standout badges across all trailers of the same year.
 * Returns a Map<slug, Array<{ label, icon, cls }>> — entries are only created
 * for slugs that earned at least one badge.
 */
export function computeFleetStandouts(trailers) {
  const result = new Map();
  if (!trailers || trailers.length < 3) return result;
  // Group by year — badges are within a model-year cohort
  const byYear = new Map();
  for (const t of trailers) {
    if (!byYear.has(t.year)) byYear.set(t.year, []);
    byYear.get(t.year).push(t);
  }
  for (const [, pool] of byYear) {
    if (pool.length < 3) continue;
    const award = (slug, badge) => {
      if (!result.has(slug)) result.set(slug, []);
      result.get(slug).push(badge);
    };
    // Lightest overall
    const sorted = [...pool].sort((a, b) => a.weightLb - b.weightLb);
    if (sorted[0].weightLb < sorted[1].weightLb) {
      award(sorted[0].slug, { label: 'Lightest', icon: '⚡', cls: 'fleet-lightest' });
    }
    // Most affordable overall
    const byPrice = [...pool].sort((a, b) => a.msrp - b.msrp);
    if (byPrice[0].msrp < byPrice[1].msrp) {
      award(byPrice[0].slug, { label: 'Most affordable', icon: '💰', cls: 'fleet-affordable' });
    }
    // Best off-grid overall
    const byOG = [...pool].filter((t) => t.offGridScore > 0).sort((a, b) => b.offGridScore - a.offGridScore);
    if (byOG.length >= 2 && byOG[0].offGridScore > byOG[1].offGridScore) {
      award(byOG[0].slug, { label: 'Best off-grid', icon: '🌲', cls: 'fleet-offgrid' });
    }
    // Best cargo capacity
    const byCCC = [...pool].filter((t) => t.cccLb > 0).sort((a, b) => b.cccLb - a.cccLb);
    if (byCCC.length >= 2 && byCCC[0].cccLb > byCCC[1].cccLb) {
      award(byCCC[0].slug, { label: 'Most cargo', icon: '📦', cls: 'fleet-cargo' });
    }
    // Best value — lowest $ per lb of dry weight (practical value metric)
    const byValue = [...pool]
      .filter((t) => t.msrp > 0 && t.weightLb > 0)
      .map((t) => ({ t, ratio: t.msrp / t.weightLb }))
      .sort((a, b) => a.ratio - b.ratio);
    if (byValue.length >= 2 && byValue[0].ratio < byValue[1].ratio) {
      award(byValue[0].t.slug, { label: 'Best value', icon: '✨', cls: 'fleet-value' });
    }
    // Largest tanks (total water)
    const totalWater = (t) => (t.freshGal || 0) + (t.grayGal || 0) + (t.blackGal || 0);
    const byWater = [...pool].filter((t) => totalWater(t) > 0).sort((a, b) => totalWater(b) - totalWater(a));
    if (byWater.length >= 2 && totalWater(byWater[0]) > totalWater(byWater[1])) {
      award(byWater[0].slug, { label: 'Largest tanks', icon: '🚿', cls: 'fleet-tanks' });
    }
  }
  return result;
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
  const fields = ['weightLb', 'msrp', 'lengthFt', 'gvwrLb', 'cccLb', 'hitchWeightLb', 'offGridScore', 'freshGal', 'solarW', 'sleeps'];
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

// ---------------------------------------------------------------------------
// YEAR-OVER-YEAR DIFF — what changed between 2025 and 2026 for a floorplan
// ---------------------------------------------------------------------------

/**
 * Compare a 2026 trailer against its 2025 counterpart (same model+floorplan).
 * Returns null if the trailer is not 2026 or no 2025 match exists.
 * Otherwise returns { prev, diffs: [{ field, from, to, delta, direction }] }.
 */
export function computeYearDiff(trailer, allTrailers) {
  if (!trailer || trailer.year !== 2026) return null;
  const prev = allTrailers.find(
    (t) => t.model === trailer.model && t.floorplan === trailer.floorplan && t.year === 2025,
  );
  if (!prev) return null;

  const FIELDS = [
    { key: 'msrp',          label: 'MSRP',          unit: '$' },
    { key: 'weightLb',      label: 'Dry weight',     unit: 'lb' },
    { key: 'gvwrLb',        label: 'GVWR',           unit: 'lb' },
    { key: 'cccLb',         label: 'Cargo capacity', unit: 'lb' },
    { key: 'hitchWeightLb', label: 'Hitch weight',   unit: 'lb' },
    { key: 'freshGal',      label: 'Fresh water',    unit: 'gal' },
    { key: 'grayGal',       label: 'Gray tank',      unit: 'gal' },
    { key: 'blackGal',      label: 'Black tank',     unit: 'gal' },
    { key: 'solarW',        label: 'Solar',          unit: 'W' },
    { key: 'batteryKwh',    label: 'Battery',        unit: 'kWh' },
    { key: 'sleeps',        label: 'Sleeps',         unit: '' },
    { key: 'lengthFt',      label: 'Length',          unit: 'ft' },
  ];

  const diffs = [];
  for (const f of FIELDS) {
    const oldVal = prev[f.key];
    const newVal = trailer[f.key];
    if (oldVal == null && newVal == null) continue;
    if (oldVal === newVal) continue;
    // At least one is non-null and they differ
    const delta = (typeof newVal === 'number' && typeof oldVal === 'number')
      ? newVal - oldVal
      : null;
    const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'changed';
    diffs.push({
      field: f.label,
      key: f.key,
      from: oldVal,
      to: newVal,
      unit: f.unit,
      delta,
      direction,
    });
  }

  return diffs.length > 0 ? { prev, diffs } : null;
}

// ---------------------------------------------------------------------------
// TOW CLASS — categorize trailers by what class of tow vehicle they need
// ---------------------------------------------------------------------------

/**
 * Tow class based on GVWR. Returns { cls, label, icon } where:
 *   half-ton  : GVWR ≤ 7,500 lb — towable by F-150 / Ram 1500 / Silverado 1500
 *   three-quarter : 7,500 < GVWR ≤ 10,000 — needs F-250 / Ram 2500 class
 *   one-ton   : GVWR > 10,000 — needs F-350 / Ram 3500 class
 *
 * These thresholds align with typical manufacturer max-tow ratings for each
 * truck class; they're conservative since GVWR must stay under the rating.
 */
export function towClass(gvwrLb) {
  if (gvwrLb <= 7500) return { cls: 'half-ton', label: 'Half-ton towable', icon: '🛻' };
  if (gvwrLb <= 10000) return { cls: 'three-quarter', label: '¾-ton required', icon: '🛻' };
  return { cls: 'one-ton', label: '1-ton required', icon: '🚛' };
}

// ---------------------------------------------------------------------------
// WATER AUTONOMY — estimated days of fresh water at typical RV usage
// ---------------------------------------------------------------------------

/**
 * Estimate days of fresh water for a given number of people.
 * Uses 3 gal/person/day (conservative RV usage: drinking, cooking, quick
 * showers, basic washing). Returns null if no fresh tank data.
 */
export function waterAutonomy(freshGal, people = 2) {
  if (!freshGal || freshGal <= 0 || people <= 0) return null;
  const GAL_PER_PERSON_PER_DAY = 3;
  return Math.round((freshGal / (GAL_PER_PERSON_PER_DAY * people)) * 10) / 10;
}

// ---------------------------------------------------------------------------
// AT-A-GLANCE SUMMARY — computed prose highlights for detail pages.
// Generates 3-4 concise bullet points about what makes a floorplan notable,
// using fleet percentiles + family context + raw specs. No fabricated data.
// ---------------------------------------------------------------------------

/**
 * Generate an "At a Glance" summary for a trailer detail page.
 * Returns an array of { icon, text } objects (3-4 items).
 * All statements are derived from the trailer's real spec data and its
 * position in the fleet/family — nothing is invented or guessed.
 */
export function generateGlanceSummary(t, allTrailers) {
  const points = [];
  if (!t || !allTrailers || allTrailers.length < 3) return points;

  // Gather family siblings (same model, same year)
  const siblings = allTrailers.filter(
    (s) => s.model === t.model && s.year === t.year,
  );
  const yearCohort = allTrailers.filter((s) => s.year === t.year);

  // 1. Size & tow class context
  const tc = towClass(t.gvwrLb);
  if (t.lengthFt && t.weightLb) {
    const lighterCount = yearCohort.filter((s) => s.weightLb > t.weightLb).length;
    const lighterPct = Math.round((lighterCount / yearCohort.length) * 100);
    if (lighterPct >= 70) {
      points.push({
        icon: '⚡',
        text: `One of the lightest in the lineup at ${Math.round(t.weightLb).toLocaleString('en-US')} lb — lighter than ${lighterPct}% of all ${t.year} models. ${tc.label} towing class.`,
      });
    } else if (lighterPct <= 20) {
      points.push({
        icon: '🏔️',
        text: `A full-size ${Math.round(t.lengthFt)}' trailer at ${Math.round(t.weightLb).toLocaleString('en-US')} lb. ${tc.label} towing class — plan for a capable truck.`,
      });
    } else {
      points.push({
        icon: '📐',
        text: `${Math.round(t.lengthFt)}' long, ${Math.round(t.weightLb).toLocaleString('en-US')} lb dry weight. ${tc.label} towing class.`,
      });
    }
  }

  // 2. Off-grid capability
  if (t.offGridScore != null) {
    const ogRank = yearCohort.filter((s) => (s.offGridScore || 0) > t.offGridScore).length;
    const ogPctBetter = Math.round((ogRank / yearCohort.length) * 100);
    if (t.offGridScore >= 70) {
      const details = [];
      if (t.solarW) details.push(`${t.solarW}W solar`);
      if (t.batteryKwh) details.push(`${t.batteryKwh} kWh battery`);
      points.push({
        icon: '🌲',
        text: `Strong off-grid setup (score ${t.offGridScore}/100)${details.length ? ' with ' + details.join(' + ') : ''}. Top ${100 - Math.round(((yearCohort.length - 1 - ogRank) / (yearCohort.length - 1)) * 100)}% of the fleet.`,
      });
    } else if (t.offGridScore <= 30) {
      points.push({
        icon: '🔌',
        text: `Built for hookup camping (off-grid score ${t.offGridScore}/100). ${t.solarW ? t.solarW + 'W solar helps extend, but' : 'No factory solar —'} plan for shore power on longer stays.`,
      });
    } else {
      const solarNote = t.solarW ? `${t.solarW}W solar standard` : 'solar optional';
      points.push({
        icon: '☀️',
        text: `Moderate off-grid capability (score ${t.offGridScore}/100) with ${solarNote}. Good for weekend boondocking.`,
      });
    }
  }

  // 3. Water & autonomy
  const totalWater = (t.freshGal || 0) + (t.grayGal || 0) + (t.blackGal || 0);
  if (t.freshGal) {
    const avgFresh = Math.round(yearCohort.reduce((s, x) => s + (x.freshGal || 0), 0) / yearCohort.length);
    if (t.freshGal >= avgFresh * 1.2) {
      points.push({
        icon: '💧',
        text: `Above-average ${t.freshGal}-gallon fresh tank (fleet avg ~${avgFresh} gal) — supports longer dry-camping stays.`,
      });
    } else if (t.freshGal <= avgFresh * 0.7) {
      points.push({
        icon: '💧',
        text: `Compact ${t.freshGal}-gallon fresh tank (fleet avg ~${avgFresh} gal). Plan for more frequent fill-ups when boondocking.`,
      });
    }
  }

  // 4. Value / price context
  if (t.msrp > 0) {
    const cheaperCount = yearCohort.filter((s) => s.msrp > 0 && s.msrp > t.msrp).length;
    const cheaperPct = Math.round((cheaperCount / yearCohort.filter((s) => s.msrp > 0).length) * 100);
    if (cheaperPct >= 70) {
      points.push({
        icon: '💰',
        text: `At $${Math.round(t.msrp).toLocaleString('en-US')}, more affordable than ${cheaperPct}% of the ${t.year} lineup. ${t.cccLb ? '$' + Math.round(t.msrp / t.cccLb).toLocaleString('en-US') + ' per lb of cargo capacity.' : ''}`,
      });
    } else if (cheaperPct <= 20) {
      points.push({
        icon: '✨',
        text: `Premium at $${Math.round(t.msrp).toLocaleString('en-US')} — a top-tier ${t.model} with ${t.sleeps}-person sleeping and ${siblings.length > 1 ? 'the largest layout in the family' : 'a spacious floorplan'}.`,
      });
    }
  }

  // 5. CCC context (if not already covered and notable)
  if (points.length < 4 && t.cccLb) {
    const avgCCC = Math.round(
      yearCohort.filter((s) => s.cccLb > 0).reduce((s, x) => s + x.cccLb, 0) /
      yearCohort.filter((s) => s.cccLb > 0).length,
    );
    if (t.cccLb >= avgCCC * 1.3) {
      points.push({
        icon: '📦',
        text: `Generous ${Math.round(t.cccLb).toLocaleString('en-US')} lb cargo capacity (fleet avg ~${avgCCC.toLocaleString('en-US')} lb) — room for gear, supplies, and full tanks.`,
      });
    }
  }

  // Cap at 4 points
  return points.slice(0, 4);
}

// ---------------------------------------------------------------------------
// AXLE TYPE — derived from Airstream's official product categorisation.
// Source: airstream.com/explore-products/travel-trailers/ (single-axle vs
// dual-axle URL paths, verified 2026-07-10). NOT guessed from weight.
// ---------------------------------------------------------------------------

const AXLE_MAP = {
  bambi:        'single',
  basecamp:     'single',
  'basecamp-xe':'single',
  caravel:      'single',
  'world-traveler': 'single',
  'flying-cloud':   'dual',
  international:    'dual',
  globetrotter:     'dual',
  'trade-wind':     'dual',
  classic:          'dual',
  'frank-lloyd-wright-limited-edition': 'dual',
  'stetson-6666-special-edition':       'dual',
};

/**
 * Derive axle type for a trailer from the official Airstream classification.
 * Returns 'single' | 'dual' | null if the family is unknown.
 */
export function deriveAxle(t) {
  return AXLE_MAP[familySlug(t.model)] || null;
}

// ---------------------------------------------------------------------------
// TOW DIFFICULTY — beginner-friendliness rating based on weight, length, axle
// ---------------------------------------------------------------------------

/**
 * Compute a tow difficulty rating for a trailer.
 * Uses weight (primary), length, and axle type to produce a 1-5 score:
 *   1-2 = Easy (small, light, single-axle — good for first-timers)
 *   3   = Moderate (mid-range, manageable with a half-ton truck)
 *   4   = Challenging (heavy or long, needs experience + ¾-ton)
 *   5   = Expert (heaviest class, 1-ton truck, experienced tower)
 * Returns { score, label, tip } or null if missing data.
 */
export function towDifficulty(t) {
  if (!t || !t.weightLb || !t.lengthFt) return null;
  const axle = deriveAxle(t);
  let score = 0;
  // Weight scoring (dominant factor)
  if (t.weightLb <= 3500) score += 1;
  else if (t.weightLb <= 5000) score += 2;
  else if (t.weightLb <= 6500) score += 3;
  else if (t.weightLb <= 8000) score += 4;
  else score += 5;
  // Length scoring
  if (t.lengthFt <= 20) score += 1;
  else if (t.lengthFt <= 25) score += 2;
  else if (t.lengthFt <= 30) score += 3;
  else score += 4;
  // Axle: dual adds stability but signals size
  if (axle === 'dual') score += 1;
  // Normalize to 1-5 (raw range is 2-10)
  const norm = Math.max(1, Math.min(5, Math.round((score - 2) / 1.6) + 1));
  const LABELS = {
    1: { label: 'Easy tow', tip: 'Light and compact — great for first-time towers and smaller tow vehicles.' },
    2: { label: 'Beginner-friendly', tip: 'Manageable for most half-ton trucks. Good for newer towers with some practice.' },
    3: { label: 'Moderate', tip: 'Mid-range weight and length. Comfortable for experienced half-ton towers.' },
    4: { label: 'Experienced', tip: 'Heavy and/or long — requires a capable tow vehicle and confident driver.' },
    5: { label: 'Heavy hauler', tip: 'The biggest class. Demands a ¾-ton or 1-ton truck and experienced towing skills.' },
  };
  return { score: norm, ...LABELS[norm] };
}

// ---------------------------------------------------------------------------
// WINTERIZATION GUIDE — model-specific storage/winterization data
// ---------------------------------------------------------------------------

/**
 * Generate winterization checklist items tailored to a specific trailer's specs.
 * Returns { items: [{cat, text, icon, detail}], drainPoints } where each item
 * references the trailer's actual tank capacities, battery, and solar.
 */
export function winterizationGuide(t) {
  if (!t) return { items: [], drainPoints: 0 };
  const items = [];
  let drainPoints = 0;

  // Water system draining
  if (t.freshGal) {
    items.push({ cat: 'water', text: `Drain ${t.freshGal}-gallon fresh water tank`, icon: '💧', detail: 'Open the low-point drain valve until the tank is fully empty.' });
    drainPoints++;
  }
  if (t.grayGal) {
    items.push({ cat: 'water', text: `Drain ${t.grayGal}-gallon gray water tank`, icon: '🚿', detail: 'Open the gray valve and let it drain completely at a dump station.' });
    drainPoints++;
  }
  if (t.blackGal) {
    const label = t.grayGal ? 'black' : 'waste (combined)';
    items.push({ cat: 'water', text: `Drain ${t.blackGal}-gallon ${label} tank`, icon: '🚽', detail: 'Flush thoroughly before draining. Use a tank rinse wand if available.' });
    drainPoints++;
  }
  items.push({ cat: 'water', text: 'Bypass water heater before adding antifreeze', icon: '♨️', detail: 'Set the bypass valve so antifreeze flows through the lines, not the heater tank.' });
  items.push({ cat: 'water', text: 'Add RV antifreeze to all drains and toilet', icon: '🧊', detail: 'Pour non-toxic RV antifreeze into each P-trap: kitchen, bathroom sink, shower, and toilet bowl.' });
  items.push({ cat: 'water', text: 'Open all faucets to relieve pressure', icon: '🔧', detail: 'Turn on hot and cold at each faucet, then leave slightly open during storage.' });

  // Battery & electrical
  if (t.batteryKwh) {
    items.push({ cat: 'electrical', text: `Disconnect ${t.batteryKwh} kWh house battery`, icon: '🔋', detail: 'Disconnect the negative terminal. Store fully charged and on a trickle charger if possible.' });
  }
  if (t.solarW) {
    items.push({ cat: 'electrical', text: `Cover or disconnect ${t.solarW}W solar panel${t.solarW > 200 ? 's' : ''}`, icon: '☀️', detail: 'If disconnecting the battery, cover panels to prevent charge buildup with no load.' });
  }
  items.push({ cat: 'electrical', text: 'Turn off all breakers and disconnect shore power', icon: '⚡', detail: 'Switch off the main breaker and unplug shore power cord.' });

  // Propane & gas
  items.push({ cat: 'gas', text: 'Turn off propane at the tank valve', icon: '🔥', detail: 'Close the main propane valve on each tank.' });
  items.push({ cat: 'gas', text: 'Run appliances briefly to clear lines', icon: '💨', detail: 'Run the stove burners until they go out to purge propane from the lines.' });

  // Exterior
  items.push({ cat: 'exterior', text: 'Inspect and clean roof seals', icon: '🏠', detail: 'Check all roof seams, vents, and antenna bases for cracks. Reseal with Dicor if needed.' });
  items.push({ cat: 'exterior', text: 'Cover tires or move periodically', icon: '🛞', detail: 'UV and flat-spotting damage tires in storage. Use covers or move the trailer monthly.' });
  items.push({ cat: 'exterior', text: 'Retract awning and secure all openings', icon: '🏕️', detail: 'Retract fully, ensure no moisture is trapped. Close all vents and windows.' });
  if (t.weightLb) {
    const wtStr = Math.round(t.weightLb).toLocaleString('en-US') + ' lb';
    items.push({ cat: 'exterior', text: 'Level and stabilize on solid surface', icon: '📐', detail: `Support the ${wtStr} dry weight on leveling blocks — avoid soft ground.` });
  }

  // Interior
  items.push({ cat: 'interior', text: 'Clean thoroughly and remove all food', icon: '🧹', detail: 'Wipe all surfaces, empty the fridge (leave door propped open), remove perishables.' });
  items.push({ cat: 'interior', text: 'Open cabinet doors for air circulation', icon: '🗄️', detail: 'Prevents mold and mildew buildup. Consider moisture absorbers in enclosed spaces.' });
  items.push({ cat: 'interior', text: 'Place moisture absorbers throughout', icon: '💨', detail: 'DampRid or similar in the bathroom, under dinette, and in closets.' });

  return { items, drainPoints };
}

// ---------------------------------------------------------------------------
// IDEAL-FOR BADGES — computed buyer-persona badges from specs. Each badge
// has clear, deterministic criteria so they are reproducible and testable.
// ---------------------------------------------------------------------------

const IDEAL_FOR_RULES = [
  {
    id: 'first-timer',
    label: 'First-timer friendly',
    icon: '🌱',
    desc: 'Easy to tow & maneuver for new RVers',
    test: (t) => t.weightLb <= 5500 && deriveAxle(t) === 'single' && t.lengthFt <= 25,
  },
  {
    id: 'couples',
    label: 'Couples retreat',
    icon: '💑',
    desc: 'Cozy layout sized for two',
    test: (t) => t.sleeps <= 3 && t.lengthFt <= 25,
  },
  {
    id: 'family',
    label: 'Family adventure',
    icon: '👨‍👩‍👧‍👦',
    desc: 'Room to sleep 5+ with cargo to match',
    test: (t) => t.sleeps >= 5 && (t.cccLb || 0) >= 1200,
  },
  {
    id: 'full-timer',
    label: 'Full-time ready',
    icon: '🏡',
    desc: 'Spacious enough for extended living',
    test: (t) => t.freshGal >= 39 && t.sleeps >= 4 && t.lengthFt >= 27,
  },
  {
    id: 'boondocker',
    label: 'Boondocking champ',
    icon: '⛺',
    desc: 'Built for dry camping off the grid',
    test: (t) => (t.offGridScore || 0) >= 55 && t.solarW >= 200,
  },
  {
    id: 'lightweight',
    label: 'Lightweight tow',
    icon: '🪶',
    desc: 'Under 4,000 lb — SUV-towable',
    test: (t) => t.weightLb <= 4000,
  },
  {
    id: 'weekend',
    label: 'Weekend warrior',
    icon: '🏕️',
    desc: 'Quick getaway without the hassle',
    test: (t) => t.lengthFt <= 22 && t.weightLb <= 5000,
  },
  {
    id: 'luxury',
    label: 'Premium touring',
    icon: '✨',
    desc: 'Top-tier comfort & appointments',
    test: (t) => t.msrp >= 150000 && t.lengthFt >= 28,
  },
];

/**
 * Compute "Ideal For" badges for a trailer. Returns an array of
 * { id, label, icon, desc } for each matching persona.
 */
export function computeIdealFor(t) {
  return IDEAL_FOR_RULES.filter((r) => r.test(t)).map(({ id, label, icon, desc }) => ({ id, label, icon, desc }));
}
