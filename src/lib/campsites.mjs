// Campsites hub — the one place to answer "where do I park the Airstream tonight?"
//
// This unifies what used to be two separate pages (Campgrounds + Overnight
// Stays) plus a new third intent (Boondocking) under THREE first-class lenses:
//
//   • view      — "Big Views": off-grid (no hookups), in/beside a National Park
//                 or Forest, bookable on Recreation.gov. VERIFIED gov data.
//   • utility   — "Full Hookups": electric/full hookups + dump, serviced and
//                 sized for a real trailer, bookable on Recreation.gov. VERIFIED.
//   • boondock  — "Boondocking": free, first-come dispersed sites on USFS/BLM
//                 land, sourced from OpenStreetMap (ODbL). UNVERIFIED community
//                 data — no photo, no rating, by design. We label it honestly.
//
// The first two lenses reuse the curated overnight.json (Recreation.gov / RIDB).
// The third reads src/data/boondocking.json (built by
// scripts/campdata/normalize-boondock.mjs). This module loads + validates both,
// and renders the merged page. The build (scripts/build.mjs) treats any data
// problem as fatal, so the page can never ship with a fabricated rating/photo
// on a community site or a broken gov card.
//
// LENS_META below is the single source of truth for all three lenses — hero
// copy, legend cards, filter chips, and per-card accents all read from it so
// they can never disagree. Gov photos route through the same-origin /cdn/ proxy
// (China-reachable). Boondocking cards carry NO photo and render an editorial
// illustration placeholder instead of a broken image.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { esc } from './render.mjs';
import { photoProxy, orgShort } from './campgrounds.mjs';
import {
  LENS_META as STAY_LENS_META, loadOvernight, titleCase,
} from './overnight.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// LENS_META — the three intents. Order = how they surface (Big Views leads, the
// soul of Airstream travel; Boondocking last, the wild/free option). The first
// two mirror overnight.mjs exactly; `boondock` is new. `tier` records the data
// trust level so cards can render an honest provenance treatment.
// ---------------------------------------------------------------------------
export const LENS_META = {
  view: {
    ...STAY_LENS_META.view,
    tier: 'verified',
    source: 'Recreation.gov',
  },
  utility: {
    ...STAY_LENS_META.utility,
    tier: 'verified',
    source: 'Recreation.gov',
  },
  boondock: {
    label: 'Boondocking',
    plural: 'Boondocking sites',
    tagline: 'Free, first-come, off the grid',
    blurb: 'Free dispersed camping on national forest and BLM land — no hookups, no reservations, no fee. Community-mapped from OpenStreetMap, so treat each as a lead to verify, not a booking: confirm the access road, current rules, and that the spot still exists before you commit the rig.',
    // A compass/wayfinding star — the "find your own spot" motif.
    icon: '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/><path d="M15 9l-2.5 5.5L9 15l2.5-5.5z"/>',
    tier: 'community',
    source: 'OpenStreetMap',
  },
};
const VALID_LENS = new Set(Object.keys(LENS_META));

// ---------------------------------------------------------------------------
// Boondocking data: load + validate.
// ---------------------------------------------------------------------------

/** Load the normalized boondocking dataset (OSM/ODbL dispersed sites). */
export function loadBoondocking(path) {
  const p = path || join(__dirname, '..', 'data', 'boondocking.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  if (!data || !Array.isArray(data.sites) || data.sites.length === 0) {
    throw new Error('boondocking.json missing sites[]');
  }
  return data;
}

/**
 * Validate the boondocking dataset. Returns problem strings (empty = ok); the
 * build treats any problem as fatal. The whole point: a community site must
 * stay HONEST — real coordinates, real OSM provenance, and crucially NEVER a
 * fabricated rating, photo, or price. If one of those sneaks in, fail loudly.
 */
