// Community photo gallery + credits — real, free-licensed Airstream photographs
// sourced from Wikimedia Commons. Pure functions + a small loader/validator.
//
// LEGAL CONTRACT: every displayed photo carries visible attribution (artist +
// license) and links to its source + license. The dataset validator below is
// the machine-checked guarantee of that contract; the build fails if any photo
// is missing attribution. Do not relax it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { esc } from './render.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load the community photo dataset. */
export function loadCommunityPhotos(path) {
  const p = path || join(__dirname, '..', 'data', 'community-photos.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('community-photos.json is empty or not an array');
  }
  return data;
}

/** Required attribution fields — the legal contract, enforced. */
const REQUIRED = ['id', 'thumb', 'bucket', 'artist', 'license', 'licenseUrl', 'source', 'sourceUrl'];

/** Validate one photo record. Returns array of problem strings (empty = ok). */
export function validatePhoto(p) {
  const problems = [];
  for (const f of REQUIRED) {
    if (!p[f] || String(p[f]).trim() === '') problems.push(`${p.id || '?'}: missing ${f}`);
  }
  // attribution URLs must be real http(s) links so the credit is reachable
  for (const f of ['licenseUrl', 'sourceUrl']) {
    if (p[f] && !/^https?:\/\//.test(p[f])) problems.push(`${p.id}: ${f} is not a URL`);
  }
  return problems;
}

/** Validate the whole photo set: per-record + unique ids. Throws on any problem. */
export function validateCommunity(photos) {
  const all = [];
  const seen = new Set();
  for (const p of photos) {
    all.push(...validatePhoto(p));
    if (seen.has(p.id)) all.push(`duplicate id: ${p.id}`);
    seen.add(p.id);
  }
  if (all.length) throw new Error('Community photos invalid:\n' + all.join('\n'));
  return true;
}

/** Group photos into ordered buckets for sectioned display. */
export function groupByBucket(photos) {
  const order = [];
  const map = new Map();
  for (const p of photos) {
    if (!map.has(p.bucket)) {
      map.set(p.bucket, []);
      order.push(p.bucket);
    }
    map.get(p.bucket).push(p);
  }
  return order.map((b) => ({ bucket: b, photos: map.get(b) }));
}

// The named model buckets are individually too small (1–3 photos each) to fill
// a multi-column masonry without leaving ragged empty columns. We pour them all
// into one "By model" section so the gallery flows as a continuous editorial
// wall, and keep the larger thematic buckets as their own sections.
const MODEL_BUCKETS = new Set([
  'Bambi', 'Caravel', 'International', 'Safari', 'Flying Cloud',
  'Trade Wind', 'Globetrotter', 'Basecamp', 'Classic',
]);

// Display order of the merged sections. "By model" leads; the thematic buckets
// follow. Any bucket not listed here falls to the end in first-seen order.
const SECTION_ORDER = [
  'By model',
  'Vintage & classic',
  'Interiors & details',
  'On the road & campsites',
];

/**
 * Collapse the small per-model buckets into a single "By model" section and
 * keep the larger thematic buckets as-is. Returns ordered sections, each with
 * enough photos to fill a masonry cleanly. Within "By model", photos are
 * ordered by their original model bucket so same-model shots sit together.
 */
export function sectionsForGallery(photos) {
  const map = new Map();
  for (const p of photos) {
    const key = MODEL_BUCKETS.has(p.bucket) ? 'By model' : p.bucket;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  const keys = [...map.keys()].sort((a, b) => {
    const ia = SECTION_ORDER.indexOf(a);
    const ib = SECTION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return keys.map((bucket) => ({ bucket, photos: map.get(bucket) }));
}

/** Short, friendly blurb per section (purely descriptive). */
const BUCKET_BLURB = {
  'By model': 'Owners’ shots of today’s lineup — Bambi, Caravel, Flying Cloud, International, Safari, Trade Wind and more, out in the world.',
  'Vintage & classic': 'Decades of riveted aluminium — vintage and unspecified models that show the lineage.',
  'Interiors & details': 'Cabins, galleys, and the details that make an Airstream an Airstream.',
  'On the road & campsites': 'Where they actually live: campsites, piers, festivals, and open road.',
};

/** One photo figure with an always-visible attribution caption. */
function photoFigure(p, relRoot = '') {
  const credit = `${esc(p.artist)} · ${esc(p.license)}`;
  const cap = p.caption ? `<span class="cphoto-desc">${esc(p.caption)}</span>` : '';
  // Real dimensions let the masonry reserve correct space and never crop.
  const w = p.w || 480;
  const h = p.h || 360;
  return `<figure class="cphoto">
<a class="cphoto-link" href="${esc(p.sourceUrl)}" target="_blank" rel="noopener nofollow" title="${esc(p.title)} — view source on ${esc(p.source)}">
<img src="${relRoot}${esc(p.thumb)}" alt="${esc(p.title)}" loading="lazy" width="${w}" height="${h}" style="aspect-ratio:${w}/${h}">
</a>
<figcaption class="cphoto-cap">${cap}<span class="cphoto-credit"><a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener nofollow">${credit}</a></span></figcaption>
</figure>`;
}

/**
 * The community gallery page body (sectioned by bucket).
 * `page` is injected from render.mjs to keep this module I/O-free and avoid a cycle.
 */
export function renderCommunityBody(photos, relRoot = '') {
  const sections = sectionsForGallery(photos)
    .map(({ bucket, photos: ps }) => {
      const blurb = BUCKET_BLURB[bucket] ? `<p class="csec-blurb">${esc(BUCKET_BLURB[bucket])}</p>` : '';
      const figs = ps.map((p) => photoFigure(p, relRoot)).join('\n');
      return `<section class="csec">
<header class="csec-head"><h2>${esc(bucket)}</h2><span class="csec-count">${ps.length}</span></header>
${blurb}
<div class="cgrid">${figs}</div>
</section>`;
    })
    .join('\n');
  return `<nav class="detail-nav"><a href="${relRoot}index.html" class="back-link">← All families</a></nav>
<header class="hero-head">
<p class="eyebrow">REAL PHOTOS · CREATIVE COMMONS</p>
<h1>Airstream in the Wild</h1>
<p class="lede">Real Airstreams, photographed by the people who love them. Every image here is freely licensed (Creative Commons or public domain) via <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a> — with thanks to the photographers, each credited below and in full on the <a href="${relRoot}credits.html">credits page</a>.</p>
</header>
<main class="community">
${sections}
</main>
<p class="community-foot muted">Grouped by model where the photographer identified one; older and unspecified trailers are grouped by era and setting rather than guessed into a specific floorplan. <a href="${relRoot}credits.html">Full photo credits &amp; licenses →</a></p>`;
}

/** The credits page body: every photo, its author, license (linked) and source. */
export function renderCreditsBody(photos, relRoot = '') {
  const rows = photos
    .map(
      (p) => `<li class="credit">
<a class="credit-thumb" href="${esc(p.sourceUrl)}" target="_blank" rel="noopener nofollow"><img src="${relRoot}${esc(p.thumb)}" alt="${esc(p.title)}" loading="lazy" width="120" height="90"></a>
<div class="credit-meta">
<span class="credit-title">${esc(p.title)}</span>
<span class="credit-by">by ${esc(p.artist)}</span>
<span class="credit-lic"><a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener nofollow">${esc(p.license)}</a> · <a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener nofollow">source (${esc(p.source)})</a></span>
</div>
</li>`,
    )
    .join('\n');
  return `<nav class="detail-nav"><a href="${relRoot}community.html" class="back-link">← Community photos</a></nav>
<header class="hero-head">
<p class="eyebrow">PHOTO CREDITS &amp; LICENSES</p>
<h1>Credits</h1>
<p class="lede">Every community photograph on this site, with its photographer, license, and original source. All images are used under their stated free license. Thank you to these photographers for sharing their work.</p>
</header>
<main class="credits">
<ul class="credit-list">
${rows}
</ul>
</main>`;
}
