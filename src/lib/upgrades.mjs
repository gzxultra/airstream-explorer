// Upgrades & options — the accessories and mods Airstream owners actually add.
//
// Two contracts, both enforced by validateUpgrades() so the build fails loudly
// if the data drifts:
//   1. Provenance: every item is tagged Factory / Aftermarket / Both and carries
//      at least one real http(s) source link. Accuracy is the whole point.
//   2. Community signal: every item declares a `consensus` tier (from the fixed
//      TIER_META scale below) plus a `consensusNote` citing the evidence, and a
//      `useCases` list drawn only from data.useCaseLegend. The tier scale lives
//      here in code — the single source of truth — so the legend, the pip
//      rendering, and the filter lens can never disagree with each other.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { esc } from './render.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The community-consensus scale. Order = strongest signal first. `pips` (out of
// PIP_MAX) drives the little ●●●○ meter; `short` is the chip label; `blurb`
// explains the tier in the legend. These keys are the ONLY legal values for an
// item's `consensus` field.
export const PIP_MAX = 4;
export const TIER_META = {
  'Near-universal': {
    short: 'Near-universal',
    pips: 4,
    blurb: 'Recommended by almost everyone — owners and the Airstream Club treat it as essential.',
  },
  'Frequently recommended': {
    short: 'Frequently added',
    pips: 3,
    blurb: 'Comes up again and again in owner mod lists.',
  },
  'Enthusiast favorite': {
    short: 'Enthusiast favorite',
    pips: 2,
    blurb: 'Passionately loved by a subset — often a polarizing, love-it-or-leave-it choice.',
  },
  'Niche': {
    short: 'Situational',
    pips: 1,
    blurb: 'Useful for specific setups, or owned by nearly everyone but treated as baseline gear rather than a celebrated upgrade.',
  },
};
const VALID_TIERS = new Set(Object.keys(TIER_META));

/** Load the upgrades dataset. */
export function loadUpgrades(path) {
  const p = path || join(__dirname, '..', 'data', 'upgrades.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  if (!data || !Array.isArray(data.categories) || data.categories.length === 0) {
    throw new Error('upgrades.json missing categories[]');
  }
  return data;
}

const VALID_TYPES = new Set(['Factory', 'Aftermarket', 'Both']);

