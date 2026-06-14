// Upgrades & options — the accessories and mods Airstream owners actually add.
//
// Two-source contract: every item is tagged Factory (priced by Airstream) or
// Aftermarket (owner/installer add-on) or Both, and every item carries at least
// one real source link so a reader can verify the claim and price. The
// validator below enforces that contract; the build fails if any item is
// missing its type or sources. Accuracy is the whole point of this page.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { esc } from './render.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
      if (!VALID_TYPES.has(it.type)) problems.push(`${tag}: bad type "${it.type}"`);
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
    // program). Same source contract: if a table is present it must carry rows
    // that match its column count and at least one verifiable source link.
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

/** A small pill that color-codes whether an upgrade is factory or aftermarket. */
function typeBadge(type) {
  const cls =
    type === 'Factory' ? 'is-factory' : type === 'Aftermarket' ? 'is-after' : 'is-both';
  const label =
    type === 'Factory' ? 'Factory option' : type === 'Aftermarket' ? 'Aftermarket' : 'Factory or aftermarket';
  return `<span class="up-badge ${cls}">${esc(label)}</span>`;
}

/** One upgrade card. */
function upgradeCard(it) {
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
  return `<article class="up-card">
<header class="up-card-head">
<h3 class="up-name">${esc(it.name)}</h3>
${typeBadge(it.type)}
</header>
${price}
<p class="up-why">${esc(it.why)}</p>
${popular}
<details class="up-sources">
<summary>Sources (${it.sources.length})</summary>
<ul>${sources}</ul>
</details>
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

/** The Upgrades page body. `relRoot` lets it live at site root (''). */
export function renderUpgradesBody(data, relRoot = '') {
  const sections = data.categories
    .map((cat) => {
      const blurb = cat.blurb ? `<p class="up-sec-blurb">${esc(cat.blurb)}</p>` : '';
      const table = categoryTable(cat.table);
      const cards = cat.items.map(upgradeCard).join('\n');
      return `<section class="up-sec" id="${esc(cat.id)}">
<header class="up-sec-head"><h2>${esc(cat.title)}</h2><span class="up-sec-count">${cat.items.length}</span></header>
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
<nav class="up-jump" aria-label="Jump to category">${jump}</nav>
<main class="upgrades">
${sections}
</main>
<p class="up-foot muted">Prices are typical 2025–2026 US street prices for reference, gathered from manufacturer and retailer listings and owner sources cited on each card — not quotes. Factory option prices and availability vary by floorplan and model year; confirm with an Airstream dealer. Independent reference, not affiliated with Airstream, Inc.</p>`;
}