export function validateBoondocking(data) {
  const problems = [];
  if (!data || !Array.isArray(data.sites)) return ['boondocking: no sites array'];
  const seen = new Set();
  for (const s of data.sites) {
    const tag = s && (s.name || s.id) ? `"${s.name || s.id}"` : '(unnamed)';
    if (!s || typeof s !== 'object') { problems.push('boondocking: non-object entry'); continue; }
    if (!s.id) problems.push(`boondock ${tag}: missing id`);
    if (s.id != null) {
      if (seen.has(s.id)) problems.push(`boondock ${tag}: duplicate id ${s.id}`);
      seen.add(s.id);
    }
    if (!s.name) problems.push(`boondock ${tag}: missing name`);
    if (typeof s.lat !== 'number' || typeof s.lon !== 'number') problems.push(`boondock ${tag}: missing coords`);
    if (s.lat != null && (s.lat < 24 || s.lat > 50)) problems.push(`boondock ${tag}: lat out of US range`);
    if (s.lon != null && (s.lon < -125 || s.lon > -66)) problems.push(`boondock ${tag}: lon out of US range`);
    // Provenance is mandatory and must be OSM.
    if (s.source !== 'OpenStreetMap') problems.push(`boondock ${tag}: source must be OpenStreetMap, got ${JSON.stringify(s.source)}`);
    if (s.verified !== false) problems.push(`boondock ${tag}: must be marked verified:false`);
    if (!s.osmUrl || !/^https?:\/\/(www\.)?openstreetmap\.org\//.test(s.osmUrl)) problems.push(`boondock ${tag}: missing/invalid osmUrl`);
    // The accuracy bar: community sites must NOT carry fabricated gov-grade data.
    if (s.rating != null) problems.push(`boondock ${tag}: must not carry a rating (got ${s.rating})`);
    if (s.reviews != null) problems.push(`boondock ${tag}: must not carry reviews (got ${s.reviews})`);
    if (s.photo != null) problems.push(`boondock ${tag}: must not carry a photo (got ${s.photo})`);
    // Boondocking is dry + first-come by definition.
    if (s.hookups && s.hookups !== 'none') problems.push(`boondock ${tag}: boondocking can't have hookups (${s.hookups})`);
    if (s.reservation && s.reservation !== 'first-come') problems.push(`boondock ${tag}: boondocking is first-come (${s.reservation})`);
    if (s.maxLengthFt != null && (typeof s.maxLengthFt !== 'number' || s.maxLengthFt > 45 || s.maxLengthFt < 10)) {
      problems.push(`boondock ${tag}: implausible maxLengthFt ${s.maxLengthFt}`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Rendering. view/utility cards reuse the exact `ov-` card markup (so they look
// identical to the old Overnight page). boondock cards use the same shell with
// an `ov-card--boondock` modifier: an illustrated placeholder instead of a
// photo, and an honest provenance block instead of a fabricated rating.
// ---------------------------------------------------------------------------

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

function priceText(p) {
  if (!p || typeof p.min !== 'number') return '';
  if (p.min === 0 && (!p.max || p.max === 0)) return 'Free';
  if (p.max && p.max !== p.min) return `$${p.min}–$${p.max}`;
  return `$${p.min}`;
}
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

// ---- VERIFIED gov card (view + utility), identical structure to overnight ----
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

function govCard(s) {
  const name = titleCase(s.name);
  const abbr = STATE_ABBR[s.state] || s.state;
  const loc = s.city ? `${titleCase(s.city)}, ${esc(abbr)}` : esc(s.state);
  const img = photoProxy(s.photo);
  const rating = `<span class="ov-rating" aria-label="${s.rating} out of 5 from ${s.reviews || 0} reviews"><svg class="ov-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2 1.3-7-5-4.8 7-.9z"/></svg>${s.rating.toFixed(1)}${s.reviews ? ` <span class="ov-reviews">(${s.reviews.toLocaleString('en-US')})</span>` : ''}</span>`;
  const price = priceText(s.price);
  const priceEl = price ? `<span class="ov-price">${esc(price)}<span class="ov-per">/night</span></span>` : '';
  const forest = s.parent ? `<p class="ov-forest">${esc(titleCase(s.parent))}</p>` : '';

  return `<article class="ov-card" data-lens="${esc(s.lens)}" data-tier="verified" data-name="${esc(name.toLowerCase())}" data-state="${esc(s.state.toLowerCase())}" data-rating="${s.rating}" data-reviews="${s.reviews || 0}" data-price="${(s.price && s.price.min) || 0}">
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

// ---- COMMUNITY boondocking card: honest, premium, no fake photo/rating ----
const AGENCY_LABEL = {
  USFS: 'National Forest', BLM: 'BLM land', NPS: 'National Park Service', State: 'State land',
};

// A calm line-art landscape that fills the media slot where a photo would be —
// so the card reads as "wild & unmapped", not "broken image". Uses the same
// copper/ink palette as the rest of the site via currentColor.
function boondockArt(seedName) {
  // tiny deterministic variation so a wall of cards isn't identical
  let h = 0; for (let i = 0; i < seedName.length; i++) h = (h * 31 + seedName.charCodeAt(i)) & 255;
  const sun = 60 + (h % 30);
  return `<svg class="bd-art" viewBox="0 0 700 466" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs><linearGradient id="bdsky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#f4ead9"/><stop offset="1" stop-color="#e7d7bf"/></linearGradient></defs>
<rect width="700" height="466" fill="url(#bdsky)"/>
<circle cx="${sun * 6}" cy="120" r="46" fill="#e9b878" opacity="0.55"/>
<path d="M0 320 L150 200 L260 300 L360 180 L470 300 L590 210 L700 310 L700 466 L0 466 Z" fill="#b98a52" opacity="0.5"/>
<path d="M0 370 L120 290 L230 360 L340 270 L460 360 L580 300 L700 360 L700 466 L0 466 Z" fill="#8a6638" opacity="0.6"/>
<path d="M0 410 L700 410 L700 466 L0 466 Z" fill="#6f5230" opacity="0.7"/>
</svg>`;
}

function boondockCard(s) {
  const name = titleCase(s.name);
  const abbr = STATE_ABBR[s.state] || s.state || '';
  const loc = abbr ? esc(abbr) : 'Public land';
  const agency = s.agency ? (AGENCY_LABEL[s.agency] || s.agency) : 'Public land';
  const pills = [];
  pills.push(pill('Free', 'ov-pill--free'));
  pills.push(pill('First-come', 'ov-pill--fcfs'));
  pills.push(pill('No hookups', 'ov-pill--offgrid'));
  const e = elevText(s.elevationFt);
  if (e) pills.push(pill(e, 'ov-pill--elev'));
  if (s.maxLengthFt) pills.push(pill(`Up to ${s.maxLengthFt} ft`, 'ov-pill--len'));

  const coords = `${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}`;
  const geo = `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=14/${s.lat}/${s.lon}`;

  return `<article class="ov-card ov-card--boondock" data-lens="boondock" data-tier="community" data-name="${esc(name.toLowerCase())}" data-state="${esc((s.state || '').toLowerCase())}" data-rating="0" data-reviews="0" data-price="0">
<div class="ov-media bd-media">
${boondockArt(name)}
${lensBadge('boondock')}
</div>
<div class="ov-body">
<header class="ov-head">
<h3 class="ov-name">${esc(name)}</h3>
<p class="ov-loc">${esc(agency)}${abbr ? ` · ${loc}` : ''}</p>
</header>
<p class="bd-provenance"><svg class="bd-prov-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>Unverified · mapped by OpenStreetMap — confirm before you go</p>
<div class="ov-pills">${pills.join('')}</div>
<p class="bd-coords"><span class="bd-coord-label">Approx.</span> ${esc(coords)}</p>
<div class="bd-links">
<a class="ov-link" href="${esc(geo)}" target="_blank" rel="noopener nofollow">Open map →</a>
<a class="bd-osm" href="${esc(s.osmUrl)}" target="_blank" rel="noopener nofollow">Source</a>
</div>
</div>
</article>`;
}

function card(item) {
  return item.lens === 'boondock' ? boondockCard(item) : govCard(item);
}

// ---- MAP: one dot per site, colored by lens, on a China-safe basemap -------
// All three lenses share ONE interactive map above the grid, so the page
// finally delivers the "one map and one list" the hero promises. The dataset
// is tiny (~150 points), so it ships inline as a CSP-safe JSON island (no
// fetch, no inline JS) that app.js (campsitesMap) reads by id; the client
// lazy-loads MapLibre, plots the points, and keeps them in sync with the lens
// filter chips. Dot colors mirror the per-lens accents used everywhere else
// (view-green / utility-copper / boondock slate-indigo).
function mapPoint(s) {
  const name = titleCase(s.name);
  const abbr = STATE_ABBR[s.state] || s.state || '';
  if (s.lens === 'boondock') {
    const agency = s.agency ? (AGENCY_LABEL[s.agency] || s.agency) : 'Public land';
    return {
      i: String(s.id), l: 'boondock', t: 'community',
      n: name, s: abbr ? `${agency} · ${abbr}` : agency,
      y: s.lat, x: s.lon,
      u: `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=14/${s.lat}/${s.lon}`,
    };
  }
  const loc = s.city ? `${titleCase(s.city)}, ${abbr}` : (abbr || s.state);
  const pt = {
    i: String(s.id), l: s.lens, t: 'verified',
    n: name, s: loc,
    y: s.lat, x: s.lon,
    u: s.url,
  };
  if (typeof s.rating === 'number') pt.r = s.rating;
  const p = priceText(s.price);
  if (p) pt.p = p;
  return pt;
}

/** The map payload: every campsite that has real coordinates, as a compact
 *  point. Filters out anything missing lat/lon so the map never plots a
 *  fabricated or null location. */
export function buildCampsiteMapData(overnight, boondocking) {
  const stays = (overnight.stays || []).map((s) => ({ ...s, lens: s.lens }));
  const boon = (boondocking.sites || []).map((s) => ({ ...s, lens: 'boondock' }));
  return stays.concat(boon)
    .filter((s) => typeof s.lat === 'number' && typeof s.lon === 'number')
    .map(mapPoint);
}

/** The map element + its CSP-safe JSON data island. Server-rendered hidden
 *  scaffolding only — app.js upgrades it to a live MapLibre map, and the page
 *  works fine (full list below) if the map never loads. */
function mapBlock(points) {
  // Only </ needs neutralizing inside <script type="application/json">.
  const json = JSON.stringify(points).replace(/</g, '\\u003c');
  return `<section class="cs-map-wrap" aria-label="Map of all campsites">
<div id="cs-map" class="cs-map">
<div class="cs-map-loading" aria-hidden="true"><span class="cs-map-loading-pin">▲</span><span class="cs-map-loading-txt">Loading map…</span></div>
</div>
<p class="cs-map-note muted">Every site below, plotted by type — <span class="cs-dot cs-dot--view"></span> Big Views, <span class="cs-dot cs-dot--utility"></span> Full Hookups, <span class="cs-dot cs-dot--boondock"></span> Boondocking. Filter with the chips above; the map follows. Boondocking pins are community-mapped and unverified.</p>
</section>
<script type="application/json" id="cs-map-data">${json}</script>`;
}

// ---- legend + filter (three lenses) ----
function lensLegend(byLens) {
  const rows = Object.entries(LENS_META).map(([key, m]) => {
    const n = byLens[key] || 0;
    const tierChip = m.tier === 'community'
      ? '<span class="ov-legend-tier ov-legend-tier--community">Community data</span>'
      : '<span class="ov-legend-tier ov-legend-tier--verified">Recreation.gov</span>';
    return `<div class="ov-legend-card ov-legend-card--${esc(key)}">
<span class="ov-legend-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${m.icon}</svg></span>
<div class="ov-legend-text">
<h3 class="ov-legend-name">${esc(m.label)} <span class="ov-legend-n">${n}</span></h3>
<p class="ov-legend-tag">${esc(m.tagline)} ${tierChip}</p>
<p class="ov-legend-blurb">${esc(m.blurb)}</p>
</div>
</div>`;
  }).join('');
  return `<section class="ov-legend ov-legend--3">${rows}</section>`;
}

function filterLens(byLens, total) {
  const chip = (key, label, n, on) =>
    `<button type="button" class="ov-chip${on ? ' is-on' : ''}" data-value="${esc(key)}" aria-pressed="${on ? 'true' : 'false'}">`
    + (LENS_META[key] ? `<svg class="ov-ico" viewBox="0 0 24 24" aria-hidden="true">${LENS_META[key].icon}</svg>` : '')
    + `${esc(label)} <span class="ov-chip-n">${n}</span></button>`;
  const chips = [chip('all', 'All', total, true)]
    .concat(Object.entries(LENS_META).map(([k, m]) => chip(k, m.label, byLens[k] || 0, false)))
    .join('');
  return `<div class="ov-lens" id="ov-lens" hidden>
<div class="ov-lens-chips" role="group" aria-label="Filter by campsite type">${chips}</div>
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

/**
 * The Campsites hub body. Merges curated overnight stays (view + utility) with
 * boondocking sites into one lens-filtered grid. `relRoot` lets it live at the
 * site root (''). Server-rendered in full so it works with no JS; app.js
 * enhances it via the shared overnightFilter() (it keys off #ov-lens/#ov-main).
 */
export function renderCampsitesBody(overnight, boondocking, relRoot = '') {
  const stays = (overnight.stays || []).map((s) => ({ ...s, lens: s.lens }));
  const boon = (boondocking.sites || []).map((s) => ({ ...s, lens: 'boondock' }));
  const all = stays.concat(boon);

  const byLens = all.reduce((m, s) => { m[s.lens] = (m[s.lens] || 0) + 1; return m; }, {});
  const lensOrder = Object.keys(LENS_META);

  // Verified gov cards sort by rating/reviews; boondock has none, so it sorts
  // by name and always trails its lens group. Big Views → Full Hookups →
  // Boondocking.
  all.sort((a, b) => {
    const l = lensOrder.indexOf(a.lens) - lensOrder.indexOf(b.lens);
    if (l) return l;
    const r = (b.rating || 0) - (a.rating || 0);
    if (r) return r;
    const rev = (b.reviews || 0) - (a.reviews || 0);
    if (rev) return rev;
    return titleCase(a.name).localeCompare(titleCase(b.name));
  });

  const total = all.length;
  const states = new Set(all.map((s) => s.state).filter(Boolean)).size;
  const cards = all.map(card).join('\n');
  const mapData = buildCampsiteMapData(overnight, boondocking);

  return `<nav class="detail-nav"><a href="${relRoot}index.html" class="back-link">← All families</a></nav>
<header class="hero-head">
<p class="eyebrow">CAMPSITES · PUBLIC LANDS</p>
<h1>Where to park the Airstream</h1>
<p class="lede">${total} places to spend the night on US public land, in one map and one list — ${byLens.view || 0} off-grid sites where the view is the whole point, ${byLens.utility || 0} full-hookup sites with power, water and a dump, and ${byLens.boondock || 0} free first-come boondocking spots out in the national forests and BLM country. Filter by what tonight calls for, across ${states} states.</p>
</header>
${lensLegend(byLens)}
${filterLens(byLens, total)}
${mapBlock(mapData)}
<main class="ov-wrap" id="ov-main">
<div class="ov-grid">${cards}</div>
</main>
<p class="ov-foot muted">Big Views and Full Hookups are hand-picked from public Recreation.gov (RIDB) data — rated 4.5★+, road-accessible to a trailer, no tent-only or hike-in sites. Boondocking sites are community-mapped from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener nofollow">OpenStreetMap</a> (ODbL) and are <strong>unverified</strong>: no reservations, and access, road condition and current rules change — always confirm before you go. Ratings, prices, length limits and availability change too; confirm on each facility's page. Independent reference, not affiliated with Recreation.gov.</p>`;
}
