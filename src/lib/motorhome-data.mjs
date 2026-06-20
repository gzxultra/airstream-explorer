// Motorhome data access + derived/aggregate logic. Mirrors data.mjs for trailers.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { slugify, galleryCutoutFlags } from './data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load the motorhome dataset. Throws on structural problems. */
export function loadMotorhomes(path) {
  const p = path || join(__dirname, '..', 'data', 'motorhomes.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('motorhomes.json is empty or not an array');
  }
  return data;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validate one motorhome record. Returns array of problem strings (empty = ok). */
export function validateMotorhome(m) {
  const problems = [];
  if (!m.slug || !SLUG_RE.test(m.slug)) problems.push(`bad slug: ${m.slug}`);
  if (!m.model) problems.push(`${m.slug}: missing model`);
  if (!m.floorplan) problems.push(`${m.slug}: missing floorplan`);
  if (![2025, 2026, 2027].includes(m.year)) problems.push(`${m.slug}: bad year ${m.year}`);
  if (m.type !== 'motorhome') problems.push(`${m.slug}: type must be "motorhome"`);
  if (!(m.msrp > 0)) problems.push(`${m.slug}: bad msrp`);
  if (!(m.weightLb > 0)) problems.push(`${m.slug}: bad weight`);
  if (!(m.gvwrLb > 0)) problems.push(`${m.slug}: bad gvwr`);
  if (m.nccLb == null || m.nccLb !== m.gvwrLb - m.weightLb) {
    problems.push(`${m.slug}: ncc mismatch (${m.nccLb} vs ${m.gvwrLb - m.weightLb})`);
  }
  if (!(m.sleeps > 0)) problems.push(`${m.slug}: bad sleeps`);
  if (!m.chassis) problems.push(`${m.slug}: missing chassis`);
  if (!m.engine) problems.push(`${m.slug}: missing engine`);
  if (!m.fuelType) problems.push(`${m.slug}: missing fuelType`);
  // When factory solar wattage is published, the standard/optional status must
  // be declared (boolean), so the spec row never silently implies "standard".
  if (m.solarW != null && m.solarW > 0 && typeof m.solarStandard !== 'boolean') {
    problems.push(`${m.slug}: solarStandard must be boolean when solarW is set`);
  }
  return problems;
}

/** Validate the whole motorhome dataset: per-record + unique slugs. Throws on any problem. */
export function validateMotorhomeDataset(motorhomes) {
  const all = [];
  const seen = new Set();
  for (const m of motorhomes) {
    all.push(...validateMotorhome(m));
    if (seen.has(m.slug)) all.push(`duplicate slug: ${m.slug}`);
    seen.add(m.slug);
  }
  if (all.length) throw new Error('Motorhome dataset invalid:\n' + all.join('\n'));
  return true;
}

/** Family slug for a motorhome model name. */
export function motorhomeFamilySlug(model) {
  return slugify(model);
}

/**
 * Official airstream.com FAMILY landing page for each motorhome family, keyed by
 * family slug. All return HTTP 200 — curl-verified 2026-06-18.
 * NOTE: airstream.com has a single "interstate" landing page covering both the
 * Interstate-19 and Interstate-24 lines (no per-size family page exists).
 */
export const MOTORHOME_OFFICIAL_URLS = {
  atlas: 'https://www.airstream.com/explore-products/touring-coaches/atlas/',
  'interstate-24': 'https://www.airstream.com/explore-products/touring-coaches/interstate/',
  'interstate-19': 'https://www.airstream.com/explore-products/touring-coaches/interstate/',
  interstate: 'https://www.airstream.com/explore-products/touring-coaches/interstate/',
  rangeline: 'https://www.airstream.com/explore-products/touring-coaches/rangeline/',
};

/**
 * Official airstream.com PER-MODEL page, keyed by our data slug.
 * The model-code casing on airstream.com is irregular (atlas-25MS upper,
 * interstate-24gtx lower, interstate-24GLX upper, rangeline-21pl lower), so this
 * is an explicit map — every URL curl-verified to return HTTP 200 on 2026-06-18.
 * Do NOT regenerate these by rule; re-verify with curl if Airstream restructures.
 */
export const MOTORHOME_OFFICIAL_URLS_BY_SLUG = {
  'atlas-25ms-2027': 'https://www.airstream.com/explore-products/touring-coaches/atlas/atlas-25MS',
  'atlas-25rt-2027': 'https://www.airstream.com/explore-products/touring-coaches/atlas/atlas-25RT',
  'interstate-24gtx-2026': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-24gtx',
  'interstate-24glx-2027': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-24GLX',
  'interstate-24gt-2027': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-24GT',
  'interstate-24gl-2027': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-24GL',
  'interstate-19gtx-2027': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-19GTX',
  'interstate-19gt-2027': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-19GT',
  'interstate-19x-2027': 'https://www.airstream.com/explore-products/touring-coaches/interstate/interstate-19X',
  'rangeline-21pl-2027': 'https://www.airstream.com/explore-products/touring-coaches/rangeline/rangeline-21pl',
  'rangeline-21ps-2027': 'https://www.airstream.com/explore-products/touring-coaches/rangeline/rangeline-21ps',
};

/** The official airstream.com FAMILY page for a motorhome model name, or null if unmapped. */
export function motorhomeOfficialUrl(model) {
  return MOTORHOME_OFFICIAL_URLS[motorhomeFamilySlug(model)] || null;
}

/**
 * The official airstream.com PER-MODEL page for a specific motorhome record (by slug).
 * Falls back to the family landing page, then null.
 */
export function motorhomeOfficialUrlBySlug(slug, model) {
  if (slug && MOTORHOME_OFFICIAL_URLS_BY_SLUG[slug]) return MOTORHOME_OFFICIAL_URLS_BY_SLUG[slug];
  if (model) return motorhomeOfficialUrl(model);
  return null;
}

/** Distinct sorted model names. */
export function motorhomeFamilyNames(motorhomes) {
  return [...new Set(motorhomes.map((m) => m.model))].sort();
}

/**
 * Group motorhomes into model families with display-ready summary stats.
 * Returns an ordered array (entry price descending: flagship -> budget), each:
 *   { family, slug, hero, motorhomes[], floorplanCount, entryCount,
 *     priceMin, priceMax, lengthMin, lengthMax, sleepsMax, years[] }
 * `motorhomes` within a family are sorted year desc, then length asc.
 */
export function groupMotorhomesByFamily(motorhomes) {
  const map = new Map();
  for (const m of motorhomes) {
    if (!map.has(m.model)) map.set(m.model, []);
    map.get(m.model).push(m);
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
      slug: motorhomeFamilySlug(family),
      hero: `assets/img/heroes/${motorhomeFamilySlug(family)}.webp`,
      motorhomes: sorted,
      floorplanCount: floorplans.size,
      entryCount: rows.length,
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      lengthMin: lengths.length ? Math.min(...lengths) : null,
      lengthMax: lengths.length ? Math.max(...lengths) : null,
      sleepsMax: Math.max(...rows.map((r) => r.sleeps || 0)),
      years: [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a),
    };
  });
  // Flagship -> budget: lead with the premium families.
  families.sort((a, b) => {
    if (a.priceMin == null) return 1;
    if (b.priceMin == null) return -1;
    return b.priceMin - a.priceMin || a.family.localeCompare(b.family);
  });
  return families;
}