/** Validate the dataset. Returns array of problem strings (empty = ok). */
export function validateUpgrades(data) {
  const problems = [];
  if (!data || !Array.isArray(data.categories)) {
    return ['upgrades: no categories array'];
  }
  // Use-case vocabulary: items may only reference keys defined in the legend.
  const legend = (data.useCaseLegend && typeof data.useCaseLegend === 'object')
    ? data.useCaseLegend : {};
  const validUseCases = new Set(Object.keys(legend));
  if (validUseCases.size === 0) problems.push('upgrades: missing useCaseLegend');

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
      if (!it.image) problems.push(`${tag}: missing image`);
      else if (!/^assets\/img\/upgrades\/[a-z0-9-]+\.webp$/.test(it.image)) {
        problems.push(`${tag}: image must be assets/img/upgrades/<slug>.webp, got "${it.image}"`);
      }
      if (!VALID_TYPES.has(it.type)) problems.push(`${tag}: bad type "${it.type}"`);
      // Community-consensus contract.
      if (!VALID_TIERS.has(it.consensus)) {
        problems.push(`${tag}: bad consensus tier "${it.consensus}"`);
      }
      if (!it.consensusNote) {
        problems.push(`${tag}: missing consensusNote (evidence for the tier)`);
      }
      if (!Array.isArray(it.useCases)) {
        problems.push(`${tag}: useCases must be an array`);
      } else {
        for (const u of it.useCases) {
          if (!validUseCases.has(u)) problems.push(`${tag}: unknown useCase "${u}"`);
        }
      }
      // Provenance contract.
      if (!Array.isArray(it.sources) || it.sources.length === 0) {
        problems.push(`${tag}: needs at least one source`);
      } else {
        for (const s of it.sources) {
          if (!s.label || !s.url) problems.push(`${tag}: source missing label/url`);
          else if (!/^https?:\/\//.test(s.url)) problems.push(`${tag}: source url not http(s): ${s.url}`);
        }
      }
    }
    // An optional per-category comparison table (e.g. the factory solar/lithium
    // program). Same source contract: rows must match column count and the
    // table must carry at least one verifiable source link.
    if (cat.table) {
      const t = cat.table;
      const ttag = `${cat.id}/table`;
      if (!Array.isArray(t.columns) || t.columns.length === 0) {
        problems.push(`${ttag}: missing columns`);
      }
      if (!Array.isArray(t.rows) || t.rows.length === 0) {
        problems.push(`${ttag}: missing rows`);
      } else if (Array.isArray(t.columns)) {
        for (const r of t.rows) {
          if (!Array.isArray(r) || r.length !== t.columns.length) {
            problems.push(`${ttag}: row width != ${t.columns.length}: ${JSON.stringify(r)}`);
          }
        }
      }
      if (!Array.isArray(t.sources) || t.sources.length === 0) {
        problems.push(`${ttag}: needs at least one source`);
      } else {
        for (const s of t.sources) {
          if (!s.label || !s.url) problems.push(`${ttag}: source missing label/url`);
          else if (!/^https?:\/\//.test(s.url)) problems.push(`${ttag}: source url not http(s): ${s.url}`);
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

/** A small pill that color-codes whether an upgrade is factory or aftermarket. */
function typeBadge(type) {
  const cls =
    type === 'Factory' ? 'is-factory' : type === 'Aftermarket' ? 'is-after' : 'is-both';
  const label =
    type === 'Factory' ? 'Factory option' : type === 'Aftermarket' ? 'Aftermarket' : 'Factory or aftermarket';
  return `<span class="up-badge ${cls}">${esc(label)}</span>`;
}

/** The ●●●○ consensus meter + label, with the evidence note as a tooltip. */
function consensusSignal(it) {
  const meta = TIER_META[it.consensus];
  if (!meta) return '';
  let pips = '';
  for (let i = 0; i < PIP_MAX; i++) {
    pips += `<span class="up-pip${i < meta.pips ? ' is-on' : ''}" aria-hidden="true"></span>`;
  }
  const note = it.consensusNote ? esc(it.consensusNote) : '';
  return `<div class="up-consensus" title="${note}">
<span class="up-pips" role="img" aria-label="Community signal: ${esc(meta.short)} (${meta.pips} of ${PIP_MAX})">${pips}</span>
<span class="up-tier">${esc(meta.short)}</span>
</div>`;
}

/** Use-case chips (Boondocking, Full-timing, …). */
function useCaseChips(it) {
  if (!Array.isArray(it.useCases) || !it.useCases.length) return '';
  const chips = it.useCases
    .map((u) => `<span class="up-uc" data-uc="${esc(slug(u))}">${esc(u)}</span>`)
    .join('');
  return `<div class="up-ucs">${chips}</div>`;
}

/** One upgrade card. Carries data-* attributes the filter lens reads. */
function upgradeCard(it, relRoot = '') {
  const sources = it.sources
    .map(
      (s) =>
        `<li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.label)}</a></li>`,
    )
    .join('');
  const popular = it.popular
    ? `<p class="up-popular"><span class="up-popular-label">What owners pick</span> ${esc(it.popular)}</p>`
    : '';
  const price = it.priceText
    ? `<p class="up-price">${esc(it.priceText)}</p>`
    : '';
  const ucTokens = (it.useCases || []).map(slug).join(' ');
  const meta = TIER_META[it.consensus] || { pips: 0 };
  const noteLine = it.consensusNote
    ? `<p class="up-evidence"><span class="up-evidence-label">Why this signal</span> ${esc(it.consensusNote)}</p>`
    : '';
  const media = it.image
    ? `<div class="up-media"><img src="${esc(relRoot + it.image)}" alt="${esc(it.name)}" loading="lazy" width="800" height="450"></div>`
    : '';
  return `<article class="up-card" data-type="${esc(it.type)}" data-consensus="${esc(it.consensus)}" data-pips="${meta.pips}" data-uc="${esc(ucTokens)}" data-name="${esc((it.name || '').toLowerCase())}">
${media}
<div class="up-card-body">
<header class="up-card-head">
<h3 class="up-name">${esc(it.name)}</h3>
${typeBadge(it.type)}
</header>
${consensusSignal(it)}
${price}
<p class="up-why">${esc(it.why)}</p>
${useCaseChips(it)}
${popular}
${noteLine}
<details class="up-sources">
<summary>Sources (${it.sources.length})</summary>
<ul>${sources}</ul>
</details>
</div>
</article>`;
}

/** An optional per-category comparison table (e.g. the factory power program). */
function categoryTable(t) {
  if (!t) return '';
  const head = t.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('');
  const body = t.rows
    .map((r) => {
      const cells = r
        .map((cell, i) =>
          i === 0
            ? `<th scope="row">${esc(cell)}</th>`
            : `<td>${esc(cell)}</td>`,
        )
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('\n');
  const intro = t.intro ? `<p class="up-table-intro">${esc(t.intro)}</p>` : '';
  const note = t.note ? `<p class="up-table-note muted">${esc(t.note)}</p>` : '';
  const sources = t.sources
    .map(
      (s) =>
        `<li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.label)}</a></li>`,
    )
    .join('');
  const title = t.title ? `<h3 class="up-table-title">${esc(t.title)}</h3>` : '';
  return `<div class="up-table-wrap">
${title}
${intro}
<div class="up-table-scroll"><table class="up-table">
<thead><tr>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table></div>
${note}
<details class="up-sources"><summary>Sources (${t.sources.length})</summary><ul>${sources}</ul></details>
</div>`;
}

/** The consensus legend — explains the ●●●○ scale. Sourced from TIER_META. */
function consensusLegend(data) {
  const rows = Object.values(TIER_META)
    .map((m) => {
      let pips = '';
      for (let i = 0; i < PIP_MAX; i++) {
        pips += `<span class="up-pip${i < m.pips ? ' is-on' : ''}" aria-hidden="true"></span>`;
      }
      return `<div class="up-legend-row">
<span class="up-pips">${pips}</span>
<span class="up-legend-name">${esc(m.short)}</span>
<span class="up-legend-blurb">${esc(m.blurb)}</span>
</div>`;
    })
    .join('');
  const note = (data.consensusIntro || '')
    ? `<p class="up-legend-note muted">${esc(data.consensusIntro)}</p>` : '';
  return `<details class="up-legend"><summary>How the community signal is judged</summary>
<div class="up-legend-body">
<p class="up-legend-lede">The signal reflects only sources we opened and read — two long owner mod threads on Airforums, the Airstream Club's official carry list, and a first-person owner build. It's a read of owner sentiment, not a vote count, and no source we couldn't reach is implied.</p>
${rows}
${note}
</div>
</details>`;
}

/** The filter lens — segmented controls the app.js module wires up. */
function filterLens(data) {
  const tierBtns = Object.entries(TIER_META)
    .map(([key, m]) => `<button type="button" class="up-chip" data-filter="consensus" data-value="${esc(key)}" aria-pressed="false">${esc(m.short)}</button>`)
    .join('');
  const typeBtns = ['Factory', 'Aftermarket']
    .map((t) => `<button type="button" class="up-chip" data-filter="type" data-value="${esc(t)}" aria-pressed="false">${esc(t)}</button>`)
    .join('');
  const ucBtns = Object.keys(data.useCaseLegend || {})
    .map((u) => `<button type="button" class="up-chip" data-filter="uc" data-value="${esc(slug(u))}" aria-pressed="false">${esc(u)}</button>`)
    .join('');
  return `<div class="up-lens" id="up-lens" hidden>
<div class="up-lens-row"><span class="up-lens-label">Signal</span><div class="up-lens-chips">${tierBtns}</div></div>
<div class="up-lens-row"><span class="up-lens-label">Source</span><div class="up-lens-chips">${typeBtns}</div></div>
<div class="up-lens-row"><span class="up-lens-label">Best for</span><div class="up-lens-chips">${ucBtns}</div></div>
<div class="up-lens-foot">
<span class="up-lens-count" id="up-count"></span>
<button type="button" class="up-lens-reset" id="up-reset" hidden>Clear filters</button>
</div>
</div>
<p class="up-empty" id="up-empty" hidden>No upgrades match those filters. <button type="button" class="linkbtn" id="up-empty-reset">Clear filters</button></p>`;
}

/** The Upgrades page body. `relRoot` lets it live at site root (''). */
export function renderUpgradesBody(data, relRoot = '') {
  const sections = data.categories
    .map((cat) => {
      const blurb = cat.blurb ? `<p class="up-sec-blurb">${esc(cat.blurb)}</p>` : '';
      const table = categoryTable(cat.table);
      const cards = cat.items.map((it) => upgradeCard(it, relRoot)).join('\n');
      return `<section class="up-sec" id="${esc(cat.id)}" data-sec>
<header class="up-sec-head"><h2>${esc(cat.title)}</h2><span class="up-sec-count" data-seccount>${cat.items.length}</span></header>
${blurb}
${table}
<div class="up-grid">${cards}</div>
</section>`;
    })
    .join('\n');

  // A small in-page jump nav across categories.
  const jump = data.categories
    .map((c) => `<a href="#${esc(c.id)}">${esc(c.title)}</a>`)
    .join('');

  return `<nav class="detail-nav"><a href="${relRoot}index.html" class="back-link">← All families</a></nav>
<header class="hero-head">
<p class="eyebrow">OPTIONS &amp; UPGRADES · OWNER-RECOMMENDED</p>
<h1>What owners actually add</h1>
<p class="lede">${esc(data.intro)}</p>
</header>
${consensusLegend(data)}
${filterLens(data)}
<nav class="up-jump" aria-label="Jump to category">${jump}</nav>
<main class="upgrades" id="up-main">
${sections}
</main>
<p class="up-foot muted">Prices are typical 2025–2026 US street prices for reference, gathered from manufacturer and retailer listings and the owner sources cited on each card — not quotes. Factory option prices and availability vary by floorplan and model year; confirm with an Airstream dealer. Independent reference, not affiliated with Airstream, Inc.</p>`;
}
