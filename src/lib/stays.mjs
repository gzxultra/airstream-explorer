// Unique overnight stays — fire lookouts, cabins/guard stations, and a
// designated-dispersed area, all from Recreation.gov (RIDB). These are the
// once-in-a-lifetime places to park an Airstream nearby or sleep in the
// structure itself: a 1940s granite fire lookout at 11,000 ft, a guard station
// in the Ochoco, a dispersed OHV basin under a historic lookout tower.
//
// Two contracts, both enforced by validateStays() so the build fails loudly if
// the data drifts:
//   1. Provenance: every stay has a real Recreation.gov url + a photo. Nothing
//      is invented; this is public RIDB data only.
//   2. Classification: stayType is one of the fixed TYPE_META keys below. The
//      collector mis-coded 34 lookouts as cabins (Recreation.gov files many
//      lookouts under a CABIN campsite_type); reclassify-stays.mjs corrected
//      them by name. The single source of truth for type label/icon/blurb is
//      TYPE_META here in code, so the legend, badges, and filter chips can
//      never disagree.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { esc } from './render.mjs';
import { photoProxy } from './campgrounds.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The stay taxonomy. Order = how they're surfaced (rarest/most iconic first).
// `icon` is an inline SVG path-set rendered into the badge + filter chip;
// `blurb` explains the type in the legend. These keys are the ONLY legal
// values for a stay's `stayType`.
export const TYPE_META = {
  lookout: {
    label: 'Fire Lookout',
    plural: 'Fire lookouts',
    blurb: 'Historic fire-spotting towers and cabs you rent for the night — usually a steep hike or high-clearance drive in, with 360° ridgeline views and few or no facilities.',
    // A little watchtower on a peak.
    icon: '<path d="M12 2 6 8v3h12V8z"/><path d="M8 11v9M16 11v9M5 20h14M9 11v9M15 11v9"/>',
  },
  cabin: {
    label: 'Cabin / Guard Station',
    plural: 'Cabins & guard stations',
    blurb: 'Forest Service rental cabins and historic guard stations — four walls, a roof, often a wood stove. A warm base camp when the weather turns.',
    // A simple gabled cabin.
    icon: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  },
  dispersed: {
    label: 'Dispersed Area',
    plural: 'Dispersed areas',
    blurb: 'Designated dispersed camping — numbered, low-service sites spread across a recreation area. Room to park the trailer off-grid, by reservation.',
    // Tent + dots for spread-out sites.
    icon: '<path d="M12 4 4 19h16z"/><path d="M12 4v15"/><circle cx="5" cy="20" r="1"/><circle cx="19" cy="20" r="1"/>',
  },
};
const VALID_TYPES = new Set(Object.keys(TYPE_META));

/** Load the stays dataset. */
export function loadStays(path) {
  const p = path || join(__dirname, '..', 'data', 'stays.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  if (!data || !Array.isArray(data.stays) || data.stays.length === 0) {
    throw new Error('stays.json missing stays[]');
  }
  return data;
}

/**
 * Validate the dataset. Returns an array of problem strings (empty = ok).
 * The build treats a non-empty result as fatal.
 */
