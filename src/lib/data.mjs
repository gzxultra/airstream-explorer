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

/** Asset paths for a trailer (relative, CF-root friendly). */
export function assetPaths(t) {
  return {
    thumb: `assets/img/thumbs/${t.slug}.jpg`,
    hero: t.heroFamily ? `assets/img/heroes/${t.heroFamily}.jpg` : null,
    gallery: [1, 2, 3].map((i) => `assets/img/gallery/${t.slug}-${i}.jpg`),
  };
}
