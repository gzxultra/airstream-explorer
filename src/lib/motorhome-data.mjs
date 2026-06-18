// Motorhome data access + derived/aggregate logic. Mirrors data.mjs for trailers.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { slugify } from './data.mjs';

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
 * Official airstream.com model page for each motorhome family, keyed by family slug.
 * Verified URLs (2026-06-18).
 */
export const MOTORHOME_OFFICIAL_URLS = {
  atlas: 'https://www.airstream.com/touring-coaches/atlas/',
  'interstate-24': 'https://www.airstream.com/touring-coaches/interstate-24/',
  'interstate-19': 'https://www.airstream.com/touring-coaches/interstate-19/',
  rangeline: 'https://www.airstream.com/touring-coaches/rangeline/',
};

/** The official airstream.com page for a motorhome model name, or null if unmapped. */
export function motorhomeOfficialUrl(model) {
  return MOTORHOME_OFFICIAL_URLS[motorhomeFamilySlug(model)] || null;
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
    gallery: [1, 2, 3].map((i) => `assets/img/gallery/${m.slug}-${i}.webp`),
    floorplan: `assets/img/floorplans/${m.slug}.webp`,
  };
}
