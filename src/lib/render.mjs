// HTML rendering — pure functions returning strings. No DOM, no I/O.
// All dynamic text goes through esc() to stay XSS/CSP-safe.

import {
  formatMsrp, formatWeight, formatLength, formatGal, formatTanks,
  formatPriceRange, formatLengthRange, formatWeightRange, formatMsrpShort,
  hitchPctOfGvwr,
  trailerTitle, trailerLabel, saveButton,
} from './format.mjs';
import { assetPaths, familySlug, officialUrl, catalogStats, computeStandouts, computePercentiles, percentileLabel, computeFleetRanges, rangePosition, deriveLayoutFeatures, LAYOUT_META, computeYearDiff, towClass, waterAutonomy } from './data.mjs';
import { motorhomeAssetPaths } from './motorhome-data.mjs';
import { renderMotorhomeExploreCard, renderMotorhomeFamilyCard } from './motorhome-render.mjs';
import { socialMeta, productJsonLd, iconMeta, breadcrumbJsonLd } from './seo.mjs';
import { SORT_KEYS, exploreTags, tagLabel } from './explore.mjs';
import { renderCampgroundFit } from './campgrounds-render.mjs';
import { renderFloorplanZones, renderFloorplanLegend } from './floorplan-zones.mjs';
import {
  estimateOffGrid, formatNights,
  LOAD_PRESETS,
} from './estimate.mjs';
import {
  loadVehicles, evaluateTow, pickDefaultVehicle, formatPct,
  TONGUE_PCT_LOADED, DEFAULT_TRUCK_OCCUPANT_LB,
} from './tow.mjs';
import {
  estimateFuelCost, formatDollars, formatMpg,
  VEHICLE_CLASS_MPG, DEFAULT_FUEL_PRICE, DEFAULT_DISTANCE_MI,
  DEFAULT_KWH_PRICE, DEFAULT_KWH_PER_100MI,
} from './fuel.mjs';
import {
  calculatePayload, waterWeight, formatRemaining, formatLb,
  WATER_LB_PER_GAL, PROPANE_PRESETS, DEFAULT_PROPANE, GEAR_PRESETS,
} from './payload.mjs';

// Tow-vehicle dataset is loaded once at module load (pure read) and reused for
// every detail page's calculator. Each vehicle carries ONE coherent, sourced
// 2025 configuration (see tow-vehicles.json _meta).
const TOW_VEHICLES = loadVehicles();

/** Escape text for HTML body/attribute context. */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Primary nav, single source of truth: [href, label, key]. `active` (a key)
// marks the current section so every page shows a "you are here" state.
// Consolidated to 3 tabs (was 6). Explore is the hub: it absorbs the old
// Families grid + Explore & match + Compare into one page (index.html) via a
// segmented control. Compare lives on as a selection tray → compare.html, and
// Community/Credits live on as footer-linked destinations — neither is a tab.
// 3 items fit a single persistent bar on mobile (no hamburger needed).
const NAV_ITEMS = [
  ['index.html', 'Explore', 'index'],
  ['saved.html', 'Saved', 'saved'],
  ['campsites.html', 'Campsites', 'campsites'],
  ['upgrades.html', 'Upgrades', 'upgrades'],
  ['maintenance.html', 'Maintenance', 'maintenance'],
];

