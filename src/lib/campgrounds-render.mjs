// Render the campground-fit feature: a per-trailer "where this fits" panel for
// detail pages, and the standalone national Campground Finder page (map + list,
// filtered live by the rig you pick). All data is baked in at build time.
import { statesWithCounts, toClientRecord, photoProxy } from './campgrounds.mjs';
import { trailerFit, nationalFit, hookupMatch, elevationContext, nightsHere, ELEVATION_BANDS } from './campsite-fit.mjs';
import { COLLECTIONS, collectionCounts } from './collections.mjs';
import { formatNights } from './estimate.mjs';
import { formatLength } from './format.mjs';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Canonical (pre-fingerprint) path of the external campground dataset. build.mjs
// writes the JSON here, fingerprints it to assets/data/campgrounds.<hash>.json,
// and rewrites this reference in the HTML to the hashed name (same pass as
// images/js/css). app.js reads it from #cg-data[data-src] and fetches async.
export const CAMP_DATA_REL = 'assets/data/campgrounds.json';

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

/** A single campground card for the detail-page preview list. Shows the HONEST
 * per-site trailer fit (% of sites that take THIS rig) + hookup + elevation,
 * not the legacy single all-equipment max length. */
function cgCard(c, lengthFt, trailer) {
  const where = [c.city, c.state].filter(Boolean).join(', ');
  const tf = trailerFit(c, lengthFt);
  const hm = hookupMatch(c.hookups, c.ampService);
  const ev = elevationContext(c.elevationFt);
  // Headline fit chip: per-site % when we have it, else an honest "unverified".
  let fitChip;
  if (tf.conf === 'per-site') {
    const label = tf.cls === 'fits'
      ? `${tf.pct}% of sites fit`
      : tf.cls === 'tight' ? `Tight — ${tf.pct}% fit` : 'No site takes it';
    fitChip = `<span class="cg-fit cg-fit-${tf.cls}">${esc(label)}</span>`;
  } else {
    fitChip = '<span class="cg-fit cg-fit-unknown">Fit unverified</span>';
  }
  const nTxt = tf.conf === 'per-site'
    ? `${esc((tf.sitesFit + tf.sitesTight).toLocaleString('en-US'))} of ${esc(tf.sitesTotal.toLocaleString('en-US'))} sites`
    : 'Per-site data not published';
  const hookBadge = c.hookups
    ? `<span class="cg-pill cg-pill-hook-${esc(c.hookups)}">${esc(c.hookups === 'full' ? 'Full hookups' : c.hookups === 'electric' ? 'Electric' : 'No hookups')}${c.hookups !== 'none' && Array.isArray(c.ampService) && c.ampService.length ? ` · ${esc(c.ampService.join('/'))}A` : ''}</span>`
    : '';
  const elBadge = ev ? `<span class="cg-pill cg-pill-el-${esc(ev.band)}">${esc(ev.ft.toLocaleString('en-US'))}&prime;</span>` : '';
  const ptBadge = c.hasPullThrough ? '<span class="cg-pill cg-pill-pt">Pull-through</span>' : '';
  // Off-grid line: ONLY where there are no hookups (otherwise solar isn't the
  // story). Uses nightsHere with this park's latitude to refine solar harvest.
  let offgrid = '';
  if (c.hookups === 'none' && trailer && trailer.batteryKwh > 0 && trailer.freshGal > 0) {
    const n = nightsHere(trailer, { people: 2, intensity: 'moderate', season: 'summer', useSolar: true, lat: c.lat });
    offgrid = `<p class="cg-card-offgrid" title="Boondocking estimate: 2 people, moderate use, summer, solar on">~${esc(formatNights(n.days))} off-grid · ${esc(n.limiter === 'power' ? 'battery-limited' : 'water-limited')}</p>`;
  }
  const price = c.price ? `$${c.price.min}${c.price.max && c.price.max !== c.price.min ? `–${c.price.max}` : ''}/night` : '';
  const img = c.photo
    ? `<img src="${esc(photoProxy(c.photo))}" alt="${esc(c.name)}" loading="lazy" class="cg-card-img" width="320" height="200" referrerpolicy="no-referrer">`
    : '<div class="cg-card-img cg-card-noimg" aria-hidden="true">▲</div>';
  return `<a class="cg-card" href="${esc(c.url || '#')}" target="_blank" rel="noopener">
${img}
<div class="cg-card-body">
<div class="cg-card-top">${fitChip}${c.rating ? stars(c.rating) : ''}</div>
<h3 class="cg-card-name">${esc(c.name)}</h3>
<p class="cg-card-where">${esc(where)}${c.org ? ` · ${esc(c.org)}` : ''}</p>
<p class="cg-card-fitline">${esc(nTxt)}</p>
<p class="cg-card-pills">${hookBadge}${ptBadge}${elBadge}</p>
${offgrid}
<p class="cg-card-meta">${price ? `<span>${esc(price)}</span>` : ''}${c.reviews ? `<span>${esc(c.reviews)} reviews</span>` : ''}</p>
</div>
</a>`;
}

