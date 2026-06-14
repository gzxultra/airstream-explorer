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
      hero: `assets/img/heroes/${familySlug(family)}.jpg`,
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
 * Canonical (pure) asset paths for a trailer, relative + CF-root friendly.
 * Hero is derived from the model name via slugify() — NOT the legacy
 * `heroFamily` field, which was unreliable and is no longer used.
 */
export function assetPaths(t) {
  return {
    thumb: `assets/img/thumbs/${t.slug}.jpg`,
    hero: `assets/img/heroes/${slugify(t.model)}.jpg`,
    gallery: [1, 2, 3].map((i) => `assets/img/gallery/${t.slug}-${i}.jpg`),
    floorplan: `assets/img/floorplans/${t.slug}.jpg`,
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
      const own = `assets/img/gallery/${t.slug}-${i}.jpg`;
      if (hasAsset(own)) return own;
      const tw = `assets/img/gallery/${twin}-${i}.jpg`;
      if (hasAsset(tw)) return tw;
      return null;
    })
    .filter(Boolean);
  // Floor-plan diagram: this slug's own, falling back to its cross-year twin's
  // (the 2025/2026 of one floorplan share an identical official diagram).
  let floorplan = null;
  if (hasAsset(canon.floorplan)) floorplan = canon.floorplan;
  else if (hasAsset(`assets/img/floorplans/${twin}.jpg`))
    floorplan = `assets/img/floorplans/${twin}.jpg`;
  return {
    thumb: canon.thumb,
    hero: hasAsset(canon.hero) ? canon.hero : null,
    gallery,
    floorplan,
  };
}