/**
 * Canonical asset paths for a motorhome, relative + CF-root friendly.
 * Uses mm/ for detail pages and mf/ for family pages to avoid collision with trailers.
 */
export function motorhomeAssetPaths(m) {
  return {
    thumb: `assets/img/thumbs/${m.slug}.webp`,
    hero: `assets/img/heroes/${motorhomeFamilySlug(m.model)}.webp`,
    gallery: Array.from({ length: 12 }, (_, i) => `assets/img/gallery/${m.slug}-${i + 1}.webp`),
    floorplan: `assets/img/floorplans/${m.slug}.webp`,
  };
}

/**
 * Existence-aware motorhome asset resolution (mirrors trailer resolveAssets).
 * Galleries are variable-length: collect every `<slug>-N.webp` (1..12) that
 * exists on disk. Motorhomes have no cross-year twins, so there's no twin
 * fallback. Hero/thumb/floorplan resolve to null when absent so the renderer
 * never emits a broken <img>. Pass build's `hasAsset` to enable; without it,
 * falls back to the canonical (non-checked) paths for backwards compat.
 */
export function resolveMotorhomeAssets(m, hasAsset) {
  const canon = motorhomeAssetPaths(m);
  if (typeof hasAsset !== 'function') return canon;
  const flags = galleryCutoutFlags();
  const gallery = [];
  const galleryCutout = [];
  for (let i = 1; i <= 12; i++) {
    const rel = `assets/img/gallery/${m.slug}-${i}.webp`;
    if (!hasAsset(rel)) continue;
    gallery.push(rel);
    const arr = flags[m.slug];
    galleryCutout.push(Array.isArray(arr) && arr[i - 1] === true);
  }
  return {
    thumb: canon.thumb,
    hero: hasAsset(canon.hero) ? canon.hero : null,
    gallery,
    galleryCutout,
    floorplan: hasAsset(canon.floorplan) ? canon.floorplan : null,
  };
}

