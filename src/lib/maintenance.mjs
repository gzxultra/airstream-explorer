// Maintenance schedule — a real, sourced service calendar for an Airstream
// travel trailer, organized by cadence (before-every-trip → seasonal).
//
// Same accuracy contract as upgrades.mjs, enforced by validateMaintenance() so
// the build fails loudly if the data drifts:
//   1. Provenance: every task carries at least one real http(s) source link.
//      The whole point of this page is that the intervals are traceable to a
//      primary source (Airstream's own schedule, Dexter, Suburban/Dometic,
//      the tire industry) — never invented.
//   2. Classification: every task declares a `cadence` (from CADENCE_META) and
//      a `severity` (from SEVERITY_META). Those scales live here in code as the
//      single source of truth, so the legend, the badges, and the filter lens
//      can never disagree with each other.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { esc } from './render.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The cadence scale. Order = most frequent first. `short` is the badge label;
// `blurb` explains it in the legend. These keys are the ONLY legal values for a
// task's `cadence` field and a category's items should match its own cadence.
export const CADENCE_META = {
  trip: { short: 'Every trip', blurb: 'A quick walkaround before you tow.' },
  monthly: { short: 'Monthly', blurb: 'Every ~1,000 miles or 60 days — Airstream\u2019s most-frequent block.' },
  quarterly: { short: 'Quarterly', blurb: 'Every ~5,000 miles or 90 days — lubrication and moving hardware.' },
  semiannual: { short: 'Twice a year', blurb: 'Every ~10,000 miles or 6 months — brakes, bearings, tires, wax.' },
  annual: { short: 'Annual', blurb: 'Once a year — structure, sealant, propane, tire age.' },
  multiyear: { short: 'Every few years', blurb: 'Long-interval replacements (detectors, tires by age).' },
  seasonal: { short: 'Seasonal', blurb: 'Winterize and de-winterize around freezing storage.' },
};
const VALID_CADENCE = new Set(Object.keys(CADENCE_META));

// The severity scale. `pips` (out of PIP_MAX) drives the meter; `short` is the
// chip; `cls` colors the badge; `blurb` explains it in the legend.
export const PIP_MAX = 3;
export const SEVERITY_META = {
  safety: {
    short: 'Safety-critical',
    pips: 3,
    cls: 'is-safety',
    blurb: 'A failure here can cause loss of control, a wheel separation, fire, or CO exposure. Do not defer.',
  },
  preventive: {
    short: 'Prevents damage',
    pips: 2,
    cls: 'is-preventive',
    blurb: 'Cheap now, costly if skipped — water intrusion, corrosion, tank or appliance failure.',
  },
  upkeep: {
    short: 'Routine care',
    pips: 1,
    cls: 'is-upkeep',
    blurb: 'Keeps things working smoothly and protects resale; a missed cycle won\u2019t hurt the trailer.',
  },
};
const VALID_SEVERITY = new Set(Object.keys(SEVERITY_META));

/** Load the maintenance dataset. */
export function loadMaintenance(path) {
  const p = path || join(__dirname, '..', 'data', 'maintenance.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  if (!data || !Array.isArray(data.categories) || data.categories.length === 0) {
    throw new Error('maintenance.json missing categories[]');
  }
  return data;
}

