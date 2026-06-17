// Overnight Stays — the editor's pick of places to park an Airstream tonight,
// curated from the enriched Recreation.gov campground dataset into two intents:
//
//   • view    — "Big Views": off-grid (no hookups), in or beside a National
//               Park / Forest, where the window is the whole point.
//   • utility — "Full Hookups": electric or full hookups + dump, serviced and
//               comfortable, sized for a real trailer.
//
// Curation + the source data live in scripts/campdata/select-overnight.mjs,
// which writes src/data/overnight.json. This module only RENDERS that file and
// validates it at build time, so the build fails loudly if the data drifts.
// One source of truth for the two lenses is LENS_META below — the hero copy,
// legend, filter chips, and card accents all read from it, so they can never
// disagree. Photos route through the same-origin /cdn/ proxy (China-reachable).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { esc } from './render.mjs';
import { photoProxy } from './campgrounds.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The two intents. Order = how they're surfaced (Big Views leads — it's the
// soul of Airstream travel). `icon` is an inline SVG path-set; these keys are
// the ONLY legal values for a stay's `lens`.
export const LENS_META = {
  view: {
    label: 'Big Views',
    plural: 'Big-view sites',
    tagline: 'Off-grid, in the national parks & forests',
    blurb: 'No hookups — just a real site you can tow into, deep in a national park or forest, where the view out the window is the whole reason you came. Bring water, run on battery and solar.',
    // A mountain range.
    icon: '<path d="M3 20h18"/><path d="M3 20 9 8l4 6 3-4 5 10"/>',
  },
  utility: {
    label: 'Full Hookups',
    plural: 'Full-hookup sites',
    tagline: 'Powered, watered, dump on site',
    blurb: 'Electric or full hookups with a dump station and room for the rig — the comfortable, serviced overnight stops for when you want to top up the batteries, fill the fresh tank, and empty the grays.',
    // A power plug.
    icon: '<path d="M9 2v6M15 2v6"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>',
  },
};
const VALID_LENS = new Set(Object.keys(LENS_META));

/** Load the curated overnight-stays dataset. */
export function loadOvernight(path) {
  const p = path || join(__dirname, '..', 'data', 'overnight.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  if (!data || !Array.isArray(data.stays) || data.stays.length === 0) {
    throw new Error('overnight.json missing stays[]');
  }
  return data;
}

/**
 * Validate the dataset. Returns problem strings (empty = ok). The build treats
 * any problem as fatal — the whole point of this feature is that every card is
 * a place you can actually tow into and trust.
 */
export function validateOvernight(data) {
  const problems = [];
  if (!data || !Array.isArray(data.stays)) return ['overnight: no stays array'];
  const seen = new Set();
  for (const s of data.stays) {
    const tag = s && (s.name || s.id) ? `"${s.name || s.id}"` : '(unnamed)';
    if (!s || typeof s !== 'object') { problems.push('overnight: non-object entry'); continue; }
    if (!s.id) problems.push(`overnight ${tag}: missing id`);
    if (s.id != null) {
      const key = `${s.lens}:${s.id}`;
      if (seen.has(key)) problems.push(`overnight ${tag}: duplicate ${key}`);
      seen.add(key);
    }
    if (!s.name) problems.push(`overnight ${tag}: missing name`);
    if (!VALID_LENS.has(s.lens)) problems.push(`overnight ${tag}: bad lens ${JSON.stringify(s.lens)}`);
    if (!s.state) problems.push(`overnight ${tag}: missing state`);
    // Provenance: a real Recreation.gov url + a photo we can proxy.
    if (!s.url || !/^https?:\/\/(www\.)?recreation\.gov/.test(s.url)) problems.push(`overnight ${tag}: missing/invalid Recreation.gov url`);
    if (!s.photo) problems.push(`overnight ${tag}: missing photo`);
    if (typeof s.lat !== 'number' || typeof s.lon !== 'number') problems.push(`overnight ${tag}: missing coords`);
    if (typeof s.rating !== 'number') problems.push(`overnight ${tag}: missing rating`);
    // Contract: a "view" site must NOT claim hookups; a "utility" site MUST.
    if (s.lens === 'view' && s.hookups && s.hookups !== 'none') problems.push(`overnight ${tag}: view site has hookups ${s.hookups}`);
    if (s.lens === 'utility' && (!s.hookups || s.hookups === 'none')) problems.push(`overnight ${tag}: utility site has no hookups`);
    // Length, when present, must be a believable trailer figure.
    if (s.maxLengthFt != null && (typeof s.maxLengthFt !== 'number' || s.maxLengthFt > 45 || s.maxLengthFt < 10)) {
      problems.push(`overnight ${tag}: implausible maxLengthFt ${s.maxLengthFt}`);
    }
  }
  return problems;
}

/** US state name → USPS code. */
const STATE_ABBR = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
  Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK',
  Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
};

