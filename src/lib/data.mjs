// Data access + derived/aggregate logic. Pure functions over the trailers array.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load and validate the trailer dataset. Throws on structural problems. */
export function loadTrailers(path) {
  const p = path || join(__dirname, '..', 'data', 'trailers.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('trailers.json is empty or not an array');
  }
  return data;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
export function assetPaths(t) {
  return {
    thumb: `assets/img/thumbs/${t.slug}.webp`,
    hero: `assets/img/heroes/${slugify(t.model)}.webp`,
    gallery: [1, 2, 3].map((i) => `assets/img/gallery/${t.slug}-${i}.webp`),
    floorplan: `assets/img/floorplans/${t.slug}.webp`,
  };
}

/**
 * Existence-aware asset resolution for the build. `hasAsset(relPath)` returns
 * whether a file exists under public/. Resolves real, on-disk paths only:
 *   - hero: the model's hero file (null if somehow absent).
 *   - gallery: this slug's own photos, falling back to its cross-year twin's
 *     photos when the slug has none of its own; any image with neither is
 *     dropped rather than emitted as a broken <img>.
 * A trailer with no gallery at all (no twin either) simply renders hero-only.
 */
export function resolveAssets(t, hasAsset) {
  const canon = assetPaths(t);
  const twin = twinSlug(t);
  const gallery = [1, 2, 3]
    .map((i) => {
      const own = `assets/img/gallery/${t.slug}-${i}.webp`;
      if (hasAsset(own)) return own;
      const tw = `assets/img/gallery/${twin}-${i}.webp`;
      if (hasAsset(tw)) return tw;
      return null;
    })
    .filter(Boolean);
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