/** Rank campgrounds by HONEST per-site fit for this rig: parks where the most
 * (and the highest %) trailer sites actually take the rig, weighted by rating.
 * Parks with no per-site data are excluded from the picks (they'd be a guess). */
function topPicksForRig(campgrounds, lengthFt, limit) {
  const scored = [];
  for (const c of campgrounds) {
    const tf = trailerFit(c, lengthFt);
    if (tf.conf !== 'per-site') continue;
    const usable = tf.sitesFit + tf.sitesTight;
    if (usable <= 0) continue; // can't honestly recommend a park nothing fits
    const rank = (c.rating || 0) * Math.log10((c.reviews || 0) + 1);
    scored.push({ c, tf, usable, rank });
  }
  scored.sort((a, b) => {
    // comfortable fits first, then rating, then how many sites actually fit
    if (b.tf.sitesFit !== a.tf.sitesFit && (b.tf.sitesFit === 0 || a.tf.sitesFit === 0)) {
      return b.tf.sitesFit - a.tf.sitesFit;
    }
    if (b.rank !== a.rank) return b.rank - a.rank;
    return b.usable - a.usable;
  });
  return scored.slice(0, limit).map((s) => s.c);
}

/**
 * Detail-page panel: "Where the <model> <floorplan> fits."
 * Headline stats from the whole dataset + a preview of top-rated campgrounds
 * this exact length can use, with a link into the full finder pre-filtered.
 */
