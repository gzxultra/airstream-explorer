// HTML rendering — pure functions returning strings. No DOM, no I/O.
// All dynamic text goes through esc() to stay XSS/CSP-safe.

import {
  formatMsrp, formatWeight, formatLength, formatGal, formatTanks,
  formatPriceRange, formatLengthRange, formatMsrpShort,
  recommendedTowRating, hitchPctOfGvwr,
  trailerTitle, trailerLabel,
} from './format.mjs';
import { assetPaths, familySlug } from './data.mjs';
import { SORT_KEYS, exploreTags, tagLabel } from './explore.mjs';

/** Escape text for HTML body/attribute context. */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function page({ title, description, body, relRoot = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${relRoot}assets/css/site.css">
</head>
<body>
<header class="topnav">
<a class="brandbar" href="${relRoot}index.html"><span class="brandbar-mark">▲</span> Airstream Explorer</a>
<nav class="topnav-links" aria-label="Primary">
<a href="${relRoot}index.html">Families</a>
<a href="${relRoot}explore.html">Explore &amp; match</a>
<a href="${relRoot}compare.html">Compare</a>
<a href="${relRoot}community.html">Community</a>
</nav>
</header>
${body}
<footer class="site-footer">
<p>Airstream Explorer · enthusiast catalog · ${31} floorplans across 12 families (2026 + 2025). · <a href="${relRoot}explore.html">Explore &amp; match</a> · <a href="${relRoot}compare.html">Compare</a> · <a href="${relRoot}community.html">Community photos</a> · <a href="${relRoot}credits.html">Credits</a></p>
<p class="muted">Independent reference. Not affiliated with Airstream, Inc. Specs compiled from published sources; verify with a dealer before purchase. Some imagery is AI-generated and labeled accordingly; community photographs are real and used under their stated Creative Commons / public-domain licenses (see credits).</p>
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

// ---------------------------------------------------------------------------
// HOME: family grid
// ---------------------------------------------------------------------------

/**
 * A family card for the home grid: cinematic hero + name + range stats.
 * `linkPrefix` is prepended to hrefs/img (''=root page, '../'=nested page).
 */
export function renderFamilyCard(fam, linkPrefix = '') {
  const range = formatPriceRange(fam.priceMin, fam.priceMax);
  const len = formatLengthRange(fam.lengthMin, fam.lengthMax);
  const plans = `${fam.floorplanCount} floorplan${fam.floorplanCount === 1 ? '' : 's'}`;
  const limited = fam.limited ? '<span class="fam-flag">Limited edition</span>' : '';
  const yrs = fam.years.join(' + ');
  return `<a class="fam" href="${linkPrefix}f/${esc(fam.slug)}.html" data-family="${esc(fam.family)}">
<div class="fam-media">
<img src="${linkPrefix}${esc(fam.hero)}" alt="Airstream ${esc(fam.family)}" loading="lazy" width="800" height="500">
${limited}
<span class="fam-plans">${esc(plans)}</span>
</div>
<div class="fam-body">
<h2 class="fam-name">${esc(fam.family)}</h2>
<p class="fam-range">${esc(range)}</p>
<dl class="fam-stats">
${specRow('Length', len)}
${specRow('Sleeps', 'up to ' + fam.sleepsMax)}
${specRow('Years', yrs)}
</dl>
</div>
</a>`;
}

/** The home/catalog page — 12 family cards, budget to flagship. */
export function renderIndex(families) {
  const cards = families.map((f) => renderFamilyCard(f, '')).join('\n');
  const totalPlans = families.reduce((n, f) => n + f.floorplanCount, 0);
  const body = `<header class="hero-head">
<p class="eyebrow">AIRSTREAM · 2026 + 2025</p>
<h1>Every Airstream, by family</h1>
<p class="lede">A cinematic, spec-accurate field guide to the current Airstream travel-trailer lineup — ${families.length} families, ${totalPlans} floorplans. Start with a family, then dive into each floorplan’s full specs.</p>
<p class="hero-cta"><a href="community.html">Browse real community photos →</a></p>
</header>
<main class="fam-grid" id="families">
${cards}
</main>`;
  return page({
    title: 'Airstream Explorer — the full travel-trailer lineup by family',
    description: `A spec-accurate, cinematic catalog of every current Airstream travel-trailer family (2026 + 2025): ${families.length} families, ${totalPlans} floorplans, with dimensions, weights, off-grid and pricing.`,
    body,
  });
}

// ---------------------------------------------------------------------------
// FAMILY: floorplans within one model
// ---------------------------------------------------------------------------

/** A floorplan card (used on family pages). `linkPrefix` reaches the m/ dir. */
export function renderCard(t, resolve = assetPaths, linkPrefix = '', hidden = false) {
  const a = resolve(t);
  return `<a class="card" href="${linkPrefix}m/${esc(t.slug)}.html" data-year="${esc(t.year)}"${hidden ? ' hidden' : ''}>
<div class="card-media">
<img src="${linkPrefix}${esc(a.thumb)}" alt="${esc(trailerTitle(t))}" loading="lazy" width="400" height="260">
<span class="card-year">${esc(t.year)}</span>
</div>
<div class="card-body">
<h3 class="card-title">${esc(t.model)} <span>${esc(t.floorplan)}</span></h3>
<dl class="card-specs">
${specRow('Length', formatLength(t.lengthFt))}
${specRow('Dry weight', formatWeight(t.weightLb))}
${specRow('MSRP', formatMsrp(t.msrp))}
</dl>
</div>
</a>`;
}

/** A family page: hero banner + the floorplans in that family. relRoot='../'. */
export function renderFamily(fam, resolve = assetPaths) {
  const hasBothYears = fam.years.length > 1;
  // Default the view to the latest model year so each distinct floorplan shows
  // once at its current price (the hero count and the visible count then agree).
  // "All" stays one tap away for anyone who wants to compare model years.
  const latest = fam.years[0];
  const yearSeg = hasBothYears
    ? `<div class="seg" role="group" aria-label="Model year">
${fam.years
  .map(
    (y, i) =>
      `<button type="button" class="seg-btn${i === 0 ? ' is-active' : ''}" data-year="${esc(y)}">${esc(y)}</button>`,
  )
  .join('\n')}
<button type="button" class="seg-btn" data-year="all">All years</button>
</div>`
    : '';
  const cards = fam.trailers
    .map((t) => renderCard(t, resolve, '../', hasBothYears && t.year !== latest))
    .join('\n');
  const range = formatPriceRange(fam.priceMin, fam.priceMax);
  const len = formatLengthRange(fam.lengthMin, fam.lengthMax);
  const limited = fam.limited ? '<span class="fam-flag fam-flag-inline">Limited edition</span>' : '';
  // Initial visible count = floorplans shown on load. With the latest year
  // selected that's one card per distinct floorplan, matching the hero count.
  const shownCount = hasBothYears
    ? fam.trailers.filter((t) => t.year === latest).length
    : fam.trailers.length;
  const body = `<nav class="detail-nav"><a href="../index.html" class="back-link">← All families</a></nav>
<header class="fam-hero">
<img class="fam-hero-img" src="../${esc(fam.hero)}" alt="Airstream ${esc(fam.family)}" width="1280" height="720">
<div class="fam-hero-overlay">
<p class="eyebrow eyebrow-light">AIRSTREAM ${esc(fam.years.join(' + '))}</p>
<h1>${esc(fam.family)} ${limited}</h1>
<p class="fam-hero-meta">${esc(range)} · ${esc(len)} · ${esc(fam.floorplanCount)} floorplan${fam.floorplanCount === 1 ? '' : 's'} · sleeps up to ${esc(fam.sleepsMax)}</p>
</div>
</header>
<section class="controls" aria-label="Filters">
${yearSeg}
<span class="count" id="result-count">${shownCount} floorplan${shownCount === 1 ? '' : 's'}</span>
</section>
<main class="cards" id="cards">
${cards}
</main>`;
  return page({
    title: `Airstream ${fam.family} — floorplans, specs & prices`,
    description: `Every Airstream ${fam.family} floorplan (${fam.years.join(' + ')}): ${range}, ${len}, sleeps up to ${fam.sleepsMax}. Compare ${fam.floorplanCount} floorplan${fam.floorplanCount === 1 ? '' : 's'} with full specs.`,
    body,
    relRoot: '../',
  });
}

// ---------------------------------------------------------------------------
// DETAIL: one floorplan
// ---------------------------------------------------------------------------

/** A single trailer detail page. */
export function renderDetail(t, resolve = assetPaths) {
  const a = resolve(t);
  const fam = familySlug(t.model);
  const heroImg = a.hero
    ? `<img src="../${esc(a.hero)}" alt="${esc(trailerTitle(t))}" class="detail-hero-img" width="1280" height="720">`
    : '';
  const gallery = a.gallery
    .map(
      (g, i) =>
        `<img src="../${esc(g)}" alt="${esc(trailerLabel(t))} photo ${i + 1}" loading="lazy" class="gallery-img" width="920" height="600">`,
    )
    .join('\n');
  const floorplanSection = a.floorplan
    ? `<section class="floorplan" aria-label="Floor plan"><h2>Floor plan</h2><figure class="floorplan-fig"><img src="../${esc(a.floorplan)}" alt="${esc(trailerLabel(t))} floor plan diagram" loading="lazy" class="floorplan-img" width="820" height="1332"><figcaption class="muted">Official Airstream ${esc(t.floorplan)} floor plan</figcaption></figure></section>`
    : '';
  const pros = (t.pros || []).map((p) => `<li>${esc(p)}</li>`).join('');
  const cons = (t.cons || []).map((c) => `<li>${esc(c)}</li>`).join('');
  const note = t.specNote
    ? `<p class="spec-note">${esc(t.specNote)}</p>`
    : '';
  const towRating = recommendedTowRating(t.gvwrLb);
  const hitchPct = hitchPctOfGvwr(t.hitchWeightLb, t.gvwrLb);
  const towCallout = towRating
    ? `<section class="tow-callout" aria-label="Towing">
<div class="tow-callout-main">
<p class="tow-callout-label">Recommended minimum tow rating</p>
<p class="tow-callout-value">${formatWeight(towRating)}<span>or more</span></p>
</div>
<p class="tow-callout-note">Sized so this floorplan's fully-loaded GVWR of ${esc(formatWeight(t.gvwrLb))} sits at a comfortable ~80% of your tow vehicle's limit${hitchPct ? `. Hitch weight is ${esc(formatWeight(t.hitchWeightLb))} (~${hitchPct}% of GVWR)` : ''}. <a href="../explore.html">Match it to your vehicle →</a></p>
</section>`
    : '';
  const body = `<nav class="detail-nav"><a href="../f/${esc(fam)}.html" class="back-link">← All ${esc(t.model)} floorplans</a></nav>
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
${towCallout}
${floorplanSection}
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

// ---------------------------------------------------------------------------
// EXPLORE: every floorplan in one place — search, sort, filter, tow-match.
// ---------------------------------------------------------------------------

/**
 * One explore-grid card. Carries every value the client filter/sort/compare
 * needs in data-* attributes, so all interactivity is client-side over static
 * HTML (no JSON fetch, CSP-safe). `resolve` gives real on-disk thumb paths.
 */
export function renderExploreCard(t, resolve = assetPaths, hidden = false) {
  const a = resolve(t);
  const tags = (t.tags || []).join(' ');
  return `<article class="xcard" data-slug="${esc(t.slug)}" data-model="${esc(t.model)}" data-floorplan="${esc(t.floorplan)}" data-year="${esc(t.year)}" data-msrp="${esc(t.msrp)}" data-weight="${esc(t.weightLb)}" data-gvwr="${esc(t.gvwrLb)}" data-length="${esc(t.lengthFt)}" data-sleeps="${esc(t.sleeps)}" data-offgrid="${esc(t.offGridScore)}" data-tags="${esc(tags)}" data-name="${esc((t.model + ' ' + t.floorplan).toLowerCase())}"${hidden ? ' hidden' : ''}>
<a class="xcard-link" href="m/${esc(t.slug)}.html">
<div class="xcard-media">
<img src="${esc(a.thumb)}" alt="${esc(trailerTitle(t))}" loading="lazy" width="400" height="260">
<span class="xcard-year">${esc(t.year)}</span>
</div>
<div class="xcard-body">
<h3 class="xcard-title">${esc(t.model)} <span>${esc(t.floorplan)}</span></h3>
<dl class="xcard-specs">
${specRow('Length', formatLength(t.lengthFt))}
${specRow('Dry weight', formatWeight(t.weightLb))}
${specRow('Sleeps', String(t.sleeps))}
${specRow('MSRP', formatMsrp(t.msrp))}
</dl>
</div>
</a>
<div class="xcard-foot">
<span class="xcard-fit" data-fit hidden></span>
<label class="xcard-compare"><input type="checkbox" class="cmp-box" data-slug="${esc(t.slug)}" aria-label="Add ${esc(trailerLabel(t))} to compare"> Compare</label>
</div>
</article>`;
}

/** The Explore & match page. `trailers` is the full (unsorted) dataset. */
export function renderExplore(trailers, resolve = assetPaths) {
  const sortOpts = Object.entries(SORT_KEYS)
    .map(([k, def], i) => `<option value="${esc(k)}"${i === 0 ? ' selected' : ''}>${esc(def.label)}</option>`)
    .join('');
  const tagChips = exploreTags(trailers)
    .map((tag) => `<button type="button" class="tagfilter" data-tag="${esc(tag)}" aria-pressed="false">${esc(tagLabel(tag))}</button>`)
    .join('');
  // Server-render the DEFAULT view correctly so the page is right without JS
  // and on first paint: latest model year (2026) visible, sorted cheapest-first;
  // 2025 twins emitted but hidden (one tap to "Both"). The client then manages
  // visibility/sort on interaction — same robust pattern as the family pages.
  const ordered = [...trailers].sort(
    (a, b) => a.msrp - b.msrp || `${a.model} ${a.floorplan}`.localeCompare(`${b.model} ${b.floorplan}`),
  );
  const cards = ordered.map((t) => renderExploreCard(t, resolve, t.year !== 2026)).join('\n');
  const total = trailers.filter((t) => t.year === 2026).length;
  const body = `<header class="explore-head">
<p class="eyebrow">FIND YOUR FLOORPLAN</p>
<h1>Explore &amp; match</h1>
<p class="lede">Search, sort and filter all ${trailers.length} floorplans — then enter your tow vehicle's rating to see exactly what you can pull, safely.</p>
</header>
<section class="tow-tool" aria-label="Tow vehicle matcher">
<div class="tow-tool-inner">
<div class="tow-field">
<label for="tow-input">Your tow vehicle's max tow rating</label>
<div class="tow-input-row">
<input type="number" id="tow-input" inputmode="numeric" min="1000" max="20000" step="100" placeholder="e.g. 7000">
<span class="tow-unit">lb</span>
<button type="button" id="tow-clear" class="tow-clear" hidden>Clear</button>
</div>
<p class="tow-hint">Check your truck's door jamb or owner's manual. We compare it to each trailer's <strong>fully-loaded GVWR</strong> — not dry weight — the way Airstream recommends.</p>
</div>
<div class="tow-presets" aria-label="Common tow vehicles">
<span class="tow-presets-label">Quick set:</span>
<button type="button" class="tow-preset" data-tow="3500">SUV ~3,500</button>
<button type="button" class="tow-preset" data-tow="5000">Midsize ~5,000</button>
<button type="button" class="tow-preset" data-tow="7700">Half-ton ~7,700</button>
<button type="button" class="tow-preset" data-tow="10000">¾-ton ~10,000</button>
</div>
</div>
<p class="tow-summary" id="tow-summary" hidden></p>
</section>
<section class="explore-controls" aria-label="Search and filter">
<div class="xc-row">
<div class="xc-search">
<input type="search" id="x-search" placeholder="Search model or floorplan…" aria-label="Search floorplans">
</div>
<div class="xc-sort">
<label for="x-sort">Sort</label>
<select id="x-sort">${sortOpts}</select>
</div>
<div class="xc-year">
<label for="x-year">Year</label>
<select id="x-year"><option value="2026" selected>2026</option><option value="2025">2025</option><option value="">Both</option></select>
</div>
</div>
<div class="xc-row xc-row-2">
<div class="xc-tags" role="group" aria-label="Use case">${tagChips}</div>
<div class="xc-sleeps">
<label for="x-sleeps">Sleeps ≥</label>
<select id="x-sleeps"><option value="">Any</option><option value="2">2</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="8">8</option></select>
</div>
<button type="button" class="xc-reset" id="x-reset">Reset</button>
</div>
</section>
<p class="xcount"><span id="x-count">${total}</span> floorplans</p>
<main class="xgrid" id="xgrid">
${cards}
</main>
<p class="xempty" id="x-empty" hidden>No floorplans match those filters. <button type="button" class="linklike" id="x-empty-reset">Reset filters</button></p>
<div class="cmp-bar" id="cmp-bar" hidden>
<span class="cmp-bar-text"><strong id="cmp-count">0</strong> selected</span>
<div class="cmp-bar-actions">
<button type="button" class="cmp-bar-clear" id="cmp-clear">Clear</button>
<a class="cmp-bar-go" id="cmp-go" href="compare.html">Compare →</a>
</div>
</div>`;
  return page({
    title: 'Explore & match — every Airstream floorplan, by the numbers',
    description: `Search, sort and filter all ${trailers.length} Airstream floorplans by price, weight, sleeps and use. Enter your tow vehicle rating to see what you can safely tow.`,
    body,
  });
}

// ---------------------------------------------------------------------------
// COMPARE: side-by-side spec sheet for up to 3 floorplans (client-populated).
// ---------------------------------------------------------------------------

/**
 * The compare page. Renders an empty shell + a hidden JSON island with the
 * full dataset (compact) so the client can build the table from ?ids=… without
 * a network call. The JSON is escaped for safe embedding in a script tag.
 */
export function renderCompare(trailers, resolve = assetPaths) {
  const compact = trailers.map((t) => {
    const a = resolve(t);
    return {
      slug: t.slug, model: t.model, floorplan: t.floorplan, year: t.year,
      thumb: a.thumb, lengthFt: t.lengthFt, weightLb: t.weightLb, gvwrLb: t.gvwrLb,
      cccLb: t.cccLb, hitchWeightLb: t.hitchWeightLb, sleeps: t.sleeps,
      freshGal: t.freshGal, grayGal: t.grayGal, blackGal: t.blackGal,
      solarW: t.solarW, batteryKwh: t.batteryKwh, offGridScore: t.offGridScore, msrp: t.msrp,
    };
  });
  // Safe JSON for <script type="application/json">: only </ needs neutralizing.
  const json = JSON.stringify(compact).replace(/</g, '\\u003c');
  const body = `<header class="explore-head">
<p class="eyebrow">SIDE BY SIDE</p>
<h1>Compare floorplans</h1>
<p class="lede">Pick up to three floorplans and see every spec lined up. Add them from the <a href="explore.html">Explore</a> page, or search below.</p>
</header>
<section class="cmp-pick" aria-label="Pick floorplans">
<input type="search" id="cmp-search" placeholder="Search to add a floorplan…" aria-label="Search floorplans to compare" autocomplete="off">
<ul class="cmp-suggest" id="cmp-suggest" hidden></ul>
<div class="cmp-chosen" id="cmp-chosen"></div>
</section>
<div class="cmp-table-wrap" id="cmp-table-wrap" hidden>
<table class="cmp-table" id="cmp-table"></table>
</div>
<p class="cmp-placeholder" id="cmp-placeholder">Nothing selected yet. Search above or pick from <a href="explore.html">Explore &amp; match</a>.</p>
<script type="application/json" id="cmp-data">${json}</script>`;
  return page({
    title: 'Compare Airstream floorplans side by side',
    description: 'Line up to three Airstream floorplans side by side: length, weight, GVWR, cargo, tanks, off-grid and price.',
    body,
  });
}
