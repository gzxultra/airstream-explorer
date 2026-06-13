// HTML rendering — pure functions returning strings. No DOM, no I/O.
// All dynamic text goes through esc() to stay XSS/CSP-safe.

import {
  formatMsrp, formatWeight, formatLength, formatGal, formatTanks,
  trailerTitle, trailerLabel,
} from './format.mjs';
import { assetPaths } from './data.mjs';

/** Escape text for HTML body/attribute context. */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function page({ title, description, body, relRoot = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${relRoot}assets/css/site.css">
</head>
<body>
${body}
<footer class="site-footer">
<p>Airstream Explorer · enthusiast catalog · ${59} floorplans (2026 + 2025).</p>
<p class="muted">Independent reference. Not affiliated with Airstream, Inc. Specs compiled from published sources; verify with a dealer before purchase. Some imagery is AI-generated and labeled accordingly.</p>
</footer>
<script src="${relRoot}assets/js/app.js" defer></script>
</body>
</html>`;
}

function specRow(label, value) {
  return `<div class="spec"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

function tagChips(tags) {
  if (!tags || !tags.length) return '';
  return `<ul class="chips">${tags
    .map((t) => `<li class="chip">${esc(t)}</li>`)
    .join('')}</ul>`;
}

/** A catalog card (home grid). Links to the detail page. */
export function renderCard(t, resolve = assetPaths) {
  const a = resolve(t);
  return `<a class="card" href="m/${esc(t.slug)}.html" data-year="${esc(t.year)}" data-model="${esc(t.model)}">
<div class="card-media">
<img src="${esc(a.thumb)}" alt="${esc(trailerTitle(t))}" loading="lazy" width="400" height="260">
<span class="card-year">${esc(t.year)}</span>
</div>
<div class="card-body">
<h2 class="card-title">${esc(t.model)} <span>${esc(t.floorplan)}</span></h2>
<dl class="card-specs">
${specRow('Length', formatLength(t.lengthFt))}
${specRow('Dry weight', formatWeight(t.weightLb))}
${specRow('MSRP', formatMsrp(t.msrp))}
</dl>
</div>
</a>`;
}

/** The home/catalog page. */
export function renderIndex(trailers, models, resolve = assetPaths) {
  const cards = trailers.map((t) => renderCard(t, resolve)).join('\n');
  const modelOpts = ['<option value="all">All models</option>']
    .concat(models.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`))
    .join('');
  const body = `<header class="hero-head">
<p class="eyebrow">AIRSTREAM · 2026 + 2025</p>
<h1>Airstream Explorer</h1>
<p class="lede">A cinematic, spec-accurate field guide to every current Airstream travel-trailer floorplan — built for fans.</p>
</header>
<section class="controls" aria-label="Filters">
<div class="seg" role="group" aria-label="Model year">
<button type="button" class="seg-btn is-active" data-year="all">All</button>
<button type="button" class="seg-btn" data-year="2026">2026</button>
<button type="button" class="seg-btn" data-year="2025">2025</button>
</div>
<label class="select-wrap">Model
<select id="model-filter">${modelOpts}</select>
</label>
<span class="count" id="result-count">${trailers.length} floorplans</span>
</section>
<main class="cards" id="cards">
${cards}
</main>`;
  return page({
    title: 'Airstream Explorer — every travel-trailer floorplan',
    description: 'A spec-accurate, cinematic catalog of all 59 current Airstream travel-trailer floorplans (2026 + 2025): dimensions, weights, tanks, off-grid, and pricing.',
    body,
  });
}

/** A single trailer detail page. */
export function renderDetail(t, resolve = assetPaths) {
  const a = resolve(t);
  const heroImg = a.hero
    ? `<img src="../${esc(a.hero)}" alt="${esc(trailerTitle(t))}" class="detail-hero-img" width="1280" height="720">`
    : '';
  const gallery = a.gallery
    .map(
      (g, i) =>
        `<img src="../${esc(g)}" alt="${esc(trailerLabel(t))} photo ${i + 1}" loading="lazy" class="gallery-img" width="920" height="600">`,
    )
    .join('\n');
  const pros = (t.pros || []).map((p) => `<li>${esc(p)}</li>`).join('');
  const cons = (t.cons || []).map((c) => `<li>${esc(c)}</li>`).join('');
  const note = t.specNote
    ? `<p class="spec-note">${esc(t.specNote)}</p>`
    : '';
  const body = `<nav class="detail-nav"><a href="../index.html" class="back-link">← All floorplans</a></nav>
<article class="detail">
<header class="detail-head">
<p class="eyebrow">${esc(t.year)} MODEL YEAR</p>
<h1>${esc(t.model)} <span>${esc(t.floorplan)}</span></h1>
${tagChips(t.tags)}
</header>
<div class="detail-hero">${heroImg}</div>
<p class="detail-desc">${esc(t.description)}</p>
<section class="spec-table" aria-label="Specifications">
<h2>Specifications</h2>
<dl class="specs-grid">
${specRow('Length', formatLength(t.lengthFt))}
${specRow('Dry weight', formatWeight(t.weightLb))}
${specRow('GVWR', formatWeight(t.gvwrLb))}
${specRow('Cargo capacity (CCC)', formatWeight(t.cccLb))}
${specRow('Hitch weight', formatWeight(t.hitchWeightLb))}
${specRow('Sleeps', String(t.sleeps))}
${specRow('Fresh / gray / black', formatTanks(t.freshGal, t.grayGal, t.blackGal))}
${specRow('Solar', t.solarW ? `${t.solarW} W${t.solarStandard ? ' (standard)' : ''}` : '—')}
${specRow('Battery', t.batteryKwh ? `${t.batteryKwh} kWh` : '—')}
${specRow('Off-grid score', `${t.offGridScore} / 100`)}
${specRow('MSRP', formatMsrp(t.msrp))}
</dl>
${note}
</section>
${pros || cons ? `<section class="proscons">
${pros ? `<div class="pros"><h3>Strengths</h3><ul>${pros}</ul></div>` : ''}
${cons ? `<div class="cons"><h3>Trade-offs</h3><ul>${cons}</ul></div>` : ''}
</section>` : ''}
${gallery ? `<section class="gallery" aria-label="Gallery"><h2>Gallery</h2><div class="gallery-grid">${gallery}</div></section>` : ''}
</article>`;
  return page({
    title: `${trailerTitle(t)} — specs, weights & price`,
    description: `${trailerTitle(t)}: ${formatLength(t.lengthFt)}, ${formatWeight(t.weightLb)} dry, sleeps ${t.sleeps}, ${formatMsrp(t.msrp)}. Full specs, tanks, off-grid and gallery.`,
    body,
    relRoot: '../',
  });
}