const SMALL = new Set(['of', 'the', 'and', 'at', 'in', 'on', 'a', 'to', 'rec', 'nf']);
export function titleCase(name) {
  if (!name) return '';
  if (name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/[A-Za-z][A-Za-z'.]*/g, (w, i) => {
    if (i > 0 && SMALL.has(w.replace(/\./g, ''))) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
}

function priceText(p) {
  if (!p || typeof p.min !== 'number') return '';
  if (p.min === 0 && (!p.max || p.max === 0)) return 'Free';
  if (p.max && p.max !== p.min) return `$${p.min}–$${p.max}`;
  return `$${p.min}`;
}

// 6996 ft → "6,990 ft" (rounded to a tidy figure; elevation is approximate).
function elevText(ft) {
  if (!ft || ft < 200) return '';
  const r = Math.round(ft / 10) * 10;
  return `${r.toLocaleString('en-US')} ft`;
}

function pill(label, cls) {
  return `<span class="ov-pill${cls ? ' ' + cls : ''}">${esc(label)}</span>`;
}

function lensBadge(lens) {
  const meta = LENS_META[lens];
  if (!meta) return '';
  return `<span class="ov-badge ov-badge--${esc(lens)}">`
    + `<svg class="ov-ico" viewBox="0 0 24 24" aria-hidden="true">${meta.icon}</svg>`
    + `${esc(meta.label)}</span>`;
}

// The pills differ by intent: a view site leads with elevation + what to do; a
// utility site leads with hookups + dump + rig fit.
function statePills(s) {
  const out = [];
  if (s.lens === 'view') {
    const e = elevText(s.elevationFt);
    if (e) out.push(pill(e, 'ov-pill--elev'));
    out.push(pill('No hookups', 'ov-pill--offgrid'));
    if (s.dumpStation) out.push(pill('Dump station', ''));
    if (s.bigRig && s.maxLengthFt == null) out.push(pill('Big-rig friendly', 'ov-pill--len'));
    else if (s.maxLengthFt) out.push(pill(`Up to ${s.maxLengthFt} ft`, 'ov-pill--len'));
  } else {
    const hook = s.hookups === 'full' ? 'Full hookups' : 'Electric hookup';
    out.push(pill(hook, 'ov-pill--power'));
    if (s.dumpStation) out.push(pill('Dump station', ''));
    if (s.drinkingWater) out.push(pill('Drinking water', ''));
    if (s.bigRig && s.maxLengthFt == null) out.push(pill('Big-rig friendly', 'ov-pill--len'));
    else if (s.maxLengthFt) out.push(pill(`Up to ${s.maxLengthFt} ft`, 'ov-pill--len'));
  }
  return out.join('');
}

// One editorial card. Photo routed through the same-origin /cdn/ proxy.
function stayCard(s) {
  const name = titleCase(s.name);
  const abbr = STATE_ABBR[s.state] || s.state;
  const loc = s.city ? `${titleCase(s.city)}, ${esc(abbr)}` : esc(s.state);
  const img = photoProxy(s.photo);
  const rating = `<span class="ov-rating" aria-label="${s.rating} out of 5 from ${s.reviews || 0} reviews"><svg class="ov-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2 1.3-7-5-4.8 7-.9z"/></svg>${s.rating.toFixed(1)}${s.reviews ? ` <span class="ov-reviews">(${s.reviews.toLocaleString('en-US')})</span>` : ''}</span>`;
  const price = priceText(s.price);
  const priceEl = price ? `<span class="ov-price">${esc(price)}<span class="ov-per">/night</span></span>` : '';
  const forest = s.parent ? `<p class="ov-forest">${esc(titleCase(s.parent))}</p>` : '';

  return `<article class="ov-card" data-lens="${esc(s.lens)}" data-name="${esc(name.toLowerCase())}" data-state="${esc(s.state.toLowerCase())}" data-rating="${s.rating}" data-reviews="${s.reviews || 0}" data-price="${(s.price && s.price.min) || 0}">
<a class="ov-media" href="${esc(s.url)}" target="_blank" rel="noopener nofollow">
<img src="${esc(img)}" alt="${esc(name)}" loading="lazy" width="700" height="466">
${lensBadge(s.lens)}
</a>
<div class="ov-body">
<header class="ov-head">
<h3 class="ov-name"><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(name)}</a></h3>
<p class="ov-loc">${loc}</p>
</header>
${forest}
<div class="ov-meta">${rating}${priceEl}</div>
<div class="ov-pills">${statePills(s)}</div>
<a class="ov-link" href="${esc(s.url)}" target="_blank" rel="noopener nofollow">Reserve on Recreation.gov →</a>
</div>
</article>`;
}

// The lens toggle + sort, wired up by app.js overnightFilter(). Server-rendered
// hidden so it never flashes for no-JS readers (who get the full static page).
function filterLens(byLens, total) {
  const chip = (key, label, n, on) =>
    `<button type="button" class="ov-chip${on ? ' is-on' : ''}" data-value="${esc(key)}" aria-pressed="${on ? 'true' : 'false'}">`
    + (LENS_META[key] ? `<svg class="ov-ico" viewBox="0 0 24 24" aria-hidden="true">${LENS_META[key].icon}</svg>` : '')
    + `${esc(label)} <span class="ov-chip-n">${n}</span></button>`;
  const chips = [chip('all', 'All', total, true)]
    .concat(Object.entries(LENS_META).map(([k, m]) => chip(k, m.label, byLens[k] || 0, false)))
    .join('');
  return `<div class="ov-lens" id="ov-lens" hidden>
<div class="ov-lens-chips" role="group" aria-label="Filter by stay type">${chips}</div>
<label class="ov-sort">Sort
<select id="ov-sort">
<option value="rating">Top rated</option>
<option value="reviews">Most reviewed</option>
<option value="price-asc">Price: low to high</option>
<option value="price-desc">Price: high to low</option>
</select>
</label>
<span class="ov-count" id="ov-count"></span>
</div>
<p class="ov-empty" id="ov-empty" hidden>Nothing matches. <button type="button" class="linkbtn" id="ov-empty-reset">Show all</button></p>`;
}

// The two-lens explainer strip under the hero.
function lensLegend(byLens) {
  const rows = Object.entries(LENS_META).map(([key, m]) => {
    const n = byLens[key] || 0;
    return `<div class="ov-legend-card ov-legend-card--${esc(key)}">
<span class="ov-legend-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${m.icon}</svg></span>
<div class="ov-legend-text">
<h3 class="ov-legend-name">${esc(m.label)} <span class="ov-legend-n">${n}</span></h3>
<p class="ov-legend-tag">${esc(m.tagline)}</p>
<p class="ov-legend-blurb">${esc(m.blurb)}</p>
</div>
</div>`;
  }).join('');
  return `<section class="ov-legend">${rows}</section>`;
}

/**
 * The Overnight Stays page body. `relRoot` lets it live at site root ('').
 * Server-rendered in full so it works with no JS; app.js enhances it.
 */
export function renderOvernightBody(data, relRoot = '') {
  const stays = data.stays.slice();
  const byLens = data.byLens || stays.reduce((m, s) => { m[s.lens] = (m[s.lens] || 0) + 1; return m; }, {});
  // Order: Big Views first, then by rating, then a log of reviews, then name —
  // so the most iconic, best-reviewed places lead each lens.
  const lensOrder = Object.keys(LENS_META);
  stays.sort((a, b) => {
    const l = lensOrder.indexOf(a.lens) - lensOrder.indexOf(b.lens);
    if (l) return l;
    const r = (b.rating || 0) - (a.rating || 0);
    if (r) return r;
    const rev = (b.reviews || 0) - (a.reviews || 0);
    if (rev) return rev;
    return titleCase(a.name).localeCompare(titleCase(b.name));
  });
  const total = stays.length;
  const states = new Set(stays.map((s) => s.state)).size;
  const cards = stays.map(stayCard).join('\n');

  return `<nav class="detail-nav"><a href="${relRoot}index.html" class="back-link">← All families</a></nav>
<header class="hero-head">
<p class="eyebrow">OVERNIGHT STAYS · PUBLIC LANDS</p>
<h1>Park the Airstream tonight</h1>
<p class="lede">${total} hand-picked places to spend the night on US public land — ${byLens.view || 0} off-grid sites where the view is the whole point, and ${byLens.utility || 0} full-hookup sites with power, water and a dump on site. Every one fits a real trailer and is bookable through Recreation.gov, across ${states} states.</p>
</header>
${lensLegend(byLens)}
${filterLens(byLens, total)}
<main class="ov-wrap" id="ov-main">
<div class="ov-grid">${cards}</div>
</main>
<p class="ov-foot muted">Hand-picked from public Recreation.gov (RIDB) data — rated 4.5★ or higher, road-accessible to a trailer, no tent-only or hike-in sites. Ratings, prices, length limits and availability change; confirm on each facility's Recreation.gov page before you go. Trailer length shown only where the published figure is reliable. Independent reference, not affiliated with Recreation.gov.</p>`;
}