/** Validate the dataset. Returns array of problem strings (empty = ok). */
export function validateMaintenance(data) {
  const problems = [];
  if (!data || !Array.isArray(data.categories)) {
    return ['maintenance: no categories array'];
  }
  if (!data.intro) problems.push('maintenance: missing intro');

  const ids = new Set();
  for (const cat of data.categories) {
    if (!cat.id) problems.push('category missing id');
    if (ids.has(cat.id)) problems.push(`duplicate category id: ${cat.id}`);
    ids.add(cat.id);
    if (!cat.title) problems.push(`${cat.id}: missing title`);
    if (!Array.isArray(cat.items) || cat.items.length === 0) {
      problems.push(`${cat.id}: no items`);
      continue;
    }
    for (const it of cat.items) {
      const tag = `${cat.id}/${it.name || '?'}`;
      if (!it.name) problems.push(`${cat.id}: item missing name`);
      if (!it.why) problems.push(`${tag}: missing why`);
      if (!it.doThis) problems.push(`${tag}: missing doThis (the actionable step)`);
      if (!it.intervalText) problems.push(`${tag}: missing intervalText`);
      if (!it.appliesTo) problems.push(`${tag}: missing appliesTo`);
      if (it.image && !/^assets\/img\/maintenance\/[a-z0-9-]+\.webp$/.test(it.image)) {
        problems.push(`${tag}: image, if present, must be assets/img/maintenance/<slug>.webp, got "${it.image}"`);
      }
      if (!VALID_CADENCE.has(it.cadence)) {
        problems.push(`${tag}: bad cadence "${it.cadence}"`);
      }
      if (!VALID_SEVERITY.has(it.severity)) {
        problems.push(`${tag}: bad severity "${it.severity}"`);
      }
      // Provenance contract — at least one real http(s) source per task.
      if (!Array.isArray(it.sources) || it.sources.length === 0) {
        problems.push(`${tag}: needs at least one source`);
      } else {
        for (const s of it.sources) {
          if (!s.label || !s.url) problems.push(`${tag}: source missing label/url`);
          else if (!/^https?:\/\//.test(s.url)) problems.push(`${tag}: source url not http(s): ${s.url}`);
        }
      }
    }
  }
  return problems;
}

/** Slug a label so it can ride as a CSS class / data attribute token. */
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Per-cadence line icons (inline SVG, currentColor stroke). Editorial, not
// photographic — a service calendar reads as information, and this honors the
// site's no-AI-imagery rule while still giving each card a visual anchor.
const CADENCE_ICON = {
  trip: '<path d="M3 12h13l-2-3M3 12l2 3M16 8h2.5a2 2 0 0 1 1.8 1.1L22 12v3a1 1 0 0 1-1 1h-1"/><circle cx="7.5" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
  monthly: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/><circle cx="8" cy="14" r="1.1" fill="currentColor" stroke="none"/>',
  quarterly: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  semiannual: '<path d="M12 3.5a8.5 8.5 0 1 1-8.2 6.2"/><path d="M3.2 4.5v5h5"/>',
  annual: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/><path d="M9 15l2 2 4-4"/>',
  multiyear: '<circle cx="12" cy="12" r="8.5"/><path d="M9 12l2 2 4-4"/>',
  seasonal: '<path d="M12 3v18M12 7l-3-2.5M12 7l3-2.5M12 17l-3 2.5M12 17l3 2.5M4.5 8l15 8M4.5 8l.7 3.8M4.5 8l3.6-1.2M19.5 16l-.7-3.8M19.5 16l-3.6 1.2"/>',
};

/** The per-cadence header icon for a card. */
function cadenceIcon(cadence) {
  const inner = CADENCE_ICON[cadence] || CADENCE_ICON.annual;
  return `<svg class="mt-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

/** The severity meter (●●○) + label, color-coded. */
function severitySignal(it) {
  const meta = SEVERITY_META[it.severity];
  if (!meta) return '';
  let pips = '';
  for (let i = 0; i < PIP_MAX; i++) {
    pips += `<span class="mt-pip${i < meta.pips ? ' is-on' : ''}" aria-hidden="true"></span>`;
  }
  return `<span class="mt-sev ${meta.cls}">
<span class="mt-pips" role="img" aria-label="Severity: ${esc(meta.short)} (${meta.pips} of ${PIP_MAX})">${pips}</span>
<span class="mt-sev-label">${esc(meta.short)}</span>
</span>`;
}

/** One maintenance task card. Carries data-* attributes the filter lens reads. */
function taskCard(it, relRoot = '') {
  const cadMeta = CADENCE_META[it.cadence] || { short: it.cadence };
  const sevMeta = SEVERITY_META[it.severity] || { pips: 0 };
  const sources = it.sources
    .map(
      (s) =>
        `<li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.label)}</a></li>`,
    )
    .join('');
  const doThis = it.doThis
    ? `<div class="mt-do"><span class="mt-do-label">How to do it</span><p>${esc(it.doThis)}</p></div>`
    : '';
  const applies = it.appliesTo
    ? `<p class="mt-applies"><span class="mt-applies-label">Applies to</span> ${esc(it.appliesTo)}</p>`
    : '';
  return `<article class="mt-card mt-card--${esc(it.cadence)} sev--${esc(it.severity)}" data-cadence="${esc(it.cadence)}" data-severity="${esc(it.severity)}" data-pips="${sevMeta.pips}" data-name="${esc((it.name || '').toLowerCase())}">
