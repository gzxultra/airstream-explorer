// Render the campground-fit feature: a per-trailer "where this fits" panel for
// detail pages, and the standalone national Campground Finder page (map + list,
// filtered live by the rig you pick). All data is baked in at build time.
import { fitSummary, campgroundsForLength, statesWithCounts, toClientRecord, FIT_LABEL } from './campgrounds.mjs';
import { formatLength } from './format.mjs';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', PR: 'Puerto Rico', VI: 'U.S. Virgin Islands',
};
const stateName = (code) => STATE_NAMES[code] || code;

function stars(rating) {
  if (!rating) return '';
  return `<span class="cg-stars" aria-label="${esc(rating)} out of 5">★ ${rating.toFixed(1)}</span>`;
}

/** A single campground card (used in the detail-page preview list). */
function cgCard(c, relRoot) {
  const place = [c.name, c.parent && c.parent !== c.name ? c.parent : null].filter(Boolean).join(' · ');
  const where = [c.city, c.state].filter(Boolean).join(', ');
  const fitChip = `<span class="cg-fit cg-fit-${c.fit}">${esc(FIT_LABEL[c.fit])}</span>`;
  const lenTxt = c.maxLengthFt ? `${c.maxLengthFt}&prime; max` : 'No posted limit';
  const price = c.price ? `$${c.price.min}${c.price.max && c.price.max !== c.price.min ? `–${c.price.max}` : ''}/night` : '';
  const img = c.photo
    ? `<img src="${esc(c.photo)}" alt="${esc(c.name)}" loading="lazy" class="cg-card-img" width="320" height="200" referrerpolicy="no-referrer">`
    : '<div class="cg-card-img cg-card-noimg" aria-hidden="true">▲</div>';
  return `<a class="cg-card" href="${esc(c.url || '#')}" target="_blank" rel="noopener">
${img}
<div class="cg-card-body">
<div class="cg-card-top">${fitChip}${c.rating ? stars(c.rating) : ''}</div>
<h3 class="cg-card-name">${esc(c.name)}</h3>
<p class="cg-card-where">${esc(where)}${c.org ? ` · ${esc(c.org)}` : ''}</p>
<p class="cg-card-meta"><span>${lenTxt}</span>${price ? `<span>${esc(price)}</span>` : ''}${c.reviews ? `<span>${esc(c.reviews)} reviews</span>` : ''}</p>
</div>
</a>`;
}

/**
 * Detail-page panel: "Where the <model> <floorplan> fits."
 * Headline stats from the whole dataset + a preview of top-rated campgrounds
 * this exact length can use, with a link into the full finder pre-filtered.
 */
export function renderCampgroundFit(t, campgrounds) {
  const L = t.lengthFt;
  if (!(L > 0) || !campgrounds || !campgrounds.length) return '';
  const sum = fitSummary(campgrounds, L);
  const top = campgroundsForLength(campgrounds, L, { limit: 6, includeUnknown: false });
  const pct = Math.round((sum.usable / sum.total) * 100);
  const cards = top.map((c) => cgCard(c, '../')).join('\n');
  return `<section class="cg-fit" aria-label="Where this fits" data-length="${esc(L)}">
<div class="cg-fit-head">
<h2>Where the ${esc(t.model)} ${esc(t.floorplan)} fits</h2>
<p class="cg-fit-sub">At ${esc(formatLength(L))} long, this rig can use <strong>${esc(sum.usable.toLocaleString('en-US'))}</strong> of ${esc(sum.total.toLocaleString('en-US'))} RV-friendly campgrounds on Recreation.gov (<strong>${esc(pct)}%</strong>) — ${esc(sum.fits.toLocaleString('en-US'))} with comfortable clearance, ${esc(sum.tight.toLocaleString('en-US'))} a tight squeeze, ${esc(sum.no.toLocaleString('en-US'))} too short to take it.</p>
</div>
<div class="cg-fit-bars">
${fitBar('Fits comfortably', sum.fits, sum.total, 'fits')}
${fitBar('Tight fit', sum.tight, sum.total, 'tight')}
${fitBar('No posted limit', sum.unknown, sum.total, 'unknown')}
${fitBar('Too long', sum.no, sum.total, 'no')}
</div>
<h3 class="cg-fit-pick">Top-rated spots that fit it</h3>
<div class="cg-card-grid">${cards}</div>
<p class="cg-fit-cta"><a class="cg-fit-link" href="../campgrounds.html?len=${esc(Math.round(L))}&from=${esc(t.slug)}">Open the full campground finder for this rig →</a></p>
<p class="cg-fit-src muted">Campground data from Recreation.gov, ${esc(campgrounds.length.toLocaleString('en-US'))} RV-capable sites nationwide. Posted max-length limits where the agency lists them; “no posted limit” means none published, not unlimited — confirm before you book.</p>
</section>`;
}