export function renderCampgroundFit(t, campgrounds) {
  const L = t.lengthFt;
  if (!(L > 0) || !campgrounds || !campgrounds.length) return '';
  const nf = nationalFit(campgrounds, L);
  const top = topPicksForRig(campgrounds, L, 6);
  const rigLen = formatLength(L);
  const parkPct = nf.parksVerified ? Math.round((nf.parksFit / nf.parksVerified) * 100) : 0;
  const sitePct = nf.sitesTotal ? Math.round((nf.sitesFit / nf.sitesTotal) * 100) : 0;

  // National honest headline: parks where >=1 trailer SITE actually takes the
  // rig, plus the raw count of trailer sites nationwide that fit. The legacy
  // single-max headline is gone — this is per-site truth, with the unverified
  // parks called out separately instead of folded into a fit.
  const cards = top.length ? top.map((c) => cgCard(c, L, t)).join('\n')
    : '<p class="cg-fit-empty">No campground in the dataset has per-site data confirming a fit for a rig this long. The honest answer: verify lengths directly on Recreation.gov before booking.</p>';

  return `<section class="cgfit" aria-label="Where this fits" data-length="${esc(L)}">
<div class="cg-fit-head">
<h2>Where the ${esc(t.model)} ${esc(t.floorplan)} really fits</h2>
<p class="cg-fit-sub">At ${esc(rigLen)} long (the rig's <em>real</em> trailer length, not a brochure max), this Airstream fits at least one trailer site at <strong>${esc(nf.parksFit.toLocaleString('en-US'))}</strong> of ${esc(nf.parksVerified.toLocaleString('en-US'))} parks with published per-site lengths (<strong>${esc(parkPct)}%</strong>). Counting actual sites: <strong>${esc(nf.sitesFit.toLocaleString('en-US'))}</strong> of ${esc(nf.sitesTotal.toLocaleString('en-US'))} trailer sites nationwide (<strong>${esc(sitePct)}%</strong>) can take it.</p>
</div>
<div class="cg-fit-bars">
${fitBar('Parks that fit it', nf.parksFit, nf.parksVerified, 'fits')}
${fitBar('Parks too short', nf.parksNo, nf.parksVerified, 'no')}
</div>
<p class="cg-fit-honesty"><span class="cg-fit-honesty-icon" aria-hidden="true">▲</span> We use each park's per-site trailer-length data, not a single posted maximum — that figure is the all-equipment (bus/motorhome) number and overstates trailer capacity. ${esc(nf.parksUnverified.toLocaleString('en-US'))} parks publish no per-site lengths and are left out of these counts rather than guessed.</p>
<h3 class="cg-fit-pick">Top spots that genuinely fit your ${esc(rigLen)}</h3>
<div class="cg-card-grid">${cards}</div>
<p class="cg-fit-cta"><a class="cg-fit-link" href="../campgrounds.html?len=${esc(Math.round(L * 10) / 10)}&from=${esc(t.slug)}">Open the full campground finder for this rig →</a></p>
<p class="cg-fit-src muted">Per-site data baked from Recreation.gov's public endpoints across ${esc(campgrounds.length.toLocaleString('en-US'))} RV-capable parks. "Fits" allows ~3′ maneuvering clearance beyond your rig; "tight" means a site takes your exact length but not the buffer. Always confirm the specific site before booking.</p>
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
  const colCounts = collectionCounts(campgrounds);
  const payload = { campgrounds: slim, states: states.length, collections: colCounts, generatedAt: new Date().toISOString().slice(0, 10) };
  // Curated editorial collections rail. Progressive enhancement: it renders as
  // real, crawlable HTML (each chip a button); app.js wires click->filter. With
  // JS off the chips are inert but the page + full list still work. Counts are
  // the honest, build-time totals from collectionCounts (same predicate the
  // baked .cl membership uses), so the label and the filter can never disagree.
  const railChips = COLLECTIONS.map((col) => {
    const n = colCounts[col.key] || 0;
    return `<button type="button" class="cg-col" data-col="${esc(col.key)}" aria-pressed="false" title="${esc(col.blurb)}">`
      + `<span class="cg-col-eyebrow">${esc(col.eyebrow)}</span>`
      + `<span class="cg-col-label">${esc(col.label)}</span>`
      + `<span class="cg-col-count">${esc(n.toLocaleString('en-US'))}</span>`
      + `</button>`;
  }).join('');
  const rail = `<section class="cg-collections" aria-label="Curated collections">
<div class="cg-col-scroll" role="group">
<button type="button" class="cg-col cg-col-all is-on" data-col="" aria-pressed="true"><span class="cg-col-label">All campgrounds</span></button>
${railChips}
</div>
<p class="cg-col-blurb" id="cg-col-blurb" hidden></p>
</section>`;
  const body = `<header class="cg-hero">
<p class="eyebrow">NATIONWIDE</p>
<h1>Campground Finder</h1>
<p class="lede">Every RV-friendly campground on Recreation.gov — <strong>${esc(campgrounds.length.toLocaleString('en-US'))}</strong> sites across <strong>${esc(states.length)}</strong> states — matched to your Airstream's real length. Pick your rig and instantly see where it fits.</p>
</header>
${rail}
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
<div class="cg-ctl">
<label for="cg-hookup">Hookups</label>
<select id="cg-hookup">
<option value="">Any hookups</option>
<option value="electric">Electric or better</option>
<option value="full">Full hookups</option>
<option value="none">Dry camping (no hookups)</option>
</select>
</div>
<div class="cg-ctl">
<label for="cg-elev">Elevation</label>
<select id="cg-elev">
<option value="">Any elevation</option>
${ELEVATION_BANDS.map((b) => `<option value="${esc(b.key)}">${esc(b.label)}</option>`).join('')}
</select>
</div>
<div class="cg-ctl cg-ctl-check">
<label class="cg-check"><input type="checkbox" id="cg-pullthrough"> Pull-through sites</label>
</div>
<button type="button" class="cg-reset" id="cg-reset">Reset</button>
<button type="button" class="cg-share" id="cg-share" title="Copy a link to this exact view">Share view</button>
</section>
<p class="cg-summary" id="cg-summary"></p>
<div class="cg-layout">
<div id="cg-map" class="cg-map" aria-label="Map of campgrounds"><div class="cg-map-loading" aria-hidden="true"><span class="cg-map-loading-pin">▲</span><span class="cg-map-loading-txt">Loading map…</span></div></div>
<div class="cg-list" id="cg-list" aria-live="polite"></div>
</div>
<p class="cg-more" id="cg-more" hidden><button type="button" id="cg-more-btn" class="cg-more-btn">Show more</button></p>
<p class="cg-src muted">Source: Recreation.gov (RIDB), public data, baked ${esc(payload.generatedAt)}. Only campgrounds that advertise RV/trailer/fifth-wheel equipment are included. “Fits” allows ~3 ft of maneuvering clearance beyond your rig; “tight” means the posted limit is between your exact length and that clearance; “no posted limit” means the agency lists none — always confirm site length before booking.</p>
<noscript><p class="cg-src muted">The interactive finder needs JavaScript. With it off, browse models from the menu above or visit Recreation.gov directly.</p></noscript>
<div id="cg-data" data-src="${esc(CAMP_DATA_REL)}" hidden></div>`;

  // The campground dataset is NOT inlined into the HTML anymore. Inlining baked
  // ~905 KB of JSON into a `no-cache` HTML page, so every visit re-downloaded it
  // and the parse blocked first paint. Instead build.mjs writes `payload` to a
  // fingerprinted, immutable-cached file (assets/data/campgrounds.<hash>.json)
  // that app.js fetches async — downloaded once, cached forever, never blocking
  // the list scaffold. Same-origin (Cloudflare Pages), so it loads wherever the
  // page itself does. `data-src` is the canonical path; the build rewrites it to
  // the hashed name in the same pass that fingerprints images/js/css.
  return { body, payload };
}