<div class="mt-card-body">
<div class="mt-card-top">
<span class="mt-interval">${cadenceIcon(it.cadence)}<span>${esc(it.intervalText || cadMeta.short)}</span></span>
${severitySignal(it)}
</div>
<h3 class="mt-name">${esc(it.name)}</h3>
<p class="mt-why">${esc(it.why)}</p>
${doThis}
${applies}
<details class="mt-sources">
<summary>Sources (${it.sources.length})</summary>
<ul>${sources}</ul>
</details>
</div>
</article>`;
}

/** Legend explaining the cadence + severity scales. */
function legend(data) {
  const cadRows = Object.values(CADENCE_META)
    .map(
      (m) =>
        `<div class="mt-legend-row"><span class="mt-legend-name">${esc(m.short)}</span><span class="mt-legend-blurb">${esc(m.blurb)}</span></div>`,
    )
    .join('');
  const sevRows = Object.values(SEVERITY_META)
    .map((m) => {
      let pips = '';
      for (let i = 0; i < PIP_MAX; i++) {
        pips += `<span class="mt-pip${i < m.pips ? ' is-on' : ''}" aria-hidden="true"></span>`;
      }
      return `<div class="mt-legend-row"><span class="mt-pips mt-legend-pips ${m.cls}">${pips}</span><span class="mt-legend-name">${esc(m.short)}</span><span class="mt-legend-blurb">${esc(m.blurb)}</span></div>`;
    })
    .join('');
  return `<details class="mt-legend"><summary>How to read this schedule</summary>
<div class="mt-legend-body">
<p class="mt-legend-lede">Intervals are \u201Cwhichever comes first.\u201D Every task is traced to a primary source \u2014 Airstream\u2019s own published schedule, the axle/appliance/tire makers \u2014 cited on each card. We flag where an Airstream differs from a typical RV, because following the wrong schedule is how owners damage these trailers.</p>
<h4 class="mt-legend-h">By cadence</h4>
${cadRows}
<h4 class="mt-legend-h">By severity</h4>
${sevRows}
</div>
</details>`;
}

/** The filter lens — segmented controls the app.js module wires up. */
function filterLens(data) {
  const cadBtns = Object.entries(CADENCE_META)
    .map(([key, m]) => `<button type="button" class="mt-chip" data-filter="cadence" data-value="${esc(key)}" aria-pressed="false">${esc(m.short)}</button>`)
    .join('');
  const sevBtns = Object.entries(SEVERITY_META)
    .map(([key, m]) => `<button type="button" class="mt-chip" data-filter="severity" data-value="${esc(key)}" aria-pressed="false">${esc(m.short)}</button>`)
    .join('');
  return `<div class="mt-lens" id="mt-lens" hidden>
<div class="mt-lens-row"><span class="mt-lens-label">When</span><div class="mt-lens-chips">${cadBtns}</div></div>
<div class="mt-lens-row"><span class="mt-lens-label">Severity</span><div class="mt-lens-chips">${sevBtns}</div></div>
<div class="mt-lens-foot">
<span class="mt-lens-count" id="mt-count"></span>
<button type="button" class="mt-lens-reset" id="mt-reset" hidden>Clear filters</button>
</div>
</div>
<p class="mt-empty" id="mt-empty" hidden>No tasks match those filters. <button type="button" class="linkbtn" id="mt-empty-reset">Clear filters</button></p>`;
}

/** The Maintenance page body. `relRoot` lets it live at site root (''). */
export function renderMaintenanceBody(data, relRoot = '') {
  const sections = data.categories
    .map((cat) => {
      const blurb = cat.blurb ? `<p class="mt-sec-blurb">${esc(cat.blurb)}</p>` : '';
      const cards = cat.items.map((it) => taskCard(it, relRoot)).join('\n');
      return `<section class="mt-sec" id="${esc(cat.id)}" data-sec>
<header class="mt-sec-head"><h2>${esc(cat.title)}</h2><span class="mt-sec-count" data-seccount>${cat.items.length}</span></header>
${blurb}
<div class="mt-grid">${cards}</div>
</section>`;
    })
    .join('\n');

  const jump = data.categories
    .map((c) => `<a href="#${esc(c.id)}">${esc(c.title)}</a>`)
    .join('');

  const footnote = data.footnote
    ? `<p class="mt-foot muted">${esc(data.footnote)}</p>`
    : '';

  return `<nav class="detail-nav"><a href="${relRoot}index.html" class="back-link">\u2190 All families</a></nav>
<header class="hero-head">
<p class="eyebrow">CARE &amp; MAINTENANCE \u00B7 SOURCED SERVICE CALENDAR</p>
<h1>Keep your Airstream road-ready</h1>
<p class="lede">${esc(data.intro)}</p>
</header>
${legend(data)}
${filterLens(data)}
<nav class="mt-jump" aria-label="Jump to cadence">${jump}</nav>
<main class="maintenance" id="mt-main">
${sections}
</main>
${footnote}`;
}