function fitBar(label, n, total, kind) {
  const pct = total ? Math.max(n > 0 ? 1.5 : 0, (n / total) * 100) : 0;
  return `<div class="cg-bar"><span class="cg-bar-label">${esc(label)}</span><span class="cg-bar-track"><span class="cg-bar-fill cg-bar-${kind}" style="width:${pct.toFixed(1)}%"></span></span><span class="cg-bar-val">${esc(n.toLocaleString('en-US'))}</span></div>`;
}

/**
 * Standalone national Campground Finder page. Ships the slim dataset + a trailer
 * length table as JSON; the client renders an interactive map + filtered list.
 */
export function renderCampgroundsPage(campgrounds, trailers) {
  const slim = campgrounds.map(toClientRecord);
  const states = statesWithCounts(campgrounds);
  const stateOpts = ['<option value="">All states</option>']
    .concat(states.map((s) => `<option value="${esc(s.state)}">${esc(stateName(s.state))} (${esc(s.count)})</option>`))
    .join('');
  // trailer picker: real lengths, grouped/sorted; default to a mid-size rig
  const rigs = trailers
    .map((t) => ({ slug: t.slug, label: `${t.model} ${t.floorplan}`, len: Math.round(t.lengthFt * 10) / 10, year: t.year }))
    .sort((a, b) => a.len - b.len);
  const seen = new Set();
  const rigOpts = ['<option value="">Any rig (show all)</option>'];
  for (const r of rigs) {
    const key = `${r.label}|${r.len}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rigOpts.push(`<option value="${esc(r.len)}" data-slug="${esc(r.slug)}">${esc(r.label)} — ${esc(formatLength(r.len))}</option>`);
  }
  const payload = { campgrounds: slim, states: states.length, generatedAt: new Date().toISOString().slice(0, 10) };

  const body = `<header class="cg-hero">
<p class="eyebrow">NATIONWIDE</p>
<h1>Campground Finder</h1>
<p class="lede">Every RV-friendly campground on Recreation.gov — <strong>${esc(campgrounds.length.toLocaleString('en-US'))}</strong> sites across <strong>${esc(states.length)}</strong> states — matched to your Airstream's real length. Pick your rig and instantly see where it fits.</p>
</header>
<section class="cg-controls" aria-label="Filters">
<div class="cg-ctl">
<label for="cg-rig">Your rig</label>
<select id="cg-rig">${rigOpts.join('')}</select>
</div>
<div class="cg-ctl">
<label for="cg-len">Or set length</label>
<div class="cg-len-wrap"><input type="number" id="cg-len" min="10" max="45" step="1" inputmode="numeric" placeholder="ft"> <span class="cg-len-unit">ft</span></div>
</div>
<div class="cg-ctl">
<label for="cg-state">State</label>
<select id="cg-state">${stateOpts}</select>
</div>
<div class="cg-ctl cg-ctl-grow">
<label for="cg-search">Search</label>
<input type="search" id="cg-search" placeholder="Name, park, or town…" autocomplete="off">
</div>
<div class="cg-ctl">
<label for="cg-sort">Sort</label>
<select id="cg-sort">
<option value="rank">Top rated</option>
<option value="reviews">Most reviewed</option>
<option value="length">Max length</option>
<option value="price">Price (low)</option>
<option value="name">Name (A–Z)</option>
</select>
</div>
<div class="cg-ctl cg-ctl-check">
<label class="cg-check"><input type="checkbox" id="cg-hide-unknown"> Only posted limits</label>
<label class="cg-check"><input type="checkbox" id="cg-fits-only"> Comfortable fits only</label>
</div>
<button type="button" class="cg-reset" id="cg-reset">Reset</button>
<button type="button" class="cg-share" id="cg-share" title="Copy a link to this exact view">Share view</button>
</section>
<p class="cg-summary" id="cg-summary"></p>
<div class="cg-layout">
<div id="cg-map" class="cg-map" aria-label="Map of campgrounds"></div>
<div class="cg-list" id="cg-list" aria-live="polite"></div>
</div>
<p class="cg-more" id="cg-more" hidden><button type="button" id="cg-more-btn" class="cg-more-btn">Show more</button></p>
<p class="cg-src muted">Source: Recreation.gov (RIDB), public data, baked ${esc(payload.generatedAt)}. Only campgrounds that advertise RV/trailer/fifth-wheel equipment are included. “Fits” allows ~3 ft of maneuvering clearance beyond your rig; “tight” means the posted limit is between your exact length and that clearance; “no posted limit” means the agency lists none — always confirm site length before booking.</p>
<script type="application/json" id="cg-data">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>`;

  return { body };
}