export function page({ title, description, body, relRoot = '', head = '', scripts = '', active = '', canonicalPath = '', ogImage = '', ogType = 'website' }) {
  const _stats = catalogStats();
  const navLinks = NAV_ITEMS.map(([href, label, key]) => {
    const on = key === active;
    // The Saved link carries a live count badge, populated client-side from
    // localStorage (hidden until there's at least one saved floorplan).
    const inner = key === 'saved'
      ? `${label} <span class="nav-badge" id="nav-saved-count" hidden aria-hidden="true"></span>`
      : label;
    return `<a href="${relRoot}${href}"${on ? ' class="is-active" aria-current="page"' : ''}${key === 'saved' ? ' data-nav-saved' : ''}>${inner}</a>`;
  }).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<script>(function(){try{var t=localStorage.getItem('ae:theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${socialMeta({ title, description, canonicalPath, imagePath: ogImage, type: ogType })}
${iconMeta(relRoot)}
<link rel="stylesheet" href="${relRoot}assets/css/fonts.css">
<link rel="stylesheet" href="${relRoot}assets/css/site.css">
<link rel="stylesheet" href="${relRoot}assets/css/controls.css">
<link rel="stylesheet" href="${relRoot}assets/css/premium.css">
<link rel="stylesheet" href="${relRoot}assets/css/theme.css">
<meta name="view-transition" content="same-origin">
${head}</head>
<body>
<a class="skip-link" href="#main-content">Skip to content</a>
<header class="topnav">
<div class="topnav-inner">
<a class="brandbar" href="${relRoot}index.html"><span class="brandbar-mark">▲</span> Airstream Explorer</a>
<nav class="topnav-links" aria-label="Primary">
${navLinks}
<button type="button" class="theme-toggle" id="theme-toggle" aria-label="Switch color theme" title="Switch color theme">
<svg class="theme-icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"></circle><line x1="12" y1="2" x2="12" y2="4.5"></line><line x1="12" y1="19.5" x2="12" y2="22"></line><line x1="2" y1="12" x2="4.5" y2="12"></line><line x1="19.5" y1="12" x2="22" y2="12"></line><line x1="4.6" y1="4.6" x2="6.4" y2="6.4"></line><line x1="17.6" y1="17.6" x2="19.4" y2="19.4"></line><line x1="4.6" y1="19.4" x2="6.4" y2="17.6"></line><line x1="17.6" y1="6.4" x2="19.4" y2="4.6"></line></svg>
<svg class="theme-icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.2 8.2 0 1 1 9.8 3.5a6.4 6.4 0 0 0 10.7 10.7z"></path></svg>
</button>
<button type="button" class="unit-toggle" id="unit-toggle" aria-label="Switch units to metric" title="Switch to metric units" aria-pressed="false">
<span class="unit-toggle-label" id="unit-label">lb/ft</span>
</button>
</nav>
</div>
</header>
<a id="main-content" tabindex="-1"></a>
${body}
<footer class="site-footer">
<div class="footer-grid">
<div class="footer-col">
<p class="footer-heading">Browse</p>
<ul class="footer-links">
<li><a href="${relRoot}index.html">Families</a></li>
<li><a href="${relRoot}index.html#all">All floorplans</a></li>
<li><a href="${relRoot}index.html#all&type=motorhome">Motorhomes</a></li>
<li><a href="${relRoot}compare.html">Compare</a></li>
</ul>
</div>
<div class="footer-col">
<p class="footer-heading">Plan your trip</p>
<ul class="footer-links">
<li><a href="${relRoot}campsites.html">Campsites</a></li>
<li><a href="${relRoot}campgrounds.html">Campground map</a></li>
<li><a href="${relRoot}upgrades.html">Upgrades</a></li>
<li><a href="${relRoot}maintenance.html">Maintenance</a></li>
</ul>
</div>
<div class="footer-col">
<p class="footer-heading">Community</p>
<ul class="footer-links">
<li><a href="${relRoot}community.html">Community photos</a></li>
<li><a href="${relRoot}credits.html">Credits &amp; sources</a></li>
<li><a href="https://www.airstream.com/" target="_blank" rel="noopener">airstream.com ↗</a></li>
</ul>
</div>
<div class="footer-col footer-col-about">
<p class="footer-heading">Airstream Explorer</p>
<p class="footer-about">${_stats.floorplanCount} floorplans across ${_stats.familyCount} families. An independent, spec-accurate field guide to the current Airstream lineup.</p>
</div>
</div>
<p class="footer-legal muted">Independent reference. Not affiliated with Airstream, Inc. Specs compiled from published sources; verify with a dealer before purchase. Model imagery is manufacturer product photography; community photos under Creative Commons / public-domain licenses (<a href="${relRoot}credits.html">see credits</a>).</p>
</footer>
<div class="lightbox" id="lightbox" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Photo viewer">
<div class="lightbox-backdrop" data-lb-close></div>
<button type="button" class="lightbox-close" data-lb-close aria-label="Close (Esc)"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg></button>
<button type="button" class="lightbox-nav lightbox-prev" data-lb-prev aria-label="Previous photo"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 5 8 12 15 19"></polyline></svg></button>
<figure class="lightbox-stage">
<img class="lightbox-img" id="lightbox-img" alt="">
<figcaption class="lightbox-caption" id="lightbox-caption"></figcaption>
</figure>
<button type="button" class="lightbox-nav lightbox-next" data-lb-next aria-label="Next photo"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 5 16 12 9 19"></polyline></svg></button>
</div>
<div class="quick-view" id="quick-view" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Quick view">
<div class="qv-backdrop" data-qv-close></div>
<div class="qv-panel">
<button type="button" class="qv-close" data-qv-close aria-label="Close">&times;</button>
<div class="qv-media"><img class="qv-img" id="qv-img" alt="" width="400" height="260"></div>
<div class="qv-body">
<p class="qv-year" id="qv-year"></p>
<h3 class="qv-title" id="qv-title"></h3>
<p class="qv-desc" id="qv-desc"></p>
<dl class="qv-specs" id="qv-specs"></dl>
<div class="qv-actions">
<a class="qv-detail-btn" id="qv-detail-link" href="#">View full details →</a>
</div>
</div>
</div>
</div>
<button type="button" class="back-to-top" id="back-to-top" aria-label="Back to top" hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
<div class="kb-help" id="kb-help" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
<div class="kb-help-backdrop" data-kb-close></div>
<div class="kb-help-panel">
<div class="kb-help-head"><h2>Keyboard shortcuts</h2><button type="button" class="kb-help-close" data-kb-close aria-label="Close">&times;</button></div>
<div class="kb-help-body">
<div class="kb-group"><h3>Navigation</h3>
<div class="kb-row"><kbd>/</kbd><span>Focus search</span></div>
<div class="kb-row"><kbd>j</kbd> / <kbd>k</kbd><span>Next / previous card</span></div>
<div class="kb-row"><kbd>Enter</kbd><span>Open focused card</span></div>
<div class="kb-row"><kbd>Esc</kbd><span>Close overlay</span></div>
</div>
<div class="kb-group"><h3>Actions</h3>
<div class="kb-row"><kbd>d</kbd><span>Toggle dark mode</span></div>
<div class="kb-row"><kbd>u</kbd><span>Toggle imperial / metric</span></div>
<div class="kb-row"><kbd>s</kbd><span>Save / unsave floorplan</span></div>
<div class="kb-row"><kbd>?</kbd><span>Show this help</span></div>
</div>
</div>
</div>
</div>
<script src="${relRoot}assets/js/app.js" defer></script>
<button type="button" class="scroll-top" id="scroll-top" aria-label="Scroll to top" title="Back to top" hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
${scripts}</body>
</html>`;
}

// Glossary of spec terms — shown as tooltips on the detail spec table.
// Each key matches the label used in specRow(); only detail-page rows get tips.
const SPEC_GLOSSARY = {
  'Length': 'Overall bumper-to-hitch length, including the tongue.',
  'Dry weight': 'Empty weight from the factory — no water, propane, or personal gear.',
  'GVWR': 'Gross Vehicle Weight Rating — the maximum safe total weight when fully loaded.',
  'Cargo capacity (CCC)': 'GVWR minus dry weight. Everything you add (water, propane, gear) must fit within this.',
  'Hitch weight': 'The downward force the tongue puts on your tow vehicle\'s hitch.',
  'Fresh / gray / black': 'Fresh = clean drinking water. Gray = sink/shower drainage. Black = toilet waste.',
  'Solar': 'Factory rooftop solar panel wattage for charging the house battery off-grid.',
  'Battery': 'House battery capacity in kilowatt-hours — powers lights, outlets, and appliances.',
  'Off-grid score': 'A 0–100 composite: battery kWh, solar watts, and tank sizes vs. the lineup.',
  'MSRP': 'Manufacturer\'s Suggested Retail Price — the base sticker price before options or dealer markup.',
  'Sleeps': 'Maximum sleeping positions from the factory floorplan layout.',
};

/** Render standout badges for a trailer detail page. */
function renderStandoutBadges(t, allTrailers) {
  const badges = computeStandouts(t, allTrailers);
  if (!badges.length) return '';
  const pills = badges.map((b) =>
    `<span class="standout-badge"><span class="standout-icon" aria-hidden="true">${b.icon}</span>${esc(b.label)}</span>`
  ).join('');
  return `<div class="standout-badges" aria-label="Standout traits">${pills}</div>`;
}

function specRow(label, value, { tip = false, unit = null, raw = null, pctData = null } = {}) {
  const glossary = tip && SPEC_GLOSSARY[label];
  const dtInner = glossary
    ? `<span class="spec-tip" tabindex="0" aria-label="${esc(label)}: ${esc(glossary)}"><span class="spec-tip-text">${esc(glossary)}</span>${esc(label)}</span>`
    : esc(label);
  const unitAttr = unit && raw != null ? ` data-unit="${esc(unit)}" data-raw="${esc(String(raw))}"` : '';
  // Percentile ranking indicator (only shown for notable rankings ≥70th pct)
  let pctHtml = '';
  if (pctData && pctData.pct >= 70) {
    const barW = pctData.pct;
    const tier = pctData.pct >= 90 ? 'top10' : pctData.pct >= 80 ? 'top20' : 'top30';
    pctHtml = `<span class="spec-pct spec-pct--${tier}" title="${esc(pctData.label || '')}" aria-label="${esc(pctData.label || '')}"><span class="spec-pct-bar" style="width:${barW}%"></span><span class="spec-pct-text">Top ${100 - barW}%</span></span>`;
  }
  return `<div class="spec"><dt>${dtInner}</dt><dd${unitAttr}>${esc(value)}${pctHtml}</dd></div>`;
}

function tagChips(tags) {
  if (!tags || !tags.length) return '';
  return `<ul class="chips">${tags
    .map((t) => `<li class="chip">${esc(t)}</li>`)
    .join('')}</ul>`;
}


/** Render the key-stats dashboard below the detail hero. */
function renderKeyStats(t) {
  const days = waterAutonomy(t.freshGal);
  const stats = [
    { icon: '📐', value: formatLength(t.lengthFt), label: 'Length', unit: 'length', raw: t.lengthFt },
    { icon: '⚖️', value: formatWeight(t.weightLb), label: 'Dry weight', unit: 'weight', raw: t.weightLb },
    { icon: '🛏️', value: String(t.sleeps), label: 'Sleeps' },
    { icon: '💰', value: formatMsrpShort(t.msrp), label: 'Base MSRP' },
    t.offGridScore ? { icon: '🔋', value: `${t.offGridScore}/100`, label: 'Off-grid' } : null,
    days ? { icon: '💧', value: `~${days}`, label: 'Water days (2 ppl)' } : null,
  ].filter(Boolean);
  return `<div class="key-stats" aria-label="Key specifications at a glance">${stats.map((s) => {
    const unitAttr = s.unit && s.raw != null ? ` data-unit="${esc(s.unit)}" data-raw="${esc(String(s.raw))}"` : '';
    return `<div class="key-stat"><span class="key-stat-icon" aria-hidden="true">${s.icon}</span><span class="key-stat-value"${unitAttr}>${esc(s.value)}</span><span class="key-stat-label">${esc(s.label)}</span></div>`;
  }).join('')}</div>`;
}

/** Render the weight capacity visualization bar. */
function renderWeightBar(t) {
  if (!(t.weightLb > 0) || !(t.gvwrLb > 0)) return '';
  const dryPct = Math.round((t.weightLb / t.gvwrLb) * 100);
  const cccPct = 100 - dryPct;
  const ccc = t.cccLb || (t.gvwrLb - t.weightLb);
  return `<div class="weight-bar" aria-label="Weight capacity breakdown">
<div class="weight-bar-header"><span class="weight-bar-title">Weight capacity</span><span class="weight-bar-gvwr" data-unit="weight" data-raw="${esc(String(t.gvwrLb))}">${esc(formatWeight(t.gvwrLb))} GVWR</span></div>
<div class="weight-bar-track">
<div class="weight-bar-dry" style="width:${dryPct}%"><span class="weight-bar-seg-label" data-unit="weight" data-raw="${esc(String(t.weightLb))}">${esc(formatWeight(t.weightLb))}</span></div>
<div class="weight-bar-ccc" style="width:${cccPct}%"><span class="weight-bar-seg-label" data-unit="weight" data-raw="${esc(String(ccc))}">${esc(formatWeight(ccc))}</span></div>
</div>
<div class="weight-bar-legend"><span class="weight-bar-legend-dry">Dry weight</span><span class="weight-bar-legend-ccc">Cargo capacity (CCC)</span></div>
</div>`;
}

// ---------------------------------------------------------------------------
// WEIGHT BUDGET WATERFALL — shows how CCC gets consumed by fluids + propane
// ---------------------------------------------------------------------------

function renderWeightBudget(t) {
  if (!(t.cccLb > 0) || !(t.gvwrLb > 0)) return '';
  const WPG = 8.34; // lb per gallon of water
  const freshLb = t.freshGal ? Math.round(t.freshGal * WPG) : 0;
  const grayLb = t.grayGal ? Math.round(t.grayGal * WPG) : 0;
  const blackLb = t.blackGal ? Math.round(t.blackGal * WPG) : 0;
  const wasteLb = grayLb + blackLb;
  const propaneLb = 40; // standard dual 20 lb tanks
  const totalFluids = freshLb + wasteLb + propaneLb;
  const gearLb = Math.max(0, t.cccLb - totalFluids);
  const ccc = t.cccLb;
  // When fluids exceed CCC (common on compact models), normalize to total
  // so the bar stays at 100% and clearly shows the overshoot.
  const overBudget = totalFluids > ccc;
  const base = overBudget ? totalFluids : ccc;
  const freshPct = Math.round((freshLb / base) * 100);
  const wastePct = Math.round((wasteLb / base) * 100);
  const propPct = Math.round((propaneLb / base) * 100);
  const gearPct = overBudget ? 0 : Math.max(0, 100 - freshPct - wastePct - propPct);
  const segments = [
    freshLb > 0 ? { cls: 'wb-fresh', pct: freshPct, label: 'Fresh water', value: `${freshLb} lb (${t.freshGal} gal)` } : null,
    wasteLb > 0 ? { cls: 'wb-waste', pct: wastePct, label: wasteLb === grayLb ? 'Gray tank' : (grayLb && blackLb ? 'Gray + black' : 'Waste tank'), value: `${wasteLb} lb` } : null,
    { cls: 'wb-propane', pct: propPct, label: 'Propane (2×20 lb)', value: `${propaneLb} lb` },
    !overBudget ? { cls: 'wb-gear', pct: gearPct, label: 'Your gear & supplies', value: `${formatWeight(gearLb)}` } : null,
  ].filter(Boolean);
  const bars = segments.map((s) =>
    `<div class="wb-seg ${s.cls}" style="width:${Math.max(s.pct, 3)}%" aria-label="${esc(s.label)}: ${esc(s.value)}"><span class="wb-seg-pct">${s.pct}%</span></div>`
  ).join('');
  const legend = segments.map((s) =>
    `<span class="wb-legend-item"><span class="wb-legend-dot ${s.cls}"></span>${esc(s.label)} <strong>${esc(s.value)}</strong></span>`
  ).join('');
  const overAmt = totalFluids - ccc;
  const verdict = overBudget
    ? `<p class="wb-verdict wb-verdict--tight">⚠ Full tanks + propane (${formatWeight(totalFluids)}) exceed your ${formatWeight(ccc)} CCC by ${formatWeight(overAmt)}. Travel with tanks partially filled or skip propane loading to leave room for personal gear.</p>`
    : gearLb < 200
    ? '<p class="wb-verdict wb-verdict--ok">Enough for essentials, but budget carefully for longer trips.</p>'
    : '<p class="wb-verdict wb-verdict--good">Comfortable margin for gear, food, and supplies.</p>';
  return `<div class="weight-budget collapsible" id="weight-budget" aria-label="Weight budget breakdown">
<h3 class="collapsible-trigger" aria-expanded="false" tabindex="0" role="button">Weight budget: where your ${esc(formatWeight(ccc))} goes<span class="collapsible-icon" aria-hidden="true"></span></h3>
<div class="collapsible-body" hidden>
<p class="wb-intro">When all tanks are full and propane is loaded, here\'s how your ${esc(formatWeight(ccc))} cargo capacity (CCC) breaks down.${overBudget ? ' <strong>On this model, full fluids exceed CCC — plan accordingly.</strong>' : ''}</p>
<div class="wb-bar-wrap"><div class="wb-bar">${bars}</div></div>
<div class="wb-legend">${legend}</div>
${verdict}
</div>
</div>`;
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
  const wt = formatWeightRange(fam.weightMin, fam.weightMax);
  const plans = `${fam.floorplanCount} floorplan${fam.floorplanCount === 1 ? '' : 's'}`;
  const limited = fam.limited ? '<span class="fam-flag">Limited edition</span>' : '';
  const yrs = fam.years.join(' + ');
  // Tow class badge based on the heaviest GVWR in the family
  const tc = fam.gvwrMax ? towClass(fam.gvwrMax) : null;
  const towBadge = tc ? `<span class="tow-badge tow-badge--${esc(tc.cls)}" aria-label="${esc(tc.label)}">${tc.icon} ${esc(tc.label)}</span>` : '';
  return `<a class="fam" href="${linkPrefix}f/${esc(fam.slug)}.html" data-family="${esc(fam.family)}">
<div class="fam-media">
<img src="${linkPrefix}${esc(fam.hero)}" alt="Airstream ${esc(fam.family)}" loading="lazy" width="800" height="500" style="view-transition-name:vt-hero-${esc(fam.slug)}">
${limited}
<span class="fam-plans">${esc(plans)}</span>
</div>
<div class="fam-body">
<h2 class="fam-name">${esc(fam.family)}</h2>
<p class="fam-range">${esc(range)}</p>
<dl class="fam-stats">
${specRow('Length', len)}
${specRow('Dry weight', wt)}
${specRow('Sleeps', 'up to ' + fam.sleepsMax)}
</dl>
${towBadge}
</div>
</a>`;
}

/**
 * The Explore hub (index.html). Consolidates three former tabs into one page:
 *   • "By family" — the cinematic 12-family grid (default view)
 *   • "All floorplans" — the full Explore & match experience (tow matcher +
 *     search/sort/filter + the 59-floorplan grid + compare tray)
 * Both views are SERVER-RENDERED so the page is complete with no JS; app.js
 * toggles between them and mirrors state in the URL hash (#families / #all)
 * for deep-linking + back-button. `trailers`/`resolve` power the all view.
 */

// ---------------------------------------------------------------------------
// QUIZ: "Find Your Airstream" lifestyle recommendation wizard
// ---------------------------------------------------------------------------
function renderQuiz() {
  return `<div class="quiz-overlay" id="quiz" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Find your Airstream">
<div class="quiz-backdrop" data-quiz-close></div>
<div class="quiz-panel">
<div class="quiz-header">
<div class="quiz-progress" id="quiz-progress"><span class="quiz-progress-fill" id="quiz-fill" style="width:25%"></span></div>
<button type="button" class="quiz-close" data-quiz-close aria-label="Close">&times;</button>
</div>
<div class="quiz-steps" id="quiz-steps">
<div class="quiz-step is-active" data-step="1">
<p class="quiz-step-num">1 of 4</p>
<h2 class="quiz-q">Who’s coming along?</h2>
<p class="quiz-hint">This helps us narrow down sleeping capacity and living space.</p>
<div class="quiz-opts">
<button type="button" class="quiz-opt" data-key="group" data-val="solo"><span class="quiz-opt-icon" aria-hidden="true">🧑‍🤝‍🧑</span><span class="quiz-opt-label">Solo or couple</span><span class="quiz-opt-sub">1–2 people</span></button>
<button type="button" class="quiz-opt" data-key="group" data-val="small"><span class="quiz-opt-icon" aria-hidden="true">👪</span><span class="quiz-opt-label">Small family</span><span class="quiz-opt-sub">3–4 people</span></button>
<button type="button" class="quiz-opt" data-key="group" data-val="large"><span class="quiz-opt-icon" aria-hidden="true">🏕️</span><span class="quiz-opt-label">Large group</span><span class="quiz-opt-sub">5+ people</span></button>
</div>
</div>
<div class="quiz-step" data-step="2">
<p class="quiz-step-num">2 of 4</p>
<h2 class="quiz-q">What’s your budget?</h2>
<p class="quiz-hint">Base MSRP — before dealer options and delivery.</p>
<div class="quiz-opts">
<button type="button" class="quiz-opt" data-key="budget" data-val="80000"><span class="quiz-opt-icon" aria-hidden="true">💰</span><span class="quiz-opt-label">Under $80k</span><span class="quiz-opt-sub">Compact &amp; nimble</span></button>
<button type="button" class="quiz-opt" data-key="budget" data-val="120000"><span class="quiz-opt-icon" aria-hidden="true">💳</span><span class="quiz-opt-label">$80k – $120k</span><span class="quiz-opt-sub">Mid-range sweet spot</span></button>
<button type="button" class="quiz-opt" data-key="budget" data-val="180000"><span class="quiz-opt-icon" aria-hidden="true">💎</span><span class="quiz-opt-label">$120k – $180k</span><span class="quiz-opt-sub">Premium touring</span></button>
<button type="button" class="quiz-opt" data-key="budget" data-val="999999"><span class="quiz-opt-icon" aria-hidden="true">👑</span><span class="quiz-opt-label">$180k+</span><span class="quiz-opt-sub">Flagship luxury</span></button>
</div>
</div>
<div class="quiz-step" data-step="3">
<p class="quiz-step-num">3 of 4</p>
<h2 class="quiz-q">How do you travel?</h2>
<p class="quiz-hint">Your style shapes which features matter most.</p>
<div class="quiz-opts">
<button type="button" class="quiz-opt" data-key="style" data-val="weekend"><span class="quiz-opt-icon" aria-hidden="true">🏖️</span><span class="quiz-opt-label">Weekend getaways</span><span class="quiz-opt-sub">Quick trips, campgrounds</span></button>
<button type="button" class="quiz-opt" data-key="style" data-val="extended"><span class="quiz-opt-icon" aria-hidden="true">🛣️</span><span class="quiz-opt-label">Extended road trips</span><span class="quiz-opt-sub">Weeks on the road</span></button>
<button type="button" class="quiz-opt" data-key="style" data-val="offgrid"><span class="quiz-opt-icon" aria-hidden="true">⛺</span><span class="quiz-opt-label">Off-grid adventure</span><span class="quiz-opt-sub">Boondocking &amp; dispersed</span></button>
<button type="button" class="quiz-opt" data-key="style" data-val="fulltime"><span class="quiz-opt-icon" aria-hidden="true">🏠</span><span class="quiz-opt-label">Full-time living</span><span class="quiz-opt-sub">Home on wheels</span></button>
</div>
</div>
<div class="quiz-step" data-step="4">
<p class="quiz-step-num">4 of 4</p>
<h2 class="quiz-q">What matters most?</h2>
<p class="quiz-hint">Pick the priority that’ll tip the decision.</p>
<div class="quiz-opts">
<button type="button" class="quiz-opt" data-key="priority" data-val="tow"><span class="quiz-opt-icon" aria-hidden="true">🚚</span><span class="quiz-opt-label">Easy to tow</span><span class="quiz-opt-sub">Lighter &amp; shorter</span></button>
<button type="button" class="quiz-opt" data-key="priority" data-val="space"><span class="quiz-opt-icon" aria-hidden="true">🛋️</span><span class="quiz-opt-label">Maximum space</span><span class="quiz-opt-sub">Room to stretch out</span></button>
<button type="button" class="quiz-opt" data-key="priority" data-val="offgrid"><span class="quiz-opt-icon" aria-hidden="true">🔋</span><span class="quiz-opt-label">Off-grid capability</span><span class="quiz-opt-sub">Solar, batteries, tanks</span></button>
<button type="button" class="quiz-opt" data-key="priority" data-val="value"><span class="quiz-opt-icon" aria-hidden="true">✨</span><span class="quiz-opt-label">Best value</span><span class="quiz-opt-sub">Most for the money</span></button>
</div>
</div>
<div class="quiz-step quiz-results" data-step="results">
<h2 class="quiz-q">Your top matches</h2>
<p class="quiz-hint" id="quiz-criteria"></p>
<div class="quiz-matches" id="quiz-matches"></div>
<div class="quiz-results-actions">
<button type="button" class="quiz-restart" id="quiz-restart">Start over</button>
<button type="button" class="quiz-explore" id="quiz-explore">Explore all floorplans</button>
</div>
</div>
</div>
<div class="quiz-nav" id="quiz-nav">
<button type="button" class="quiz-back" id="quiz-back" hidden>← Back</button>
</div>
</div>
</div>`;
}

export function renderIndex(families, trailers = [], resolve = assetPaths, motorhomes = [], motorhomeFamilies = []) {
  // Unified family grid: trailer families + motorhome families in one .fam-grid.
  const cards = [
    ...families.map((f) => renderFamilyCard(f, '')),
    ...motorhomeFamilies.map((f) => renderMotorhomeFamilyCard(f, '')),
  ].join('\n');
  const allFamilies = families.length + motorhomeFamilies.length;
  const totalPlans = families.reduce((n, f) => n + f.floorplanCount, 0)
    + motorhomeFamilies.reduce((n, f) => n + f.floorplanCount, 0);
  // Cinematic full-bleed hero. Pick a deliberately *different* establishing
  // shot than the first card below it (which is the flagship Classic), so the
  // opening viewport has visual variety instead of the same image twice — the
  // "duplicate hero" smell. International's red-rock adventure shot reads as the
  // brand hero; fall back to the flagship, then to the text-only header, so
  // this never renders a broken/empty hero if the catalog changes.
  const heroFam = families.find((f) => f.family === 'International')
    || families.find((f) => f.hero) || null;
  const heroImg = heroFam && heroFam.hero;
  const heroBand = heroImg
    ? `<header class="home-hero">
<img class="home-hero-img" src="${esc(heroImg)}" alt="An Airstream travel trailer at golden hour" width="1280" height="720" fetchpriority="high">
<div class="home-hero-shade"></div>
<div class="home-hero-inner">
<p class="eyebrow eyebrow-light">AIRSTREAM · 2026 + 2025</p>
<h1>Every Airstream, by family</h1>
<p class="lede">A cinematic, spec-accurate field guide to the current Airstream lineup — ${allFamilies} families, ${totalPlans} floorplans across travel trailers and motorhomes.</p>
<p class="home-hero-cta"><a class="home-hero-btn" href="#all" data-view-go="all">Explore all floorplans</a><button type="button" class="home-hero-ghost quiz-trigger" id="quiz-open">Find your Airstream →</button></p>
</div>
</header>`
    : `<header class="hero-head">
<p class="eyebrow">AIRSTREAM · 2026 + 2025</p>
<h1>Every Airstream, by family</h1>
<p class="lede">A cinematic, spec-accurate field guide to the current Airstream lineup — ${allFamilies} families, ${totalPlans} floorplans across travel trailers and motorhomes. Start with a family, then dive into each floorplan’s full specs.</p>
<p class="hero-cta"><a href="#all" data-view-go="all">Explore all floorplans →</a></p>
</header>`;
  // Editorial segmented control — styled as a magazine section divider
  // (Fraunces letterspaced caps + copper underline), NOT a SaaS pill. Distinct
  // class from the family-page year toggle (.seg-btn) so app.js modules don't
  // collide. aria-pressed conveys state to AT; hash deep-links each view.
  const viewToggle = `<nav class="viewseg" id="view-toggle" aria-label="Browse mode">
<a class="viewseg-btn is-active" href="#families" data-view="families" aria-current="page"><span class="viewseg-label">By family</span><span class="viewseg-sub">${allFamilies} model lines</span></a>
<a class="viewseg-btn" href="#all" data-view="all"><span class="viewseg-label">All floorplans</span><span class="viewseg-sub">${trailers.length + motorhomes.length} by the numbers</span></a>
</nav>`;
  const body = `${heroBand}
${viewToggle}
${renderQuiz()}
<section class="hub-view" id="view-families" data-view="families">
<main class="fam-grid" id="families">
${cards}
</main>
</section>
<section class="hub-view" id="view-all" data-view="all" hidden>
${renderExploreSections(trailers, resolve, motorhomes, { headingLevel: 'h2' })}
</section>`;
  return page({
    title: 'Airstream Explorer — the full lineup by family',
    description: `A spec-accurate, cinematic catalog of every current Airstream travel trailer and motorhome family: ${allFamilies} families, ${totalPlans} floorplans, with dimensions, weights, off-grid and pricing.`,
    body,
    active: 'index',
    canonicalPath: 'index.html',
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

// ---------------------------------------------------------------------------
// FAMILY SPEC COMPARISON TABLE
// ---------------------------------------------------------------------------

/**
 * Side-by-side spec comparison table for all floorplans within a family.
 * Renders a horizontally-scrollable table showing key specs for each floorplan
 * so users can compare without clicking into each detail page. Only shows the
 * latest model year to keep the table focused; if a family has a single
 * floorplan, the table is skipped (nothing to compare).
 */
function renderFamilyCompare(fam) {
  // Pick the latest year's floorplans for comparison
  const latest = fam.years[0];
  const plans = fam.trailers.filter((t) => t.year === latest);
  if (plans.length < 2) return ''; // nothing to compare
  // Find best/worst for highlighting
  const bestOffGrid = Math.max(...plans.map((t) => t.offGridScore || 0));
  const lightestLb = Math.min(...plans.map((t) => t.weightLb));
  const mostCcc = Math.max(...plans.map((t) => t.cccLb || 0));
  const cols = plans.map((t) => {
    const isLightest = t.weightLb === lightestLb;
    const isBestOffGrid = (t.offGridScore || 0) === bestOffGrid && bestOffGrid > 0;
    const isMostCcc = (t.cccLb || 0) === mostCcc && mostCcc > 0;
    return `<td>
<a href="../m/${esc(t.slug)}.html" class="fc-link">${esc(t.floorplan)}</a>
</td>
<td data-unit="length" data-raw="${esc(String(t.lengthFt))}">${esc(formatLength(t.lengthFt))}</td>
<td${isLightest ? ' class="fc-best"' : ''} data-unit="weight" data-raw="${esc(String(t.weightLb))}">${esc(formatWeight(t.weightLb))}</td>
<td data-unit="weight" data-raw="${esc(String(t.gvwrLb))}">${esc(formatWeight(t.gvwrLb))}</td>
<td${isMostCcc ? ' class="fc-best"' : ''}${t.cccLb ? ` data-unit="weight" data-raw="${esc(String(t.cccLb))}"` : ''}>${t.cccLb ? esc(formatWeight(t.cccLb)) : '—'}</td>
<td>${esc(String(t.sleeps))}</td>
<td data-unit="tanks" data-raw="${esc([t.freshGal, t.grayGal, t.blackGal].join(','))}">${esc(formatTanks(t.freshGal, t.grayGal, t.blackGal))}</td>
<td${isBestOffGrid ? ' class="fc-best"' : ''}>${t.offGridScore || '—'}</td>
<td>${esc(formatMsrp(t.msrp))}</td>`;
  });
  const headerRow = `<tr><th>Floorplan</th><th>Length</th><th>Dry wt</th><th>GVWR</th><th>CCC</th><th>Sleeps</th><th>Tanks <span class="fc-sub">F/G/B gal</span></th><th>Off-grid</th><th>MSRP</th></tr>`;
  const bodyRows = cols.map((c) => `<tr>${c}</tr>`).join('\n');
  return `<section class="fam-compare" id="fam-compare" aria-label="Spec comparison">
<h2>Compare ${esc(fam.family)} floorplans</h2>
<p class="muted">${esc(String(latest))} model year · ${esc(String(plans.length))} floorplans side by side. Best-in-family values highlighted.</p>
<div class="fc-scroll">
<table class="fc-table">
<thead>${headerRow}</thead>
<tbody>${bodyRows}</tbody>
</table>
</div>
</section>`;
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
  const famOfficial = officialUrl(fam.family);
  // Initial visible count = floorplans shown on load. With the latest year
  // selected that's one card per distinct floorplan, matching the hero count.
  const shownCount = hasBothYears
    ? fam.trailers.filter((t) => t.year === latest).length
    : fam.trailers.length;
  const body = `<nav class="breadcrumb" aria-label="Breadcrumb"><ol class="breadcrumb-list"><li><a href="../index.html">Home</a></li><li aria-current="page">${esc(fam.family)}</li></ol></nav>
<header class="fam-hero">
<img class="fam-hero-img" src="../${esc(fam.hero)}" alt="Airstream ${esc(fam.family)}" width="1280" height="720" fetchpriority="high" style="view-transition-name:vt-hero-${esc(fam.slug)}">
<div class="fam-hero-overlay">
<p class="eyebrow eyebrow-light">AIRSTREAM ${esc(fam.years.join(' + '))}</p>
<h1>${esc(fam.family)} ${limited}</h1>
<p class="fam-hero-meta">${esc(range)} · ${esc(len)} · ${esc(fam.floorplanCount)} floorplan${fam.floorplanCount === 1 ? '' : 's'} · sleeps up to ${esc(fam.sleepsMax)}</p>
${famOfficial ? `<p class="fam-hero-official"><a class="official-link official-link-light" href="${esc(famOfficial)}" target="_blank" rel="noopener">View ${esc(fam.family)} on airstream.com ↗</a></p>` : ''}
</div>
</header>
<section class="controls" aria-label="Filters">
${yearSeg}
<span class="count" id="result-count" aria-live="polite" aria-atomic="true">${shownCount} floorplan${shownCount === 1 ? '' : 's'}</span>
</section>
<main class="cards" id="cards">
${cards}
</main>
${renderFamilyCompare(fam)}`;
  // Breadcrumb trail: Home → Family
  const famBreadcrumbItems = [
    { name: 'Airstream Explorer', path: 'index.html' },
    { name: `Airstream ${fam.family}`, path: `f/${fam.slug}.html` },
  ];
  return page({
    title: `Airstream ${fam.family} — floorplans, specs & prices`,
    description: `Every Airstream ${fam.family} floorplan (${fam.years.join(' + ')}): ${range}, ${len}, sleeps up to ${fam.sleepsMax}. Compare ${fam.floorplanCount} floorplan${fam.floorplanCount === 1 ? '' : 's'} with full specs.`,
    body,
    relRoot: '../',
    active: 'index',
    canonicalPath: `f/${fam.slug}.html`,
    ogImage: fam.hero || '',
    head: breadcrumbJsonLd(famBreadcrumbItems),
  });
}

// ---------------------------------------------------------------------------
// DETAIL: one floorplan
// ---------------------------------------------------------------------------

/**
 * Off-grid endurance estimator block for a detail page. Server-renders the
 * default scenario (2 people, moderate use, summer, solar on) so it's correct
 * with no JS; the client recomputes live from the data-* spec values. Every
 * assumption is disclosed inline — we model how this trailer's REAL battery /
 * solar / tank numbers play out, we don't invent specs.
 */
export function renderOffGridTool(t) {
  // Skip entirely if we somehow lack the inputs (keeps it honest).
  if (!(t.batteryKwh > 0) || !(t.freshGal > 0)) return '';
  const def = estimateOffGrid(t, { people: 2, intensity: 'moderate', season: 'summer', useSolar: true });
  const intensityOpts = Object.entries(LOAD_PRESETS)
    .map(([k, v]) => `<option value="${esc(k)}"${k === 'moderate' ? ' selected' : ''}>${esc(v.label)} — ${esc(v.blurb)}</option>`)
    .join('');
  return `<section class="estimator offgrid-tool" id="offgrid" aria-label="Off-grid endurance estimator"
 data-battery="${esc(t.batteryKwh)}" data-solar="${esc(t.solarW || 0)}" data-fresh="${esc(t.freshGal)}" data-gray="${esc(t.grayGal == null ? '' : t.grayGal)}" data-black="${esc(t.blackGal == null ? '' : t.blackGal)}">
<div class="est-head">
<h2>How long off-grid?</h2>
<p class="est-sub">Boondocking endurance for this floorplan — modeled from its real ${esc(t.batteryKwh)} kWh battery, ${t.solarW ? `${esc(t.solarW)} W solar` : 'no factory solar'}, and ${esc(t.freshGal)} gal fresh / ${t.grayGal != null ? esc(t.grayGal) : '—'} gal gray / ${t.blackGal != null ? esc(t.blackGal) : '—'} gal black tanks.</p>
</div>
<div class="est-controls">
<div class="est-field">
<label for="og-people">Campers</label>
<select id="og-people">
<option value="1">1 person</option>
<option value="2" selected>2 people</option>
<option value="3">3 people</option>
<option value="4">4 people</option>
<option value="5">5 people</option>
</select>
</div>
<div class="est-field est-field-wide">
<label for="og-intensity">Power &amp; water use</label>
<select id="og-intensity">${intensityOpts}</select>
</div>
<div class="est-field">
<label for="og-season">Season</label>
<select id="og-season">
<option value="summer" selected>Summer sun</option>
<option value="shoulder">Spring / fall</option>
<option value="winter">Winter</option>
</select>
</div>
<div class="est-field est-field-check">
<label class="est-check"><input type="checkbox" id="og-solar" checked> Count rooftop solar</label>
</div>
</div>
<div class="est-result" id="og-result" aria-live="polite" aria-atomic="true"
 data-nights="${esc(formatNights(def.days))}"
 data-limiter="${esc(def.limiter === 'power' ? 'Battery-limited' : 'Water-limited')}"
 data-detail="${esc(cap(def.limiterDetail))}">
<div class="est-big">
<span class="est-number" id="og-nights">${esc(formatNights(def.days))}</span>
<span class="est-number-cap" id="og-limiter">${esc(def.limiter === 'power' ? 'Battery-limited' : 'Water-limited')}</span>
</div>
<p class="est-detail" id="og-detail">${esc(cap(def.limiterDetail))} under these assumptions.</p>
<div class="est-bars" id="og-bars">${offGridBars(def)}</div>
</div>
<details class="est-method">
<summary>How this is calculated</summary>
<p>Power: usable battery = nameplate kWh × 0.8 (blended depth-of-discharge). Daily load presets — light ≈ 1,500, moderate ≈ 2,800, heavy ≈ 5,000 Wh/day — from published boondocking power budgets, <strong>excluding air conditioning</strong> (no trailer battery runs rooftop AC for long). Solar harvest = panel watts × peak-sun-hours (summer 5.5, spring/fall 4.0, winter 2.5) × 0.7 system derate. Water: per-person daily use (light 3 / moderate 5 / heavy 8 gal fresh; gray ≈ 80% of fresh; black from toilet use) against the real tank sizes. Endurance is whichever runs out first. Estimates for planning — your real usage varies.</p>
</details>
</section>`;
}

/** Three little capacity bars (battery, fresh, waste) showing days each lasts. */
function offGridBars(est) {
  const cap14 = (d) => Math.max(2, Math.min(100, (Math.min(d, 14) / 14) * 100));
  const pwr = est.power.days;
  const waste = Math.min(est.water.grayDays, est.water.blackDays);
  const rows = [
    ['Battery', pwr == null ? Infinity : pwr, pwr == null ? 'Solar covers it' : daysLabel(pwr)],
    ['Fresh water', est.water.freshDays, daysLabel(est.water.freshDays)],
    ['Waste tanks', waste, daysLabel(waste)],
  ];
  return rows.map(([label, d, txt]) =>
    `<div class="est-bar"><span class="est-bar-label">${esc(label)}</span><span class="est-bar-track"><span class="est-bar-fill" style="width:${cap14(d)}%"></span></span><span class="est-bar-val">${esc(txt)}</span></div>`,
  ).join('');
}
function daysLabel(d) {
  if (!Number.isFinite(d)) return '14+ days';
  if (d >= 13.5) return '14+ days';
  if (d < 2) return `${d.toFixed(1)} days`;
  return `${Math.round(d)} days`;
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// ---------------------------------------------------------------------------
// DETAIL: tow-safety calculator
// ---------------------------------------------------------------------------

const TOW_VERDICT_META = {
  comfortable: { label: 'Comfortable match', cls: 'tow-ok', blurb: 'Good margin on every limit.' },
  tight: { label: 'Tight but legal', cls: 'tow-tight', blurb: 'Within ratings, but little headroom — load carefully.' },
  over: { label: 'Over a limit', cls: 'tow-over', blurb: 'Exceeds a rating loaded — not a safe match as configured.' },
};

/** One result row per check (tow / payload / GCWR) with a usage meter. */
function towCheckRows(result) {
  return result.checks.map((c) => {
    const meta = TOW_VERDICT_META[c.grade];
    const pctW = Math.max(2, Math.min(100, Math.round(c.frac * 100)));
    return `<div class="tow-check tow-check-${esc(c.grade)}" data-key="${esc(c.key)}">
<div class="tow-check-top"><span class="tow-check-label">${esc(c.label)}</span><span class="tow-check-pct">${esc(formatPct(c.frac))}</span></div>
<div class="tow-check-track"><span class="tow-check-fill ${esc(meta.cls)}" style="width:${pctW}%"></span></div>
<div class="tow-check-nums"><span>${esc(formatWeight(c.used))} used</span><span>of ${esc(formatWeight(c.limit))}</span></div>
</div>`;
  }).join('');
}

/**
 * Tow-safety calculator for one floorplan. Server-renders a real default
 * pairing (this trailer behind a sensible vehicle) so the page is useful with
 * JS off; the client (app.js towTool) recomputes when the reader picks another
 * vehicle or changes the cab load. Mirrors the off-grid tool's contract:
 * data-* defaults, a method <details>, and a CSP-safe JSON data island.
 *
 * Honesty rules baked in:
 *  - Compares against the trailer's GVWR (loaded), not dry weight.
 *  - Loaded tongue weight modeled at 13% of GVWR (the 10-15% rule), not the
 *    optimistic published dry hitch figure.
 *  - Every vehicle states its exact configuration and links its sources.
 */
export function renderTowTool(t) {
  // Need a real loaded weight to compare against. GVWR is the honest basis.
  if (!(t.gvwrLb > 0) || !TOW_VEHICLES.length) return '';
  const trailer = { gvwrLb: t.gvwrLb, weightLb: t.weightLb, hitchWeightLb: t.hitchWeightLb };
  const def = pickDefaultVehicle(TOW_VEHICLES, trailer, { truckLoadLb: DEFAULT_TRUCK_OCCUPANT_LB });
  if (!def) return '';
  const defResult = evaluateTow(def, trailer, { truckLoadLb: DEFAULT_TRUCK_OCCUPANT_LB });
  const defMeta = TOW_VERDICT_META[defResult.verdict];

  const vehicleOpts = TOW_VEHICLES
    .slice()
    .sort((a, b) => b.maxTowLb - a.maxTowLb)
    .map((v) => `<option value="${esc(v.id)}"${v.id === def.id ? ' selected' : ''}>${esc(v.name)} — ${esc(v.config)}</option>`)
    .join('');

  // CSP-safe data island: the full vehicle table for the client. No inline JS;
  // app.js reads + parses this <script type="application/json"> by id. Values
  // are JSON-encoded so esc() isn't needed, but we still neutralize any "</"
  // sequence so the block can't break out of the script element.
  const dataIsland = JSON.stringify({
    trailer: {
      model: t.model, floorplan: t.floorplan,
      gvwrLb: t.gvwrLb, weightLb: t.weightLb || null, hitchWeightLb: t.hitchWeightLb || null,
    },
    tonguePct: TONGUE_PCT_LOADED,
    defaultTruckLoadLb: DEFAULT_TRUCK_OCCUPANT_LB,
    defaultVehicleId: def.id,
    vehicles: TOW_VEHICLES,
  }).replace(/<\//g, '<\\/');

  const sourceLinks = def.sources
    .map((s, i) => `<a href="${esc(s)}" target="_blank" rel="noopener nofollow">source${def.sources.length > 1 ? ' ' + (i + 1) : ''}</a>`)
    .join(' · ');

  return `<section class="towtool" id="tow" aria-label="Tow-safety calculator"
 data-gvwr="${esc(t.gvwrLb)}"${t.weightLb ? ` data-weight="${esc(t.weightLb)}"` : ''}${t.hitchWeightLb ? ` data-hitch="${esc(t.hitchWeightLb)}"` : ''}>
<script type="application/json" id="tow-data">${dataIsland}</script>
<div class="tow-head">
<h2>Can your vehicle tow it?</h2>
<p class="tow-sub">Checks this floorplan's <strong>loaded</strong> weight (${esc(formatWeight(t.gvwrLb))} GVWR) against a tow vehicle's three real limits — tow rating, payload, and combined weight (GCWR). Pick your vehicle:</p>
</div>
<div class="tow-controls">
<div class="tow-field tow-field-wide">
<label for="tow-vehicle">Tow vehicle</label>
<select id="tow-vehicle">${vehicleOpts}</select>
</div>
<div class="tow-field">
<label for="tow-load">People &amp; gear in the cab</label>
<select id="tow-load">
<option value="150">~150 lb (1 adult)</option>
<option value="300"${DEFAULT_TRUCK_OCCUPANT_LB === 300 ? ' selected' : ''}>~300 lb (2 adults)</option>
<option value="500">~500 lb (family)</option>
<option value="800">~800 lb (family + gear)</option>
</select>
</div>
</div>
<div class="tow-verdict ${esc(defMeta.cls)}" id="tow-verdict" aria-live="polite" aria-atomic="true"
 data-verdict="${esc(defResult.verdict)}">
<div class="tow-verdict-badge">
<span class="tow-verdict-label" id="tow-verdict-label">${esc(defMeta.label)}</span>
<span class="tow-verdict-vehicle" id="tow-verdict-vehicle">${esc(def.name)}</span>
</div>
<p class="tow-verdict-blurb" id="tow-verdict-blurb">${esc(defMeta.blurb)} Binds on ${esc(defResult.binding.label.toLowerCase())} at ${esc(formatPct(defResult.binding.frac))}.</p>
</div>
<div class="tow-checks" id="tow-checks">${towCheckRows(defResult)}</div>
<p class="tow-config muted" id="tow-config">Modeled config: ${esc(def.config)}. <span id="tow-sources">${sourceLinks}</span></p>
<details class="tow-method">
<summary>How this is calculated</summary>
<p>Three checks, each from the tow vehicle's <strong>published ${esc(def.year)}-spec</strong> ratings for one stated configuration:</p>
<ul>
<li><strong>Trailer tow rating</strong> — the trailer at its loaded weight (GVWR, not dry) vs. the truck's max tow rating.</li>
<li><strong>Payload</strong> — loaded tongue weight (modeled at ${Math.round(TONGUE_PCT_LOADED * 100)}% of trailer GVWR, the mid of the 10–15% rule) plus people &amp; gear in the cab vs. the truck's payload.</li>
<li><strong>Combined weight (GCWR)</strong> — truck + trailer + everything vs. the gross combined weight rating.</li>
</ul>
<p>The verdict is the <em>worst</em> of the three: ≤80% of a limit is comfortable, 80–100% is tight, over 100% exceeds it. Manufacturers' "max tow" and "max payload" usually come from <em>different</em> configurations and are mutually exclusive, so each vehicle here uses ONE coherent, sourced config. These are planning figures — your truck's door-jamb certification label is the final word.</p>
</details>
</section>`;
}

// ---------------------------------------------------------------------------
// DETAIL: fuel cost estimator
// ---------------------------------------------------------------------------

/**
 * Trip fuel cost estimator for one floorplan. Server-renders a default scenario
 * (this trailer behind the default tow vehicle, 500 mi, $3.50/gal) so the page
 * is useful with no JS; the client recomputes live when the user changes inputs.
 * Uses the same tow-vehicle dataset as the tow-safety calculator.
 */
export function renderFuelTool(t) {
  if (!(t.gvwrLb > 0) || !TOW_VEHICLES.length) return '';
  const trailer = { gvwrLb: t.gvwrLb, weightLb: t.weightLb };
  const def = pickDefaultVehicle(TOW_VEHICLES, trailer, { truckLoadLb: DEFAULT_TRUCK_OCCUPANT_LB });
  if (!def) return '';
  const defResult = estimateFuelCost(def, trailer);
  const defElectric = !!defResult.isElectric;

  const vehicleOpts = TOW_VEHICLES
    .slice()
    .sort((a, b) => b.maxTowLb - a.maxTowLb)
    .map((v) => `<option value="${esc(v.id)}"${v.id === def.id ? ' selected' : ''}>${esc(v.name)} — ${esc(v.config)}</option>`)
    .join('');

  // Data island for client-side recomputation. EVs carry their fuel type +
  // baseline kWh/100mi so the client uses the electricity model, never fake
  // gasoline math; gas vehicles keep the MPG-class model.
  const dataIsland = JSON.stringify({
    trailer: { gvwrLb: t.gvwrLb, weightLb: t.weightLb || null },
    vehicles: TOW_VEHICLES.map((v) => ({
      id: v.id, name: v.name, class: v.class, curbWeightLb: v.curbWeightLb,
      fuel: v.fuel === 'electric' ? 'electric' : 'gas',
      kwhPer100mi: v.kwhPer100mi || null,
    })),
    defaultVehicleId: def.id,
    defaults: {
      distanceMi: DEFAULT_DISTANCE_MI,
      fuelPriceGal: DEFAULT_FUEL_PRICE,
      kwhPriceKwh: DEFAULT_KWH_PRICE,
      kwhPer100mi: DEFAULT_KWH_PER_100MI,
    },
    classmpg: VEHICLE_CLASS_MPG,
  }).replace(/<\//g, '<\\/');

  // Default-vehicle economy stat + price control differ by fuel type, but the
  // element ids stay the same so the client can swap text/labels on change.
  const economyStat = defElectric
    ? `${esc(defResult.towingKwhPer100mi.toFixed(1))} kWh/100mi`
    : esc(formatMpg(defResult.towingMpg));
  const usedStat = defElectric
    ? `${esc(defResult.kwhUsed.toFixed(1))} kWh`
    : `${esc(defResult.gallonsUsed.toFixed(1))} gal`;
  const usedLabel = defElectric ? 'Energy needed' : 'Fuel needed';
  const economyLabel = defElectric ? 'Towing efficiency' : 'Towing economy';
  const priceLabel = defElectric ? 'Electricity price' : 'Fuel price';
  const priceValue = defElectric ? DEFAULT_KWH_PRICE.toFixed(2) : DEFAULT_FUEL_PRICE.toFixed(2);
  const priceSuffix = defElectric ? '$/kWh' : '$/gal';
  const priceStep = defElectric ? '0.01' : '0.10';
  const priceMax = defElectric ? '2' : '10';
  const costNoun = defElectric ? 'estimated energy' : 'estimated fuel';

  return `<section class="estimator fuel-tool" id="fuel" aria-label="Trip fuel cost estimator"
 data-gvwr="${esc(t.gvwrLb)}"${t.weightLb ? ` data-weight="${esc(t.weightLb)}"` : ''}>
<script type="application/json" id="fuel-data">${dataIsland}</script>
<div class="est-head">
<h2>Trip fuel cost</h2>
<p class="est-sub" id="fuel-sub">Estimate what it costs to tow this ${esc(t.model)} ${esc(t.floorplan)} (${esc(formatWeight(t.gvwrLb))} loaded) on a road trip. ${defElectric ? 'Energy use climbs' : 'Fuel economy drops'} ${Math.round(defResult.penalty * 100)}% when towing — the heavier the trailer relative to the tow vehicle, the bigger the hit.</p>
</div>
<div class="est-controls">
<div class="est-field est-field-wide">
<label for="fuel-vehicle">Tow vehicle</label>
<select id="fuel-vehicle">${vehicleOpts}</select>
</div>
<div class="est-field">
<label for="fuel-distance">Trip distance</label>
<div class="est-input-suffix"><input type="number" id="fuel-distance" value="${DEFAULT_DISTANCE_MI}" min="10" max="10000" step="10"><span>miles</span></div>
</div>
<div class="est-field">
<label for="fuel-price" id="fuel-price-label">${priceLabel}</label>
<div class="est-input-suffix"><input type="number" id="fuel-price" value="${priceValue}" min="0.05" max="${priceMax}" step="${priceStep}"><span id="fuel-price-suffix">${priceSuffix}</span></div>
</div>
</div>
<div class="est-result" id="fuel-result" aria-live="polite" aria-atomic="true">
<div class="est-big">
<span class="est-number" id="fuel-cost">${esc(formatDollars(defResult.totalCost))}</span>
<span class="est-per" id="fuel-cost-noun">${costNoun}</span>
</div>
<div class="fuel-stats" id="fuel-stats">
<div class="fuel-stat"><span class="fuel-stat-value" id="fuel-mpg">${economyStat}</span><span class="fuel-stat-label" id="fuel-mpg-label">${economyLabel}</span></div>
<div class="fuel-stat"><span class="fuel-stat-value" id="fuel-gallons">${usedStat}</span><span class="fuel-stat-label" id="fuel-gallons-label">${usedLabel}</span></div>
<div class="fuel-stat"><span class="fuel-stat-value" id="fuel-cpm">${esc(formatDollars(defResult.costPerMile))}/mi</span><span class="fuel-stat-label">Cost per mile</span></div>
</div>
</div>
<details class="est-method">
<summary>How this is calculated</summary>
<p><strong>Gas vehicles:</strong> towing cuts fuel economy 30–60% vs. unladen driving. The penalty scales with the weight ratio (trailer GVWR ÷ tow-vehicle curb weight): a 20% base drag from the hitch + aerodynamics, plus 25% per 1.0 weight ratio, capped at 60%. This aligns with real-world Airstream towing reports (8–15 MPG across the lineup). Cost = distance ÷ towing MPG × price per gallon.</p>
<p><strong>Electric vehicles:</strong> the same weight-ratio penalty is applied to each EV's <em>EPA-rated</em> energy use (kWh/100mi), so a ~50% penalty roughly doubles consumption — consistent with the ≈50% range loss EV owners report when towing. Cost = distance ÷ 100 × towing kWh/100mi × price per kWh. We never apply gasoline math to an EV.</p>
<p>These are planning estimates — your actual range depends on speed, terrain, wind, and driving style.</p>
</details>
</section>`;
}

// ---------------------------------------------------------------------------
// DETAIL: payload / packing calculator
// ---------------------------------------------------------------------------

/**
 * Payload (packing) calculator for one floorplan. Shows how much of the CCC
 * is consumed by water and propane, and how much remains for personal cargo.
 * Server-renders a default scenario (full water, dual 20 lb propane).
 */

// ---------------------------------------------------------------------------
// FINANCING CALCULATOR: estimated monthly payment based on MSRP
// ---------------------------------------------------------------------------

/** Default financing assumptions — reasonable RV loan terms. */
const FINANCE_DEFAULTS = { downPct: 20, apr: 6.99, termYears: 15 };

/** Calculate monthly payment using standard amortization formula. */
export function calculateMonthly(msrp, downPct, apr, termYears) {
  const down = Math.round(msrp * downPct / 100);
  const principal = msrp - down;
  if (principal <= 0) return { monthly: 0, totalCost: down, totalInterest: 0, down, principal: 0 };
  const r = apr / 100 / 12;
  const n = termYears * 12;
  const monthly = r > 0
    ? principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
    : principal / n;
  const totalCost = Math.round(monthly) * n + down;
  return { monthly: Math.round(monthly), totalCost, totalInterest: totalCost - msrp, down, principal };
}

/** Render the financing calculator section for a detail page. */
export function renderFinancingTool(t) {
  if (!(t.msrp > 0)) return '';
  const d = FINANCE_DEFAULTS;
  const calc = calculateMonthly(t.msrp, d.downPct, d.apr, d.termYears);

  const termOpts = [5, 10, 15, 20].map((y) =>
    `<option value="${y}"${y === d.termYears ? ' selected' : ''}>${y} years</option>`
  ).join('');

  const dataIsland = JSON.stringify({ msrp: t.msrp }).replace(/<\//g, '<\\/');

  return `<section class="estimator finance-tool" id="finance" aria-label="Monthly payment estimator"
 data-msrp="${esc(t.msrp)}">
<script type="application/json" id="finance-data">${dataIsland}</script>
<div class="est-head">
<h2>Estimated monthly payment</h2>
<p class="est-sub">A financing estimate for the ${esc(t.model)} ${esc(t.floorplan)} at ${formatMsrp(t.msrp)} MSRP. Adjust the terms below — this is for planning only, not a loan offer.</p>
</div>
<div class="est-controls">
<div class="est-field">
<label for="finance-down">Down payment</label>
<div class="finance-slider-row">
<input type="range" id="finance-down" min="0" max="50" step="5" value="${d.downPct}" class="finance-range" aria-label="Down payment percentage">
<span class="finance-range-val" id="finance-down-val">${d.downPct}% (${formatMsrp(calc.down)})</span>
</div>
</div>
<div class="est-field">
<label for="finance-apr">Interest rate (APR)</label>
<div class="finance-slider-row">
<input type="range" id="finance-apr" min="3" max="12" step="0.25" value="${d.apr}" class="finance-range" aria-label="Annual percentage rate">
<span class="finance-range-val" id="finance-apr-val">${d.apr}%</span>
</div>
</div>
<div class="est-field">
<label for="finance-term">Loan term</label>
<select id="finance-term">${termOpts}</select>
</div>
</div>
<div class="est-result" id="finance-result" aria-live="polite" aria-atomic="true">
<div class="est-big">
<span class="est-number" id="finance-monthly">${formatMsrp(calc.monthly)}</span>
<span class="est-number-cap">per month</span>
</div>
<div class="finance-breakdown">
<dl class="finance-dl">
<div class="finance-dl-row"><dt>Loan amount</dt><dd id="finance-principal">${formatMsrp(calc.principal)}</dd></div>
<div class="finance-dl-row"><dt>Total interest</dt><dd id="finance-interest">${formatMsrp(calc.totalInterest)}</dd></div>
<div class="finance-dl-row finance-dl-total"><dt>Total cost</dt><dd id="finance-total">${formatMsrp(calc.totalCost)}</dd></div>
</dl>
</div>
</div>
<p class="est-caveat muted">For planning purposes only. Actual rates depend on credit, lender, and terms. Does not include tax, registration, or dealer fees.</p>
</section>`;
}

export function renderPayloadTool(t) {
  if (!(t.cccLb > 0)) return '';
  const def = calculatePayload(t);

  const propaneOpts = Object.entries(PROPANE_PRESETS)
    .map(([k, v]) => `<option value="${esc(k)}"${k === DEFAULT_PROPANE ? ' selected' : ''}>${esc(v.label)}</option>`)
    .join('');

  const waterFillOpts = [
    ['1.0', 'Full (100%)'],
    ['0.75', 'Three-quarter (75%)'],
    ['0.5', 'Half (50%)'],
    ['0.25', 'Quarter (25%)'],
    ['0', 'Empty (travel dry)'],
  ].map(([v, l]) => `<option value="${v}"${v === '1.0' ? ' selected' : ''}>${esc(l)}</option>`).join('');

  // Status badge
  const STATUS_META = {
    ok: { label: 'Good capacity', cls: 'payload-ok' },
    tight: { label: 'Getting tight', cls: 'payload-tight' },
    over: { label: 'Over capacity', cls: 'payload-over' },
  };
  const statusMeta = STATUS_META[def.status];

  // Breakdown bars
  const barPct = (lb) => Math.max(2, Math.min(100, (lb / (def.cccLb || 1)) * 100));
  const bars = [
    ['Fresh water', def.waterLb, `${esc(formatLb(def.waterLb))} (${t.freshGal || 0} gal × 8.34 lb/gal)`],
    ['Propane', def.propaneLb, esc(formatLb(def.propaneLb))],
  ];

  const barsHtml = bars.map(([label, lb, detail]) =>
    `<div class="est-bar"><span class="est-bar-label">${esc(label)}</span><span class="est-bar-track"><span class="est-bar-fill" style="width:${barPct(lb)}%"></span></span><span class="est-bar-val">${detail}</span></div>`,
  ).join('');

  // Gear presets as checkboxes for the client
  const gearChecks = Object.entries(GEAR_PRESETS)
    .map(([k, v]) => `<label class="payload-gear-item"><input type="checkbox" class="payload-gear-check" data-key="${esc(k)}" data-weight="${v.weightLb}"><span class="payload-gear-name">${esc(v.label)}</span><span class="payload-gear-wt">${esc(formatLb(v.weightLb))}</span></label>`)
    .join('');

  // Data island for client
  const dataIsland = JSON.stringify({
    cccLb: t.cccLb,
    freshGal: t.freshGal || 0,
    propanePresets: PROPANE_PRESETS,
    gearPresets: GEAR_PRESETS,
    waterLbPerGal: WATER_LB_PER_GAL,
  }).replace(/<\//g, '<\\/');

  return `<section class="estimator payload-tool" id="payload" aria-label="Payload packing calculator"
 data-ccc="${esc(t.cccLb)}" data-fresh="${esc(t.freshGal || 0)}">
<script type="application/json" id="payload-data">${dataIsland}</script>
<div class="est-head">
<h2>How much can you pack?</h2>
<p class="est-sub">This ${esc(t.model)} ${esc(t.floorplan)} has ${esc(formatWeight(t.cccLb))} of cargo carrying capacity (CCC). Water and propane eat into that before you load a single bag — here's what's left for your gear.</p>
</div>
<div class="est-controls">
<div class="est-field">
<label for="payload-water">Fresh water fill</label>
<select id="payload-water">${waterFillOpts}</select>
</div>
<div class="est-field">
<label for="payload-propane">Propane</label>
<select id="payload-propane">${propaneOpts}</select>
</div>
</div>
<div class="est-result" id="payload-result" aria-live="polite" aria-atomic="true">
<div class="est-big">
<span class="est-number" id="payload-remaining">${esc(formatLb(def.remainingLb))}</span>
<span class="est-number-cap ${esc(statusMeta.cls)}" id="payload-status">${esc(statusMeta.label)}</span>
</div>
<p class="est-detail" id="payload-detail">Remaining for personal gear after water and propane (${esc(Math.round(def.usedPct * 100))}% of CCC used by consumables).</p>
<div class="est-bars" id="payload-bars">${barsHtml}</div>
</div>
<div class="payload-gear" id="payload-gear">
<p class="payload-gear-title">Add common gear to see the impact:</p>
<div class="payload-gear-grid">${gearChecks}</div>
</div>
<details class="est-method">
<summary>How this is calculated</summary>
<p>CCC (Cargo Carrying Capacity) is the maximum weight you can add to the trailer beyond its dry (empty) weight. Fresh water weighs 8.34 lb per gallon (USGS standard). Propane weight is the fuel itself — standard Airstream dual 20 lb tanks hold 40 lb of LP gas. After subtracting these consumables, the remainder is what you have for personal belongings, food, and gear. Exceeding CCC means exceeding the trailer's GVWR — an unsafe and often illegal condition. When in doubt, weigh your loaded trailer at a truck scale.</p>
</details>
</section>`;
}

// ---------------------------------------------------------------------------
// DETAIL: one floorplan
// ---------------------------------------------------------------------------

/**
 * Official interior décor section. `schemes` is the resolved décor for this
 * trailer's family (see resolveDecor): each scheme has a name, official
 * description, and a row of labeled material swatches. Returns '' when empty.
 */
export function renderDecor(schemes, model) {
  if (!schemes || !schemes.length) return '';
  const cards = schemes
    .map((s) => {
      const swatches = s.swatches
        .map(
          (sw) =>
            `<figure class="decor-swatch"><img src="../${esc(sw.src)}" alt="${esc(s.name)} — ${esc(sw.kind)}" loading="lazy" width="120" height="120"><figcaption>${esc(sw.kind)}</figcaption></figure>`,
        )
        .join('');
      const desc = s.description
        ? `<p class="decor-desc">${esc(s.description)}</p>`
        : '';
      return `<article class="decor-card">
<h3 class="decor-name">${esc(s.name)}</h3>
${desc}
<div class="decor-swatches">${swatches}</div>
</article>`;
    })
    .join('\n');
  return `<section class="decor" aria-label="Interior décor options">
<h2>Interior décor options</h2>
<p class="decor-intro muted">Official Airstream interior packages for the ${esc(model)} — cabinetry, upholstery, and coordinating materials. Décor is offered by family, so these apply across its floorplans.</p>
<div class="decor-grid">${cards}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// SECTION QUICK-NAV: horizontal sticky bar for detail page sections
// ---------------------------------------------------------------------------
function buildSectionNav(items) {
  if (items.length < 2) return '';
  const links = items.map(([href, label]) =>
    `<a href="${href}" class="secnav-link">${esc(label)}</a>`).join('');
  return `<nav class="secnav" aria-label="Page sections" data-secnav>${links}</nav>`;
}

/** Build a plain-text spec summary for clipboard copy. */
function buildSpecText(t) {
  const lines = [
    `${trailerTitle(t)}`,
    `Length: ${formatLength(t.lengthFt)}`,
    `Dry weight: ${formatWeight(t.weightLb)}`,
    `GVWR: ${formatWeight(t.gvwrLb)}`,
    t.cccLb ? `Cargo capacity (CCC): ${formatWeight(t.cccLb)}` : null,
    t.hitchWeightLb ? `Hitch weight: ${formatWeight(t.hitchWeightLb)}` : null,
    `Sleeps: ${t.sleeps}`,
    `Tanks: ${formatTanks(t.freshGal, t.grayGal, t.blackGal)}`,
    t.solarW ? `Solar: ${t.solarW}W ${t.solarStandard ? '(standard)' : '(optional)'}` : null,
    t.batteryKwh ? `Battery: ${t.batteryKwh} kWh` : null,
    `Off-grid score: ${t.offGridScore}/100`,
    `MSRP: ${formatMsrp(t.msrp)}`,
  ].filter(Boolean);
  // Use || separator (split back to \n in client JS for clipboard copy)
  return lines.join(' || ');
}

// ---------------------------------------------------------------------------
// SPEC RADAR CHART: visual fingerprint of how a trailer stacks up
// ---------------------------------------------------------------------------

/**
 * Catalog-wide min/max for radar axes. These define the normalization range.
 * Values are from the full 2025+2026 catalog so every model maps to 0-1.
 * Axes where "more is better" scale linearly; "less is better" axes are
 * inverted so the polygon always grows outward toward "better".
 */
const RADAR_AXES = [
  { key: 'offGridScore', label: 'Off-grid',  min: 35,  max: 95,  better: 'higher' },
  { key: 'cccLb',        label: 'Cargo',     min: 300, max: 2300, better: 'higher' },
  { key: 'sleeps',       label: 'Sleeps',    min: 2,   max: 8,    better: 'higher' },
  { key: 'lengthFt',     label: 'Compact',   min: 16,  max: 34,   better: 'lower'  },
  { key: 'weightLb',     label: 'Light',     min: 2600,max: 8500, better: 'lower'  },
  { key: 'msrp',         label: 'Value',     min: 50000, max: 225000, better: 'lower' },
];

function radarNormalize(value, axis) {
  if (value == null || value <= 0) return 0;
  const clamped = Math.max(axis.min, Math.min(axis.max, value));
  const ratio = (clamped - axis.min) / (axis.max - axis.min);
  return axis.better === 'lower' ? 1 - ratio : ratio;
}

/**
 * Render a pure-SVG radar chart for one trailer. Each axis is normalized 0-1
 * against catalog-wide min/max. The polygon shows this trailer's "shape" —
 * where it excels and where it trades off.
 */
function renderRadarChart(t) {
  const cx = 120, cy = 120, R = 90;
  const n = RADAR_AXES.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2; // top

  // Concentric guide rings at 33%, 66%, 100%
  const rings = [0.33, 0.66, 1].map((frac) => {
    const r = R * frac;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = startAngle + i * angleStep;
      pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
    }
    return `<polygon points="${pts.join(' ')}" class="radar-ring"/>`;
  }).join('');

  // Spoke lines from center to each vertex
  const spokes = RADAR_AXES.map((_, i) => {
    const a = startAngle + i * angleStep;
    return `<line x1="${cx}" y1="${cy}" x2="${cx + R * Math.cos(a)}" y2="${cy + R * Math.sin(a)}" class="radar-spoke"/>`;
  }).join('');

  // Data polygon
  const values = RADAR_AXES.map((axis) => radarNormalize(t[axis.key], axis));
  const dataPts = values.map((v, i) => {
    const r = Math.max(R * 0.08, R * v); // minimum visible radius
    const a = startAngle + i * angleStep;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

  // Data dots
  const dots = values.map((v, i) => {
    const r = Math.max(R * 0.08, R * v);
    const a = startAngle + i * angleStep;
    return `<circle cx="${cx + r * Math.cos(a)}" cy="${cy + r * Math.sin(a)}" r="3.5" class="radar-dot"/>`;
  }).join('');

  // Axis labels positioned outside the chart
  const labels = RADAR_AXES.map((axis, i) => {
    const a = startAngle + i * angleStep;
    const labelR = R + 22;
    const x = cx + labelR * Math.cos(a);
    const y = cy + labelR * Math.sin(a);
    const anchor = Math.abs(Math.cos(a)) < 0.1 ? 'middle'
      : Math.cos(a) > 0 ? 'start' : 'end';
    const dy = Math.abs(Math.sin(a)) > 0.8 ? (Math.sin(a) > 0 ? '0.9em' : '-0.3em') : '0.35em';
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" dy="${dy}" class="radar-label">${esc(axis.label)}</text>`;
  }).join('');

  return `<div class="radar-chart" aria-label="Spec profile chart">
<svg viewBox="0 0 240 240" width="240" height="240" class="radar-svg" role="img" aria-label="Radar chart showing ${esc(t.model)} ${esc(t.floorplan)} spec profile">
${rings}
${spokes}
<polygon points="${dataPts}" class="radar-fill"/>
<polygon points="${dataPts}" class="radar-stroke"/>
${dots}
${labels}
</svg>
<p class="radar-hint muted">How this floorplan stacks up across the lineup</p>
</div>`;
}

// ---------------------------------------------------------------------------
// CROSS-FAMILY RECOMMENDATIONS: similar trailers from other families
// ---------------------------------------------------------------------------

/**
 * Multi-dimensional distance between two trailers for recommendation matching.
 * Each dimension is normalized 0-1 using catalog-wide ranges, then we compute
 * Euclidean distance. Lower = more similar.
 */
function trailerDistance(a, b) {
  const dims = [
    { key: 'weightLb',  min: 2600, max: 8500 },
    { key: 'lengthFt',  min: 16,   max: 34 },
    { key: 'msrp',      min: 50000, max: 225000 },
    { key: 'sleeps',    min: 2,    max: 8 },
    { key: 'offGridScore', min: 35, max: 95 },
    { key: 'cccLb',     min: 300,  max: 2300 },
  ];
  let sumSq = 0;
  for (const { key, min, max } of dims) {
    const va = a[key] != null ? (a[key] - min) / (max - min) : 0.5;
    const vb = b[key] != null ? (b[key] - min) / (max - min) : 0.5;
    sumSq += (va - vb) ** 2;
  }
  return Math.sqrt(sumSq);
}


// ---------------------------------------------------------------------------
// YEAR-OVER-YEAR DIFF — "What changed in 2026" section for detail pages
// ---------------------------------------------------------------------------

function formatDiffValue(val, unit) {
  if (val == null) return '—';
  if (unit === '$') return formatMsrp(val);
  if (unit === 'lb') return formatWeight(val);
  if (unit === 'ft') return formatLength(val);
  if (unit === 'gal') return formatGal(val);
  return `${val} ${unit}`.trim();
}

function formatDiffDelta(delta, unit) {
  if (delta == null) return '';
  const sign = delta > 0 ? '+' : '';
  if (unit === '$') return `${sign}$${Math.abs(delta).toLocaleString('en-US')}`;
  if (unit === 'lb') return `${sign}${delta.toLocaleString('en-US')} lb`;
  if (unit === 'gal') return `${sign}${delta} gal`;
  if (unit === 'ft') return `${sign}${delta} ft`;
  return `${sign}${delta} ${unit}`.trim();
}

function renderYearDiff(t, allTrailers) {
  const diff = computeYearDiff(t, allTrailers);
  if (!diff) return '';

  const rows = diff.diffs.map((d) => {
    const arrow = d.direction === 'up' ? '↑' : d.direction === 'down' ? '↓' : '~';
    const cls = d.direction === 'up'
      ? (d.key === 'msrp' || d.key === 'weightLb' ? 'diff-warn' : 'diff-good')
      : d.direction === 'down'
        ? (d.key === 'msrp' || d.key === 'weightLb' ? 'diff-good' : 'diff-warn')
        : 'diff-neutral';
    return `<tr class="${cls}">
<td class="diff-field">${esc(d.field)}</td>
<td class="diff-from">${formatDiffValue(d.from, d.unit)}</td>
<td class="diff-arrow">${arrow}</td>
<td class="diff-to">${formatDiffValue(d.to, d.unit)}</td>
<td class="diff-delta">${d.delta != null ? formatDiffDelta(d.delta, d.unit) : '—'}</td>
</tr>`;
  }).join('\n');

  return `<section class="year-diff" id="year-diff" aria-label="Year-over-year changes">
<h2>What changed from 2025</h2>
<p class="year-diff-sub">Spec differences between the ${esc(t.model)} ${esc(t.floorplan)} across model years.</p>
<div class="year-diff-table-wrap">
<table class="year-diff-table">
<thead><tr><th>Spec</th><th>2025</th><th></th><th>2026</th><th>Change</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>
<p class="muted year-diff-note">All figures are official Airstream base specifications.</p>
</section>`;
}

// ---------------------------------------------------------------------------
// TOTAL COST OF OWNERSHIP ESTIMATOR
// ---------------------------------------------------------------------------

const OWNERSHIP_DEFAULTS = {
  insurancePct: 1.5,     // % of MSRP per year
  storageMo: 150,        // $/month
  maintenanceYr: 800,    // $/year
  depreciationPct: 12,   // % of current value first year
};

function computeOwnership(msrp, opts = {}) {
  const o = { ...OWNERSHIP_DEFAULTS, ...opts };
  const insurance = Math.round(msrp * o.insurancePct / 100);
  const storage = Math.round(o.storageMo * 12);
  const maintenance = Math.round(o.maintenanceYr);
  const depreciation = Math.round(msrp * o.depreciationPct / 100);
  const total = insurance + storage + maintenance + depreciation;
  return { insurance, storage, maintenance, depreciation, total };
}

export function renderOwnershipTool(t) {
  if (!(t.msrp > 0)) return '';
  const d = OWNERSHIP_DEFAULTS;
  const calc = computeOwnership(t.msrp);

  const dataIsland = JSON.stringify({
    msrp: t.msrp,
    defaults: d,
  }).replace(/<\//g, '<\\/');

  return `<section class="estimator ownership-tool" id="ownership" aria-label="Annual ownership cost estimator"
 data-msrp="${esc(t.msrp)}">
<script type="application/json" id="ownership-data">${dataIsland}</script>
<div class="est-head">
<h2>Annual ownership cost</h2>
<p class="est-sub">Estimated yearly costs beyond the purchase price for the ${esc(t.model)} ${esc(t.floorplan)}. Adjust assumptions below.</p>
</div>
<div class="est-controls">
<div class="est-field">
<label for="own-insurance">Insurance (% of value/year)</label>
<div class="finance-slider-row">
<input type="range" id="own-insurance" min="0.5" max="3" step="0.25" value="${d.insurancePct}" class="finance-range" aria-label="Insurance rate">
<span class="finance-range-val" id="own-insurance-val">${d.insurancePct}% (${formatMsrp(calc.insurance)}/yr)</span>
</div>
</div>
<div class="est-field">
<label for="own-storage">Storage ($/month)</label>
<div class="finance-slider-row">
<input type="range" id="own-storage" min="0" max="400" step="25" value="${d.storageMo}" class="finance-range" aria-label="Monthly storage cost">
<span class="finance-range-val" id="own-storage-val">$${d.storageMo}/mo (${formatMsrp(calc.storage)}/yr)</span>
</div>
</div>
<div class="est-field">
<label for="own-maintenance">Maintenance ($/year)</label>
<div class="finance-slider-row">
<input type="range" id="own-maintenance" min="200" max="2000" step="100" value="${d.maintenanceYr}" class="finance-range" aria-label="Annual maintenance cost">
<span class="finance-range-val" id="own-maintenance-val">${formatMsrp(calc.maintenance)}/yr</span>
</div>
</div>
<div class="est-field">
<label for="own-depreciation">First-year depreciation (%)</label>
<div class="finance-slider-row">
<input type="range" id="own-depreciation" min="5" max="20" step="1" value="${d.depreciationPct}" class="finance-range" aria-label="First year depreciation rate">
<span class="finance-range-val" id="own-depreciation-val">${d.depreciationPct}% (${formatMsrp(calc.depreciation)})</span>
</div>
</div>
</div>
<div class="est-result" id="ownership-result" aria-live="polite" aria-atomic="true">
<div class="est-big">
<span class="est-number" id="own-total">${formatMsrp(calc.total)}</span>
<span class="est-number-cap">estimated per year</span>
</div>
<div class="ownership-breakdown">
<div class="own-bar-stack" id="own-bars">
<div class="own-bar own-bar--insurance" style="flex:${calc.insurance}"><span class="own-bar-label">Insurance</span></div>
<div class="own-bar own-bar--storage" style="flex:${calc.storage}"><span class="own-bar-label">Storage</span></div>
<div class="own-bar own-bar--maintenance" style="flex:${calc.maintenance}"><span class="own-bar-label">Maint.</span></div>
<div class="own-bar own-bar--depreciation" style="flex:${calc.depreciation}"><span class="own-bar-label">Depreciation</span></div>
</div>
<dl class="finance-dl">
<div class="finance-dl-row"><dt>Insurance</dt><dd id="own-ins-dd">${formatMsrp(calc.insurance)}/yr</dd></div>
<div class="finance-dl-row"><dt>Storage</dt><dd id="own-sto-dd">${formatMsrp(calc.storage)}/yr</dd></div>
<div class="finance-dl-row"><dt>Maintenance</dt><dd id="own-mnt-dd">${formatMsrp(calc.maintenance)}/yr</dd></div>
<div class="finance-dl-row"><dt>Depreciation</dt><dd id="own-dep-dd">${formatMsrp(calc.depreciation)}</dd></div>
<div class="finance-dl-row finance-dl-total"><dt>Total annual cost</dt><dd id="own-tot-dd">${formatMsrp(calc.total)}/yr</dd></div>
</dl>
</div>
</div>
<p class="est-caveat muted">Rough planning estimates only. Insurance varies by coverage, location, and driving record. Airstreams hold value well — depreciation may be lower than shown. Storage cost varies widely by region and type (indoor/outdoor/covered).</p>
</section>`;
}


/**
 * "You might also like" — spec-similar trailers from OTHER families.
 * Complements renderRelated() which stays within the same family.
 */
function renderCrossFamily(current, allTrailers, resolve) {
  if (allTrailers.length < 10) return '';
  const candidates = allTrailers
    .filter((t) => t.model !== current.model && t.year === current.year && t.slug !== current.slug)
    .map((t) => ({ t, dist: trailerDistance(current, t) }))
    .sort((a, b) => a.dist - b.dist);
  // Take top 4, but deduplicate families (at most one per family)
  const seen = new Set();
  const picks = [];
  for (const { t } of candidates) {
    if (seen.has(t.model)) continue;
    seen.add(t.model);
    picks.push(t);
    if (picks.length >= 4) break;
  }
  if (picks.length < 2) return '';
  const cards = picks.map((t) => {
    const a = resolve(t);
    // Show what makes this similar: shared traits
    const traits = [];
    if (Math.abs(t.sleeps - current.sleeps) <= 1) traits.push(`Sleeps ${t.sleeps}`);
    if (Math.abs(t.weightLb - current.weightLb) < 1000) traits.push('Similar weight');
    if (Math.abs(t.msrp - current.msrp) < 20000) traits.push('Similar price');
    if (Math.abs(t.offGridScore - current.offGridScore) < 15) traits.push('Similar off-grid');
    const traitStr = traits.length ? traits.slice(0, 2).join(' · ') : '';
    return `<a class="xfam-card" href="${esc(t.slug)}.html">
<div class="xfam-media"><img src="../${esc(a.thumb)}" alt="${esc(trailerTitle(t))}" loading="lazy" width="400" height="260"></div>
<div class="xfam-body">
<p class="xfam-title">${esc(t.model)} <span>${esc(t.floorplan)}</span></p>
<p class="xfam-specs">${esc(formatLength(t.lengthFt))} · ${esc(formatWeight(t.weightLb))} · ${esc(formatMsrp(t.msrp))}</p>
${traitStr ? `<p class="xfam-traits">${esc(traitStr)}</p>` : ''}
</div>
</a>`;
  }).join('\n');
  return `<section class="cross-family" aria-label="Similar from other families">
<h2>You might also like</h2>
<p class="cross-family-sub muted">Similar specs from other Airstream families</p>
<div class="cross-family-grid">${cards}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// NEXT STEPS: actionable links to move from research to purchase
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// TRIP READY CHECKLIST — model-specific pre-departure checklist using real specs
// ---------------------------------------------------------------------------

function renderTripReady(t) {
  // Build checklist items using the trailer's real specs
  const items = [];

  // Water system
  if (t.freshGal) {
    items.push({ cat: 'water', text: `Fill ${t.freshGal}-gallon fresh water tank`, icon: '💧' });
  }
  if (t.blackGal || t.grayGal) {
    const tanks = [];
    if (t.grayGal) tanks.push(`gray (${t.grayGal} gal)`);
    if (t.blackGal) tanks.push(t.grayGal ? `black (${t.blackGal} gal)` : `waste (${t.blackGal} gal)`);
    items.push({ cat: 'water', text: `Empty ${tanks.join(' + ')} tank${tanks.length > 1 ? 's' : ''}`, icon: '🚿' });
  }
  items.push({ cat: 'water', text: 'Check water heater bypass valve position', icon: '♨️' });

  // Tow & weight
  if (t.hitchWeightLb) {
    items.push({ cat: 'tow', text: `Verify hitch weight (~${formatWeight(t.hitchWeightLb)}) with tongue scale`, icon: '⚖️' });
  }
  if (t.gvwrLb) {
    items.push({ cat: 'tow', text: `Confirm total weight under ${formatWeight(t.gvwrLb)} GVWR`, icon: '🏋️' });
  }
  items.push({ cat: 'tow', text: 'Check tire pressure (trailer & tow vehicle)', icon: '🛞' });
  items.push({ cat: 'tow', text: 'Inspect hitch coupler & safety chains', icon: '🔗' });
  items.push({ cat: 'tow', text: 'Test brake controller & breakaway switch', icon: '🛑' });
  items.push({ cat: 'tow', text: 'Check all exterior lights & turn signals', icon: '💡' });

  // Systems
  if (t.solarW) {
    items.push({ cat: 'systems', text: `Confirm ${t.solarW}W solar panel${t.solarW > 200 ? 's' : ''} unobstructed`, icon: '☀️' });
  }
  if (t.batteryKwh) {
    items.push({ cat: 'systems', text: `Charge house battery (${t.batteryKwh} kWh) to 100%`, icon: '🔋' });
  }
  items.push({ cat: 'systems', text: 'Check propane tank level & valve operation', icon: '🔥' });
  items.push({ cat: 'systems', text: 'Test LP & CO detectors', icon: '🚨' });
  items.push({ cat: 'systems', text: 'Test smoke detector', icon: '🧯' });

  // Interior
  items.push({ cat: 'interior', text: 'Secure all cabinet doors & drawers', icon: '🗄️' });
  items.push({ cat: 'interior', text: 'Stow loose items & close roof vents', icon: '📦' });
  items.push({ cat: 'interior', text: 'Retract stabilizer jacks & entry step', icon: '🔧' });
  items.push({ cat: 'interior', text: 'Retract TV antenna & lower awning', icon: '📡' });
  items.push({ cat: 'interior', text: 'Lock entry door during travel', icon: '🔒' });

  const catMeta = {
    water: { label: 'Water System', cls: 'trip-cat--water' },
    tow: { label: 'Tow & Safety', cls: 'trip-cat--tow' },
    systems: { label: 'Power & Gas', cls: 'trip-cat--systems' },
    interior: { label: 'Interior Prep', cls: 'trip-cat--interior' },
  };

  const groups = {};
  for (const item of items) {
    if (!groups[item.cat]) groups[item.cat] = [];
    groups[item.cat].push(item);
  }

  let html = '';
  for (const [cat, meta] of Object.entries(catMeta)) {
    if (!groups[cat]) continue;
    html += `<div class="trip-group ${meta.cls}">
<h3 class="trip-group-title">${meta.label}</h3>
<ul class="trip-list">`;
    for (const item of groups[cat]) {
      html += `<li class="trip-item">
<label class="trip-label"><input type="checkbox" class="trip-check" data-trip-item="${esc(item.text)}"><span class="trip-icon" aria-hidden="true">${item.icon}</span><span class="trip-text">${esc(item.text)}</span></label>
</li>`;
    }
    html += `</ul></div>`;
  }

  return `<section class="trip-ready collapsible" id="trip-ready" aria-label="Trip ready checklist">
<h2 class="collapsible-trigger" aria-expanded="false" tabindex="0" role="button">
Trip Ready Checklist
<span class="trip-count" id="trip-count"></span>
<span class="collapsible-icon" aria-hidden="true"></span>
</h2>
<div class="collapsible-body" hidden>
<p class="trip-intro">Pre-departure checklist for the ${esc(t.model)} ${esc(t.floorplan)}, using its real specs. Check off items as you go — progress saves on this device.</p>
<div class="trip-progress"><div class="trip-progress-fill" id="trip-progress-fill"></div></div>
<div class="trip-groups">${html}</div>
<div class="trip-actions">
<button type="button" class="trip-reset" id="trip-reset">Reset checklist</button>
</div>
</div>
</section>`;
}

function renderNextSteps(t) {
  const official = officialUrl(t.model);
  const links = [];
  links.push(`<a class="nextstep-card" href="https://www.airstream.com/find-a-dealer/" target="_blank" rel="noopener">
<span class="nextstep-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></span>
<span class="nextstep-text"><span class="nextstep-title">Find a dealer</span><span class="nextstep-sub">Locate an authorized Airstream dealer near you</span></span>
<span class="nextstep-arrow" aria-hidden="true">↗</span></a>`);
  if (official) {
    links.push(`<a class="nextstep-card" href="${esc(official)}" target="_blank" rel="noopener">
<span class="nextstep-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg></span>
<span class="nextstep-text"><span class="nextstep-title">Official ${esc(t.model)} page</span><span class="nextstep-sub">Full details, options &amp; configurator on airstream.com</span></span>
<span class="nextstep-arrow" aria-hidden="true">↗</span></a>`);
  }
  links.push(`<a class="nextstep-card" href="https://www.airstream.com/build-your-own/" target="_blank" rel="noopener">
<span class="nextstep-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"></path></svg></span>
<span class="nextstep-text"><span class="nextstep-title">Build &amp; price</span><span class="nextstep-sub">Configure your Airstream with factory options</span></span>
<span class="nextstep-arrow" aria-hidden="true">↗</span></a>`);
  return `<section class="next-steps" aria-label="Next steps">
<h2>Ready for the next step?</h2>
<div class="nextstep-grid">${links.join('')}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// RELATED FLOORPLANS: cross-discovery cards at the bottom of detail pages
// ---------------------------------------------------------------------------
function renderRelated(current, allTrailers, resolve) {
  if (!allTrailers.length) return '';
  // Same family, same year, different floorplan
  let related = allTrailers.filter(
    (t) => t.model === current.model && t.slug !== current.slug && t.year === current.year,
  );
  // If not enough, add same-family from other years
  if (related.length < 3) {
    const slugs = new Set(related.map((r) => r.slug));
    slugs.add(current.slug);
    allTrailers
      .filter((t) => t.model === current.model && !slugs.has(t.slug))
      .forEach((t) => related.push(t));
  }
  // If still not enough (single-floorplan families like FLW), add similar-sized from other families
  if (related.length < 2) {
    const slugs = new Set(related.map((r) => r.slug));
    slugs.add(current.slug);
    const bySimilarity = allTrailers
      .filter((t) => !slugs.has(t.slug) && t.year === current.year)
      .map((t) => ({ t, dist: Math.abs(t.weightLb - current.weightLb) + Math.abs(t.msrp - current.msrp) / 100 }))
      .sort((a, b) => a.dist - b.dist);
    bySimilarity.slice(0, 4 - related.length).forEach(({ t }) => related.push(t));
  }
  related = related.slice(0, 4);
  if (!related.length) return '';
  const cards = related.map((t) => {
    const a = resolve(t);
    return `<a class="rel-card" href="${esc(t.slug)}.html">
<div class="rel-media"><img src="../${esc(a.thumb)}" alt="${esc(trailerTitle(t))}" loading="lazy" width="400" height="260"></div>
<div class="rel-body">
<p class="rel-title">${esc(t.model)} <span>${esc(t.floorplan)}</span></p>
<p class="rel-specs">${esc(formatLength(t.lengthFt))} · ${esc(formatWeight(t.weightLb))} · ${esc(formatMsrp(t.msrp))}</p>
</div>
</a>`;
  }).join('\n');
  const heading = related.every((r) => r.model === current.model)
    ? `More ${esc(current.model)} floorplans`
    : 'Explore similar floorplans';
  return `<section class="related" aria-label="Related floorplans">
<h2>${heading}</h2>
<div class="related-grid">${cards}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// DETAIL: one floorplan
// ---------------------------------------------------------------------------

/** A single trailer detail page. */

// ---------------------------------------------------------------------------
// DETAIL: compatible tow vehicles panel
// ---------------------------------------------------------------------------

/**
 * Shows which tow vehicles from the database can safely tow this trailer,
 * color-coded by margin. Gives buyers a quick "what can tow this?" answer.
 */
function renderCompatibleVehicles(t) {
  if (!(t.gvwrLb > 0) || !TOW_VEHICLES.length) return '';
  const sorted = TOW_VEHICLES.slice().sort((a, b) => a.maxTowLb - b.maxTowLb);
  const rows = sorted.map((v) => {
    const pct = (t.gvwrLb / v.maxTowLb) * 100;
    let cls, label;
    if (pct > 100) { cls = 'compat-over'; label = 'Over limit'; }
    else if (pct > 80) { cls = 'compat-tight'; label = 'Tight'; }
    else { cls = 'compat-ok'; label = 'Comfortable'; }
    const margin = v.maxTowLb - t.gvwrLb;
    const marginStr = margin > 0 ? `+${margin.toLocaleString()} lb margin` : `${margin.toLocaleString()} lb`;
    return `<tr class="${cls}">
<td class="compat-name">${esc(v.name)}</td>
<td class="compat-rating" data-unit="weight" data-raw="${v.maxTowLb}">${formatWeight(v.maxTowLb)}</td>
<td class="compat-margin">${esc(marginStr)}</td>
<td class="compat-verdict"><span class="compat-badge">${esc(label)}</span></td>
</tr>`;
  }).join('\n');

  const okCount = sorted.filter((v) => t.gvwrLb <= v.maxTowLb).length;

  return `<section class="compat-vehicles" id="vehicles" aria-label="Compatible tow vehicles">
<h2>What can tow it?</h2>
<p class="compat-intro">${okCount} of ${sorted.length} popular tow vehicles can handle this trailer\'s ${formatWeight(t.gvwrLb)} GVWR. Green = comfortable (under 80%), yellow = within limit, red = exceeds rating.</p>
<div class="compat-table-wrap">
<table class="compat-table">
<thead><tr><th>Vehicle</th><th>Tow rating</th><th>Margin</th><th>Verdict</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>
</section>`;
}

export function renderDetail(t, resolve = assetPaths, campgrounds = null, decor = null, allTrailers = []) {
  const a = resolve(t);
  const fam = familySlug(t.model);
  const official = officialUrl(t.model);
  // Compute percentile rankings for this trailer in its year cohort
  const pctMap = allTrailers.length >= 3 ? computePercentiles(allTrailers) : new Map();
  const rankings = pctMap.get(t.slug) || {};
  const pctFor = (field) => {
    const r = rankings[field];
    if (!r) return null;
    const label = percentileLabel(field, r);
    return label ? { pct: r.pct, label } : null;
  };
  const totalMedia = a.gallery.length + (a.hero ? 1 : 0);
  const heroImg = a.hero
    ? `<button type="button" class="detail-hero-btn" data-lightbox data-full="../${esc(a.hero)}" data-index="0" data-caption="${esc(trailerTitle(t))} — hero" aria-label="View hero image full screen"><img src="../${esc(a.hero)}" alt="${esc(trailerTitle(t))}" class="detail-hero-img" width="1280" height="720" fetchpriority="high"><span class="hero-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></span></button>`
    : '';
  const galleryCount = a.gallery.length;
  const heroOffset = a.hero ? 1 : 0;
  const gallery = a.gallery
    .map(
      (g, i) =>
        `<button type="button" class="gallery-img-wrap${a.galleryCutout && a.galleryCutout[i] ? ' is-cutout' : ' is-photo'}" data-lightbox data-full="../${esc(g)}" data-index="${i + heroOffset}" data-caption="${esc(trailerLabel(t))} — photo ${i + 1} of ${galleryCount}" aria-label="Open photo ${i + 1} of ${galleryCount} full screen"><img src="../${esc(g)}" alt="${esc(trailerLabel(t))} photo ${i + 1}" loading="lazy" class="gallery-img${a.galleryCutout && a.galleryCutout[i] ? ' gallery-img--cutout' : ' gallery-img--photo'}" width="920" height="600"><span class="gallery-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></span></button>`,
    )
    .join('\n');
  const fpZones = renderFloorplanZones(t.floorplan, t.slug);
  const fpLegend = renderFloorplanLegend(t.floorplan, t.slug);
  const fpInteractive = fpZones ? ' floorplan--interactive' : '';
  const fpHint = fpZones
    ? `<p class="floorplan-hint" data-fp-hint>Tap a numbered point to see what's where. <span class="muted">Zones placed against the official ${esc(t.floorplan)} diagram.</span></p>`
    : '';
  const floorplanLbIdx = totalMedia; // lightbox index after hero + gallery
  const floorplanSection = a.floorplan
    ? `<section class="floorplan${fpInteractive}" id="floorplan" aria-label="Floor plan" data-floorplan-code="${esc(t.floorplan)}"><h2>Floor plan</h2>${fpHint}<figure class="floorplan-fig"><button type="button" class="floorplan-zoom-btn" data-lightbox data-full="../${esc(a.floorplan)}" data-index="${floorplanLbIdx}" data-caption="${esc(trailerLabel(t))} floor plan" aria-label="View floor plan full screen"><span class="floorplan-stage"><img src="../${esc(a.floorplan)}" alt="${esc(trailerLabel(t))} floor plan diagram" loading="lazy" class="floorplan-img" width="820" height="1332">${fpZones}</span><span class="floorplan-zoom-hint" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg> Tap to enlarge</span></button>${fpLegend}<figcaption class="muted">Official Airstream ${esc(t.floorplan)} floor plan${official ? ` · <a class="official-link" href="${esc(official)}" target="_blank" rel="noopener">View ${esc(t.model)} floor plans on airstream.com ↗</a>` : ''}</figcaption></figure></section>`
    : '';
  const decorSection = renderDecor(decor, t.model);
  const pros = (t.pros || []).map((p) => `<li>${esc(p)}</li>`).join('');
  const cons = (t.cons || []).map((c) => `<li>${esc(c)}</li>`).join('');
  const note = t.specNote
    ? `<p class="spec-note">${esc(t.specNote)}</p>`
    : '';
  const hitchPct = hitchPctOfGvwr(t.hitchWeightLb, t.gvwrLb);
  // Towing guidance built only from Airstream's official published figures —
  // GVWR (the fully-loaded weight a tow vehicle must be rated to pull) and the
  // official hitch (tongue) weight. No derived/estimated "recommended rating".
  const towCallout = t.gvwrLb
    ? `<section class="tow-callout" aria-label="Towing">
<div class="tow-callout-main">
<p class="tow-callout-label">Your tow vehicle must be rated for at least</p>
<p class="tow-callout-value"><span data-unit="weight" data-raw="${esc(String(t.gvwrLb))}">${formatWeight(t.gvwrLb)}</span><span>fully-loaded GVWR</span></p>
</div>
<p class="tow-callout-note">This is the official Airstream GVWR — the most this floorplan can weigh loaded, and the minimum tow rating your vehicle needs.${t.hitchWeightLb ? ` Official hitch (tongue) weight is ${esc(formatWeight(t.hitchWeightLb))}${hitchPct ? ` (~${hitchPct}% of GVWR)` : ''}.` : ''} <a href="../index.html#all">Match it to your vehicle →</a></p>
</section>`
    : '';
  // Section quick-nav: built from sections present on this page
  const yearDiff = computeYearDiff(t, allTrailers);
  const sectionNav = buildSectionNav([
    ['#specs', 'Specs'],
    yearDiff ? ['#year-diff', '2025→26'] : null,
    t.gvwrLb ? ['#tow', 'Tow'] : null,
    t.gvwrLb ? ['#fuel', 'Fuel'] : null,
    t.gvwrLb ? ['#vehicles', 'Vehicles'] : null,
    t.cccLb ? ['#payload', 'Payload'] : null,
    t.msrp > 0 ? ['#finance', 'Finance'] : null,
    t.msrp > 0 ? ['#ownership', 'Ownership'] : null,
    ['#offgrid', 'Off-grid'],
    a.floorplan ? ['#floorplan', 'Floor plan'] : null,
    ['#trip-ready', 'Trip Ready'],
    galleryCount ? ['#gallery', 'Gallery'] : null,
  ].filter(Boolean));
  // Related floorplans: same family, different floorplan, prefer same year
  const relatedSection = renderRelated(t, allTrailers, resolve);
  // Cross-family: spec-similar trailers from other model lines
  const crossFamilySection = renderCrossFamily(t, allTrailers, resolve);
  // Prev/next pager: navigate between floorplans (sorted model+floorplan+year)
  const sorted = [...allTrailers].sort((a, b) =>
    `${a.model} ${a.floorplan} ${a.year}`.localeCompare(`${b.model} ${b.floorplan} ${b.year}`));
  const curIdx = sorted.findIndex((x) => x.slug === t.slug);
  const prevT = curIdx > 0 ? sorted[curIdx - 1] : null;
  const nextT = curIdx >= 0 && curIdx < sorted.length - 1 ? sorted[curIdx + 1] : null;
  const pagerPrev = prevT
    ? `<a class="detail-pager-link detail-pager-link--prev" href="${esc(prevT.slug)}.html"><span class="detail-pager-arrow">←</span><span><span class="detail-pager-label">Previous</span><span class="detail-pager-name">${esc(prevT.model)} ${esc(prevT.floorplan)}</span></span></a>`
    : '<span></span>';
  const pagerNext = nextT
    ? `<a class="detail-pager-link detail-pager-link--next" href="${esc(nextT.slug)}.html"><span><span class="detail-pager-label">Next</span><span class="detail-pager-name">${esc(nextT.model)} ${esc(nextT.floorplan)}</span></span><span class="detail-pager-arrow">→</span></a>`
    : '<span></span>';
  const pagerNav = `<nav class="detail-pager" aria-label="Browse floorplans">${pagerPrev}${pagerNext}</nav>`;
  // Breadcrumb trail: Home → Family → Floorplan
  const breadcrumbItems = [
    { name: 'Airstream Explorer', path: 'index.html' },
    { name: t.model, path: `f/${fam}.html` },
    { name: `${t.model} ${t.floorplan}`, path: `m/${t.slug}.html` },
  ];
  const breadcrumbHtml = `<nav class="breadcrumb" aria-label="Breadcrumb"><ol class="breadcrumb-list">`
    + `<li><a href="../index.html">Home</a></li>`
    + `<li><a href="../f/${esc(fam)}.html">${esc(t.model)}</a></li>`
    + `<li aria-current="page">${esc(t.floorplan)}</li>`
    + `</ol></nav>`;
  const body = `<div class="reading-progress" id="reading-progress" aria-hidden="true"></div>
<div class="detail-sticky-summary" id="detail-sticky-summary" hidden aria-hidden="true">
<div class="sticky-summary-inner">
<span class="sticky-summary-title">${esc(t.model)} ${esc(t.floorplan)}</span>
<span class="sticky-summary-sep" aria-hidden="true">·</span>
<span class="sticky-summary-stat" data-unit="length" data-raw="${esc(String(t.lengthFt))}">${esc(formatLength(t.lengthFt))}</span>
<span class="sticky-summary-sep" aria-hidden="true">·</span>
<span class="sticky-summary-stat" data-unit="weight" data-raw="${esc(String(t.weightLb))}">${esc(formatWeight(t.weightLb))}</span>
<span class="sticky-summary-sep" aria-hidden="true">·</span>
<span class="sticky-summary-stat">${esc(formatMsrpShort(t.msrp))}</span>
<a class="sticky-summary-cta" href="#specs">Specs ↓</a>
</div>
</div>
${breadcrumbHtml}
${sectionNav}
<article class="detail" data-canonical="m/${esc(t.slug)}.html" data-spec-text="${esc(buildSpecText(t))}"${prevT ? ` data-prev-href="${esc(prevT.slug)}.html"` : ''}${nextT ? ` data-next-href="${esc(nextT.slug)}.html"` : ''}>
<header class="detail-head">
<p class="eyebrow">${esc(t.year)} MODEL YEAR</p>
<div class="detail-head-row">
<h1>${esc(t.model)} <span>${esc(t.floorplan)}</span></h1>
${saveButton(t.slug, 'trailer', trailerLabel(t), 'detail')}
</div>
${tagChips(t.tags)}
${renderStandoutBadges(t, allTrailers)}
<div class="share-actions" data-share-actions>
<button type="button" class="share-btn" id="detail-share" aria-label="Share this page" title="Share this page"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg> Share</button>
<button type="button" class="share-btn" id="detail-copy-specs" aria-label="Copy specs to clipboard" title="Copy specs to clipboard"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg> Copy specs</button>
<button type="button" class="share-btn" id="detail-print" aria-label="Print spec sheet" title="Print spec sheet"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> Print</button>
</div>
${official ? `<p class="official-head"><a class="official-link" href="${esc(official)}" target="_blank" rel="noopener">Official ${esc(t.model)} page on airstream.com ↗</a></p>` : ''}
</header>
<div class="detail-hero">${heroImg}</div>
${renderKeyStats(t)}
<div class="detail-overview">
<p class="detail-desc">${esc(t.description)}</p>
${renderRadarChart(t)}
</div>
<section class="spec-table" id="specs" aria-label="Specifications">
<h2>Specifications</h2>
<dl class="specs-grid">
${specRow('Length', formatLength(t.lengthFt), { tip: true, unit: 'length', raw: t.lengthFt, pctData: pctFor('lengthFt') })}
${specRow('Dry weight', formatWeight(t.weightLb), { tip: true, unit: 'weight', raw: t.weightLb, pctData: pctFor('weightLb') })}
${specRow('GVWR', formatWeight(t.gvwrLb), { tip: true, unit: 'weight', raw: t.gvwrLb })}
${specRow('Cargo capacity (CCC)', formatWeight(t.cccLb), { tip: true, unit: 'weight', raw: t.cccLb, pctData: pctFor('cccLb') })}
${specRow('Hitch weight', formatWeight(t.hitchWeightLb), { tip: true, unit: 'weight', raw: t.hitchWeightLb, pctData: pctFor('hitchWeightLb') })}
${specRow('Sleeps', String(t.sleeps), { tip: true })}
${specRow('Fresh / gray / black', formatTanks(t.freshGal, t.grayGal, t.blackGal), { tip: true, unit: 'tanks', raw: [t.freshGal, t.grayGal, t.blackGal].join(',') })}
${specRow('Solar', t.solarW ? `${t.solarW} W ${t.solarStandard ? '(standard)' : '(optional)'}` : '—', { tip: true })}
${specRow('Battery', t.batteryKwh ? `${t.batteryKwh} kWh` : '—', { tip: true })}
${specRow('Off-grid score', `${t.offGridScore} / 100`, { tip: true, pctData: pctFor('offGridScore') })}
${specRow('MSRP', formatMsrp(t.msrp), { tip: true, pctData: pctFor('msrp') })}
</dl>
${note}
</section>
${renderYearDiff(t, allTrailers)}
${renderWeightBar(t)}
${renderWeightBudget(t)}
${towCallout}
${renderTowTool(t)}
${renderCompatibleVehicles(t)}
${renderFuelTool(t)}
${renderPayloadTool(t)}
${renderFinancingTool(t)}
${renderOwnershipTool(t)}
${renderOffGridTool(t)}
${floorplanSection}
${decorSection}
${campgrounds ? renderCampgroundFit(t, campgrounds) : ''}
${pros || cons ? `<section class="proscons">
${pros ? `<div class="pros"><h3>Strengths</h3><ul>${pros}</ul></div>` : ''}
${cons ? `<div class="cons"><h3>Trade-offs</h3><ul>${cons}</ul></div>` : ''}
</section>` : ''}
${renderTripReady(t)}
${gallery ? `<section class="gallery" id="gallery" aria-label="Gallery"><h2>Gallery</h2><div class="gallery-grid" data-gallery>${gallery}</div></section>` : ''}
${renderNextSteps(t)}
${relatedSection}
${crossFamilySection}
</article>
${pagerNav}`;
  return page({
    title: `${trailerTitle(t)} — specs, weights & price`,
    description: `${trailerTitle(t)}: ${formatLength(t.lengthFt)}, ${formatWeight(t.weightLb)} dry, sleeps ${t.sleeps}, ${formatMsrp(t.msrp)}. Full specs, tanks, off-grid and gallery.`,
    body,
    relRoot: '../',
    active: 'index',
    canonicalPath: `m/${t.slug}.html`,
    ogImage: a.hero || '',
    ogType: 'product',
    head: productJsonLd({
      name: trailerTitle(t),
      description: `${trailerTitle(t)}: ${formatLength(t.lengthFt)}, ${formatWeight(t.weightLb)} dry, sleeps ${t.sleeps}, ${formatMsrp(t.msrp)}.`,
      imagePath: a.hero || '',
      canonicalPath: `m/${t.slug}.html`,
      category: 'Travel Trailer',
    }) + '\n' + breadcrumbJsonLd(breadcrumbItems),
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
/** Tiny inline range bar showing where a value sits in the fleet range. */
function renderRangeBar(value, range, label) {
  const pos = rangePosition(value, range);
  if (pos == null) return '';
  return `<span class="range-bar" aria-label="${esc(label)}: ${pos}th percentile in lineup" title="${esc(label)}: ${pos}th percentile"><span class="range-bar-track"><span class="range-bar-fill" style="width:${pos}%"></span></span></span>`;
}

export function renderExploreCard(t, resolve = assetPaths, hidden = false, ranges = {}) {
  const a = resolve(t);
  const tags = (t.tags || []).join(' ');
  const layout = deriveLayoutFeatures(t).join(' ');
  return `<article class="xcard" data-slug="${esc(t.slug)}" data-type="trailer" data-model="${esc(t.model)}" data-floorplan="${esc(t.floorplan)}" data-year="${esc(t.year)}" data-msrp="${esc(t.msrp)}" data-weight="${esc(t.weightLb)}" data-gvwr="${esc(t.gvwrLb)}" data-length="${esc(t.lengthFt)}" data-sleeps="${esc(t.sleeps)}" data-offgrid="${esc(t.offGridScore)}" data-tags="${esc(tags)}" data-layout="${esc(layout)}" data-name="${esc((t.model + ' ' + t.floorplan).toLowerCase())}" data-ccc="${esc(t.cccLb || '')}" data-fresh="${esc(t.freshGal || '')}" data-gray="${esc(t.grayGal || '')}" data-black="${esc(t.blackGal || '')}" data-solar="${esc(t.solarW || '')}" data-hitch="${esc(t.hitchWeightLb || '')}" data-desc="${esc(t.description || '')}" data-thumb="${esc(a.thumb || '')}"${hidden ? ' hidden' : ''}>
<a class="xcard-link" href="m/${esc(t.slug)}.html">
<div class="xcard-media">
<img src="${esc(a.thumb)}" alt="${esc(trailerTitle(t))}" loading="lazy" width="400" height="260">
<span class="xcard-year">${esc(t.year)}</span>
${a.gallery && a.gallery.length ? `<span class="xcard-photos" aria-label="${a.gallery.length} photos"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> ${a.gallery.length}</span>` : ''}
<button type="button" class="xcard-peek" data-peek aria-label="Quick view ${esc(trailerLabel(t))}" title="Quick view"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
</div>
<div class="xcard-body">
<h3 class="xcard-title">${esc(t.model)} <span>${esc(t.floorplan)}</span></h3>
<dl class="xcard-specs">
${specRow('Length', formatLength(t.lengthFt), { unit: 'length', raw: t.lengthFt })}${renderRangeBar(t.lengthFt, ranges.lengthFt, 'Length')}
${specRow('Dry weight', formatWeight(t.weightLb), { unit: 'weight', raw: t.weightLb })}${renderRangeBar(t.weightLb, ranges.weightLb, 'Dry weight')}
${specRow('Sleeps', String(t.sleeps))}
${specRow('MSRP', formatMsrp(t.msrp))}${renderRangeBar(t.msrp, ranges.msrp, 'MSRP')}
</dl>
${(() => { const tc = towClass(t.gvwrLb); return `<span class="xcard-tow tow-badge tow-badge--${esc(tc.cls)}">${tc.icon} ${esc(tc.label)}</span>`; })()}
</div>
</a>
<div class="xcard-foot">
<span class="xcard-fit" data-fit hidden></span>
<div class="xcard-foot-actions">
${saveButton(t.slug, 'trailer', trailerLabel(t), 'card')}
<label class="xcard-compare"><input type="checkbox" class="cmp-box" data-slug="${esc(t.slug)}" data-type="trailer" aria-label="Add ${esc(trailerLabel(t))} to compare"> Compare</label>
</div>
</div>
</article>`;
}

/**
 * The Explore & match sections (tow matcher + search/sort/filter + grid +
 * compare tray) as a reusable body fragment. Used inside the Explore hub
 * (renderIndex "All floorplans" view) AND the standalone explore.html shim.
 * `trailers` is the full (unsorted) dataset. All links are root-relative
 * (m/…, compare.html) so it renders correctly at the site root either way.
 */
export function renderExploreSections(trailers, resolve = assetPaths, motorhomes = [], { headingLevel = 'h1' } = {}) {
  // Build tow vehicle picker options from the shared dataset
  const exploreTowVehicleOpts = TOW_VEHICLES
    .slice()
    .sort((a, b) => a.maxTowLb - b.maxTowLb)
    .map((v) => `<option value="${esc(v.id)}" data-tow="${v.maxTowLb}">${esc(v.name)} \u2014 ${v.maxTowLb.toLocaleString()} lb</option>`)
    .join('');

  const sortOpts = Object.entries(SORT_KEYS)
    .map(([k, def], i) => `<option value="${esc(k)}"${i === 0 ? ' selected' : ''}>${esc(def.label)}</option>`)
    .join('');
  // Use-case tags span BOTH datasets so the chips work whatever type is active.
  const tagChips = exploreTags([...trailers, ...motorhomes])
    .map((tag) => `<button type="button" class="tagfilter" data-tag="${esc(tag)}" aria-pressed="false">${esc(tagLabel(tag))}</button>`)
    .join('');
  // Layout feature chips — bed position, bath type, etc.
  const layoutChips = LAYOUT_META
    .map((lf) => `<button type="button" class="layoutfilter" data-layout-key="${esc(lf.key)}" aria-pressed="false">${esc(lf.label)}</button>`)
    .join('');
  // Server-render the DEFAULT view correctly so the page is right without JS
  // and on first paint: latest model year (2026) visible, sorted cheapest-first;
  // off-year twins emitted but hidden (one tap to "All years"). The client then
  // manages visibility/sort on interaction — same robust pattern as family pages.
  // Trailers AND motorhomes share one grid; each card carries data-type so the
  // client type filter can show All / Travel trailers / Motorhomes.
  const merged = [
    ...trailers.map((t) => ({ item: t, type: 'trailer' })),
    ...motorhomes.map((m) => ({ item: m, type: 'motorhome' })),
  ].sort(
    (a, b) => a.item.msrp - b.item.msrp
      || `${a.item.model} ${a.item.floorplan}`.localeCompare(`${b.item.model} ${b.item.floorplan}`),
  );
  // Compute fleet ranges for spec position bars on explore cards
  const fleetRanges = computeFleetRanges(trailers, motorhomes);
  const cards = merged
    .map(({ item, type }) =>
      type === 'motorhome'
        ? renderMotorhomeExploreCard(item, motorhomeAssetPaths, item.year !== 2026, fleetRanges)
        : renderExploreCard(item, resolve, item.year !== 2026, fleetRanges),
    )
    .join('\n');
  const total = merged.filter(({ item }) => item.year === 2026).length;
  const totalPlans = trailers.length + motorhomes.length;
  const hasMotorhomes = motorhomes.length > 0;
  const typeSeg = hasMotorhomes
    ? `<nav class="xc-type" id="x-type" aria-label="Vehicle type">
<button type="button" class="xc-type-btn is-active" data-type="all" aria-pressed="true">All</button>
<button type="button" class="xc-type-btn" data-type="trailer" aria-pressed="false">Travel trailers</button>
<button type="button" class="xc-type-btn" data-type="motorhome" aria-pressed="false">Motorhomes</button>
</nav>`
    : '';
  return `<header class="explore-head">
<p class="eyebrow">FIND YOUR FLOORPLAN</p>
<${headingLevel}>Every floorplan, by the numbers</${headingLevel}>
<p class="lede">Search, sort and filter all ${totalPlans} floorplans${hasMotorhomes ? ' — travel trailers and motorhomes' : ''} — match a trailer to your tow vehicle, or browse by size, sleeping capacity or off-grid capability.</p>
${typeSeg}
</header>
<section class="tow-tool" aria-label="Tow vehicle matcher">
<div class="tow-tool-inner">
<div class="tow-field tow-field-wide">
<label for="tow-vehicle-pick">Pick your tow vehicle</label>
<select id="tow-vehicle-pick">
<option value="">— Select a vehicle —</option>
${exploreTowVehicleOpts}
<option value="custom">Other (enter manually)</option>
</select>
</div>
<div class="tow-field">
<label for="tow-input">Or enter your max tow rating</label>
<div class="tow-input-row">
<input type="number" id="tow-input" inputmode="numeric" min="1000" max="20000" step="100" placeholder="e.g. 7000">
<span class="tow-unit">lb</span>
<button type="button" id="tow-clear" class="tow-clear" hidden>Clear</button>
</div>
</div>
</div>
<p class="tow-hint">Pick a vehicle above or enter your max tow rating. We compare it to each trailer\'s <strong>fully-loaded GVWR</strong> — not dry weight — the way Airstream recommends.</p>
<p class="tow-summary" id="tow-summary" hidden></p>
</section>
<section class="explore-controls" aria-label="Search and filter">
<div class="xc-row">
<div class="xc-search" role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-owns="x-suggest">
<input type="search" id="x-search" placeholder="Search model or floorplan…" aria-label="Search floorplans" autocomplete="off" aria-autocomplete="list" aria-controls="x-suggest">
<ul class="x-suggest" id="x-suggest" role="listbox" hidden></ul>
</div>
<div class="xc-sort">
<label for="x-sort">Sort</label>
<select id="x-sort">${sortOpts}</select>
</div>
<div class="xc-year">
<label for="x-year">Year</label>
<select id="x-year"><option value="2026" selected>2026</option><option value="2025">2025</option><option value="2027">2027</option><option value="">All years</option></select>
</div>
</div>
<div class="xc-row xc-row-2">
<div class="xc-tags" role="group" aria-label="Use case">${tagChips}</div>
<div class="xc-sleeps">
<label for="x-sleeps">Sleeps ≥</label>
<select id="x-sleeps"><option value="">Any</option><option value="2">2</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="8">8</option></select>
</div>
<div class="xc-price">
<label for="x-price">Budget</label>
<select id="x-price"><option value="">Any price</option><option value="80000">Under $80k</option><option value="120000">Under $120k</option><option value="160000">Under $160k</option><option value="200000">Under $200k</option></select>
</div>
<div class="xc-length">
<label for="x-length">Max length</label>
<select id="x-length"><option value="">Any</option><option value="20">Under 20\'</option><option value="25">Under 25\'</option><option value="28">Under 28\'</option><option value="30">Under 30\'</option></select>
</div>
<div class="xc-weight">
<label for="x-weight">Max dry weight</label>
<select id="x-weight"><option value="">Any</option><option value="4000">Under 4,000 lb</option><option value="5500">Under 5,500 lb</option><option value="7000">Under 7,000 lb</option><option value="8500">Under 8,500 lb</option></select>
</div>
<button type="button" class="xc-reset" id="x-reset">Reset</button>
</div>
<div class="xc-row xc-row-3">
<div class="xc-tags xc-tags-layout" role="group" aria-label="Layout features">${layoutChips}</div>
</div>
<div class="active-filters" id="active-filters" hidden aria-live="polite"></div>
</section>
<div class="xc-row xc-row-layout">
<div class="x-stats" id="x-stats" aria-live="polite" aria-atomic="true"></div>
<div class="xc-layout" id="x-layout" aria-label="View layout">
<button type="button" class="xc-layout-btn is-active" data-layout="grid" aria-pressed="true" title="Grid view"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button>
<button type="button" class="xc-layout-btn" data-layout="list" aria-pressed="false" title="List view"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>
</div>
</div>
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
}

/**
 * Standalone explore.html — kept as a real file so old bookmarks/links don't
 * 404 and the build's fingerprint + image-guardrail lists stay valid. It is
 * NOT in the top nav. With JS it redirects to the canonical hub (index.html#all);
 * without JS it still shows the full Explore & match experience inline so the
 * page is never a dead end.
 */
export function renderExplore(trailers, resolve = assetPaths) {
  const body = `<div class="explore-shim" data-redirect="index.html#all">
<p class="explore-shim-note"><a href="index.html#all">Explore &amp; match has moved to the Explore hub →</a></p>
${renderExploreSections(trailers, resolve)}
</div>`;
  return page({
    title: 'Explore & match — every Airstream floorplan, by the numbers',
    description: `Search, sort and filter all ${trailers.length} Airstream floorplans by price, weight, sleeps and use. Enter your tow vehicle rating to see what you can safely tow.`,
    body,
    active: 'index',
    canonicalPath: 'index.html',
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
export function renderCompare(trailers, resolve = assetPaths, motorhomes = []) {
  const compact = [
    ...trailers.map((t) => {
      const a = resolve(t);
      return {
        type: 'trailer', linkDir: 'm',
        slug: t.slug, model: t.model, floorplan: t.floorplan, year: t.year,
        thumb: a.thumb, lengthFt: t.lengthFt, weightLb: t.weightLb, gvwrLb: t.gvwrLb,
        cccLb: t.cccLb, hitchWeightLb: t.hitchWeightLb, sleeps: t.sleeps,
        freshGal: t.freshGal, grayGal: t.grayGal, blackGal: t.blackGal,
        solarW: t.solarW, batteryKwh: t.batteryKwh, offGridScore: t.offGridScore, msrp: t.msrp,
      };
    }),
    ...motorhomes.map((m) => {
      const a = motorhomeAssetPaths(m);
      return {
        type: 'motorhome', linkDir: 'mm',
        slug: m.slug, model: m.model, floorplan: m.floorplan, year: m.year,
        thumb: a.thumb, lengthFt: m.lengthFt, weightLb: m.weightLb, gvwrLb: m.gvwrLb,
        nccLb: m.nccLb, towCapacityLb: m.towCapacityLb, sleeps: m.sleeps, seats: m.seats,
        chassis: m.chassis, engine: m.engine, fuelType: m.fuelType, fuelTankGal: m.fuelTankGal,
        freshGal: m.freshGal, grayGal: m.grayGal, blackGal: m.blackGal,
        solarW: m.solarW, batteryKwh: m.batteryKwh, offGridScore: m.offGridScore, msrp: m.msrp,
      };
    }),
  ];
  // Safe JSON for <script type="application/json">: only </ needs neutralizing.
  const json = JSON.stringify(compact).replace(/</g, '\\u003c');
  const body = `<header class="explore-head">
<p class="eyebrow">SIDE BY SIDE</p>
<h1>Compare floorplans</h1>
<p class="lede">Pick up to three floorplans and see every spec lined up. Add them from the <a href="index.html#all">Explore</a> hub, or search below.</p>
</header>
<section class="cmp-pick" aria-label="Pick floorplans">
<input type="search" id="cmp-search" placeholder="Search to add a floorplan…" aria-label="Search floorplans to compare" autocomplete="off">
<ul class="cmp-suggest" id="cmp-suggest" hidden></ul>
<div class="cmp-chosen" id="cmp-chosen"></div>
</section>
<div class="cmp-table-wrap" id="cmp-table-wrap" hidden>
<div class="cmp-share-row"><button type="button" class="share-btn cmp-share-btn" id="cmp-share"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"></path></svg> Share comparison</button></div>
<table class="cmp-table" id="cmp-table"></table>
<div class="cmp-radar-wrap" id="cmp-radar-wrap" hidden>
<h2 class="cmp-radar-title">Spec profile overlay</h2>
<p class="cmp-radar-sub muted">Each axis runs from the catalog's worst to best. Bigger = stronger on that dimension.</p>
<div class="cmp-radar-chart" id="cmp-radar-chart"></div>
<div class="cmp-radar-legend" id="cmp-radar-legend"></div>
</div>
</div>
<div class="cmp-placeholder" id="cmp-placeholder">
<p class="cmp-empty-lead">Search above to add any floorplan, or start with one of these:</p>
<div class="cmp-starter">
<a class="cmp-starter-card" href="compare.html?ids=basecamp-16x-2026,caravel-16rb-2026,bambi-16rb-2026">
<span class="cmp-starter-tag">Compact &amp; light</span>
<strong>Basecamp 16X · Caravel 16RB · Bambi 16RB</strong>
<span class="cmp-starter-sub">The smallest, easiest-to-tow trio — $54.9k–$83.9k</span>
</a>
<a class="cmp-starter-card" href="compare.html?ids=flying-cloud-25fb-2026,globetrotter-25fb-2026,trade-wind-25fb-2026">
<span class="cmp-starter-tag">Mid-size all-rounders</span>
<strong>Flying Cloud · Globetrotter · Trade Wind 25FB</strong>
<span class="cmp-starter-sub">Three 26-footers, three personalities — $118.9k–$139.9k</span>
</a>
<a class="cmp-starter-card" href="compare.html?ids=classic-33fb-2026,globetrotter-27fb-2026,international-28rb-2026">
<span class="cmp-starter-tag">Big &amp; luxe</span>
<strong>Classic 33FB · Globetrotter 27FB · International 28RB</strong>
<span class="cmp-starter-sub">Full-size flagships for long hauls — $145k–$222.9k</span>
</a>
</div>
<p class="cmp-empty-foot">Or browse the full lineup on <a href="index.html#all">Explore &amp; match</a>.</p>
</div>
<script type="application/json" id="cmp-data">${json}</script>`;
  return page({
    title: 'Compare Airstream floorplans side by side',
    description: 'Line up to three Airstream floorplans side by side: length, weight, GVWR, cargo, tanks, off-grid and price.',
    body,
    active: 'compare',
    canonicalPath: 'compare.html',
  });
}

/**
 * Saved page (saved.html). A shopper's shortlist that spans the whole catalog —
 * Compare caps at 3 same-type picks for a side-by-side; Saved has no cap and
 * persists every floorplan you starred while browsing, trailers and motorhomes
 * together. The full catalog is embedded as a CSP-safe JSON island keyed by
 * slug; the client (app.js `savedPage`) reads localStorage `ae:saved` and
 * renders the matching cards, newest-first, with remove + "compare these" +
 * a quick stats rollup. No fetch, no build-time knowledge of what's saved.
 */
export function renderSaved(trailers, resolve = assetPaths, motorhomes = []) {
  const byline = (t, type) => {
    const a = type === 'trailer' ? resolve(t) : motorhomeAssetPaths(t);
    const base = {
      type, linkDir: type === 'trailer' ? 'm' : 'mm',
      slug: t.slug, model: t.model, floorplan: t.floorplan, year: t.year,
      thumb: a.thumb, lengthFt: t.lengthFt, weightLb: t.weightLb, gvwrLb: t.gvwrLb,
      sleeps: t.sleeps, freshGal: t.freshGal, grayGal: t.grayGal, blackGal: t.blackGal,
      solarW: t.solarW, batteryKwh: t.batteryKwh, offGridScore: t.offGridScore, msrp: t.msrp,
      tags: t.tags || [],
    };
    if (type === 'trailer') { base.cccLb = t.cccLb; base.hitchWeightLb = t.hitchWeightLb; }
    else { base.nccLb = t.nccLb; base.towCapacityLb = t.towCapacityLb; base.chassis = t.chassis; base.fuelType = t.fuelType; }
    return base;
  };
  const all = [
    ...trailers.map((t) => byline(t, 'trailer')),
    ...motorhomes.map((m) => byline(m, 'motorhome')),
  ];
  // Map keyed by slug for O(1) client lookup; only </ needs neutralizing.
  const map = {};
  for (const r of all) map[r.slug] = r;
  const json = JSON.stringify(map).replace(/</g, '\\u003c');

  const body = `<header class="explore-head">
<p class="eyebrow">YOUR SHORTLIST</p>
<h1>Saved floorplans</h1>
<p class="lede">Every floorplan you starred while browsing, kept here on this device. Save as many as you like — then send the ones you're torn between to <a href="compare.html">Compare</a>.</p>
</header>
<section class="saved-wrap" aria-label="Saved floorplans">
<div class="saved-toolbar" id="saved-toolbar" hidden>
<p class="saved-summary" id="saved-summary"></p>
<div class="saved-toolbar-actions">
<a class="saved-compare-btn" id="saved-compare" href="compare.html">Compare these →</a>
<button type="button" class="saved-clear-btn" id="saved-clear">Clear all</button>
</div>
</div>
<div class="saved-grid" id="saved-grid"></div>
<div class="saved-empty" id="saved-empty">
<div class="saved-empty-art" aria-hidden="true"><svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.3 4.6 12.9a4.6 4.6 0 1 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 1 1 6.5 6.5z"/></svg></div>
<p class="saved-empty-lead">Nothing saved yet.</p>
<p class="saved-empty-sub">Tap the heart on any floorplan — on a card or its detail page — to keep it here. Your list stays on this device.</p>
<a class="saved-empty-cta" href="index.html#all">Browse the lineup →</a>
</div>
</section>
<script type="application/json" id="saved-data">${json}</script>
<section class="recent-section" id="recent-section" hidden>
<h2>Recently viewed</h2>
<button type="button" class="recent-clear" id="recent-clear">Clear history</button>
<p class="recent-lead">Floorplans you looked at recently on this device.</p>
<div class="recent-grid" id="recent-grid"></div>
</section>
<section class="recs-section" id="recs-section" hidden>
<h2>You might also like</h2>
<p class="recs-lead">Similar floorplans from other families, based on what you saved.</p>
<div class="recs-grid" id="recs-grid"></div>
</section>`;
  return page({
    title: 'Saved floorplans — your Airstream shortlist',
    description: 'Your saved Airstream floorplans, kept on this device — trailers and motorhomes you starred while browsing, ready to revisit and compare.',
    body,
    active: 'saved',
    canonicalPath: 'saved.html',
  });
}
