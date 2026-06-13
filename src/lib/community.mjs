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
const REQUIRED = ['id', 'file', 'thumb', 'bucket', 'artist', 'license', 'licenseUrl', 'source', 'sourceUrl'];

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

/** Short, friendly blurb per bucket (purely descriptive). */
const BUCKET_BLURB = {
  Bambi: 'The compact single-axle icon — real owners’ Bambis in the wild.',
  Caravel: 'Small, polished, and unmistakably Airstream.',
  International: 'The well-travelled International, on the road and at rest.',
  Safari: 'Mid-size Safari trailers under big skies.',
  'Flying Cloud': 'The best-selling Flying Cloud, hitched and ready.',
  'Trade Wind': 'Restored and rolling Trade Winds.',
  Globetrotter: 'The European-flavoured Globetrotter.',
  Basecamp: 'The rugged, go-anywhere Basecamp.',
  Classic: 'The flagship Classic.',
  'Vintage & classic': 'Decades of riveted aluminium — vintage and unspecified models that show the lineage.',
  'Interiors & details': 'Cabins, galleys, and the details that make an Airstream an Airstream.',
  'On the road & campsites': 'Where they actually live: campsites, piers, festivals, and open road.',
};

/** One photo figure with an always-visible attribution caption. */
function photoFigure(p, relRoot = '') {
  const credit = `Photo: ${esc(p.artist)} · ${esc(p.license)}`;
  const cap = p.caption ? `<span class="cphoto-desc">${esc(p.caption)}</span>` : '';
  return `<figure class="cphoto">
<a class="cphoto-link" href="${esc(p.sourceUrl)}" target="_blank" rel="noopener nofollow" title="${esc(p.title)} — view source on ${esc(p.source)}">
<img src="${relRoot}${esc(p.thumb)}" alt="${esc(p.title)}" loading="lazy" width="480" height="360">
</a>
<figcaption class="cphoto-cap">${cap}<span class="cphoto-credit"><a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener nofollow">${credit}</a></span></figcaption>
</figure>`;
}

/**
 * The community gallery page body (sectioned by bucket).
 * `page` is injected from render.mjs to keep this module I/O-free and avoid a cycle.
 */
export function renderCommunityBody(photos, relRoot = '') {
  const sections = groupByBucket(photos)
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
  return `<nav class="detail-nav"><a href="${relRoot}index.html" class="back-link">← All floorplans</a></nav>
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