export function validateStays(data) {
  const problems = [];
  if (!data || !Array.isArray(data.stays)) return ['stays: no stays array'];
  const seen = new Set();
  for (const s of data.stays) {
    const tag = s && (s.name || s.id) ? `"${s.name || s.id}"` : '(unnamed)';
    if (!s || typeof s !== 'object') { problems.push('stays: non-object entry'); continue; }
    if (!s.id) problems.push(`stays ${tag}: missing id`);
    if (s.id != null) {
      if (seen.has(String(s.id))) problems.push(`stays ${tag}: duplicate id ${s.id}`);
      seen.add(String(s.id));
    }
    if (!s.name) problems.push(`stays ${tag}: missing name`);
    if (!VALID_TYPES.has(s.stayType)) problems.push(`stays ${tag}: bad stayType ${JSON.stringify(s.stayType)}`);
    if (!s.state) problems.push(`stays ${tag}: missing state`);
    // Provenance: a real Recreation.gov url + a photo we can proxy.
    if (!s.url || !/^https?:\/\//.test(s.url)) problems.push(`stays ${tag}: missing/invalid url`);
    if (!s.photo) problems.push(`stays ${tag}: missing photo`);
    if (typeof s.lat !== 'number' || typeof s.lon !== 'number') problems.push(`stays ${tag}: missing coords`);
    if (s.price != null) {
      if (typeof s.price !== 'object' || typeof s.price.min !== 'number') problems.push(`stays ${tag}: bad price`);
    }
  }
  return problems;
}

/** US state name → USPS code, for the compact location line. */
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

// Title-case a SHOUTY Recreation.gov name without mangling acronyms/roman
// numerals. "GARNET MOUNTAIN FIRE LOOKOUT" → "Garnet Mountain Fire Lookout";
// "MTN." stays "Mtn."; an already-mixed-case name is left alone.
const SMALL = new Set(['of', 'the', 'and', 'at', 'in', 'on', 'a', 'to', 'rec', 'nf']);
export function titleCase(name) {
  if (!name) return '';
  if (name !== name.toUpperCase()) return name; // already mixed-case: trust it
  return name.toLowerCase().replace(/[A-Za-z][A-Za-z'.]*/g, (w, i) => {
    if (i > 0 && SMALL.has(w.replace(/\./g, ''))) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
}

function priceText(p) {
  if (!p || typeof p.min !== 'number') return '';
  if (p.max && p.max !== p.min) return `$${p.min}–$${p.max}/night`;
  return `$${p.min}/night`;
}

function pill(label, cls) {
  return `<span class="stay-pill${cls ? ' ' + cls : ''}">${esc(label)}</span>`;
}

function typeBadge(type) {
  const meta = TYPE_META[type];
  if (!meta) return '';
  return `<span class="stay-badge stay-badge--${esc(type)}">`
    + `<svg class="stay-ico" viewBox="0 0 24 24" aria-hidden="true">${meta.icon}</svg>`
    + `${esc(meta.label)}</span>`;
}

// One editorial card. Photo always routed through the same-origin /cdn/ proxy
// so it loads from mainland China and matches the campground photos.
function stayCard(s) {
  const name = titleCase(s.name);
  const abbr = STATE_ABBR[s.state] || s.state;
  const loc = s.city ? `${titleCase(s.city)}, ${esc(abbr)}` : esc(s.state);
  const img = photoProxy(s.photo);
  const rating = (typeof s.rating === 'number')
    ? `<span class="stay-rating" aria-label="${s.rating} out of 5 from ${s.reviews || 0} reviews"><svg class="stay-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2 1.3-7-5-4.8 7-.9z"/></svg>${s.rating.toFixed(1)}${s.reviews ? ` <span class="stay-reviews">(${s.reviews})</span>` : ''}</span>`
    : '';
  const price = priceText(s.price);
  const priceEl = price ? `<span class="stay-price">${esc(price)}</span>` : '';
  const len = (typeof s.maxLengthFt === 'number' && s.maxLengthFt > 0)
    ? pill(`Up to ${s.maxLengthFt} ft`, 'stay-pill--len')
    : '';
  const resv = s.reservable
    ? pill('Reservable', 'stay-pill--ok')
    : pill('First-come', 'stay-pill--fcfs');
  const sites = (typeof s.sites === 'number' && s.sites > 1)
    ? pill(`${s.sites} sites`, '')
    : '';
  const forest = s.parent ? `<p class="stay-forest">${esc(titleCase(s.parent))}</p>` : '';
  const meta = TYPE_META[s.stayType];

  return `<article class="stay-card" data-type="${esc(s.stayType)}" data-name="${esc(name.toLowerCase())}" data-state="${esc(s.state.toLowerCase())}">
<a class="stay-media" href="${esc(s.url)}" target="_blank" rel="noopener nofollow">
<img src="${esc(img)}" alt="${esc(name)}" loading="lazy" width="700" height="466">
${typeBadge(s.stayType)}
</a>
<div class="stay-body">
<header class="stay-head">
<h3 class="stay-name"><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(name)}</a></h3>
<p class="stay-loc">${loc}</p>
</header>
${forest}
<div class="stay-meta">${rating}${priceEl}</div>
<div class="stay-pills">${resv}${len}${sites}</div>
<a class="stay-link" href="${esc(s.url)}" target="_blank" rel="noopener nofollow">View on Recreation.gov →</a>
</div>
</article>`;
}

/** The legend explaining the three stay types. Sourced from TYPE_META. */
function staysLegend(byType) {
  const rows = Object.entries(TYPE_META).map(([key, m]) => {
    const n = byType[key] || 0;
    return `<div class="stay-legend-row">
<span class="stay-legend-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${m.icon}</svg></span>
<span class="stay-legend-name">${esc(m.label)} <span class="stay-legend-n">${n}</span></span>
<span class="stay-legend-blurb">${esc(m.blurb)}</span>
</div>`;
  }).join('');
  return `<div class="stay-legend">${rows}</div>`;
}

/** The filter lens — segmented controls the app.js staysFilter() wires up. */
function filterLens(byType, total) {
  const chips = Object.entries(TYPE_META).map(([key, m]) => {
    const n = byType[key] || 0;
    if (!n) return '';
    return `<button type="button" class="stay-chip" data-filter="type" data-value="${esc(key)}" aria-pressed="false">
<svg class="stay-ico" viewBox="0 0 24 24" aria-hidden="true">${m.icon}</svg>${esc(m.label)} <span class="stay-chip-n">${n}</span></button>`;
  }).join('');
  return `<div class="stay-lens" id="stay-lens" hidden>
<div class="stay-lens-chips">
<button type="button" class="stay-chip is-on" data-filter="type" data-value="all" aria-pressed="true">All <span class="stay-chip-n">${total}</span></button>
${chips}
</div>
<div class="stay-lens-foot">
<span class="stay-lens-count" id="stay-count"></span>
</div>
</div>
<p class="stay-empty" id="stay-empty" hidden>No stays of that type. <button type="button" class="linkbtn" id="stay-empty-reset">Show all</button></p>`;
}

/**
 * The Unique Stays page body. `relRoot` lets it live at site root ('').
 * Server-rendered in full so it works with no JS; app.js enhances filtering.
 */
export function renderStaysBody(data, relRoot = '') {
  const stays = data.stays.slice();
  // Stable, meaningful order: type (lookout→cabin→dispersed), then rating desc,
  // then name. So the most iconic, best-reviewed places lead each group.
  const typeOrder = Object.keys(TYPE_META);
  stays.sort((a, b) => {
    const t = typeOrder.indexOf(a.stayType) - typeOrder.indexOf(b.stayType);
    if (t) return t;
    const r = (b.rating || 0) - (a.rating || 0);
    if (r) return r;
    return titleCase(a.name).localeCompare(titleCase(b.name));
  });

  const byType = data.byType || stays.reduce((m, s) => {
    m[s.stayType] = (m[s.stayType] || 0) + 1; return m;
  }, {});
  const total = stays.length;
  const states = new Set(stays.map((s) => s.state)).size;
  const cards = stays.map(stayCard).join('\n');

  return `<nav class="detail-nav"><a href="${relRoot}index.html" class="back-link">← All families</a></nav>
<header class="hero-head">
<p class="eyebrow">UNIQUE OVERNIGHT STAYS · PUBLIC LANDS</p>
<h1>Sleep somewhere unforgettable</h1>
<p class="lede">${total} once-in-a-lifetime places on US public land — historic fire lookouts, backcountry cabins and guard stations, and a designated dispersed basin — across ${states} states. Park the Airstream nearby, or trade it for a night in the tower. All bookable through Recreation.gov.</p>
</header>
${staysLegend(byType)}
${filterLens(byType, total)}
<main class="stays" id="stay-main">
<div class="stay-grid">${cards}</div>
</main>
<p class="stay-foot muted">Public data courtesy of Recreation.gov (RIDB). Ratings, prices, and availability change — confirm on each facility's Recreation.gov page before you go. Many lookouts require a strenuous hike or high-clearance vehicle and have no water, power, or road access for a trailer; read the facility notes. Independent reference, not affiliated with Recreation.gov or the US Forest Service.</p>`;
}
