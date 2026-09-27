// HTML rendering - pure functions returning strings. No DOM, no I/O.
// All dynamic text goes through esc() to stay XSS/CSP-safe.

import {
  formatMsrp, formatWeight, formatLength, formatGal, formatTanks,
  formatPriceRange, formatLengthRange, formatWeightRange, formatMsrpShort,
  hitchPctOfGvwr,
  trailerTitle, trailerLabel, saveButton,
  formatDimFt,
  ordinal,
} from './format.mjs';
import { assetPaths, familySlug, officialUrl, catalogStats, computeStandouts, computeFleetRanges, rangePosition, deriveLayoutFeatures, LAYOUT_META, computeYearDiff, towClass, waterAutonomy, offGridTier, computeFleetStandouts, deriveAxle, towDifficulty, winterizationGuide } from './data.mjs';
import { motorhomeAssetPaths, loadMotorhomes } from './motorhome-data.mjs';
import { renderMotorhomeExploreCard, renderMotorhomeFamilyCard } from './motorhome-render.mjs';
import { socialMeta, productJsonLd, iconMeta, breadcrumbJsonLd } from './seo.mjs';
import { lifestyleFit, deriveAmenities, storageGuide } from './lifestyle.mjs';
import { SORT_KEYS, exploreTags, tagLabel } from './explore.mjs';
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
  WATER_LB_PER_GAL, PROPANE_PRESETS, DEFAULT_PROPANE, FULL_PROPANE_LB, GEAR_PRESETS,
} from './payload.mjs';

// Tow-vehicle dataset is loaded once at module load (pure read) and reused for
// every detail page's calculator. Each vehicle carries ONE coherent, sourced
// 2025 configuration (see tow-vehicles.json _meta).
const TOW_VEHICLES = loadVehicles();

// Wrapper: formatTanks uses em dash for missing values; detail pages must use literal n/a.
function formatTanksNA(fresh, gray, black) {
  return formatTanks(fresh, gray, black).replace(/—/g, 'n/a');
}

/** Escape text for HTML body/attribute context. */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Chrome icon set — 2026-09 icon spec (design-2026-09/icons.md): monochrome
// linear inline SVG, 1.5px stroke, currentColor, decorative (aria-hidden).
const ICON_COMPASS = '<svg class="nav-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M16 8l-2.6 5.4L8 16l2.6-5.4z"/></svg>';
const ICON_COLUMNS = '<svg class="nav-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/><line x1="12" y1="4" x2="12" y2="20"/></svg>';
const ICON_BOOK = '<svg class="nav-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

// Primary nav, single source of truth: [href, label, key, iconSvg]. `active`
// (a key) marks the current section so every page shows a "you are here" state.
// 2026-09 redesign: exactly 3 tabs — Explore / Compare / Owner's guide.
// Saved lost its tab (save buttons now feed the compare tray; the saved page
// is deleted); Upgrades + Maintenance merged into the Owner's guide page.
// 3 items fit a single persistent bar on mobile (no hamburger needed).
const NAV_ITEMS = [
  ['index.html', 'Explore', 'index', ICON_COMPASS],
  ['compare.html', 'Compare', 'compare', ICON_COLUMNS],
  ['owners-guide.html', "Owner's guide", 'owners', ICON_BOOK],
];

export function page({ title, description, body, relRoot = '', head = '', scripts = '', active = '', canonicalPath = '', ogImage = '', ogType = 'website' }) {
  const _stats = catalogStats(null, loadMotorhomes());
  const navLinks = NAV_ITEMS.map(([href, label, key, icon]) => {
    const on = key === active;
    return `<a href="${relRoot}${href}"${on ? ' class="is-active" aria-current="page"' : ''}>${icon}<span>${label}</span></a>`;
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
<link rel="preload" as="font" type="font/woff2" crossorigin href="${relRoot}assets/fonts/fraunces-600-latin.woff2">
<link rel="stylesheet" href="${relRoot}assets/css/fonts.css">
<link rel="stylesheet" href="${relRoot}assets/css/site.css">
<link rel="stylesheet" href="${relRoot}assets/css/controls.css">
<link rel="stylesheet" href="${relRoot}assets/css/premium.css">
<link rel="stylesheet" href="${relRoot}assets/css/theme.css">
<link rel="stylesheet" href="${relRoot}assets/css/print.css" media="print">
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
<svg class="theme-icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"></circle><line x1="12" y1="2" x2="12" y2="4.5"></line><line x1="12" y1="19.5" x2="12" y2="22"></line><line x1="2" y1="12" x2="4.5" y2="12"></line><line x1="19.5" y1="12" x2="22" y2="12"></line><line x1="4.6" y1="4.6" x2="6.4" y2="6.4"></line><line x1="17.6" y1="17.6" x2="19.4" y2="19.4"></line><line x1="4.6" y1="19.4" x2="6.4" y2="17.6"></line><line x1="17.6" y1="6.4" x2="19.4" y2="4.6"></line></svg>
<svg class="theme-icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.2 8.2 0 1 1 9.8 3.5a6.4 6.4 0 0 0 10.7 10.7z"></path></svg>
</button>
<button type="button" class="unit-toggle" id="unit-toggle" aria-label="Switch units to metric" title="Switch to metric units" aria-pressed="false">
<span class="unit-toggle-label" id="unit-label">lb/ft</span>
</button>
</nav>
</div>
</header>
<main id="main-content" tabindex="-1">
${body}
</main>
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
<p class="footer-heading">Ownership</p>
<ul class="footer-links">
<li><a href="${relRoot}owners-guide.html">Owner's guide</a></li>
<li><a href="${relRoot}towguide.html">Tow guide</a></li>
</ul>
</div>
<div class="footer-col">
<p class="footer-heading">Reference</p>
<ul class="footer-links">
<li><a href="${relRoot}glossary.html">RV glossary</a></li>
<li><a href="${relRoot}credits.html">Credits &amp; sources</a></li>
<li><a href="https://www.airstream.com/" target="_blank" rel="noopener">airstream.com ↗</a></li>
</ul>
</div>
<div class="footer-col footer-col-about">
<p class="footer-heading">Airstream Explorer</p>
<p class="footer-about">${_stats.entryCount} floorplans across ${_stats.familyCount} families. An independent field guide to Airstream's 2025–2026 lineup — Airstream has since moved to model year 2027. Trailer specs checked against official Airstream sources (Sept 2026); 2025 figures are inherited from 2026 and unverified.</p>
</div>
</div>
<p class="footer-legal muted">Independent reference. Not affiliated with Airstream, Inc. Specs compiled from published sources; verify with a dealer before purchase. Model imagery is manufacturer product photography.</p>
</footer>
<div class="lightbox" id="lightbox" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Photo viewer">
<div class="lightbox-backdrop" data-lb-close></div>
<button type="button" class="lightbox-close" data-lb-close aria-label="Close (Esc)"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg></button>
<button type="button" class="lightbox-nav lightbox-prev" data-lb-prev aria-label="Previous photo"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 5 8 12 15 19"></polyline></svg></button>
<figure class="lightbox-stage">
<img class="lightbox-img" id="lightbox-img" alt="">
<figcaption class="lightbox-caption" id="lightbox-caption"></figcaption>
</figure>
<button type="button" class="lightbox-nav lightbox-next" data-lb-next aria-label="Next photo"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 5 16 12 9 19"></polyline></svg></button>
</div>
<div class="quick-view" id="quick-view" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Quick view">
<div class="qv-backdrop" data-qv-close></div>
<div class="qv-panel">
<button type="button" class="qv-close" data-qv-close aria-label="Close">&times;</button>
<button type="button" class="qv-nav qv-nav--prev" id="qv-prev" aria-label="Previous floorplan"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 19 8 12 15 5"></polyline></svg></button>
<button type="button" class="qv-nav qv-nav--next" id="qv-next" aria-label="Next floorplan"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 5 16 12 9 19"></polyline></svg></button>
<div class="qv-counter" id="qv-counter" aria-hidden="true"></div>
<div class="qv-media"><img class="qv-img" id="qv-img" alt="" width="400" height="260"><div class="qv-gallery-strip" id="qv-gallery" hidden></div></div>
<div class="qv-body">
<p class="qv-year" id="qv-year"></p>
<h3 class="qv-title" id="qv-title"></h3>
<p class="qv-desc" id="qv-desc"></p>
<dl class="qv-specs" id="qv-specs"></dl>
<div class="qv-actions">
<a class="qv-detail-btn" id="qv-detail-link" href="#">View full details →</a>
<button type="button" class="qv-save-btn" id="qv-save" aria-label="Save"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"></path></svg> <span id="qv-save-label">Save</span></button>
<label class="qv-compare-label"><input type="checkbox" class="qv-compare-box" id="qv-compare"> Compare</label>
</div>
</div>
</div>
</div>
<button type="button" class="back-to-top" id="back-to-top" aria-label="Back to top" hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
<div class="kb-help" id="kb-help" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
<div class="kb-help-backdrop" data-kb-close></div>
<div class="kb-help-panel">
<div class="kb-help-head"><h2>Keyboard shortcuts</h2><button type="button" class="kb-help-close" data-kb-close aria-label="Close">&times;</button></div>
<div class="kb-help-body">
<div class="kb-group"><h3>Navigation</h3>
<div class="kb-row"><kbd>/</kbd><span>Focus search</span></div>
<div class="kb-row"><kbd>j</kbd> / <kbd>k</kbd><span>Next / previous card</span></div>
<div class="kb-row"><kbd>Enter</kbd><span>Open focused card</span></div>
<div class="kb-row"><kbd>←</kbd> / <kbd>→</kbd><span>Prev / next in Quick View</span></div>
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
<button type="button" class="scroll-top" id="scroll-top" aria-label="Scroll to top" title="Back to top" hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
${scripts}</body>
</html>`;
}

// Glossary of spec terms - shown as tooltips on the detail spec table.
// Each key matches the label used in specRow(); only detail-page rows get tips.
const SPEC_GLOSSARY = {
  'Length': 'Exterior body length as published by Airstream - excludes the hitch/tongue. Allow about 3 ft extra for the true bumper-to-hitch length.',
  'Ext. width': 'Widest point of the exterior shell - determines lane fit and campsite clearance.',
  'Ext. height': 'Overall height with A/C unit - the clearance you need for bridges, tunnels, and covered campsites.',
  'Interior height': 'Standing headroom inside with A/C unit - measured at the tallest point.',
  'Dry weight': 'Airstream "Unit Base Weight" - as shipped from the factory with full propane tanks and batteries. No water, options, or personal gear.',
  'GVWR': 'Gross Vehicle Weight Rating - the maximum safe total weight when fully loaded.',
  'Cargo capacity (CCC)': 'GVWR minus dry weight. Everything you add (water, propane, gear) must fit within this.',
  'Hitch weight': 'The downward force the tongue puts on your tow vehicle\'s hitch.',
  'Fresh / gray / black': 'Fresh = clean drinking water. Gray = sink/shower drainage. Black = toilet waste.',
  'Solar': 'Factory rooftop solar panel wattage for charging the house battery off-grid.',
  'Battery': 'House battery capacity in kilowatt-hours - powers lights, outlets, and appliances.',
  'Off-grid score': 'An editorial 0–100 composite from this site - battery kWh, solar watts, and tank sizes vs. the lineup. Tiers: Strong (75+), Moderate (55–74), Basic (<55). Not an official Airstream rating.',
  'MSRP': 'Manufacturer\'s Suggested Retail Price. Airstream does not publish per-floorplan starting prices - this figure is an estimate, rounded to the nearest $100.',
  'Sleeps': 'Maximum sleeping positions from the factory floorplan layout.',
  'Axle': 'Single-axle trailers are lighter and easier to maneuver; dual-axle adds stability for larger, heavier models.',
};

/** Render standout badges for a trailer detail page. */
// ---------------------------------------------------------------------------
// AT A GLANCE - computed prose summary for detail page hero section.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PERSONAL NOTES - textarea with localStorage persistence per floorplan.
// ---------------------------------------------------------------------------

function renderStandoutBadges(t, allTrailers) {
  const badges = computeStandouts(t, allTrailers);
  if (!badges.length) return '';
  const pills = badges.map((b) =>
    `<span class="standout-badge">${esc(b.label)}</span>`
  ).join('');
  return `<div class="standout-badges" aria-label="Standout traits">${pills}</div>`;
}

// ---------------------------------------------------------------------------
// BROWSE-SIMILAR LINKS - deep-link back to explore with this trailer's specs
// as filter bounds, creating a natural browse loop.
// ---------------------------------------------------------------------------
function renderBrowseLinks(t) {
  const links = [];
  // Price bracket: ±$20K rounded to nearest $10K
  if (t.msrp > 0) {
    const lo = Math.max(0, Math.floor((t.msrp - 20000) / 10000) * 10000);
    const hi = Math.ceil((t.msrp + 20000) / 10000) * 10000;
    const loK = Math.round(lo / 1000);
    const hiK = Math.round(hi / 1000);
    links.push(`<a href="../index.html#all&price=${hi}&year=" class="browse-link">$${loK}K–$${hiK}K range →</a>`);
  }
  // Weight class
  if (t.weightLb) {
    const wCeil = Math.ceil(t.weightLb / 1000) * 1000 + 1000;
    links.push(`<a href="../index.html#all&weight=${wCeil}&year=" class="browse-link">Under ${wCeil.toLocaleString('en-US')} lb →</a>`);
  }
  // Sleeps
  if (t.sleeps >= 4) {
    links.push(`<a href="../index.html#all&sleeps=${t.sleeps}&year=" class="browse-link">Sleeps ${t.sleeps}+ →</a>`);
  }
  if (!links.length) return '';
  return `<div class="browse-links"><span class="browse-links-label">Browse similar:</span>${links.join('')}</div>`;
}

function specRow(label, value, { tip = false, unit = null, raw = null, pctData = null, pctField = null, fleetRange = null, yearDelta = null } = {}) {
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
    // Direction-aware badge text: "Top 10%" is ambiguous on price - a cheap
    // trailer is "top" only in the affordability sense.
    const pctText = pctField === 'msrp' ? `Lowest-priced ${100 - barW}%` : `Top ${100 - barW}%`;
    pctHtml = `<span class="spec-pct spec-pct--${tier}" title="${esc(pctData.label || '')}" aria-label="${esc(pctData.label || '')}"><span class="spec-pct-bar" style="width:${barW}%"></span><span class="spec-pct-text">${pctText}</span></span>`;
  }
  // Fleet position bar - thin inline bar for ALL numeric specs showing where
  // this value falls within the fleet min→max range.
  let fleetHtml = '';
  if (fleetRange) {
    const pos = rangePosition(fleetRange.value, fleetRange.range);
    if (pos != null) {
      fleetHtml = `<span class="spec-fleet" aria-label="${esc(label)}: ${ordinal(pos)} percentile in lineup" title="Fleet position: ${pos}%"><span class="spec-fleet-track"><span class="spec-fleet-fill" style="width:${pos}%"></span><span class="spec-fleet-dot" style="left:${pos}%"></span></span></span>`;
    }
  }
  // Year-over-year change indicator (2025→2026)
  let ydHtml = '';
  if (yearDelta) {
    const arrow = yearDelta.direction === 'up' ? '↑' : yearDelta.direction === 'down' ? '↓' : '~';
    const cls = yearDelta.direction === 'up' ? 'spec-yd--up' : yearDelta.direction === 'down' ? 'spec-yd--down' : 'spec-yd--changed';
    const deltaText = yearDelta.delta != null
      ? (yearDelta.delta > 0 ? '+' : '') + yearDelta.formatted
      : 'changed';
    ydHtml = `<span class="spec-yd ${cls}" title="vs 2025: ${esc(deltaText)}" aria-label="Changed from 2025: ${esc(deltaText)}"><span class="spec-yd-arrow">${arrow}</span><span class="spec-yd-val">${esc(deltaText)}</span></span>`;
  }
  return `<div class="spec"><dt>${dtInner}</dt><dd${unitAttr}>${esc(value)}${ydHtml}${pctHtml}${fleetHtml}</dd></div>`;
}

function tagChips(tags) {
  if (!tags || !tags.length) return '';
  return `<ul class="chips">${tags
    .map((t) => `<li class="chip">${esc(t)}</li>`)
    .join('')}</ul>`;
}


// ---------------------------------------------------------------------------
// DETAIL REDESIGN (2026-09-27, approved): quiet-luxury editorial system.
// - Zero emoji: key stats use single-stroke inline SVG icons (1.5px,
//   currentColor); everywhere else plain text or small monochrome SVG.
// - Missing values render as literal "n/a" (iron rule) - the local na()
//   helper converts the old "—" fallback before it reaches the DOM.
// - One Fraunces display title per page (the h1); every section head is
//   <h2 class="dsec-title"> so the global visual system owns the treatment.
// - Interactive tools keep their app.js DOM contracts (ids / classes);
//   merged sections own the anchor ids; inner tools carry none so the
//   auto-collapse module (collapsibleSections) leaves them open.
// ---------------------------------------------------------------------------

/** Missing-value marker for detail pages: literal "n/a", never "—". */
function na(s) {
  return String(s == null ? '' : s).replace(/—/g, 'n/a');
}

/** Single-stroke (1.5px, currentColor) line icons for key stats. */
const KS_ICONS = {
  length: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="9" width="19" height="6" rx="1"/><path d="M6.5 9v2.5M10.5 9v1.8M14.5 9v2.5M18 9v1.8"/></svg>',
  weight: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="14" r="6.5"/><path d="M12 7.5V4M9.5 4h5"/></svg>',
  sleeps: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18V6"/><path d="M3 13h18v5"/><path d="M3 15.5h18"/><circle cx="6.2" cy="9.6" r="1.6"/></svg>',
  price: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 11.5v-8h8L20 12l-8.5 8.5z"/><circle cx="8" cy="8" r="1.3"/></svg>',
  battery: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="8" width="17" height="8.5" rx="1.5"/><path d="M21.8 11v3"/><path d="M7 11v3M11 11v3"/></svg>',
  water: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5c3.4 4.4 5.8 7.6 5.8 10.6a5.8 5.8 0 1 1-11.6 0c0-3 2.4-6.2 5.8-10.6z"/></svg>',
};

/** Render the key-stats dashboard below the detail hero. */
function renderKeyStats(t) {
  const stats = [
    { icon: 'length', value: na(formatLength(t.lengthFt)), label: 'Length', unit: 'length', raw: t.lengthFt },
    { icon: 'weight', value: na(formatWeight(t.weightLb)), label: 'Dry weight', unit: 'weight', raw: t.weightLb },
    { icon: 'sleeps', value: t.sleeps != null ? String(t.sleeps) : 'n/a', label: 'Sleeps' },
    { icon: 'price', value: na(formatMsrpShort(t.msrp)), label: 'Base MSRP' },
  ].filter(Boolean);
  return `<div class="key-stats" aria-label="Key specifications at a glance">${stats.map((s) => {
    const unitAttr = s.unit && s.raw != null ? ` data-unit="${esc(s.unit)}" data-raw="${esc(String(s.raw))}"` : '';
    const titleAttr = s.title ? ` title="${esc(s.title)}"` : '';
    return `<div class="key-stat"><span class="key-stat-icon" aria-hidden="true">${KS_ICONS[s.icon]}</span><span class="key-stat-value"${unitAttr}${titleAttr}>${esc(s.value)}</span><span class="key-stat-label">${esc(s.label)}</span></div>`;
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
// WEIGHT CONTEXT - translates abstract weight into relatable everyday objects.
// Uses real, verifiable reference weights so buyers can intuit what the number
// means. Only the closest 3 references are shown so it stays concise.
// ---------------------------------------------------------------------------

const WEIGHT_REFS = [
  { label: 'grand piano', lb: 800, icon: '🎹' },
  { label: 'smart car', lb: 1850, icon: '🚗' },
  { label: 'Honda Civic', lb: 3100, icon: '🚙' },
  { label: 'Ford F-150', lb: 4700, icon: '🛻' },
  { label: 'Ford Expedition', lb: 5700, icon: '🚐' },
  { label: 'African elephant', lb: 13000, icon: '🐘' },
];

export function renderWeightContext(t) {
  if (!(t.weightLb > 0)) return '';
  const w = t.weightLb;

  const comparisons = WEIGHT_REFS
    .map((r) => {
      const ratio = w / r.lb;
      let text;
      if (ratio >= 0.95 && ratio <= 1.05) {
        text = `About the same as one ${r.label}`;
      } else if (ratio > 1.05) {
        const rounded = Math.round(ratio * 10) / 10;
        const plural = rounded === 1 ? r.label : r.label + 's';
        text = `About ${rounded}× a ${r.label}`;
        if (rounded === Math.round(rounded)) {
          text = `About ${Math.round(rounded)} ${plural}`;
        }
      } else {
        const pct = Math.round(ratio * 100);
        text = `About ${pct}% of a ${r.label}`;
      }
      return { ...r, ratio, text, distance: Math.abs(Math.log(ratio)) };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  const items = comparisons
    .map((c) => {
      const barPct = Math.min(100, Math.max(4, Math.round((w / c.lb) * 50)));
      const refPct = Math.min(100, Math.max(4, 50));
      return `<div class="wctx-item">
<span class="wctx-icon" aria-hidden="true">${c.icon}</span>
<div class="wctx-detail">
<span class="wctx-text">${esc(c.text)}</span>
<div class="wctx-bars">
<div class="wctx-bar wctx-bar--trailer" style="width:${barPct}%"><span class="wctx-bar-label">${esc(formatWeight(w))}</span></div>
<div class="wctx-bar wctx-bar--ref" style="width:${refPct}%"><span class="wctx-bar-label">${esc(c.label)} ${esc(formatWeight(c.lb))}</span></div>
</div>
</div>
</div>`;
    })
    .join('\n');

  return `<section class="weight-context" id="weight-context" aria-label="Weight in context">
<h2>How heavy is ${esc(formatWeight(w))}?</h2>
<p class="wctx-intro muted">Your ${esc(t.model)} ${esc(t.floorplan)} weighs ${esc(formatWeight(w))} dry - here's how that compares to everyday objects.</p>
<div class="wctx-grid">${items}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// WEIGHT BUDGET WATERFALL - shows how CCC gets consumed by fluids.
// Note: factory-full propane is ALREADY inside CCC (Airstream publishes UBW
// "with LP & Batteries"), so it is not a CCC-consuming segment here.
// ---------------------------------------------------------------------------

function renderWeightBudget(t) {
  if (!(t.cccLb > 0) || !(t.gvwrLb > 0)) return '';
  const WPG = 8.34; // lb per gallon of water
  const freshLb = t.freshGal ? Math.round(t.freshGal * WPG) : 0;
  const grayLb = t.grayGal ? Math.round(t.grayGal * WPG) : 0;
  const blackLb = t.blackGal ? Math.round(t.blackGal * WPG) : 0;
  const wasteLb = grayLb + blackLb;
  const totalFluids = freshLb + wasteLb;
  const gearLb = Math.max(0, t.cccLb - totalFluids);
  const ccc = t.cccLb;
  // When fluids exceed CCC (common on compact models), normalize to total
  // so the bar stays at 100% and clearly shows the overshoot.
  const overBudget = totalFluids > ccc;
  const base = overBudget ? totalFluids : ccc;
  const freshPct = Math.round((freshLb / base) * 100);
  const wastePct = Math.round((wasteLb / base) * 100);
  const gearPct = overBudget ? 0 : Math.max(0, 100 - freshPct - wastePct);
  const segments = [
    freshLb > 0 ? { cls: 'wb-fresh', pct: freshPct, label: 'Fresh water', value: `${freshLb} lb (${t.freshGal} gal)` } : null,
    wasteLb > 0 ? { cls: 'wb-waste', pct: wastePct, label: wasteLb === grayLb ? 'Gray tank' : (grayLb && blackLb ? 'Gray + black' : 'Waste tank'), value: `${wasteLb} lb` } : null,
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
    ? `<p class="wb-verdict wb-verdict--tight">⚠ Full tanks (${formatWeight(totalFluids)}) exceed your ${formatWeight(ccc)} CCC by ${formatWeight(overAmt)}. Travel with tanks partially filled to leave room for personal gear. (Propane ships full from the factory and is already inside your CCC.)</p>`
    : gearLb < 200
    ? '<p class="wb-verdict wb-verdict--ok">Enough for essentials, but budget carefully for longer trips.</p>'
    : '<p class="wb-verdict wb-verdict--good">Comfortable margin for gear, food, and supplies.</p>';
  return `<div class="weight-budget collapsible" id="weight-budget" aria-label="Weight budget breakdown">
<h3 class="collapsible-trigger" aria-expanded="false" tabindex="0" role="button">Weight budget: where your ${esc(formatWeight(ccc))} goes<span class="collapsible-icon" aria-hidden="true"></span></h3>
<div class="collapsible-body" hidden>
<p class="wb-intro">When all tanks are full, here's how your ${esc(formatWeight(ccc))} cargo capacity (CCC) breaks down. Propane is not listed: it ships with full tanks from the factory and is already counted inside CCC.${overBudget ? ' <strong>On this model, full fluids exceed CCC - plan accordingly.</strong>' : ''}</p>
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
  const towBadge = tc ? `<span class="tow-badge tow-badge--${esc(tc.cls)}" aria-label="${esc(tc.label)}">${esc(tc.label)}</span>` : '';
  return `<a class="fam" href="${linkPrefix}f/${esc(fam.slug)}.html" data-family="${esc(fam.family)}">
<div class="fam-media">
<img src="${linkPrefix}${esc(fam.hero)}" alt="Airstream ${esc(fam.family)}" loading="lazy" width="800" height="500" style="view-transition-name:vt-hero-${esc(fam.slug)}">
${limited}
<span class="fam-plans">${esc(plans)}</span>
</div>
<div class="fam-body">
<span class="fam-name">${esc(fam.family)}</span>
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
 *   • "By family" - the cinematic 12-family grid (default view)
 *   • "All floorplans" - the full Explore & match experience (tow matcher +
 *     search/sort/filter + the 59-floorplan grid + compare tray)
 * Both views are SERVER-RENDERED so the page is complete with no JS; app.js
 * toggles between them and mirrors state in the URL hash (#families / #all)
 * for deep-linking + back-button. `trailers`/`resolve` power the all view.
 */

// ---------------------------------------------------------------------------
// MODEL YEAR HIGHLIGHTS — auto-generated 2025→2026 changes summary
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WHAT'S NEW IN 2026 - editorial overview of all model year changes.
// Shows new models, discontinued models, and aggregated spec changes.
// ---------------------------------------------------------------------------
export function renderWhatsNew2026(trailers) {
  const t2026 = trailers.filter((t) => t.year === 2026);
  const t2025 = trailers.filter((t) => t.year === 2025);
  if (t2026.length === 0) return '';

  const keys26 = new Set(t2026.map((t) => t.model + '|' + t.floorplan));
  const keys25 = new Set(t2025.map((t) => t.model + '|' + t.floorplan));

  // New for 2026 (no 2025 counterpart)
  const newModels = t2026.filter((t) => !keys25.has(t.model + '|' + t.floorplan));
  // Discontinued (2025 only, no 2026 counterpart)
  const discontinued = t2025.filter((t) => !keys26.has(t.model + '|' + t.floorplan));
  // Paired models with spec changes
  const paired = t2026.filter((t) => keys25.has(t.model + '|' + t.floorplan));
  const changed = [];
  for (const curr of paired) {
    const diff = computeYearDiff(curr, trailers);
    if (diff && diff.diffs.length) {
      const priceDiff = diff.diffs.find((d) => d.key === 'msrp');
      const weightDiff = diff.diffs.find((d) => d.key === 'weightLb');
      changed.push({ trailer: curr, diffs: diff.diffs, priceDiff, weightDiff });
    }
  }

  // Nothing interesting to show
  if (newModels.length === 0 && discontinued.length === 0 && changed.length === 0) return '';

  // Build summary chips
  const chips = [];
  if (newModels.length) chips.push(`<span class="wn26-chip wn26-chip--new">${newModels.length} new model${newModels.length > 1 ? 's' : ''}</span>`);
  if (discontinued.length) chips.push(`<span class="wn26-chip wn26-chip--disc">${discontinued.length} discontinued</span>`);
  const priceDrops = changed.filter((h) => h.priceDiff && h.priceDiff.delta < 0);
  const priceUps = changed.filter((h) => h.priceDiff && h.priceDiff.delta > 0);
  const lighter = changed.filter((h) => h.weightDiff && h.weightDiff.delta < 0);
  if (priceDrops.length) chips.push(`<span class="wn26-chip wn26-chip--good">${priceDrops.length} price drop${priceDrops.length > 1 ? 's' : ''}</span>`);
  if (priceUps.length) chips.push(`<span class="wn26-chip wn26-chip--warn">${priceUps.length} price increase${priceUps.length > 1 ? 's' : ''}</span>`);
  if (lighter.length) chips.push(`<span class="wn26-chip wn26-chip--good">${lighter.length} weight reduction${lighter.length > 1 ? 's' : ''}</span>`);
  if (paired.length > 0 && changed.length === 0) chips.push(`<span class="wn26-chip">${paired.length} models unchanged</span>`);

  // New model cards
  const newCards = newModels.map((t) => {
    const price = t.msrp > 0 ? formatMsrp(t.msrp) : 'Price TBA';
    const weight = t.weightLb ? formatWeight(t.weightLb) : '';
    const len = t.lengthFt ? formatLength(t.lengthFt) : '';
    const specs = [len, weight, t.sleeps ? 'sleeps ' + t.sleeps : ''].filter(Boolean).join(' · ');
    return `<a class="wn26-card wn26-card--new" href="m/${esc(t.slug)}.html">
<span class="wn26-card-badge">New</span>
<span class="wn26-card-name">${esc(t.model)} ${esc(t.floorplan)}</span>
<span class="wn26-card-specs muted">${esc(specs)}</span>
<span class="wn26-card-price">${esc(price)}</span>
</a>`;
  }).join('\n');

  // Changed model cards
  const changedCards = changed.slice(0, 6).map((h) => {
    const topDiffs = h.diffs.slice(0, 3).map((d) => {
      const sign = d.delta > 0 ? '+' : '';
      let val = '';
      if (d.unit === '$') val = sign + formatMsrpShort(d.delta);
      else if (d.unit === 'lb') val = sign + d.delta.toLocaleString('en-US') + ' lb';
      else if (d.unit === 'W') val = sign + d.delta + ' W';
      else if (d.unit === 'kWh') val = sign + d.delta + ' kWh';
      else if (d.unit === 'gal') val = sign + d.delta + ' gal';
      else val = sign + d.delta + ' ' + d.unit;
      const cls = d.direction === 'up' ? 'wn26-delta--up' : d.direction === 'down' ? 'wn26-delta--down' : '';
      return `<span class="wn26-delta ${cls}">${esc(d.field)}: ${esc(val)}</span>`;
    }).join('');
    return `<a class="wn26-card" href="m/${esc(h.trailer.slug)}.html#year-diff">
<span class="wn26-card-name">${esc(h.trailer.model)} ${esc(h.trailer.floorplan)}</span>
<span class="wn26-card-deltas">${topDiffs}</span>
</a>`;
  }).join('\n');

  // Discontinued cards
  const discCards = discontinued.map((t) => {
    return `<a class="wn26-card wn26-card--disc" href="m/${esc(t.slug)}.html">
<span class="wn26-card-badge wn26-badge--disc">Discontinued</span>
<span class="wn26-card-name">${esc(t.model)} ${esc(t.floorplan)}</span>
<span class="wn26-card-specs muted">${esc(String(t.year))} model year</span>
</a>`;
  }).join('\n');

  // Group cards into labelled sections
  let sections = '';
  if (newCards) sections += `<div class="wn26-group">
<h3 class="wn26-group-title">New for 2026</h3>
<div class="wn26-grid">${newCards}</div>
</div>`;
  if (changedCards) sections += `<div class="wn26-group">
<h3 class="wn26-group-title">Updated specs</h3>
<div class="wn26-grid">${changedCards}</div>
</div>`;
  if (discCards) sections += `<div class="wn26-group">
<h3 class="wn26-group-title">Discontinued</h3>
<div class="wn26-grid">${discCards}</div>
</div>`;

  const carryover = paired.length - changed.length;
  const sub = carryover > 0
    ? `${t2026.length} trailer floorplans in the 2026 lineup - ${carryover} carry over unchanged from 2025.`
    : `${t2026.length} trailer floorplans in the 2026 lineup.`;

  return `<section class="wn26-section" id="whats-new" aria-label="What's new in the 2026 lineup">
<div class="wn26-head">
<h2 class="wn26-title">What's new in 2026</h2>
<p class="wn26-sub muted">${sub}</p>
</div>
<div class="wn26-chips">${chips.join('')}</div>
${sections}
</section>`;
}

// ---------------------------------------------------------------------------
// EDITOR'S PICKS - curated "best for" recommendation strips on the home page.
// Computed from real spec data, 2026 models only, deduplicated per family.
// ---------------------------------------------------------------------------
function computeEditorsPicks(trailers, resolve) {
  const current = trailers.filter((t) => t.year === 2026);
  if (current.length < 6) return '';

  // Helper: pick the best N trailers by a scoring function, max 1 per family
  function bestBy(arr, scoreFn, n = 3) {
    const scored = arr
      .filter((t) => scoreFn(t) != null && Number.isFinite(scoreFn(t)))
      .map((t) => ({ t, score: scoreFn(t) }))
      .sort((a, b) => b.score - a.score);
    const seen = new Set();
    const picks = [];
    for (const { t } of scored) {
      const fam = familySlug(t.model);
      if (seen.has(fam)) continue;
      seen.add(fam);
      picks.push(t);
      if (picks.length >= n) break;
    }
    return picks;
  }

  const categories = [
    {
      id: 'easy-tow',
      title: 'Easiest to tow',
      sub: 'Lightest GVWR - more vehicle choices',
      picks: bestBy(current, (t) => t.gvwrLb > 0 ? -t.gvwrLb : null),
      stat: (t) => formatWeight(t.gvwrLb) + ' GVWR',
    },
    {
      id: 'off-grid',
      title: 'Best off-grid',
      sub: 'Highest self-sufficiency score',
      picks: bestBy(current, (t) => t.offGridScore || 0),
      stat: (t) => (t.offGridScore || 0) + '/100 off-grid',
    },
    {
      id: 'spacious',
      title: 'Most spacious',
      sub: 'Maximum sleeping capacity & length',
      picks: bestBy(current, (t) => (t.sleeps || 0) * 10 + (t.lengthFt || 0)),
      stat: (t) => 'Sleeps ' + t.sleeps + ' · ' + formatLength(t.lengthFt),
    },
    {
      id: 'value',
      title: 'Best value',
      sub: 'Most space per dollar',
      picks: bestBy(current, (t) => t.msrp > 0 && t.lengthFt > 0 ? (t.lengthFt * (t.sleeps || 1)) / t.msrp * 100000 : null),
      stat: (t) => formatMsrp(t.msrp) + ' · sleeps ' + t.sleeps,
    },
  ];

  const strips = categories.map((cat) => {
    if (cat.picks.length < 2) return '';
    const cards = cat.picks.map((t) => {
      const a = resolve(t);
      return `<a class="pick-card" href="m/${esc(t.slug)}.html">
<img class="pick-card-img" src="${esc(a.thumb)}" alt="${esc(trailerTitle(t))}" loading="lazy" width="280" height="182">
<div class="pick-card-body">
<span class="pick-card-name">${esc(t.model)} ${esc(t.floorplan)}</span>
<span class="pick-card-stat muted">${cat.stat(t)}</span>
</div></a>`;
    }).join('\n');
    return `<div class="pick-strip" data-pick="${esc(cat.id)}">
<div class="pick-strip-head">
<div class="pick-strip-text"><span class="pick-strip-title">${esc(cat.title)}</span><span class="pick-strip-sub muted">${esc(cat.sub)}</span></div>
</div>
<div class="pick-strip-scroll">${cards}</div>
</div>`;
  }).filter(Boolean).join('\n');

  if (!strips) return '';
  return `<section class="editors-picks" id="editors-picks" aria-label="Editor's picks">
<h2 class="picks-heading">Editor's picks</h2>
<p class="picks-sub muted">Curated from the current lineup — ranked by real specs, not marketing.</p>
${strips}
</section>`;
}

export function renderIndex(families, trailers = [], resolve = assetPaths, motorhomes = [], motorhomeFamilies = []) {
  // Unified family grid: trailer families + motorhome families in one .fam-grid.
  const cards = [
    ...families.map((f) => renderFamilyCard(f, '')),
    ...motorhomeFamilies.map((f) => renderMotorhomeFamilyCard(f, '')),
  ].join('\n');
  const allFamilies = families.length + motorhomeFamilies.length;
  // Record count when the record arrays are passed (real build); otherwise
  // derive from the family rollups so a families-only call still shows a
  // truthful number instead of 0.
  const totalPlans = (trailers.length + motorhomes.length)
    || [...families, ...motorhomeFamilies].reduce((n, f) => n + (f.floorplanCount || 0), 0);
  // Year coverage, computed from the data — never hardcoded. (Trailers span
  // 2025–2026, touring coaches 2026–2027 as of this writing.)
  const years = [
    ...trailers.map((t) => t.year),
    ...motorhomes.map((m) => m.year),
  ].filter((y) => Number.isFinite(y));
  const yearSpan = years.length && Math.min(...years) !== Math.max(...years)
    ? `${Math.min(...years)}–${Math.max(...years)}`
    : (years.length ? `${years[0]}` : '');
  // Editorial full-bleed hero. Pick a deliberately *different* establishing
  // shot than the first card below it (which is the flagship Classic), so the
  // opening viewport has visual variety instead of the same image twice - the
  // "duplicate hero" smell. International's red-rock adventure shot reads as the
  // brand hero; fall back to the flagship, then to the text-only header, so
  // this never renders a broken/empty hero if the catalog changes.
  const heroFam = families.find((f) => f.family === 'International')
    || families.find((f) => f.hero) || null;
  const heroImg = heroFam && heroFam.hero;
  const heroBand = heroImg
    ? `<header class="home-hero">
<img class="home-hero-img" src="${esc(heroImg)}" ${heroImgAttrs(heroImg)} alt="An Airstream travel trailer at golden hour" width="1280" height="720" fetchpriority="high">
<div class="home-hero-shade"></div>
<div class="home-hero-inner">
<p class="eyebrow eyebrow-light">AIRSTREAM${yearSpan ? ` · ${yearSpan} MODEL YEARS` : ''}</p>
<h1>Every Airstream, by family</h1>
<p class="lede">A field guide to the full Airstream lineup — <span class="hero-stat" data-hero-num="${allFamilies}">${allFamilies}</span> families, <span class="hero-stat" data-hero-num="${totalPlans}">${totalPlans}</span> floorplans across travel trailers and touring coaches. Specs checked against official Airstream sources.</p>
<p class="home-hero-cta"><a class="home-hero-btn" href="#all" data-view-go="all">Explore all floorplans</a></p>
</div>
</header>`
    : `<header class="hero-head">
<p class="eyebrow">AIRSTREAM${yearSpan ? ` · ${yearSpan}` : ''}</p>
<h1>Every Airstream, by family</h1>
<p class="lede">A field guide to the full Airstream lineup — ${allFamilies} families, ${totalPlans} floorplans across travel trailers and touring coaches. Start with a family, then dive into each floorplan's full specs.</p>
<p class="hero-cta"><a href="#all" data-view-go="all">Explore all floorplans →</a></p>
</header>`;
  // Editorial segmented control - styled as a magazine section divider
  // (Fraunces letterspaced caps + copper underline), NOT a SaaS pill. Distinct
  // class from the family-page year toggle (.seg-btn) so app.js modules don't
  // collide. aria-pressed conveys state to AT; hash deep-links each view.
  const viewToggle = `<nav class="viewseg" id="view-toggle" aria-label="Browse mode">
<a class="viewseg-btn is-active" href="#families" data-view="families" aria-current="page"><span class="viewseg-label">By family</span><span class="viewseg-sub">${allFamilies} model lines</span></a>
<a class="viewseg-btn" href="#all" data-view="all"><span class="viewseg-label">All floorplans</span><span class="viewseg-sub">${totalPlans} floorplans</span></a>
</nav>`;
  // Magazine-style index: three text rows (size / budget / tow vehicle) that
  // deep-link into pre-filtered Explore views. Replaces the deleted quiz —
  // same wayfinding job, directory styling, no wizard, no emoji.
  const browseIndex = `<nav class="home-index" aria-label="Browse the lineup">
<p class="home-index-label">Browse the lineup</p>
<div class="home-index-row"><span class="home-index-key">By size</span><span class="home-index-links"><a href="#all&len=20&sort=length-asc">Under 20 ft</a><a href="#all&len=25&sort=length-asc">Under 25 ft</a><a href="#all&len=30&sort=length-asc">Under 30 ft</a></span></div>
<div class="home-index-row"><span class="home-index-key">By budget</span><span class="home-index-links"><a href="#all&price=80000&sort=price-asc">Under $80k</a><a href="#all&price=120000&sort=price-asc">Under $120k</a><a href="#all&price=200000&sort=price-asc">Under $200k</a></span></div>
<div class="home-index-row"><span class="home-index-key">By tow vehicle</span><span class="home-index-links"><a href="#all&tow=5000">5,000 lb rating</a><a href="#all&tow=7000">7,000 lb rating</a><a href="#all&tow=10000">10,000 lb rating</a></span></div>
</nav>`;
  const editorsPicks = computeEditorsPicks(trailers, resolve);
  const body = `${heroBand}
${viewToggle}
${browseIndex}
<section class="home-recent" id="home-recent" hidden>
<div class="home-recent-head"><h2 class="home-recent-title">Recently viewed</h2><button type="button" class="home-recent-clear" id="home-recent-clear">Clear</button></div>
<div class="home-recent-strip" id="home-recent-grid"></div>
</section>
<section class="hub-view" id="view-families" data-view="families">
<div class="fam-grid" id="families">
${cards}
</div>
${editorsPicks}
${renderWhatsNew2026(trailers)}
${renderSizeLadder(families, trailers)}
</section>
<section class="hub-view" id="view-all" data-view="all" hidden>
${renderExploreSections(trailers, resolve, motorhomes, { headingLevel: 'h2' })}
</section>`;
  return page({
    title: 'Airstream Explorer — the full lineup by family',
    description: `A field guide to every Airstream travel trailer and touring coach${yearSpan ? ` (${yearSpan} model years)` : ''}: ${allFamilies} families, ${totalPlans} floorplans, with dimensions, weights, off-grid and pricing.`,
    body,
    active: 'index',
    canonicalPath: 'index.html',
    head: heroImg ? heroPreloadLink(heroImg) : '',
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
  // Compute ranges for inline comparison bars
  const ranges = {
    lengthFt: { min: Math.min(...plans.map((t) => t.lengthFt)), max: Math.max(...plans.map((t) => t.lengthFt)) },
    weightLb: { min: Math.min(...plans.map((t) => t.weightLb)), max: Math.max(...plans.map((t) => t.weightLb)) },
    gvwrLb: { min: Math.min(...plans.map((t) => t.gvwrLb)), max: Math.max(...plans.map((t) => t.gvwrLb)) },
    cccLb: { min: Math.min(...plans.filter((t) => t.cccLb).map((t) => t.cccLb)), max: Math.max(...plans.filter((t) => t.cccLb).map((t) => t.cccLb)) },
    offGridScore: { min: Math.min(...plans.map((t) => t.offGridScore || 0)), max: Math.max(...plans.map((t) => t.offGridScore || 0)) },
    msrp: { min: Math.min(...plans.map((t) => t.msrp)), max: Math.max(...plans.map((t) => t.msrp)) },
  };
  /** Inline bar: shows relative position within the family range. */
  const fcBar = (value, range) => {
    if (!range || !value || range.max === range.min) return '';
    const pct = Math.round(((value - range.min) / (range.max - range.min)) * 100);
    return `<span class="fc-bar" aria-hidden="true"><span class="fc-bar-fill" style="width:${pct}%"></span></span>`;
  };
  const cols = plans.map((t) => {
    const isLightest = t.weightLb === lightestLb;
    const isBestOffGrid = (t.offGridScore || 0) === bestOffGrid && bestOffGrid > 0;
    const isMostCcc = (t.cccLb || 0) === mostCcc && mostCcc > 0;
    return `<td>
<a href="../m/${esc(t.slug)}.html" class="fc-link">${esc(t.floorplan)}</a>
</td>
<td data-unit="length" data-raw="${esc(String(t.lengthFt))}">${esc(formatLength(t.lengthFt))}${fcBar(t.lengthFt, ranges.lengthFt)}</td>
<td${isLightest ? ' class="fc-best"' : ''} data-unit="weight" data-raw="${esc(String(t.weightLb))}">${esc(formatWeight(t.weightLb))}${fcBar(t.weightLb, ranges.weightLb)}</td>
<td data-unit="weight" data-raw="${esc(String(t.gvwrLb))}">${esc(formatWeight(t.gvwrLb))}${fcBar(t.gvwrLb, ranges.gvwrLb)}</td>
<td${isMostCcc ? ' class="fc-best"' : ''}${t.cccLb ? ` data-unit="weight" data-raw="${esc(String(t.cccLb))}"` : ''}>${t.cccLb ? esc(formatWeight(t.cccLb)) + fcBar(t.cccLb, ranges.cccLb) : '—'}</td>
<td>${esc(String(t.sleeps))}</td>
<td data-unit="tanks" data-raw="${esc([t.freshGal, t.grayGal, t.blackGal].join(','))}">${esc(formatTanksNA(t.freshGal, t.grayGal, t.blackGal))}</td>
<td${isBestOffGrid ? ' class="fc-best"' : ''}>${t.offGridScore || '—'}${t.offGridScore ? fcBar(t.offGridScore, ranges.offGridScore) : ''}</td>
<td>${esc(formatMsrp(t.msrp))}${fcBar(t.msrp, ranges.msrp)}</td>`;
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
export function renderFamily(fam, resolve = assetPaths, allFamilies = [], decor = null) {
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
  const famNav = allFamilies.length > 1
    ? `<nav class="famnav" aria-label="All Airstream families">
<div class="famnav-scroll">
${allFamilies.map(f => `<a class="famnav-link${f.slug === fam.slug ? ' is-current' : ''}" href="${esc(f.slug)}.html"${f.slug === fam.slug ? ' aria-current="page"' : ''}>${esc(f.family)}</a>`).join('\n')}
</div>
</nav>`
    : '';
  const body = `${famNav}<nav class="breadcrumb" aria-label="Breadcrumb"><ol class="breadcrumb-list"><li><a href="../index.html">Home</a></li><li aria-current="page">${esc(fam.family)}</li></ol></nav>
<header class="fam-hero">
<img class="fam-hero-img" src="../${esc(fam.hero)}" ${fam.hero ? heroImgAttrs(fam.hero, '../') : ''} alt="Airstream ${esc(fam.family)}" width="1280" height="720" fetchpriority="high" style="view-transition-name:vt-hero-${esc(fam.slug)}">
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
<div class="cards" id="cards">
${cards}
</div>
${renderFamilyCompare(fam)}
${renderFamilyAdvisor(fam)}
${decor ? renderDecor(decor, fam.family) : ''}`;
  // Breadcrumb trail: Home → Family
  const famBreadcrumbItems = [
    { name: 'Airstream Explorer', path: 'index.html' },
    { name: `Airstream ${fam.family}`, path: `f/${fam.slug}.html` },
  ];
  return page({
    title: `Airstream ${fam.family} - floorplans, specs & prices`,
    description: `Every Airstream ${fam.family} floorplan (${fam.years.join(' + ')}): ${range}, ${len}, sleeps up to ${fam.sleepsMax}. Compare ${fam.floorplanCount} floorplan${fam.floorplanCount === 1 ? '' : 's'} with full specs.`,
    body,
    relRoot: '../',
    active: 'index',
    canonicalPath: `f/${fam.slug}.html`,
    ogImage: fam.hero || '',
    head: breadcrumbJsonLd(famBreadcrumbItems) + (fam.hero ? '\n' + heroPreloadLink(fam.hero, '../') : ''),
  });
}

// ---------------------------------------------------------------------------
// DETAIL: one floorplan
// ---------------------------------------------------------------------------

/**
 * Off-grid endurance estimator block for a detail page. Server-renders the
 * default scenario (2 people, moderate use, summer, solar on) so it's correct
 * with no JS; the client recomputes live from the data-* spec values. Every
 * assumption is disclosed inline - we model how this trailer's REAL battery /
 * solar / tank numbers play out, we don't invent specs.
 */
export function renderOffGridTool(t) {
  // Skip entirely if we somehow lack the inputs (keeps it honest).
  if (!(t.batteryKwh > 0) || !(t.freshGal > 0)) return '';
  const def = estimateOffGrid(t, { people: 2, intensity: 'moderate', season: 'summer', useSolar: true });
  const intensityOpts = Object.entries(LOAD_PRESETS)
    .map(([k, v]) => `<option value="${esc(k)}"${k === 'moderate' ? ' selected' : ''}>${esc(v.label)} - ${esc(v.blurb)}</option>`)
    .join('');
  return `<div class="estimator offgrid-tool" aria-label="Off-grid endurance estimator"
 data-battery="${esc(t.batteryKwh)}" data-solar="${esc(t.solarW || 0)}" data-fresh="${esc(t.freshGal)}" data-gray="${esc(t.grayGal == null ? '' : t.grayGal)}" data-black="${esc(t.blackGal == null ? '' : t.blackGal)}">
<div class="est-head">
<h3 class="offgrid-title">How long off-grid?</h3>
<p class="est-sub">Boondocking endurance for this floorplan - modeled from its real ${esc(t.batteryKwh)} kWh battery, ${t.solarW ? `${esc(t.solarW)} W solar` : 'no factory solar'}, and ${esc(t.freshGal)} gal fresh / ${t.grayGal != null ? esc(t.grayGal) : 'n/a'} gal gray / ${t.blackGal != null ? esc(t.blackGal) : 'n/a'} gal black tanks.</p>
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
<p>Power: usable battery = nameplate kWh × 0.8 (blended depth-of-discharge). Daily load presets - light ≈ 1,500, moderate ≈ 2,800, heavy ≈ 5,000 Wh/day - from published boondocking power budgets, <strong>excluding air conditioning</strong> (no trailer battery runs rooftop AC for long). Solar harvest = panel watts × peak-sun-hours (summer 5.5, spring/fall 4.0, winter 2.5) × 0.7 system derate. Water: per-person daily use (light 3 / moderate 5 / heavy 8 gal fresh; gray ≈ 80% of fresh; black from toilet use) against the real tank sizes. Endurance is whichever runs out first. Estimates for planning - your real usage varies.</p>
</details>
</div>`;
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
  tight: { label: 'Tight but legal', cls: 'tow-tight', blurb: 'Within ratings, but little headroom - load carefully.' },
  over: { label: 'Over a limit', cls: 'tow-over', blurb: 'Exceeds a rating loaded - not a safe match as configured.' },
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

  // Searchable combobox (datalist progressive enhancement): alphabetical by
  // name so a 200-item list stays scannable. The input's display text is the
  // unique "Name - config" string; app.js maps it back to the vehicle id.
  const vehicleLabel = (v) => `${v.name} - ${v.config}`;
  const vehicleOpts = TOW_VEHICLES
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((v) => `<option value="${esc(vehicleLabel(v))}"></option>`)
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

  return `<div class="towtool" aria-label="Tow-safety calculator"
 data-gvwr="${esc(t.gvwrLb)}"${t.weightLb ? ` data-weight="${esc(t.weightLb)}"` : ''}${t.hitchWeightLb ? ` data-hitch="${esc(t.hitchWeightLb)}"` : ''}>
<script type="application/json" id="tow-data">${dataIsland}</script>
<div class="tow-head">
<h3 class="towtool-title">Can your vehicle tow it?</h3>
<p class="tow-sub">Checks this floorplan's <strong>loaded</strong> weight (${esc(formatWeight(t.gvwrLb))} GVWR) against a tow vehicle's three real limits - tow rating, payload, and combined weight (GCWR). Pick your vehicle:</p>
<p class="tow-declare" id="tow-declare">Ratings shown for <strong id="tow-declare-vehicle">${esc(def.name)} - ${esc(def.config)}</strong>. Your door-jamb certification label wins over any number here.</p>
</div>
<div class="tow-controls">
<div class="tow-field tow-field-wide">
<label for="tow-vehicle">Tow vehicle</label>
<input id="tow-vehicle" type="text" role="combobox" aria-autocomplete="list" aria-controls="tow-vehicle-list" autocomplete="off" spellcheck="false" value="${esc(vehicleLabel(def))}">
<datalist id="tow-vehicle-list">${vehicleOpts}</datalist>
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
<fieldset class="tow-overrides">
<legend>Your door-jamb numbers <span class="tow-override-hint">optional - overrides the preset</span></legend>
<p class="tow-override-note">Prefilled from the selected vehicle. Type your door-jamb ratings to override a limit; clear a field to use the preset again. Curb weight always comes from the selected preset - combined-weight math needs it.</p>
<div class="tow-controls">
<div class="tow-field">
<label for="tow-maxtow">Max tow rating (lb)</label>
<input type="number" id="tow-maxtow" min="0" step="100" inputmode="numeric" value="${esc(String(def.maxTowLb))}">
</div>
<div class="tow-field">
<label for="tow-payload">Payload (lb)</label>
<input type="number" id="tow-payload" min="0" step="50" inputmode="numeric" value="${esc(String(def.payloadLb))}">
</div>
<div class="tow-field">
<label for="tow-gcwr">GCWR (lb)</label>
<input type="number" id="tow-gcwr" min="0" step="100" inputmode="numeric" value="${esc(String(def.gcwrLb))}">
</div>
</div>
</fieldset>
<div class="tow-actions">
<button type="button" class="tow-copylink" id="tow-copylink">Copy link to this setup</button>
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
<p>Three checks against one stated configuration of the tow vehicle. Max tow, payload, and curb weight are manufacturer-published; GCWR is published where available and otherwise a derived planning value (curb + max tow + 300 lb - not an official published GCWR, see below).</p>
<ul>
<li><strong>Trailer tow rating</strong> - the trailer at its loaded weight (GVWR, not dry) vs. the truck's max tow rating.</li>
<li><strong>Payload</strong> - loaded tongue weight (modeled at ${Math.round(TONGUE_PCT_LOADED * 100)}% of trailer GVWR, the mid of the 10–15% rule) plus people &amp; gear in the cab vs. the truck's payload.</li>
<li><strong>Combined weight (GCWR)</strong> - truck + trailer + everything vs. the gross combined weight rating. <em>GCWR honesty note:</em> where a manufacturer publishes a GCWR we use it; where it does not, the dataset carries a derived planning value (curb weight + max tow + 300 lb, the SAE J2807 basis) - not an official published GCWR for that configuration.</li>
</ul>
<p>The verdict is the <em>worst</em> of the three: ≤80% of a limit is comfortable, 80–100% is tight, over 100% exceeds it. Manufacturers' "max tow" and "max payload" usually come from <em>different</em> configurations and are mutually exclusive, so each vehicle here uses ONE coherent, sourced config. These are planning figures - your truck's door-jamb certification label is the final word.</p>
</details>
</div>`;
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
    .map((v) => `<option value="${esc(v.id)}"${v.id === def.id ? ' selected' : ''}>${esc(v.name)} - ${esc(v.config)}</option>`)
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
<p class="est-sub" id="fuel-sub">Estimate what it costs to tow this ${esc(t.model)} ${esc(t.floorplan)} (${esc(formatWeight(t.gvwrLb))} loaded) on a road trip. ${defElectric ? 'Energy use climbs' : 'Fuel economy drops'} ${Math.round(defResult.penalty * 100)}% when towing - the heavier the trailer relative to the tow vehicle, the bigger the hit.</p>
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
<p><strong>Electric vehicles:</strong> the same weight-ratio penalty is applied to each EV's <em>EPA-rated</em> energy use (kWh/100mi), so a ~50% penalty roughly doubles consumption - consistent with the ≈50% range loss EV owners report when towing. Cost = distance ÷ 100 × towing kWh/100mi × price per kWh. We never apply gasoline math to an EV.</p>
<p>These are planning estimates - your actual range depends on speed, terrain, wind, and driving style.</p>
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

  // Breakdown bars (propane shown as delta vs the factory-full baseline already in CCC)
  const barPct = (lb) => Math.max(2, Math.min(100, (lb / (def.cccLb || 1)) * 100));
  const propaneDeltaDetail = def.propaneDeltaLb === 0
    ? '0 lb - factory-full propane is already inside your CCC'
    : `${def.propaneDeltaLb > 0 ? '+' : ''}${esc(formatLb(def.propaneDeltaLb))} vs factory-full`;
  const bars = [
    ['Fresh water', def.waterLb, `${esc(formatLb(def.waterLb))} (${t.freshGal || 0} gal × 8.34 lb/gal)`],
    ['Propane (vs factory-full)', Math.abs(def.propaneDeltaLb), propaneDeltaDetail],
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
    fullPropaneLb: FULL_PROPANE_LB,
    gearPresets: GEAR_PRESETS,
    waterLbPerGal: WATER_LB_PER_GAL,
  }).replace(/<\//g, '<\\/');

  return `<section class="estimator payload-tool" id="payload" aria-label="Payload packing calculator"
 data-ccc="${esc(t.cccLb)}" data-fresh="${esc(t.freshGal || 0)}">
<script type="application/json" id="payload-data">${dataIsland}</script>
<div class="est-head">
<h2>How much can you pack?</h2>
<p class="est-sub">This ${esc(t.model)} ${esc(t.floorplan)} has ${esc(formatWeight(t.cccLb))} of cargo carrying capacity (CCC). Water eats into that before you load a single bag - here's what's left for your gear. Propane ships with full tanks from the factory, so it's already inside your CCC: the propane control only counts the difference vs factory-full.</p>
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
<div class="payload-presets" id="payload-presets">
<button type="button" class="payload-preset" data-preset="weekend" title="Bedding, kitchen, outdoor gear">🏖️ Weekend trip</button>
<button type="button" class="payload-preset" data-preset="weeklong" title="Bedding, kitchen, clothing, food, outdoor, electronics">🛣️ Week-long road trip</button>
<button type="button" class="payload-preset" data-preset="fullload" title="Everything - all gear categories checked">🏠 Full load</button>
<button type="button" class="payload-preset payload-preset--clear" data-preset="clear" title="Uncheck all gear">✕ Clear</button>
</div>
<div class="payload-gear-grid">${gearChecks}</div>
</div>
<details class="est-method">
<summary>How this is calculated</summary>
<p>CCC (Cargo Carrying Capacity) is the maximum weight you can add to the trailer beyond its dry (empty) weight. Fresh water weighs 8.34 lb per gallon (USGS standard). Propane weight is the fuel itself - standard Airstream dual 20 lb tanks hold 40 lb of LP gas. After subtracting these consumables, the remainder is what you have for personal belongings, food, and gear. Exceeding CCC means exceeding the trailer's GVWR - an unsafe and often illegal condition. When in doubt, weigh your loaded trailer at a truck scale.</p>
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
            `<figure class="decor-swatch"><img src="../${esc(sw.src)}" alt="${esc(s.name)} - ${esc(sw.kind)}" loading="lazy" width="120" height="120"><figcaption>${esc(sw.kind)}</figcaption></figure>`,
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
<p class="decor-intro muted">Official Airstream interior packages for the ${esc(model)} - cabinetry, upholstery, and coordinating materials. Décor is offered by family, so these apply across its floorplans.</p>
<div class="decor-grid">${cards}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// SECTION QUICK-NAV: horizontal sticky bar for detail page sections
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// HERO RESPONSIVE VARIANTS (perf #28). Every 1280x720 hero ships with -640 and
// -960 WebP variants (scripts/gen-hero-variants.sh). The build's fingerprint
// step rewrites every 'assets/img/...' tail in emitted HTML - srcset and
// preload included - so these canonical paths are safe to emit pre-build.
// ---------------------------------------------------------------------------
function heroSrcset(canonHero, prefix = '') {
  const dot = canonHero.lastIndexOf('.');
  const stem = canonHero.slice(0, dot), ext = canonHero.slice(dot);
  return `${prefix}${stem}-640${ext} 640w, ${prefix}${stem}-960${ext} 960w, ${prefix}${canonHero} 1280w`;
}
function heroPreloadLink(canonHero, prefix = '') {
  return `<link rel="preload" as="image" imagesrcset="${esc(heroSrcset(canonHero, prefix))}" imagesizes="100vw">`;
}
function heroImgAttrs(canonHero, prefix = '') {
  return `srcset="${esc(heroSrcset(canonHero, prefix))}" sizes="100vw"`;
}

/** Build a plain-text spec summary for clipboard copy. */
function buildSpecText(t) {
  const lines = [
    `${trailerTitle(t)}`,
    `Length: ${formatLength(t.lengthFt)}`,
    t.extWidthFt ? `Ext. width: ${formatDimFt(t.extWidthFt)}` : null,
    t.extHeightFt ? `Ext. height: ${formatDimFt(t.extHeightFt)} (with A/C)` : null,
    t.intHeightFt ? `Interior height: ${formatDimFt(t.intHeightFt)} (with A/C)` : null,
    `Dry weight: ${formatWeight(t.weightLb)}`,
    `GVWR: ${formatWeight(t.gvwrLb)}`,
    t.cccLb ? `Cargo capacity (CCC): ${formatWeight(t.cccLb)}` : null,
    t.hitchWeightLb ? `Hitch weight: ${formatWeight(t.hitchWeightLb)}` : null,
    `Sleeps: ${t.sleeps}`,
    `Tanks: ${formatTanksNA(t.freshGal, t.grayGal, t.blackGal)}`,
    t.solarW ? `Solar: ${t.solarW}W ${t.solarStandard ? '(standard)' : '(optional)'}` : null,
    t.batteryKwh ? `Battery: ${t.batteryKwh} kWh` : null,
    `Off-grid: ${offGridTier(t.offGridScore) || 'n/a'} (editorial composite ${t.offGridScore}/100)`,
    `MSRP: ${formatMsrp(t.msrp)}`,
  ].filter(Boolean);
  // Append the canonical detail-page URL so pasted specs are traceable
  lines.push(`https://airstream-explorer.pages.dev/m/${t.slug}.html`);
  // Use || separator (split back to \n in client JS for clipboard copy)
  return lines.join(' || ');
}

// ---------------------------------------------------------------------------
// SPEC RADAR CHART: visual fingerprint of how a trailer stacks up
// ---------------------------------------------------------------------------
/**
 * Render a pure-SVG radar chart for one trailer. Each axis is normalized 0-1
 * against catalog-wide min/max. The polygon shows this trailer's "shape" —
 * where it excels and where it trades off.
 */
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
// YEAR-OVER-YEAR DIFF - "What changed in 2026" section for detail pages
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SIZE SCALE - visual length comparison against everyday reference objects.
// Helps users answer "will it fit in my garage / at the campsite?"
// ---------------------------------------------------------------------------
const SIZE_REFS = [
  { label: 'Compact car',         ft: 15,  cls: 'size-ref--car'     },
  { label: 'Standard parking',    ft: 18,  cls: 'size-ref--parking'  },
  { label: 'Single garage',       ft: 20,  cls: 'size-ref--garage1'  },
  { label: 'Double garage',       ft: 24,  cls: 'size-ref--garage2'  },
  { label: 'School bus',          ft: 35,  cls: 'size-ref--bus'      },
  { label: 'Typical RV site',     ft: 40,  cls: 'size-ref--site'     },
];
// ---------------------------------------------------------------------------
// CLEARANCE FIT - shows whether the trailer clears common height/width gates.
// Uses the trailer's real exterior height (with A/C) and width from official
// Airstream specs. Reference clearances are sourced from standard dimensions.
// ---------------------------------------------------------------------------
const CLEARANCE_REFS = [
  { label: 'Standard garage door', heightFt: 7, widthFt: 9, note: '7\' × 9\' single-car' },
  { label: 'Tall garage door', heightFt: 8, widthFt: 9, note: '8\' × 9\' residential' },
  { label: 'RV garage door', heightFt: 12, widthFt: 12, note: '12\' × 12\' RV bay' },
  { label: 'Standard overpass', heightFt: 14, widthFt: 12, note: '14\' federal minimum' },
  { label: 'Covered campsite', heightFt: 12, widthFt: 14, note: '~12\' typical clearance' },
];


// ---------------------------------------------------------------------------
// MERGED: Weight & Cargo Capacity - bar + budget + payload unified
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// MERGED: Tow Setup - safety calculator + hitch guide
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// RIG LENGTH CAMPSITE FIT - shows whether the total rig (trailer + tow
// vehicle) fits in standard campsite sizes. Uses the trailer's official
// length. Users set their tow vehicle length via the interactive slider.
// ---------------------------------------------------------------------------

const SITE_SIZES = [
  { label: 'Compact back-in', lengthFt: 30, note: 'Tight national park loops' },
  { label: 'Standard back-in', lengthFt: 40, note: 'Most state parks & KOA' },
  { label: 'Large back-in', lengthFt: 50, note: 'Spacious private campgrounds' },
  { label: 'Standard pull-through', lengthFt: 65, note: 'Easy hitch-and-go, no reversing' },
  { label: 'Full-length pull-through', lengthFt: 80, note: 'Big rigs welcome' },
];

// ---------------------------------------------------------------------------
// MERGED: Dimensions - clearance fit + campsite length fit
// ---------------------------------------------------------------------------
/**
 * "You might also like" - spec-similar trailers from OTHER families.
 * Complements renderRelated() which stays within the same family.
 */
// ---------------------------------------------------------------------------
// GRADE CLIMBING PERFORMANCE CALCULATOR
// ---------------------------------------------------------------------------

const MOUNTAIN_PASSES = [
  { id: 'cajon', name: 'Cajon Pass, CA', grade: 3.5, elev: 4190 },
  { id: 'lookout', name: 'Lookout Pass, ID/MT', grade: 5.0, elev: 4725 },
  { id: 'stevens', name: 'Stevens Pass, WA', grade: 5.0, elev: 4061 },
  { id: 'raton', name: 'Raton Pass, CO/NM', grade: 5.5, elev: 7834 },
  { id: 'grapevine', name: 'Grapevine (Tejon), CA', grade: 6.0, elev: 4144 },
  { id: 'eisenhower', name: 'Eisenhower Tunnel, CO', grade: 6.5, elev: 11158 },
  { id: 'donner', name: 'Donner Pass, CA', grade: 7.0, elev: 7056 },
  { id: 'vail', name: 'Vail Pass, CO', grade: 7.0, elev: 10662 },
  { id: 'teton', name: 'Teton Pass, WY', grade: 10.0, elev: 8431 },
];

/**
 * Compute grade climbing forces for a given trailer GVWR and grade %.
 * Physics: grade resistance ≈ GVWR × sin(arctan(grade/100)).
 * For < ~15% grades, sin(arctan(g/100)) ≈ g/100 within 1%.
 */
export function computeGradeForces(gvwrLb, gradePct, altitudeFt = 0) {
  const theta = Math.atan(gradePct / 100);
  const gradeForce = Math.round(gvwrLb * Math.sin(theta));
  // Rolling resistance at ~1.5% of total weight
  const rollResist = Math.round(gvwrLb * 0.015);
  // Total resistance on grade
  const totalForce = gradeForce + rollResist;
  // Engine power loss at altitude: ~3% per 1,000 ft (naturally aspirated rule of thumb)
  const powerLossPct = Math.round(altitudeFt / 1000 * 3);
  const altFactor = Math.max(0.4, 1 - powerLossPct / 100);
  // Speed recommendation adjusted for altitude power loss
  const baseSpeed = gradePct <= 3 ? 65 : gradePct <= 5 ? 55 : gradePct <= 7 ? 45 : gradePct <= 9 ? 35 : 25;
  const maxSpeed = Math.round(baseSpeed * altFactor);
  // Grade rating: altitude makes effective grade worse
  const effectiveGrade = gradePct / altFactor;
  const rating = effectiveGrade <= 4 ? 'moderate' : effectiveGrade <= 7 ? 'challenging' : 'severe';
  return { gradeForce, rollResist, totalForce, maxSpeed, rating, gradePct, gvwrLb, altitudeFt, powerLossPct };
}

// ---------------------------------------------------------------------------
// HITCH & WEIGHT DISTRIBUTION GUIDE
// ---------------------------------------------------------------------------

const HITCH_CLASSES = [
  { cls: 'I', maxLb: 2000, hitchLb: 200 },
  { cls: 'II', maxLb: 3500, hitchLb: 350 },
  { cls: 'III', maxLb: 8000, hitchLb: 800 },
  { cls: 'IV', maxLb: 10000, hitchLb: 1000 },
  { cls: 'V', maxLb: 17000, hitchLb: 1700 },
];

export function recommendHitch(gvwrLb, hitchWeightLb) {
  const hitchClass = HITCH_CLASSES.find((h) => h.maxLb >= gvwrLb) || HITCH_CLASSES[HITCH_CLASSES.length - 1];
  const needsWdh = gvwrLb > 5000 || (hitchWeightLb && hitchWeightLb > 300);
  const needsAntiSway = gvwrLb > 6000;
  return { hitchClass, needsWdh, needsAntiSway };
}

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
${specDelta(current, t)}
${traitStr ? `<p class="xfam-traits">${esc(traitStr)}</p>` : ''}
</div>
</a>`;
  }).join('\n');
  // Inner block for the "More to explore" detail section - the section itself
  // owns the h2, so this renders an h3 sub-head with no <section> wrapper.
  return `<div class="more-block more-block--cross" aria-label="Similar from other families">
<h3 class="dsec-sub">You might also like</h3>
<p class="cross-family-sub muted">Similar specs from other Airstream families</p>
<div class="cross-family-grid">${cards}</div>
</div>`;
}

// ---------------------------------------------------------------------------
// NEXT STEPS: actionable links to move from research to purchase
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// TRIP READY CHECKLIST - model-specific pre-departure checklist using real specs
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// WATER & TANK AUTONOMY CALCULATOR - interactive calculator showing how many
// days of camping before needing to refill fresh or dump waste tanks. Uses
// real tank capacities and adjustable daily usage assumptions.
// ---------------------------------------------------------------------------
const WATER_USAGE = {
  conservative: { label: 'Conservative', freshGpd: 4, grayGpd: 3, blackGpd: 1.5, desc: 'Navy showers, careful cooking' },
  moderate:     { label: 'Moderate',     freshGpd: 6, grayGpd: 5, blackGpd: 2,   desc: 'Normal showers, regular cooking' },
  heavy:        { label: 'Heavy',        freshGpd: 10, grayGpd: 8, blackGpd: 3,  desc: 'Long showers, laundry, dishwasher' },
};

function computeTankDays(tankGal, gpd, people) {
  if (!tankGal || tankGal <= 0 || gpd <= 0 || people <= 0) return null;
  return Math.round((tankGal / (gpd * people)) * 10) / 10;
}

export function renderWaterAutonomy(t) {
  if (!t.freshGal && !t.blackGal && !t.grayGal) return '';
  const people = 2;
  const usage = WATER_USAGE.moderate;
  const freshDays = computeTankDays(t.freshGal, usage.freshGpd, people);
  const grayDays = t.grayGal ? computeTankDays(t.grayGal, usage.grayGpd, people) : null;
  const combined = !t.grayGal && t.blackGal; // combined waste tank
  // A combined tank takes BOTH gray and black waste, so its effective drain
  // rate is (grayGpd + blackGpd) * people - not blackGpd alone. A 30 gal
  // combo tank at 2 people / moderate usage lasts ~2.1 days, not ~7.5.
  const blackDays = t.blackGal
    ? computeTankDays(t.blackGal, combined ? usage.grayGpd + usage.blackGpd : usage.blackGpd, people)
    : null;

  // Find the constraining factor
  const allDays = [freshDays, grayDays, blackDays].filter(d => d != null && d > 0);
  const minDays = allDays.length ? Math.min(...allDays) : null;
  const minLabel = minDays === freshDays ? 'Fresh water' : minDays === grayDays ? 'Gray tank' : 'Waste tank';

  const dataIsland = JSON.stringify({
    freshGal: t.freshGal || 0,
    grayGal: t.grayGal || 0,
    blackGal: t.blackGal || 0,
    combined: combined,
    usage: WATER_USAGE,
  }).replace(/<\//g, '<\\/');

  const tankBar = (label, gal, days, cls) => {
    if (!gal || gal <= 0) return '';
    const pct = days && minDays ? Math.min(100, (days / Math.max(...allDays)) * 100) : 0;
    const isMin = days === minDays;
    return `<div class="wc-tank ${cls}">
<div class="wc-tank-head">
<span class="wc-tank-label">${label}</span>
<span class="wc-tank-cap">${gal} gal</span>
</div>
<div class="wc-tank-bar"><div class="wc-tank-fill${isMin ? ' wc-tank-fill--limiting' : ''}" style="width:${Math.round(pct)}%"><span class="wc-tank-days" id="wc-${cls}-days">${days != null ? days.toFixed(1) : 'n/a'} days</span></div></div>
${isMin ? '<p class="wc-tank-limit">← Limiting factor</p>' : ''}
</div>`;
  };

  return `<div class="estimator water-calc" aria-label="Water autonomy calculator"
 data-fresh-gal="${t.freshGal || 0}" data-gray-gal="${t.grayGal || 0}" data-black-gal="${t.blackGal || 0}" data-combined="${combined ? '1' : '0'}">
<script type="application/json" id="water-calc-data">${dataIsland}</script>
<div class="est-head">
<h3 class="water-title">Water autonomy</h3>
<p class="est-sub">How many days can the ${esc(t.model)} ${esc(t.floorplan)} camp before needing a refill or dump? Adjust people and usage below.</p>
</div>
<div class="est-controls">
<div class="est-field">
<label for="wc-people">People</label>
<div class="finance-slider-row">
<input type="range" id="wc-people" min="1" max="6" step="1" value="2" class="finance-range" aria-label="Number of people">
<span class="finance-range-val" id="wc-people-val">2 people</span>
</div>
</div>
<div class="est-field">
<label>Daily usage</label>
<div class="wc-usage-btns" role="radiogroup" aria-label="Water usage level">
<button type="button" class="wc-usage-btn" data-usage="conservative" aria-pressed="false">Conservative</button>
<button type="button" class="wc-usage-btn is-active" data-usage="moderate" aria-pressed="true">Moderate</button>
<button type="button" class="wc-usage-btn" data-usage="heavy" aria-pressed="false">Heavy</button>
</div>
</div>
</div>
<div class="wc-result" id="wc-result" aria-live="polite" aria-atomic="true">
<div class="wc-headline">
<span class="est-number" id="wc-total-days">${minDays != null ? minDays.toFixed(1) : 'n/a'}</span>
<span class="est-number-cap">days of camping</span>
<span class="wc-limit-note" id="wc-limit-note">${minDays != null ? 'Limited by ' + minLabel.toLowerCase() : ''}</span>
</div>
<div class="wc-tanks" id="wc-tanks">
${tankBar('Fresh water', t.freshGal, freshDays, 'wc-fresh')}
${combined
  ? tankBar('Waste (combined)', t.blackGal, blackDays, 'wc-black')
  : (tankBar('Gray water', t.grayGal, grayDays, 'wc-gray') + tankBar('Black water', t.blackGal, blackDays, 'wc-black'))
}
</div>
<p class="wc-usage-detail" id="wc-usage-detail">At moderate usage: ${usage.freshGpd} gal fresh / ${usage.grayGpd} gal gray / ${usage.blackGpd} gal black per person per day. ${usage.desc}.</p>
</div>
<p class="est-caveat muted">Estimates assume typical RV usage patterns. Actual consumption depends on shower habits, cooking, laundry, toilet type, and climate. Gray includes sink and shower drain; black is toilet only. ${combined ? 'This model has a single combined waste tank.' : ''}</p>
</div>`;
}

// ---------------------------------------------------------------------------
// SEASONAL CAMPING GUIDE - per-season suitability based on real specs.
// Uses tank capacity, solar, battery, and weight to advise per-season.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// WINTERIZATION / STORAGE PREP - model-specific guide built from real specs
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// TOW DIFFICULTY BADGE - visual indicator for explore cards and detail pages
// ---------------------------------------------------------------------------
function renderTowDifficultyBadge(t, context = 'detail') {
  const diff = towDifficulty(t);
  if (!diff) return '';
  const cls = `tow-diff--${diff.score}`;
  const dots = Array.from({ length: 5 }, (_, i) =>
    `<span class="tow-diff-dot${i < diff.score ? ' is-filled' : ''}" aria-hidden="true"></span>`
  ).join('');
  if (context === 'card') {
    return `<span class="tow-diff tow-diff--card ${cls}" title="${esc(diff.tip)}"><span class="tow-diff-dots">${dots}</span><span class="tow-diff-label">${esc(diff.label)}</span></span>`;
  }
  return `<div class="tow-diff tow-diff--detail ${cls}" title="${esc(diff.tip)}"><span class="tow-diff-dots">${dots}</span><span class="tow-diff-label">${esc(diff.label)}</span><span class="tow-diff-tip">${esc(diff.tip)}</span></div>`;
}


// ---------------------------------------------------------------------------
// MAINTENANCE QUICK-REF - shows key maintenance items with timing and est.
// costs for this trailer, linking to the full maintenance page for details.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PROPANE DURATION ESTIMATOR - calculates how long LP gas will last based on
// appliance usage. Standard Airstream has dual 20 lb tanks = 40 lb LP gas.
// 1 lb LP = 21,594 BTU. 40 lb = 863,760 BTU total capacity.
// ---------------------------------------------------------------------------
const BTU_PER_LB_LP = 21594;
const PROPANE_APPLIANCE_PROFILES = {
  furnace: { label: 'Furnace', btuPerHr: 25000, defaultHrsPerDay: 4, desc: 'BTU rating varies 20–35k; uses ~25k avg' },
  waterHeater: { label: 'Water heater', btuPerHr: 12000, defaultHrsPerDay: 1, desc: '6-gal tank heater, ~12k BTU' },
  stove: { label: 'Stovetop', btuPerHr: 9000, defaultHrsPerDay: 0.5, desc: 'Two burners avg ~9k BTU combined' },
  oven: { label: 'Oven', btuPerHr: 8000, defaultHrsPerDay: 0, desc: '~8k BTU when in use' },
  fridge: { label: 'Fridge (LP mode)', btuPerHr: 1500, defaultHrsPerDay: 0, desc: '~1.5k BTU, runs 24/7 on LP if no hookup' },
};

export function computePropaneDuration(lbCapacity, appliances) {
  const totalBtu = lbCapacity * BTU_PER_LB_LP;
  let dailyBtu = 0;
  for (const [key, hrs] of Object.entries(appliances)) {
    const profile = PROPANE_APPLIANCE_PROFILES[key];
    if (profile && hrs > 0) dailyBtu += profile.btuPerHr * hrs;
  }
  if (dailyBtu <= 0) return { days: Infinity, dailyBtu: 0, dailyLb: 0, totalBtu };
  const days = totalBtu / dailyBtu;
  const dailyLb = dailyBtu / BTU_PER_LB_LP;
  return { days, dailyBtu, dailyLb, totalBtu };
}


// ---------------------------------------------------------------------------
// ELECTRICAL LOAD PLANNER - shows shore power capacity and what you can run.
// Airstream trailers are typically 30A service (smaller models) or 50A
// (Classic and some larger models). 30A @ 120V = 3,600W max; 50A @ 120V×2
// legs = 12,000W max. Shows common appliances with their wattage and a visual
// breaker budget bar so users understand what they can run simultaneously.
// ---------------------------------------------------------------------------
const RV_APPLIANCES = [
  { id: 'ac', name: 'Rooftop A/C', watts: 1350, icon: '❄️', note: 'Running watts; ~2800W startup surge', defaultOn: true },
  { id: 'microwave', name: 'Microwave', watts: 1000, icon: '📡', note: '1000W cooking power', defaultOn: false },
  { id: 'waterHeater', name: 'Water heater (electric)', watts: 1440, icon: '♨️', note: '120V element, alternative to LP gas', defaultOn: false },
  { id: 'fridge', name: 'Refrigerator (AC mode)', watts: 150, icon: '🧊', note: '120V auto mode ~150W average', defaultOn: true },
  { id: 'tv', name: 'TV', watts: 100, icon: '📺', note: 'LED TV ~60–120W', defaultOn: false },
  { id: 'charger', name: 'Converter / battery charger', watts: 600, icon: '🔋', note: 'Charges house batteries from shore', defaultOn: true },
  { id: 'lights', name: 'LED lights', watts: 50, icon: '💡', note: 'All interior lights ~50W LED', defaultOn: true },
  { id: 'hair', name: 'Hair dryer', watts: 1500, icon: '💨', note: 'High-draw - watch the breaker', defaultOn: false },
  { id: 'heater', name: 'Space heater', watts: 1500, icon: '🔥', note: 'Ceramic heater, alternative to furnace', defaultOn: false },
];

function deriveAmpService(t) {
  // Classic and larger models typically have 50A; most others are 30A
  const name = (t.model || '').toLowerCase();
  if (name.includes('classic') || (t.gvwrLb && t.gvwrLb >= 10000)) return 50;
  return 30;
}


// ---------------------------------------------------------------------------
// HOOKUP & ADAPTER REFERENCE - practical gear guide based on trailer specs
// ---------------------------------------------------------------------------

/** Derive the shore power plug type label from amp service. */
function plugType(amps) {
  return amps === 50 ? 'NEMA 14-50' : 'TT-30';
}

export function renderHookupGuide(t) {
  const amps = deriveAmpService(t);
  const plug = plugType(amps);
  const isSmall = (t.lengthFt || 20) < 22;

  // Build adapter list
  const adapters = [];
  if (amps === 30) {
    adapters.push({ name: '30A → 15A adapter', plug: 'TT-30P to 5-15R', why: 'Use a household outlet in a pinch (limited to ~1,800W - no A/C)', icon: '🔌' });
    adapters.push({ name: '15A → 30A dogbone', plug: '5-15P to TT-30R', why: 'Emergency power from any standard outlet', icon: '🦴' });
    adapters.push({ name: '50A → 30A adapter', plug: '14-50R to TT-30P', why: 'Connect to a 50A pedestal when 30A is taken', icon: '🔄' });
  } else {
    adapters.push({ name: '50A → 30A adapter', plug: '14-50P to TT-30R', why: 'Most campgrounds outside resorts only offer 30A - you\'ll use this often', icon: '🔄' });
    adapters.push({ name: '30A → 15A adapter', plug: 'TT-30P to 5-15R', why: 'Daisy-chain with 50→30 for household outlet (very limited power)', icon: '🔌' });
  }

  const adapterRows = adapters.map((a) =>
    `<div class="hookup-adapter">
<span class="hookup-adapter-icon" aria-hidden="true">${a.icon}</span>
<div class="hookup-adapter-info">
<span class="hookup-adapter-name">${esc(a.name)}</span>
<span class="hookup-adapter-plug muted">${esc(a.plug)}</span>
<span class="hookup-adapter-why">${esc(a.why)}</span>
</div>
</div>`
  ).join('\n');

  // Sewer hose recommendation based on trailer length
  const hoseLen = isSmall ? '10–15' : '15–20';

  // Water system items
  const waterItems = [
    { label: 'White potable water hose', note: 'Never use a garden hose - lead and BPA contamination risk', icon: '💧' },
    { label: 'Inline water filter', note: 'Protects from sediment and chlorine at unfamiliar hookups', icon: '🚰' },
    { label: 'Pressure regulator', note: 'Set to 40–45 PSI - campground pressure can spike to 80+ and damage plumbing', icon: '⚙️' },
  ];

  const sewerItems = [
    { label: `Sewer hose (${hoseLen} ft)`, note: 'Standard 3″ bayonet fitting - all Airstreams use the same connection', icon: '🔧' },
    { label: 'Clear sewer elbow adapter', note: 'Locks into dump station inlet - lets you see when tanks are clear', icon: '👁️' },
    { label: 'Disposable gloves', note: 'Keep a box in the wet bay for every dump', icon: '🧤' },
  ];

  const gearSection = (title, items) => {
    const rows = items.map((item) =>
      `<div class="hookup-gear-item">
<span class="hookup-gear-icon" aria-hidden="true">${item.icon}</span>
<div class="hookup-gear-info">
<span class="hookup-gear-label">${esc(item.label)}</span>
<span class="hookup-gear-note muted">${esc(item.note)}</span>
</div>
</div>`
    ).join('\n');
    return `<div class="hookup-gear-group">
<h3 class="hookup-gear-title">${esc(title)}</h3>
${rows}
</div>`;
  };

  return `<section class="hookup-guide collapsible" id="hookup" aria-label="Hookup &amp; adapter guide">
<h2 class="collapsible-trigger" aria-expanded="false" tabindex="0" role="button">
Hookup &amp; adapter guide<span class="collapsible-icon" aria-hidden="true"></span>
</h2>
<div class="collapsible-body" hidden>
<p class="hookup-intro">The ${esc(t.model)} ${esc(t.floorplan)} uses <strong>${amps}A shore power</strong> (${esc(plug)} plug). Here's the gear you need for a trouble-free hookup at any campsite.</p>
<div class="hookup-section">
<h3 class="hookup-section-title">⚡ Power adapters</h3>
<p class="hookup-note muted">Your ${amps}A cord handles up to ${amps === 50 ? '12,000W' : '3,600W'} - enough for${amps === 50 ? ' dual A/C, microwave, and everything else simultaneously' : ' A/C or microwave (not both at once)'}.</p>
<div class="hookup-adapter-grid">${adapterRows}</div>
</div>
${gearSection('Water hookup', waterItems)}
${gearSection('Sewer & dump', sewerItems)}
<p class="est-caveat muted">All Airstream travel trailers use standard RV connections. Adapters listed are the most common needs - your campground mix may vary. Always check polarity with a pedestal tester before plugging in.</p>
</div>
</section>`;
}

// ---------------------------------------------------------------------------
// LIFESTYLE FIT METER - how well a trailer matches common camping lifestyles
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// AMENITY SUMMARY - visual chips showing key floorplan features
// ---------------------------------------------------------------------------
function renderAmenitySummary(t) {
  const amenities = deriveAmenities(t);
  if (!amenities.length) return '';
  const chips = amenities.map((a) =>
    `<span class="amenity-chip">${esc(a.label)}</span>`
  ).join('');
  return `<div class="amenity-summary" aria-label="Key features">${chips}</div>`;
}

// ---------------------------------------------------------------------------
// STORAGE & PARKING GUIDE - practical dimension-based recommendations
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// IDEAL-FOR BADGES - buyer persona badges computed from specs
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FAMILY ADVISOR - "Which one should I pick?" quick-pick recommendations
// ---------------------------------------------------------------------------

function renderFamilyAdvisor(fam) {
  const latest = fam.years[0];
  const plans = fam.trailers.filter((t) => t.year === latest);
  if (plans.length < 2) return '';

  const picks = [];
  // Lightest
  const lightest = plans.reduce((a, b) => a.weightLb < b.weightLb ? a : b);
  picks.push({ q: 'Easiest to tow?', fp: lightest.floorplan, slug: lightest.slug, why: `Lightest at ${lightest.weightLb.toLocaleString()} lb dry` });
  // Most space
  const longest = plans.reduce((a, b) => a.lengthFt > b.lengthFt ? a : b);
  if (longest.slug !== lightest.slug) {
    picks.push({ q: 'Most living space?', fp: longest.floorplan, slug: longest.slug, why: `Longest at ${Math.round(longest.lengthFt)}'` });
  }
  // Best off-grid
  const bestOg = plans.reduce((a, b) => (a.offGridScore || 0) > (b.offGridScore || 0) ? a : b);
  if (bestOg.slug !== lightest.slug && bestOg.slug !== longest.slug && (bestOg.offGridScore || 0) > 0) {
    picks.push({ q: 'Best off-grid?', fp: bestOg.floorplan, slug: bestOg.slug, why: `Off-grid score ${bestOg.offGridScore}/100` });
  }
  // Most cargo
  const mostCargo = plans.reduce((a, b) => (a.cccLb || 0) > (b.cccLb || 0) ? a : b);
  if (mostCargo.slug !== lightest.slug && mostCargo.slug !== longest.slug && mostCargo.slug !== bestOg.slug && (mostCargo.cccLb || 0) > 0) {
    picks.push({ q: 'Most cargo capacity?', fp: mostCargo.floorplan, slug: mostCargo.slug, why: `${mostCargo.cccLb.toLocaleString()} lb CCC` });
  }
  // Best value
  const bestVal = plans.reduce((a, b) => a.msrp < b.msrp ? a : b);
  if (bestVal.slug !== lightest.slug && bestVal.slug !== longest.slug) {
    picks.push({ q: 'Best value?', fp: bestVal.floorplan, slug: bestVal.slug, why: `Starting at $${(bestVal.msrp / 1000).toFixed(0)}k` });
  }

  if (picks.length < 2) return '';

  const items = picks.slice(0, 4).map((p) =>
    `<a class="advisor-pick" href="../m/${esc(p.slug)}.html"><span class="advisor-q">${esc(p.q)}</span><span class="advisor-fp">${esc(p.fp)}</span><span class="advisor-why">${esc(p.why)}</span></a>`
  ).join('\n');

  return `<section class="fam-advisor" id="advisor" aria-label="Which one to pick">
<h2>Which ${esc(fam.family)} should I pick?</h2>
<p class="muted">Quick picks based on what matters most to you.</p>
<div class="advisor-grid">${items}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// FAQ - data-driven buyer FAQ per trailer. Every answer uses real spec data;
// nothing is fabricated. Renders as a collapsible accordion + FAQPage JSON-LD
// for Google rich results.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// RELATED FLOORPLANS: cross-discovery cards at the bottom of detail pages
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SPEC DELTA - compact comparison chip showing how a trailer differs from
// a reference trailer. Used by related & cross-family recommendation cards.
// ---------------------------------------------------------------------------
function specDelta(current, other) {
  const parts = [];
  const dw = other.weightLb - current.weightLb;
  if (dw !== 0) {
    const sign = dw > 0 ? '+' : '';
    const cls = dw < 0 ? 'delta-better' : 'delta-more';
    parts.push(`<span class="delta-chip ${cls}">${sign}${Math.round(dw).toLocaleString('en-US')} lb</span>`);
  }
  const dp = other.msrp - current.msrp;
  if (dp !== 0 && current.msrp > 0 && other.msrp > 0) {
    const sign = dp > 0 ? '+' : '';
    const cls = dp < 0 ? 'delta-better' : 'delta-more';
    const dK = Math.round(dp / 1000);
    parts.push(`<span class="delta-chip ${cls}">${sign}${dK}k</span>`);
  }
  const dl = other.lengthFt - current.lengthFt;
  if (Math.abs(dl) >= 0.5) {
    const sign = dl > 0 ? '+' : '';
    const cls = dl < 0 ? 'delta-shorter' : 'delta-longer';
    parts.push(`<span class="delta-chip ${cls}">${sign}${Math.round(dl)}' long</span>`);
  }
  const ds = other.sleeps - current.sleeps;
  if (ds !== 0) {
    const sign = ds > 0 ? '+' : '';
    const cls = ds > 0 ? 'delta-better' : 'delta-more';
    parts.push(`<span class="delta-chip ${cls}">${sign}${ds} sleeps</span>`);
  }
  const dog = (other.offGridScore || 0) - (current.offGridScore || 0);
  if (Math.abs(dog) >= 5 && current.offGridScore && other.offGridScore) {
    const sign = dog > 0 ? '+' : '';
    const cls = dog > 0 ? 'delta-better' : 'delta-more';
    parts.push(`<span class="delta-chip ${cls}">${sign}${dog} off-grid</span>`);
  }
  if (!parts.length) return '';
  return `<p class="spec-deltas" aria-label="Compared to current trailer">${parts.join('')}</p>`;
}

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
${specDelta(current, t)}
</div>
</a>`;
  }).join('\n');
  const heading = related.every((r) => r.model === current.model)
    ? `More ${esc(current.model)} floorplans`
    : 'Explore similar floorplans';
  // Inner block for the "More to explore" detail section - the section itself
  // owns the h2, so this renders an h3 sub-head with no <section> wrapper.
  return `<div class="more-block more-block--related" aria-label="Related floorplans">
<h3 class="dsec-sub">${heading}</h3>
<div class="related-grid">${cards}</div>
</div>`;
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
// ---------------------------------------------------------------------------
// "WHAT CAN TOW IT?" summary table. Uses the SAME three-limit verdict as the
// detailed tow-safety calculator (evaluateTow in tow.mjs: tow rating, truck
// payload, GCWR - the binding/worst limit decides the verdict, with the same
// 300 lb default truck load). The old table only checked maxTow, which is why
// it could show "Comfortable" while the calculator showed "Over a limit"
// for the same pairing (e.g. Hummer EV SUV x Flying Cloud 23FB: fine on tow
// rating, 129% on payload). Same mouth, both places.
// ---------------------------------------------------------------------------
function renderCompatibleVehicles(t) {
  if (!(t.gvwrLb > 0) || !TOW_VEHICLES.length) return '';
  const sorted = TOW_VEHICLES.slice().sort((a, b) => a.maxTowLb - b.maxTowLb);
  const evs = sorted.map((v) => ({ v, ev: evaluateTow(v, t, { truckLoadLb: DEFAULT_TRUCK_OCCUPANT_LB }) }));
  const rows = evs.map(({ v, ev }) => {
    const cls = ev.verdict === 'over' ? 'compat-over' : ev.verdict === 'tight' ? 'compat-tight' : 'compat-ok';
    const label = ev.verdict === 'over' ? 'Over limit' : ev.verdict === 'tight' ? 'Tight' : 'Comfortable';
    const b = ev.binding;
    const margin = Math.round(b.limit - b.used);
    const marginStr = (margin >= 0 ? '+' : '') + margin.toLocaleString('en-US') + ' lb';
    const bindShort = b.key === 'tow' ? 'tow rating' : b.key === 'payload' ? 'payload' : 'GCWR';
    return `<tr class="${cls}">
<td class="compat-name">${esc(v.name)}</td>
<td class="compat-rating" data-unit="weight" data-raw="${v.maxTowLb}">${formatWeight(v.maxTowLb)}</td>
<td class="compat-margin"><span title="Binding limit: ${esc(b.label)}">${esc(marginStr)}</span> <span class="compat-binding" title="Binding limit: ${esc(b.label)}">${esc(bindShort)}</span></td>
<td class="compat-verdict"><span class="compat-badge">${esc(label)}</span></td>
</tr>`;
  }).join('\n');

  const okCount = evs.filter(({ ev }) => ev.verdict !== 'over').length;

  return `<div class="compat-vehicles" aria-label="Compatible tow vehicles">
<h3 class="compat-title">What can tow it?</h3>
<p class="compat-intro">${okCount} of ${sorted.length} popular tow vehicles can tow this trailer\'s ${formatWeight(t.gvwrLb)} GVWR without exceeding a limit. Verdict = the binding of three checks - tow rating, truck payload, and GCWR - the same math as the tow-safety calculator above (300 lb people + gear in the truck). A <em>comfortable</em> verdict means the binding limit is under 80% used; <em>tight</em> is within limits but near them; <em>over limit</em> exceeds a rating. Margin shown is on the binding limit.</p>
<div class="compat-table-wrap">
<table class="compat-table">
<thead><tr><th>Vehicle</th><th>Tow rating</th><th>Margin</th><th>Verdict</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>
</div>`;
}

// ---------------------------------------------------------------------------
// DETAIL SECTION BUILDERS (redesign 2026-09-27): the fixed 11-module body.
// Each owns its anchor id; inner tools carry none. All honor the red lines:
// zero emoji, one Fraunces display title (the h1), literal "n/a" for missing
// values, single-stroke monochrome icons only in key stats.
// ---------------------------------------------------------------------------

/** Big-number lede for the Specifications section: the owner-critical figures. */
function renderSpecLede(t) {
  const cell = (label, value, unit = null, raw = null) => {
    const unitAttr = unit && raw != null ? ` data-unit="${esc(unit)}" data-raw="${esc(String(raw))}"` : '';
    return `<div class="spec-lede-cell"><span class="spec-lede-value"${unitAttr}>${esc(value)}</span><span class="spec-lede-label">${esc(label)}</span></div>`;
  };
  const combinedWaste = !t.grayGal && t.blackGal;
  const tankRaw = [t.freshGal, t.grayGal, t.blackGal].join(',');
  const tankCell = (label, value) =>
    `<div class="spec-lede-cell"><span class="spec-lede-value" data-unit="tanks" data-raw="${esc(tankRaw)}">${esc(value)}</span><span class="spec-lede-label">${esc(label)}</span></div>`;
  const tankCells = [
    tankCell('Fresh', na(formatGal(t.freshGal))),
    combinedWaste
      ? tankCell('Waste (combined)', na(formatGal(t.blackGal)))
      : tankCell('Gray', na(formatGal(t.grayGal))) + tankCell('Black', na(formatGal(t.blackGal))),
  ].join('');
  return `<div class="spec-lede" aria-label="Key figures">
<div class="spec-lede-group"><p class="spec-lede-group-label">Weight</p><div class="spec-lede-cells">
${cell('Dry weight', na(formatWeight(t.weightLb)), 'weight', t.weightLb)}
<div class="spec-lede-cell"><span class="spec-lede-value" data-unit="weight" data-raw="${esc(String(t.gvwrLb))}" title="Gross Vehicle Weight Rating - the maximum safe total weight when fully loaded.">${esc(na(formatWeight(t.gvwrLb)))}</span><span class="spec-lede-label">GVWR</span></div>
<div class="spec-lede-cell"><span class="spec-lede-value" data-unit="weight" data-raw="${esc(String(t.cccLb))}" title="GVWR minus dry weight. Everything you add (water, propane, gear) must fit within this.">${esc(na(formatWeight(t.cccLb)))}</span><span class="spec-lede-label">Cargo capacity</span></div>
${cell('Hitch weight', na(formatWeight(t.hitchWeightLb)), 'weight', t.hitchWeightLb)}
</div></div>
<div class="spec-lede-group"><p class="spec-lede-group-label">Size</p><div class="spec-lede-cells">
${cell('Length', na(formatLength(t.lengthFt)), 'length', t.lengthFt)}
${cell('Width', na(formatDimFt(t.extWidthFt)), 'dimft', t.extWidthFt)}
${cell('Height', na(formatDimFt(t.extHeightFt)), 'dimft', t.extHeightFt)}
</div></div>
<div class="spec-lede-group"><p class="spec-lede-group-label">Tanks</p><div class="spec-lede-cells">${tankCells}</div></div>
<div class="spec-lede-group"><p class="spec-lede-group-label">Camping</p><div class="spec-lede-cells">
${cell('Sleeps', t.sleeps != null ? String(t.sleeps) : 'n/a')}
<div class="spec-lede-cell"><span class="spec-lede-value" title="${esc(SPEC_GLOSSARY['MSRP'])}">${esc(na(formatMsrp(t.msrp)))}</span><span class="spec-lede-label">Base MSRP</span></div>
</div></div>
</div>`;
}

/** Fit check: bridge/garage clearance (with A/C height) + total rig length. */
function renderFitCheck(t) {
  const h = t.extHeightFt, w = t.extWidthFt;
  const rows = (h && w) ? CLEARANCE_REFS.map((ref) => {
    const hFits = h <= ref.heightFt;
    const wFits = w <= ref.widthFt;
    const fits = hFits && wFits;
    const hMarginIn = Math.round((ref.heightFt - h) * 12);
    const wMarginIn = Math.round((ref.widthFt - w) * 12);
    const verdict = fits
      ? `Clears - ${hMarginIn}" height, ${wMarginIn}" width to spare`
      : !hFits && !wFits ? `Too tall by ${Math.abs(hMarginIn)}", too wide by ${Math.abs(wMarginIn)}"`
      : !hFits ? `Too tall by ${Math.abs(hMarginIn)}"` : `Too wide by ${Math.abs(wMarginIn)}"`;
    return `<div class="fitcheck-row${fits ? ' is-fits' : ' is-blocked'}">
<span class="fitcheck-ref">${esc(ref.label)} <span class="muted">${esc(ref.note)}</span></span>
<span class="fitcheck-verdict">${esc(verdict)}</span>
</div>`;
  }).join('') : '';
  const totalLine = t.lengthFt
    ? `<p class="fitcheck-total">Total rig length: about <strong>${Math.ceil(t.lengthFt + 19)} ft</strong> with a typical tow vehicle (~19 ft) - plus 2–3 ft for the hitch gap. Always confirm site dimensions with the campground before booking.</p>`
    : '';
  if (!rows && !totalLine) return '';
  return `<div class="fit-check" aria-label="Fit check">
<h3 class="dsec-sub">Fit check</h3>
<p class="fitcheck-intro muted">Height includes rooftop A/C - without A/C the trailer is roughly 2–3" shorter. Always measure your specific unit before a tight clearance.</p>
${rows ? `<div class="fitcheck-rows">${rows}</div>` : ''}
${totalLine}
</div>`;
}

/** Hitch & towing setup items - inner content for a <details> fold (no section). */
function renderHitchItems(t) {
  if (!(t.gvwrLb > 0)) return '';
  const rec = recommendHitch(t.gvwrLb, t.hitchWeightLb);
  const hc = rec.hitchClass;
  const tongueW = t.hitchWeightLb ? formatWeight(t.hitchWeightLb) : '~' + formatWeight(Math.round(t.gvwrLb * 0.13));
  const tongueNote = t.hitchWeightLb ? '(official dry hitch weight)' : '(estimated at 13% of GVWR)';

  const item = (title, body, recommended = false) =>
    `<div class="hitch-item${recommended ? ' hitch-item--recommended' : ''}">
<div class="hitch-item-body">
<strong>${title}</strong>
<p class="muted">${body}</p>
</div>
</div>`;

  const items = [
    item(`Class ${esc(hc.cls)} hitch receiver`,
      `Rated for up to ${hc.maxLb.toLocaleString()} lb trailer weight / ${hc.hitchLb.toLocaleString()} lb tongue weight. Your ${esc(t.model)} ${esc(t.floorplan)} at ${esc(formatWeight(t.gvwrLb))} GVWR needs at least this class.`),
  ];
  if (rec.needsWdh) {
    items.push(item('Weight distribution hitch (WDH) - recommended',
      `With ${esc(tongueW)} tongue weight ${tongueNote}, a WDH redistributes load across all axles for level towing and better braking. Many states require one above 5,000 lb GVWR.`, true));
  }
  if (rec.needsAntiSway) {
    items.push(item('Anti-sway control - recommended',
      `At ${esc(formatWeight(t.gvwrLb))} loaded, wind gusts and passing trucks can induce sway. A friction or dual-cam anti-sway device keeps things stable - often integrated into the WDH.`, true));
  }
  items.push(item('7-pin trailer connector',
    `Standard for all Airstream travel trailers - carries running lights, turn signals, brakes, 12V charge, and electric brake signal. Your tow vehicle needs a matching 7-pin socket.`));
  items.push(item('Brake controller',
    `Required - all Airstream trailers have electric brakes. An in-cab brake controller syncs trailer braking with your vehicle. Proportional (vs. time-delayed) gives smoother stops.`));

  return `<div class="hitch-items">${items.join('\n')}</div>
<p class="est-caveat muted">Hitch class is the minimum required. Always verify your specific tow vehicle's hitch receiver rating - some vehicles come with a lower-rated receiver than their tow rating allows. WDH and anti-sway recommendations follow industry best practices for this weight class.</p>`;
}

/**
 * Towing section - merged from the old split layout (tow-callout + tow tool +
 * compatible vehicles + hitch guide). Fixes the double-rendered hitch bug.
 */
function renderTowingSection(t) {
  if (!(t.gvwrLb > 0)) return '';
  const calc = renderTowTool(t);
  const vehicles = renderCompatibleVehicles(t);
  const hitch = renderHitchItems(t);
  const hitchPct = hitchPctOfGvwr(t.hitchWeightLb, t.gvwrLb);
  const lede = `<p class="tow-lede">Your tow vehicle must be rated for at least <strong><span data-unit="weight" data-raw="${esc(String(t.gvwrLb))}">${esc(formatWeight(t.gvwrLb))}</span></strong> - the official fully-loaded GVWR.${t.hitchWeightLb ? ` Official hitch (tongue) weight is <strong>${esc(formatWeight(t.hitchWeightLb))}</strong>${hitchPct ? ` (~${hitchPct}% of GVWR)` : ''}.` : ''}</p>`;
  return `<section class="dsec dsec-tow towing-band" id="tow" aria-label="Towing">
<h2 class="dsec-title">Towing</h2>
${lede}
${calc}
${vehicles}
${hitch ? `<details class="fold fold--hitch">
<summary><span class="fold-title">Hitch &amp; towing setup</span><span class="fold-hint">What receiver, WDH and brake controller this floorplan needs</span></summary>
<div class="fold-body collapsible-body">${hitch}</div>
</details>` : ''}
</section>`;
}

/** Propane as one line inside the Off-grid endurance tab. */
function renderPropaneLine(t) {
  const r = computePropaneDuration(40, { furnace: 4, waterHeater: 1, stove: 0.5 });
  const days = Number.isFinite(r.days) ? `about ${Math.max(1, Math.round(r.days))} days` : 'n/a';
  return `<p class="propane-line muted">Propane: the standard dual 20 lb tanks last ${days} of moderate use (furnace + hot water + cooking).</p>`;
}

/**
 * Off-grid section - CSS-only tabs (no JS). Default: endurance + water tabs.
 * Inner tools keep their app.js ids/classes but no section id, so the
 * auto-collapse module leaves them alone.
 */
function renderOffgridSection(t) {
  const endurance = renderOffGridTool(t);
  const water = renderWaterAutonomy(t);
  if (!endurance && !water) return '';
  const slug = t.slug.replace(/[^a-z0-9-]/gi, '-');
  const tab = (id, label, checked, panel) => `
<input class="og-tab-input" type="radio" name="ogtab-${slug}" id="${id}"${checked ? ' checked' : ''}>
<label class="og-tab" for="${id}" role="tab" aria-selected="${checked ? 'true' : 'false'}">${label}</label>
<div class="og-panel" role="tabpanel" aria-label="${label}">${panel}</div>`;
  return `<section class="dsec dsec-offgrid" id="offgrid" aria-label="Off-grid">
<h2 class="dsec-title">Off-grid</h2>
<div class="og-tabs">
${tab(`og-endurance`, 'Endurance', true, endurance ? endurance + renderPropaneLine(t) : '')}
${tab(`og-water`, 'Water', false, water)}
</div>
</section>`;
}

/**
 * Trip-ready checklist - full version, rendered as a plain div inside the
 * Care section's <details>. Keeps the JS contract (.trip-check,
 * #trip-progress-fill, #trip-count, #trip-reset) - app.js guards all lookups.
 */
function renderTripChecklist(t) {
  const items = [];
  if (t.freshGal) {
    items.push({ cat: 'water', text: `Fill ${t.freshGal}-gallon fresh water tank` });
  }
  if (t.blackGal || t.grayGal) {
    const tanks = [];
    if (t.grayGal) tanks.push(`gray (${t.grayGal} gal)`);
    if (t.blackGal) tanks.push(t.grayGal ? `black (${t.blackGal} gal)` : `waste (${t.blackGal} gal)`);
    items.push({ cat: 'water', text: `Empty ${tanks.join(' + ')} tank${tanks.length > 1 ? 's' : ''}` });
  }
  items.push({ cat: 'water', text: 'Check water heater bypass valve position' });
  if (t.hitchWeightLb) {
    items.push({ cat: 'tow', text: `Verify hitch weight (~${formatWeight(t.hitchWeightLb)}) with tongue scale` });
  }
  if (t.gvwrLb) {
    items.push({ cat: 'tow', text: `Confirm total weight under ${formatWeight(t.gvwrLb)} GVWR` });
  }
  items.push({ cat: 'tow', text: 'Check tire pressure (trailer & tow vehicle)' });
  items.push({ cat: 'tow', text: 'Inspect hitch coupler & safety chains' });
  items.push({ cat: 'tow', text: 'Test brake controller & breakaway switch' });
  items.push({ cat: 'tow', text: 'Check all exterior lights & turn signals' });
  if (t.solarW) {
    items.push({ cat: 'systems', text: `Confirm ${t.solarW}W solar panel${t.solarW > 200 ? 's' : ''} unobstructed` });
  }
  if (t.batteryKwh) {
    items.push({ cat: 'systems', text: `Charge house battery (${t.batteryKwh} kWh) to 100%` });
  }
  items.push({ cat: 'systems', text: 'Check propane tank level & valve operation' });
  items.push({ cat: 'systems', text: 'Test LP & CO detectors' });
  items.push({ cat: 'systems', text: 'Test smoke detector' });
  items.push({ cat: 'interior', text: 'Secure all cabinet doors & drawers' });
  items.push({ cat: 'interior', text: 'Stow loose items & close roof vents' });
  items.push({ cat: 'interior', text: 'Retract stabilizer jacks & entry step' });
  items.push({ cat: 'interior', text: 'Retract TV antenna & lower awning' });
  items.push({ cat: 'interior', text: 'Lock entry door during travel' });

  const catMeta = {
    water: { label: 'Water system' },
    tow: { label: 'Tow & safety' },
    systems: { label: 'Power & gas' },
    interior: { label: 'Interior prep' },
  };
  const groups = {};
  for (const item of items) {
    if (!groups[item.cat]) groups[item.cat] = [];
    groups[item.cat].push(item);
  }
  let n = 0;
  const html = Object.entries(catMeta).map(([cat, meta]) => {
    if (!groups[cat]) return '';
    const rows = groups[cat].map((item) => {
      n++;
      const key = `${t.slug}:${cat}:${n}`;
      return `<label class="trip-item"><input type="checkbox" class="trip-check" data-trip-item="${esc(key)}"><span class="trip-checkmark" aria-hidden="true"></span><span class="trip-item-text">${esc(item.text)}</span></label>`;
    }).join('\n');
    return `<div class="trip-group"><h4 class="trip-cat-title">${esc(meta.label)}</h4>${rows}</div>`;
  }).join('\n');

  return `<div class="trip-ready" aria-label="Trip checklist">
<p class="trip-intro">Pre-departure checklist for the ${esc(t.model)} ${esc(t.floorplan)}, using its real specs. Check off items as you go - progress saves on this device.</p>
<div class="trip-progress" role="progressbar" aria-label="Checklist progress"><div class="trip-progress-fill" id="trip-progress-fill"></div></div>
<p class="trip-count-line"><span id="trip-count" class="trip-count">0/${n}</span> done</p>
<div class="trip-groups">${html}</div>
<div class="trip-actions">
<button type="button" class="trip-reset" id="trip-reset">Reset checklist</button>
</div>
</div>`;
}

/** Winterization key points (condensed from winterizationGuide). */
function renderWinterizationPoints(t) {
  const guide = winterizationGuide(t);
  if (!guide.items.length) return '';
  const water = guide.items.filter((i) => i.cat === 'water');
  const others = ['electrical', 'gas', 'exterior', 'interior']
    .map((c) => guide.items.find((i) => i.cat === c))
    .filter(Boolean);
  const points = [...water, ...others];
  const lis = points.map((i) => `<li><strong>${esc(i.text)}</strong> - ${esc(i.detail)}</li>`).join('');
  const drainNote = guide.drainPoints
    ? `<p class="muted">This ${esc(t.model)} ${esc(t.floorplan)} has ${guide.drainPoints} tank${guide.drainPoints > 1 ? 's' : ''} to drain.</p>`
    : '';
  return `<h3 class="dsec-sub">Winterization</h3>${drainNote}<ul class="care-list">${lis}</ul>`;
}

/** Maintenance key cycles - compact task/interval list. */
function renderMaintenanceCycles(t) {
  const items = [
    ['Tire pressure & lug nut torque', 'Before every trip'],
    ['LP & CO detector test', 'Before every trip'],
    t.solarW ? ['Solar panel cleaning', 'Every 3 months'] : null,
    ['Roof seam inspection', 'Every 6 months'],
    t.batteryKwh ? ['Battery health check', 'Every 6 months'] : null,
    ['Wheel bearing service', 'Every 12 months / 12k mi'],
    ['Water heater anode rod', 'Annually'],
    ['Fire extinguisher inspection', 'Annually'],
    ['Winterization / de-winterization', 'Seasonal'],
  ].filter(Boolean);
  const rows = items.map(([task, interval]) =>
    `<div class="maint-row"><span class="maint-task">${esc(task)}</span><span class="maint-interval muted">${esc(interval)}</span></div>`
  ).join('');
  return `<h3 class="dsec-sub">Maintenance</h3><div class="maint-rows">${rows}</div>
<p class="maint-link"><a href="../owners-guide.html#maintenance">Full maintenance guide →</a></p>`;
}

/** Storage sizing as one line. */
function renderStorageLine(t) {
  if (!t.lengthFt) return '';
  const guide = storageGuide(t);
  return `<h3 class="dsec-sub">Storage</h3><p class="care-storage">${esc(guide.storageUnit)} - needs a ${guide.recommendedSlotFt}' minimum slot; ${esc(guide.garageNote)}${guide.clearanceHeight ? ` (${guide.clearanceHeight}' clearance with A/C)` : ''}.</p>`;
}

/**
 * Care & upkeep - one <details>, default folded. Holds the full trip
 * checklist plus winterization points, maintenance cycles, and storage line.
 */
function renderCareSection(t) {
  const trip = renderTripChecklist(t);
  const winter = renderWinterizationPoints(t);
  const maint = renderMaintenanceCycles(t);
  const storage = renderStorageLine(t);
  if (!trip && !winter && !maint && !storage) return '';
  return `<section class="dsec dsec-care" id="care" aria-label="Care and upkeep">
<h2 class="dsec-title">Care &amp; upkeep</h2>
<details class="fold fold--care">
<summary class="collapsible-trigger"><span class="fold-title">Trip checklist, winterization &amp; maintenance</span><span class="fold-hint">Tuned to this floorplan's specs - progress saves on this device</span></summary>
<div class="fold-body collapsible-body">
${trip ? `<h3 class="dsec-sub">Trip checklist</h3>${trip}` : ''}
${winter}
${maint}
${storage}
</div>
</details>
</section>`;
}

/** More to explore - related floorplans + cross-family picks + prev/next pager. */
function renderMoreSection(t, allTrailers, resolve, prevT, nextT) {
  const related = renderRelated(t, allTrailers, resolve);
  const cross = renderCrossFamily(t, allTrailers, resolve);
  const pagerPrev = prevT
    ? `<a class="detail-pager-link detail-pager-link--prev" href="${esc(prevT.slug)}.html"><span class="detail-pager-arrow">←</span><span><span class="detail-pager-label">Previous</span><span class="detail-pager-name">${esc(prevT.model)} ${esc(prevT.floorplan)}</span></span></a>`
    : '<span></span>';
  const pagerNext = nextT
    ? `<a class="detail-pager-link detail-pager-link--next" href="${esc(nextT.slug)}.html"><span><span class="detail-pager-label">Next</span><span class="detail-pager-name">${esc(nextT.model)} ${esc(nextT.floorplan)}</span></span><span class="detail-pager-arrow">→</span></a>`
    : '<span></span>';
  if (!related && !cross && !prevT && !nextT) return '';
  return `<section class="dsec dsec-more" id="more" aria-label="More to explore">
<h2 class="dsec-title">More to explore</h2>
${related}
${cross}
<nav class="detail-pager" aria-label="Browse floorplans">${pagerPrev}${pagerNext}</nav>
</section>`;
}

export function renderDetail(t, resolve = assetPaths, decor = null, allTrailers = []) {
  allTrailers = allTrailers || [];
  const a = resolve(t);
  const fam = familySlug(t.model);
  const official = officialUrl(t.model);
  // 2025 dataset ruling (2B): 2025 figures are inherited from the 2026 model
  // year and were never independently sourced. 2025 pages are annotated,
  // canonicalized to their 2026 twin, and emit no Product JSON-LD.
  const is2025 = t.year === 2025;
  const slug2026 = t.slug.replace(/-2025$/, '-2026');
  const hasPrev2025 = t.year === 2026 && allTrailers.some(
    (x) => x.model === t.model && x.floorplan === t.floorplan && x.year === 2025);
  const totalMedia = a.gallery.length + (a.hero ? 1 : 0);
  const heroImg = a.hero
    ? `<button type="button" class="detail-hero-btn" data-lightbox data-full="../${esc(a.hero)}" data-index="0" data-caption="${esc(trailerTitle(t))} - hero" aria-label="View hero image full screen"><img src="../${esc(a.hero)}" ${heroImgAttrs(a.hero, '../')} alt="${esc(trailerTitle(t))}" class="detail-hero-img" width="1280" height="720" fetchpriority="high"><span class="hero-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></span></button>`
    : '';
  const galleryCount = a.gallery.length;
  const heroOffset = a.hero ? 1 : 0;
  // Mosaic: first 5 images in hero+thumb grid
  const galleryMosaic = a.gallery ? a.gallery.slice(0, 5).map((g, i) => {
    const cutout = a.galleryCutout && a.galleryCutout[i];
    const cls = i === 0 ? 'gallery-mosaic-hero' : 'gallery-mosaic-thumb';
    return `<button type="button" class="gallery-mosaic-item ${cls}" data-lb-open="${i + heroOffset}" data-full="../${esc(g)}" aria-label="Photo ${i + 1}"><img src="../${esc(g)}" alt="${esc(trailerLabel(t))} photo ${i + 1}" loading="${i < 2 ? 'eager' : 'lazy'}" class="${cutout ? 'gallery-img--cutout' : 'gallery-img--photo'}"></button>`;
  }).join('\n') : '';
  const gallery = a.gallery
    .map(
      (g, i) =>
        `<button type="button" class="gallery-img-wrap${a.galleryCutout && a.galleryCutout[i] ? ' is-cutout' : ' is-photo'}" data-lightbox data-full="../${esc(g)}" data-index="${i + heroOffset}" data-caption="${esc(trailerLabel(t))} - photo ${i + 1} of ${galleryCount}" aria-label="Open photo ${i + 1} of ${galleryCount} full screen"><img src="../${esc(g)}" alt="${esc(a.galleryCutout && a.galleryCutout[i] ? trailerLabel(t) + ' - studio exterior view' : trailerLabel(t) + ' - gallery photo ' + (i + 1) + ' of ' + galleryCount)}" loading="lazy" class="gallery-img${a.galleryCutout && a.galleryCutout[i] ? ' gallery-img--cutout' : ' gallery-img--photo'}" width="920" height="600"><span class="gallery-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></span></button>`,
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
    ? `<section class="dsec floorplan${fpInteractive}" id="floorplan" aria-label="Floor plan" data-floorplan-code="${esc(t.floorplan)}"><h2 class="dsec-title">Floor plan</h2>${fpHint}<figure class="floorplan-fig"><button type="button" class="floorplan-zoom-btn" data-lightbox data-full="../${esc(a.floorplan)}" data-index="${floorplanLbIdx}" data-caption="${esc(trailerLabel(t))} floor plan" aria-label="View floor plan full screen"><span class="floorplan-stage"><img src="../${esc(a.floorplan)}" alt="${esc(trailerLabel(t))} floor plan diagram" loading="lazy" class="floorplan-img" width="820" height="1332">${fpZones}</span><span class="floorplan-zoom-hint" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg> Tap to enlarge</span></button>${fpLegend}<figcaption class="muted">Official Airstream ${esc(t.floorplan)} floor plan${official ? ` · <a class="official-link" href="${esc(official)}" target="_blank" rel="noopener">View ${esc(t.model)} floor plans on airstream.com ↗</a>` : ''}</figcaption></figure></section>`
    : '';
  const pros = (t.pros || []).map((p) => `<li>${esc(p)}</li>`).join('');
  const cons = (t.cons || []).map((c) => `<li>${esc(c)}</li>`).join('');
  const note = t.specNote
    ? `<p class="spec-note">${esc(t.specNote)}</p>`
    : '';
  // Prev/next pager: navigate between floorplans (sorted model+floorplan+year)
  const sorted = [...allTrailers].sort((a, b) =>
    `${a.model} ${a.floorplan} ${a.year}`.localeCompare(`${b.model} ${b.floorplan} ${b.year}`));
  const curIdx = sorted.findIndex((x) => x.slug === t.slug);
  const prevT = curIdx > 0 ? sorted[curIdx - 1] : null;
  const nextT = curIdx >= 0 && curIdx < sorted.length - 1 ? sorted[curIdx + 1] : null;
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
  const body = `${breadcrumbHtml}
<article class="detail" data-canonical="m/${esc(t.slug)}.html" data-spec-text="${esc(buildSpecText(t))}"${prevT ? ` data-prev-href="${esc(prevT.slug)}.html"` : ''}${nextT ? ` data-next-href="${esc(nextT.slug)}.html"` : ''}>
<header class="detail-head">
<p class="eyebrow">${esc(t.year)} MODEL YEAR</p>
${is2025 ? `<p class="inherited-note" role="note"><strong>2025 data note:</strong> the 2025 figures below were <strong>inherited from the 2026 model year</strong> and were not independently verified. <a href="${esc(slug2026)}.html">See the 2026 page →</a></p>` : ''}
<div class="detail-head-row">
<h1>${esc(t.model)} <span>${esc(t.floorplan)}</span></h1>
${saveButton(t.slug, 'trailer', trailerLabel(t), 'detail')}
</div>
<div class="detail-actions" data-share-actions>
<button type="button" class="share-btn" id="detail-share" aria-label="Share this page" title="Share this page"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg> Share</button>
<button type="button" class="share-btn" id="detail-compare" data-compare-slug="${esc(t.slug)}" data-compare-type="trailer" aria-label="Add to comparison" title="Add to comparison"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="18" x2="6" y2="14"></line></svg> Compare</button>
</div>
${official ? `<p class="official-head"><a class="official-link" href="${esc(official)}" target="_blank" rel="noopener">Official ${esc(t.model)} page on airstream.com ↗</a></p>` : ''}
</header>
<div class="detail-hero">${heroImg}</div>
${renderKeyStats(t)}
${renderStandoutBadges(t, allTrailers)}
${renderTowDifficultyBadge(t, 'detail')}
<section class="dsec detail-overview" aria-label="Overview">
<h2 class="dsec-title">Overview</h2>
<p class="detail-desc">${esc(t.description)}</p>
${renderAmenitySummary(t)}
</section>
${gallery ? `<section class="dsec gallery gallery-immersive" id="gallery" aria-label="Gallery">
<div class="gallery-head"><h2 class="dsec-title">Gallery</h2><span class="gallery-count">${galleryCount} photos</span></div>
<div class="gallery-mosaic" data-gallery data-count="${galleryCount}">
${galleryMosaic}
</div>
<button type="button" class="gallery-show-all" data-gallery-all aria-label="View all photos">View all photos</button>
<div class="gallery-grid" data-gallery hidden>${gallery}</div>
</section>` : ''}
${floorplanSection}
<section class="dsec spec-table" id="specs" aria-label="Specifications">
<h2 class="dsec-title">Specifications</h2>
${renderSpecLede(t)}
${renderFitCheck(t)}
<details class="fold fold--specs">
<summary><span class="fold-title">Full specifications</span><span class="fold-hint">Secondary specs - solar, battery, interior height and more</span></summary>
<div class="fold-body collapsible-body">
<dl class="specs-grid">
${specRow('Axle', deriveAxle(t) === 'single' ? 'Single axle' : deriveAxle(t) === 'dual' ? 'Dual axle' : 'n/a', { tip: true })}
${specRow('Interior height', t.intHeightFt ? formatDimFt(t.intHeightFt) + ' (with A/C)' : 'n/a', { tip: true, unit: 'dimft', raw: t.intHeightFt })}
${specRow('Solar', t.solarW ? `${t.solarW} W ${t.solarStandard ? '(standard)' : '(optional)'}` : 'n/a', { tip: true })}
${specRow('Battery', t.batteryKwh ? `${t.batteryKwh} kWh` : 'n/a', { tip: true })}
${specRow('Off-grid score', offGridTier(t.offGridScore) || 'n/a', { tip: true })}
</dl>
${note}
</div>
</details>
${renderBrowseLinks(t)}
</section>
${renderTowingSection(t)}
${renderOffgridSection(t)}
${renderCareSection(t)}
${pros || cons ? `<section class="dsec dsec-proscons proscons" id="proscons" aria-label="Strengths and trade-offs">
<h2 class="dsec-title">Strengths &amp; trade-offs</h2>
<div class="proscons-grid">
${pros ? `<div class="pros"><h3 class="dsec-sub">Strengths</h3><ul>${pros}</ul></div>` : ''}
${cons ? `<div class="cons"><h3 class="dsec-sub">Trade-offs</h3><ul>${cons}</ul></div>` : ''}
</div></section>` : ''}
${renderMoreSection(t, allTrailers, resolve, prevT, nextT)}
</article>`;
  return page({
    title: `${trailerTitle(t)} - specs, weights & price`,
    description: `${trailerTitle(t)}: ${formatLength(t.lengthFt)}, ${formatWeight(t.weightLb)} dry, sleeps ${t.sleeps}, ${formatMsrp(t.msrp)}. Full specs, tanks, off-grid and gallery.`,
    body,
    relRoot: '../',
    active: 'index',
    // 2025 pages canonicalize to their 2026 twin (2B ruling) and emit no
    // Product JSON-LD: the entity lives on the canonical 2026 page.
    canonicalPath: `m/${is2025 ? slug2026 : t.slug}.html`,
    ogImage: a.hero || '',
    ogType: 'product',
    head: (is2025 ? '' : productJsonLd({
      name: trailerTitle(t),
      description: `${trailerTitle(t)}: ${formatLength(t.lengthFt)}, ${formatWeight(t.weightLb)} dry, sleeps ${t.sleeps}, ${formatMsrp(t.msrp)}.`,
      imagePath: a.hero || '',
      canonicalPath: `m/${t.slug}.html`,
      category: 'Travel Trailer',
      msrp: t.msrp,
    }) + '\n') + breadcrumbJsonLd(breadcrumbItems) + (a.hero ? '\n' + heroPreloadLink(a.hero, '../') : ''),
  });
}

// ---------------------------------------------------------------------------
// EXPLORE: every floorplan in one place - search, sort, filter, tow-match.
// ---------------------------------------------------------------------------

/**
 * One explore-grid card. Carries every value the client filter/sort/compare
 * needs in data-* attributes (hard contract — the client-side template in
 * app.js must emit the same set). `resolve` gives real on-disk thumb paths.
 * Exported for tests; production grids render client-side from the JSON
 * payload (see exploreCardData).
 */
export function renderExploreCard(t, resolve = assetPaths, hidden = false) {
  // Editorial entry: big photo, title, one-line editor's descriptor, three
  // numbers (GVWR / length / MSRP), and a small Save · Compare action row.
  // All data-* attributes are kept verbatim — the client filters, sorts, tow
  // matcher, quick-view and CSV export all read from them (hard contract).
  const a = resolve(t);
  const tags = (t.tags || []).join(' ');
  const layout = deriveLayoutFeatures(t).join(' ');
  const galleryUrls = a.gallery && a.gallery.length ? a.gallery.slice(0, 6).join('|') : '';
  const lede = (t.description || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');
  const gvwr = t.gvwrLb > 0 ? formatWeight(t.gvwrLb) : 'n/a';
  const len = t.lengthFt > 0 ? formatLength(t.lengthFt) : 'n/a';
  const msrp = t.msrp > 0 ? formatMsrp(t.msrp) : 'n/a';
  return `<article class="xcard" data-slug="${esc(t.slug)}" data-type="trailer" data-model="${esc(t.model)}" data-floorplan="${esc(t.floorplan)}" data-year="${esc(t.year)}" data-msrp="${esc(t.msrp)}" data-weight="${esc(t.weightLb)}" data-gvwr="${esc(t.gvwrLb)}" data-length="${esc(t.lengthFt)}" data-sleeps="${esc(t.sleeps)}" data-offgrid="${esc(t.offGridScore)}" data-tags="${esc(tags)}" data-layout="${esc(layout)}" data-name="${esc((t.model + ' ' + t.floorplan).toLowerCase())}" data-ccc="${esc(t.cccLb || '')}" data-fresh="${esc(t.freshGal || '')}" data-gray="${esc(t.grayGal == null ? '' : t.grayGal)}" data-black="${esc(t.blackGal == null ? '' : t.blackGal)}" data-solar="${esc(t.solarW || '')}" data-hitch="${esc(t.hitchWeightLb || '')}" data-axle="${esc(deriveAxle(t) || '')}" data-desc="${esc(t.description || '')}" data-thumb="${esc(a.thumb || '')}" data-gallery-urls="${esc(galleryUrls)}"${hidden ? ' hidden' : ''}>
<a class="xcard-link" href="m/${esc(t.slug)}.html">
<div class="xcard-media">
<img src="${esc(a.thumb)}" alt="${esc(trailerTitle(t))}" loading="lazy" width="400" height="260">
${a.gallery && a.gallery.length ? `<span class="xcard-photos" aria-label="${a.gallery.length} photos"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> ${a.gallery.length}</span>` : ''}
<button type="button" class="xcard-peek" data-peek aria-label="Quick view ${esc(trailerLabel(t))}" title="Quick view"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
</div>
<div class="xcard-body">
<h3 class="xcard-title">${esc(t.model)} <span>${esc(t.floorplan)}</span></h3>
${lede ? `<p class="xcard-lede">${esc(lede)}</p>` : ''}
<dl class="xcard-specs">
${specRow('GVWR', gvwr, { unit: 'weight', raw: t.gvwrLb })}
${specRow('Length', len, { unit: 'length', raw: t.lengthFt })}
${specRow('MSRP', msrp)}
</dl>
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
 * compare tray) as a reusable body fragment. Rendered inside the Explore hub
 * (the renderIndex "All floorplans" view). `trailers` is the full (unsorted)
 * dataset. The card grid itself is a compact JSON payload rendered client-side
 * (see exploreCardData); everything else is static markup with root-relative
 * links (m/…, compare.html).
 */

/**
 * Compact card data for the Explore "All floorplans" grid. The grid is NOT
 * server-rendered (that duplicated the whole catalog into a hidden section and
 * blew the index.html budget); instead this JSON payload is embedded once and
 * app.js renders the .xcard markup client-side from it. Every field the client
 * needs is here: the full data-* filter/sort contract, quick-view, CSV export,
 * compare tray, tow verdict and gallery carousel. Display strings (lede,
 * formatted specs) are precomputed server-side so the client template needs no
 * formatter parity.
 */
function exploreCardData(t, type, resolve) {
  const a = resolve(t);
  const gallery = (a.gallery || []).slice(0, 6);
  const lede = (t.description || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');
  return {
    type,
    slug: t.slug,
    model: t.model,
    floorplan: t.floorplan,
    year: t.year,
    msrp: t.msrp,
    weightLb: t.weightLb,
    gvwrLb: t.gvwrLb,
    lengthFt: t.lengthFt,
    sleeps: t.sleeps,
    offGridScore: t.offGridScore ?? null,
    tags: (t.tags || []).join(' '),
    layout: type === 'trailer' ? deriveLayoutFeatures(t).join(' ') : '',
    ccc: t.cccLb || t.nccLb || null,
    fresh: t.freshGal || null,
    gray: t.grayGal ?? null,
    black: t.blackGal ?? null,
    solar: t.solarW || null,
    hitch: t.hitchWeightLb || null,
    axle: type === 'trailer' ? (deriveAxle(t) || '') : '',
    desc: t.description || '',
    thumb: a.thumb || '',
    gallery,
    lede,
    label: `${t.model} ${t.floorplan}`,
    alt: `${t.year} Airstream ${t.model} ${t.floorplan}`,
    gvwrFmt: t.gvwrLb > 0 ? formatWeight(t.gvwrLb) : 'n/a',
    lenFmt: t.lengthFt > 0 ? formatLength(t.lengthFt) : 'n/a',
    msrpFmt: t.msrp > 0 ? formatMsrp(t.msrp) : 'n/a',
  };
}

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
  // Layout feature chips - bed position, bath type, etc.
  const layoutChips = LAYOUT_META
    .map((lf) => `<button type="button" class="layoutfilter" data-layout-key="${esc(lf.key)}" aria-pressed="false">${esc(lf.label)}</button>`)
    .join('');
  // The card grid is rendered client-side from a compact JSON payload (see
  // exploreCardData): one payload instead of a second full SSR copy of the
  // catalog keeps index.html lean. Default order is cheapest-first, matching
  // the historic SSR order; the client re-sorts on interaction.
  const items = [
    ...trailers.map((t) => exploreCardData(t, 'trailer', resolve)),
    ...motorhomes.map((m) => exploreCardData(m, 'motorhome', motorhomeAssetPaths)),
  ].sort(
    (a, b) => a.msrp - b.msrp || a.label.localeCompare(b.label),
  );
  // Escape "<" so a stray "</script>" in data can never break out of the
  // JSON script block.
  const payloadJson = JSON.stringify(items).replace(/</g, '\\u003c');
  const total = items.filter((it) => it.year === 2026).length;
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
<p class="lede">Search, sort and filter all ${totalPlans} floorplans${hasMotorhomes ? ' - travel trailers and motorhomes' : ''} - match a trailer to your tow vehicle, or browse by size, sleeping capacity or off-grid capability.</p>
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
<p class="tow-hint">Pick a vehicle above or enter your max tow rating. We compare it to each trailer\'s <strong>fully-loaded GVWR</strong> - not dry weight - the way Airstream recommends.</p>
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
<select id="x-year"><option value="2026" selected>2026</option><option value="2025">2025</option><option value="">All years</option></select>
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
<div class="xc-axle">
<label for="x-axle">Axle</label>
<select id="x-axle"><option value="">Any</option><option value="single">Single axle</option><option value="dual">Dual axle</option></select>
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
<div class="xc-layout-actions">
<button type="button" class="csv-export-btn" id="csv-export" title="Download visible catalog as CSV"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CSV</button>
<button type="button" class="csv-export-btn" id="x-share-view" title="Copy link to this filtered view"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"></path></svg> Share</button>
<div class="xc-layout" id="x-layout" aria-label="View layout">
<button type="button" class="xc-layout-btn is-active" data-layout="grid" aria-pressed="true" title="Grid view"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button>
<button type="button" class="xc-layout-btn" data-layout="list" aria-pressed="false" title="List view"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>
</div>
</div>
</div>
<p class="xcount"><span id="x-count">${total}</span> floorplans</p>
<div class="xgrid" id="xgrid"></div>
<script type="application/json" id="xdata">${payloadJson}</script>
<p class="xempty" id="x-empty" hidden>No floorplans match those filters. <button type="button" class="linklike" id="x-empty-reset">Reset filters</button></p>
<div class="x-nearest" id="x-nearest" hidden>
<p class="x-nearest-title">Closest matches:</p>
<div class="x-nearest-grid" id="x-nearest-grid"></div>
</div>
<div class="cmp-bar" id="cmp-bar" hidden>
<span class="cmp-bar-text"><strong id="cmp-count">0</strong> selected</span>
<span class="cmp-bar-delta" id="cmp-delta" hidden></span>
<div class="cmp-bar-actions">
<button type="button" class="cmp-bar-clear" id="cmp-clear">Clear</button>
<a class="cmp-bar-go" id="cmp-go" href="compare.html">Compare →</a>
</div>
</div>`;
}

/**
 * Standalone explore.html - kept as a real file so old bookmarks/links don't
 * 404 and the build's fingerprint + image-guardrail lists stay valid. It is
 * NOT in the top nav. With JS it redirects to the canonical hub (index.html#all);
 * without JS it still shows the full Explore & match experience inline so the
 * page is never a dead end. Its canonical is itself (explore.html): the page
 * renders real content, so it must not canonicalize to index.html.
 */
export function renderExplore(trailers, resolve = assetPaths) {
  const body = `<div class="explore-shim" data-redirect="index.html#all">
<p class="explore-shim-note"><a href="index.html#all">Explore &amp; match has moved to the Explore hub →</a></p>
${renderExploreSections(trailers, resolve)}
</div>`;
  return page({
    title: 'Explore & match - every Airstream floorplan, by the numbers',
    description: `Search, sort and filter all ${trailers.length} Airstream floorplans by price, weight, sleeps and use. Enter your tow vehicle rating to see what you can safely tow.`,
    body,
    active: 'index',
    canonicalPath: 'explore.html',
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
        thumb: a.thumb, floorplanImg: a.floorplan || '', lengthFt: t.lengthFt, weightLb: t.weightLb, gvwrLb: t.gvwrLb,
        cccLb: t.cccLb, hitchWeightLb: t.hitchWeightLb, sleeps: t.sleeps,
        freshGal: t.freshGal, grayGal: t.grayGal, blackGal: t.blackGal,
        solarW: t.solarW, batteryKwh: t.batteryKwh, offGridScore: t.offGridScore, msrp: t.msrp,
        extWidthFt: t.extWidthFt || null, extHeightFt: t.extHeightFt || null, intHeightFt: t.intHeightFt || null,
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
<p class="cmp-empty-title">Nothing to compare yet</p>
<p class="cmp-empty-lead">Search above to add any floorplan, or start with one of these:</p>
<ul class="cmp-empty-list">
<li><a href="compare.html?ids=basecamp-16x-2026,caravel-16rb-2026,bambi-16rb-2026"><span class="cmp-empty-tag">Compact &amp; light</span>Basecamp 16X · Caravel 16RB · Bambi 16RB<span class="muted"> — the smallest, easiest-to-tow trio</span></a></li>
<li><a href="compare.html?ids=flying-cloud-25fb-2026,globetrotter-25fb-2026,trade-wind-25fb-2026"><span class="cmp-empty-tag">Mid-size all-rounders</span>Flying Cloud · Globetrotter · Trade Wind 25FB<span class="muted"> — three 26-footers, three personalities</span></a></li>
<li><a href="compare.html?ids=classic-33fb-2026,globetrotter-27fb-2026,international-28rb-2026"><span class="cmp-empty-tag">Big &amp; luxe</span>Classic 33FB · Globetrotter 27FB · International 28RB<span class="muted"> — full-size flagships for long hauls</span></a></li>
</ul>
<p class="cmp-empty-foot">Or browse the full lineup in <a href="index.html#all">Explore</a>.</p>
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

// ---------------------------------------------------------------------------
// GLOSSARY PAGE - standalone reference for all RV & Airstream terminology
// ---------------------------------------------------------------------------

const GLOSSARY_TERMS = [
  // Specs & Weights
  { term: 'Dry Weight', def: 'The weight of the trailer as it leaves the factory - no water, propane, or personal gear. The starting point for all weight calculations.', cat: 'weights', link: '#specs' },
  { term: 'GVWR', def: 'Gross Vehicle Weight Rating - the maximum safe loaded weight set by Airstream. Everything you add (water, propane, food, gear) must keep total weight under this number.', cat: 'weights', link: '#specs' },
  { term: 'CCC', def: 'Cargo Carrying Capacity - the difference between GVWR and dry weight. This is your total budget for water, propane, and personal cargo.', cat: 'weights', link: '#payload' },
  { term: 'Hitch Weight', def: 'The downward force the trailer tongue exerts on the tow vehicle\'s hitch ball. Typically 10–15% of the trailer\'s loaded weight. Your tow vehicle\'s payload must handle this.', cat: 'weights', link: '#hitch-guide' },
  { term: 'MSRP', def: 'Manufacturer\'s Suggested Retail Price - the base sticker price before dealer markup, options, or negotiation. Actual transaction prices vary.', cat: 'weights', link: '#specs' },
  // Towing
  { term: 'Max Tow Rating', def: 'The maximum trailer weight your tow vehicle is rated to pull, as stated by the vehicle manufacturer. Must exceed the trailer\'s GVWR.', cat: 'towing', link: '#tow' },
  { term: 'GCWR', def: 'Gross Combined Weight Rating - the maximum combined weight of tow vehicle + trailer + all occupants and cargo. Set by the tow vehicle manufacturer.', cat: 'towing', link: '#tow' },
  { term: 'WDH', def: 'Weight Distributing Hitch - a hitch system that uses spring bars to redistribute tongue weight across all axles. Recommended for trailers over 5,000 lb GVWR.', cat: 'towing', link: '#hitch-guide' },
  { term: 'Anti-Sway Control', def: 'A device (friction bar, dual-cam, or electronic) that reduces lateral trailer sway in crosswinds or when passed by trucks. Essential for larger trailers.', cat: 'towing', link: '#hitch-guide' },
  { term: 'Breakaway Switch', def: 'A safety device that activates the trailer\'s brakes automatically if it separates from the tow vehicle. Required by law in most states.', cat: 'towing', link: '#tow' },
  { term: 'Tongue Weight', def: 'Synonym for hitch weight - the downward force on the hitch. The loaded tongue weight should be 10–15% of the total loaded trailer weight for safe handling.', cat: 'towing', link: '#hitch-guide' },
  // Tanks & Plumbing
  { term: 'Fresh Water Tank', def: 'Holds clean drinking water for the sinks, shower, and toilet. Capacity ranges from 21 to 54 gallons across the Airstream lineup.', cat: 'tanks', link: '#water-autonomy' },
  { term: 'Gray Tank', def: 'Collects wastewater from sinks and shower. Empties at a dump station. Some smaller Airstreams combine gray and black into one "combo" waste tank.', cat: 'tanks', link: '#water-autonomy' },
  { term: 'Black Tank', def: 'Holds toilet waste. Must be emptied at a dump station. Use only RV-specific toilet paper. On combo-tank models, the single waste tank handles both gray and black.', cat: 'tanks', link: '#water-autonomy' },
  { term: 'Combo Waste Tank', def: 'A single tank that handles both gray (sink/shower) and black (toilet) waste. Found on the smallest Airstreams like the Basecamp 16X and Bambi 16RB.', cat: 'tanks', link: '#water-autonomy' },
  { term: 'Dump Station', def: 'A facility where you empty gray and black tanks through a sewer hose. Found at campgrounds, rest areas, and some gas stations. Many are free.', cat: 'tanks', link: '' },
  // Power & Solar
  { term: 'Shore Power', def: 'Electrical hookup at a campsite, typically 30A (3,600W max) or 50A (12,000W max). Your trailer plugs in with its shore power cord.', cat: 'power', link: '#electrical' },
  { term: '30A Service', def: '30-amp campsite power - a single 120V/30A circuit providing up to 3,600W. Enough for A/C or microwave, but not both simultaneously.', cat: 'power', link: '#hookup' },
  { term: '50A Service', def: '50-amp campsite power - two 120V/50A circuits providing up to 12,000W. Runs everything including dual A/C units. Found at RV resorts and newer campgrounds.', cat: 'power', link: '#hookup' },
  { term: 'House Battery', def: 'The 12V battery (or lithium bank) that powers lights, water pump, furnace fan, and USB outlets when not on shore power. Charged by solar, the alternator while driving, or shore power.', cat: 'power', link: '#electrical' },
  { term: 'Solar (Rooftop)', def: 'Factory-installed photovoltaic panels that charge the house battery. Wattage ranges from 90W to 600W across the lineup. Higher wattage = longer off-grid stays.', cat: 'power', link: '#offgrid' },
  { term: 'Off-Grid Score', def: 'A 0–100 composite rating based on battery capacity, solar wattage, and tank sizes relative to the rest of the lineup. Higher = more self-sufficient.', cat: 'power', link: '#offgrid' },
  // Camping
  { term: 'Boondocking', def: 'Camping without hookups - no water, sewer, or electrical connections. Relies entirely on tanks, battery, solar, and propane. Also called "dry camping" or "dispersed camping."', cat: 'camping', link: '#offgrid' },
  { term: 'Full Hookups', def: 'A campsite with water, sewer, and electrical connections. The most convenient setup - unlimited water, instant waste disposal, and shore power.', cat: 'camping', link: '#hookup' },
  { term: 'Pull-Through Site', def: 'A campsite you can drive straight through without backing up. Easier for longer rigs. Back-in sites require reversing the trailer into position.', cat: 'camping', link: '' },
  { term: 'Leveling', def: 'Adjusting the trailer so it sits level using stabilizer jacks and/or leveling blocks. Important for fridge operation, sleeping comfort, and proper tank drainage.', cat: 'camping', link: '#trip-ready' },
  // Airstream-specific
  { term: 'Single Axle', def: 'One axle (two wheels). Lighter, shorter trailers - easier to maneuver and tow. Bambi, Basecamp, and Caravel models.', cat: 'airstream', link: '#specs' },
  { term: 'Dual Axle', def: 'Two axles (four wheels). Larger, heavier trailers - more stable at highway speed and in crosswinds. Flying Cloud, International, Classic, and most others.', cat: 'airstream', link: '#specs' },
  { term: 'Rock Guard', def: 'The protective front panel (black or body-color) that shields the trailer\'s aluminum shell from road debris kicked up by the tow vehicle.', cat: 'airstream', link: '' },
  { term: 'A-Frame', def: 'The triangular steel tongue structure at the front of the trailer that connects to the hitch ball. Houses the propane tanks, battery, and breakaway switch.', cat: 'airstream', link: '' },
];

const GLOSSARY_CATS = [
  { key: 'weights', label: 'Specs & Weights', icon: '⚖️' },
  { key: 'towing', label: 'Towing', icon: '🚗' },
  { key: 'tanks', label: 'Tanks & Plumbing', icon: '💧' },
  { key: 'power', label: 'Power & Solar', icon: '⚡' },
  { key: 'camping', label: 'Camping', icon: '⛺' },
  { key: 'airstream', label: 'Airstream-Specific', icon: '🏕️' },
];

export function renderGlossaryBody() {
  const sections = GLOSSARY_CATS.map((cat) => {
    const terms = GLOSSARY_TERMS.filter((t) => t.cat === cat.key);
    if (!terms.length) return '';
    const rows = terms.map((t) => {
      const linkHtml = t.link
        ? ` <a class="glossary-link" href="index.html#all" aria-label="See ${esc(t.term)} in context">→ See in specs</a>`
        : '';
      return `<div class="glossary-term" id="gl-${esc(t.term.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">
<dt class="glossary-dt">${esc(t.term)}</dt>
<dd class="glossary-dd">${esc(t.def)}${linkHtml}</dd>
</div>`;
    }).join('\n');
    return `<section class="glossary-cat" aria-label="${esc(cat.label)}">
<h2><span class="glossary-cat-icon" aria-hidden="true">${cat.icon}</span> ${esc(cat.label)}</h2>
<dl class="glossary-dl">${rows}</dl>
</section>`;
  }).join('\n');

  return `<header class="glossary-head">
<p class="eyebrow">REFERENCE</p>
<h1>RV & Airstream Glossary</h1>
<p class="lede">Every term you'll see on spec sheets, in campground descriptions, and throughout this site - explained in plain language.</p>
</header>
<div class="glossary-toc">
${GLOSSARY_CATS.map((c) => `<a class="glossary-toc-link" href="#gl-${esc(GLOSSARY_TERMS.find((t) => t.cat === c.key).term.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">${c.icon} ${esc(c.label)}</a>`).join('\n')}
</div>
${sections}`;
}

// ---------------------------------------------------------------------------
// WEIGHT CLASS SEGMENT BAR - visual weight distribution for explore page
// ---------------------------------------------------------------------------
const WEIGHT_CLASSES = [
  { key: 'ultralight', label: 'Ultra-light', max: 3500, color: '#3a7d44' },
  { key: 'light',      label: 'Light',       max: 5000, color: '#5b8a3c' },
  { key: 'medium',     label: 'Medium',      max: 7000, color: '#b07a1f' },
  { key: 'heavy',      label: 'Heavy',       max: Infinity, color: '#8b5a3c' },
];

export function renderWeightClassBar(trailers) {
  // Only count latest-year trailers so the bar matches the default explore view
  const latest = trailers.filter((t) => t.year === 2026 && t.weightLb > 0);
  if (latest.length < 3) return '';
  const counts = WEIGHT_CLASSES.map((wc) => {
    const prev = WEIGHT_CLASSES[WEIGHT_CLASSES.indexOf(wc) - 1];
    const min = prev ? prev.max : 0;
    const n = latest.filter((t) => t.weightLb > min && t.weightLb <= wc.max).length;
    return { ...wc, count: n };
  }).filter((wc) => wc.count > 0);
  const total = counts.reduce((s, c) => s + c.count, 0);
  const segments = counts.map((wc) => {
    const pct = ((wc.count / total) * 100).toFixed(1);
    const maxLabel = wc.max === Infinity ? '7,000+' : wc.max.toLocaleString('en-US');
    const prevWc = WEIGHT_CLASSES[WEIGHT_CLASSES.indexOf(WEIGHT_CLASSES.find((w) => w.key === wc.key)) - 1];
    const minLabel = prevWc ? prevWc.max.toLocaleString('en-US') : '0';
    return `<button type="button" class="wc-seg" data-wc="${esc(wc.key)}" data-wc-max="${wc.max === Infinity ? '99999' : wc.max}" data-wc-min="${prevWc ? prevWc.max : 0}" style="flex:${wc.count};background:${wc.color}" aria-label="${esc(wc.label)}: ${wc.count} models (${minLabel}–${maxLabel} lb)" title="${esc(wc.label)}: ${wc.count} models"><span class="wc-seg-label">${esc(wc.label)}</span><span class="wc-seg-count">${wc.count}</span></button>`;
  }).join('\n');
  return `<div class="weight-class-bar" id="weight-class-bar" aria-label="Weight class distribution">
<div class="wc-header"><span class="wc-title">Weight classes</span><button type="button" class="wc-clear linklike" id="wc-clear" hidden>Clear</button></div>
<div class="wc-bar">${segments}</div>
<div class="wc-legend">${counts.map((wc) => {
    const maxLabel = wc.max === Infinity ? '7,000+ lb' : `under ${wc.max.toLocaleString('en-US')} lb`;
    return `<span class="wc-legend-item"><span class="wc-legend-dot" style="background:${wc.color}"></span>${esc(wc.label)} · ${maxLabel}</span>`;
  }).join('')}</div>
</div>`;
}

// ---------------------------------------------------------------------------
// TOW GUIDE PAGE - "What can your vehicle tow?" reverse compatibility finder.
// Pick a tow vehicle, see all Airstreams ranked by compatibility.
// ---------------------------------------------------------------------------

export function renderTowGuide(trailers, vehicles = []) {
  // Compact data islands: only the fields the client needs
  const compactVehicles = vehicles.map((v) => ({
    id: v.id, name: v.name, class: v.class || 'Other',
    maxTowLb: v.maxTowLb, payloadLb: v.payloadLb,
    gcwrLb: v.gcwrLb, curbWeightLb: v.curbWeightLb || 0,
  }));
  const compactTrailers = trailers.filter((t) => t.year === 2026).map((t) => ({
    slug: t.slug, model: t.model, floorplan: t.floorplan, year: t.year,
    weightLb: t.weightLb, gvwrLb: t.gvwrLb, hitchWeightLb: t.hitchWeightLb,
    lengthFt: t.lengthFt, sleeps: t.sleeps, msrp: t.msrp,
  }));
  const vJson = JSON.stringify(compactVehicles).replace(/</g, '\\u003c');
  const tJson = JSON.stringify(compactTrailers).replace(/</g, '\\u003c');

  const body = `<header class="explore-head">
<p class="eyebrow">TOW MATCH</p>
<h1>What can your vehicle tow?</h1>
<p class="lede">Pick your tow vehicle below and see every 2026 Airstream floorplan ranked by how well it fits your limits - tow rating, payload, and GCWR. Green means comfortable headroom, amber is tight but legal, red exceeds your vehicle's rating.</p>
</header>
<script type="application/json" id="towguide-vehicles">${vJson}</script>
<script type="application/json" id="towguide-trailers">${tJson}</script>
<section class="towguide-pick" aria-label="Pick your tow vehicle" id="towguide-grid">
<p class="muted">Loading vehicles…</p>
</section>
<section class="towguide-results" id="towguide-results" hidden aria-label="Compatible trailers">
<h2 id="towguide-result-title">Select a vehicle above</h2>
<div class="towguide-result-grid" id="towguide-result-list"></div>
</section>
<p class="towguide-empty muted" id="towguide-empty">Pick a vehicle above to see which Airstreams it can tow.</p>
<section class="towguide-notes">
<h2>How we evaluate</h2>
<p>Every trailer is tested against <strong>three real limits</strong> from your vehicle's spec sheet:</p>
<ol>
<li><strong>Tow rating</strong> - trailer's GVWR (fully loaded weight) vs. the vehicle's max trailer tow rating.</li>
<li><strong>Payload</strong> - loaded tongue weight (13% of GVWR) + 300 lb for passengers/gear vs. the vehicle's payload capacity.</li>
<li><strong>GCWR</strong> - truck + trailer + everything combined vs. the gross combined weight rating.</li>
</ol>
<p class="muted">Comfortable = all limits under 80%. Tight = 80–100% on at least one. Over = any limit exceeded. All vehicle data is sourced from official manufacturer publications - no invented numbers.</p>
</section>`;

  return page({
    title: 'Tow Guide - what can your vehicle tow?',
    description: `Pick your tow vehicle and see which of the ${compactTrailers.length} current Airstream floorplans it can safely tow, with real payload, tow rating, and GCWR checks against official specs.`,
    body,
    active: 'towguide',
    canonicalPath: 'towguide.html',
  });
}

// ---------------------------------------------------------------------------
// SIZE LADDER - proportional visual strip showing all families by size.
// Used on the home page to give an instant "lineup at a glance" feel.
// ---------------------------------------------------------------------------

export function renderSizeLadder(families, trailers = []) {
  if (!families || !families.length) return '';

  // For each family, compute range of lengths and prices across 2026 models
  const famStats = families.map((fam) => {
    const models = trailers.filter((t) => t.model === fam.family && t.year === 2026);
    if (!models.length) return null;
    const lengths = models.map((t) => t.lengthFt).filter(Boolean);
    const prices = models.map((t) => t.msrp).filter(Boolean);
    const weights = models.map((t) => t.weightLb).filter(Boolean);
    if (!lengths.length) return null;
    return {
      name: fam.family,
      slug: fam.slug,
      count: models.length,
      minLen: Math.min(...lengths),
      maxLen: Math.max(...lengths),
      avgLen: lengths.reduce((a, b) => a + b, 0) / lengths.length,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      minWeight: weights.length ? Math.min(...weights) : 0,
      maxWeight: weights.length ? Math.max(...weights) : 0,
    };
  }).filter(Boolean).sort((a, b) => a.avgLen - b.avgLen);

  if (!famStats.length) return '';

  const maxLen = Math.max(...famStats.map((f) => f.maxLen));
  const minLen = Math.min(...famStats.map((f) => f.minLen));

  const bars = famStats.map((f) => {
    const widthPct = Math.max(20, Math.round((f.avgLen / maxLen) * 100));
    const priceLabel = f.minPrice === f.maxPrice
      ? formatMsrpShort(f.minPrice)
      : `${formatMsrpShort(f.minPrice)}–${formatMsrpShort(f.maxPrice)}`;
    const lenLabel = f.minLen === f.maxLen
      ? `${Math.round(f.minLen)}'`
      : `${Math.round(f.minLen)}'–${Math.round(f.maxLen)}'`;
    return `<div class="sl-bar" data-href="f/${esc(f.slug)}.html" style="--sl-w:${widthPct}%" role="button" tabindex="0" aria-label="${esc(f.name)}: ${lenLabel}, ${priceLabel}">
<div class="sl-bar-fill"></div>
<span class="sl-bar-name">${esc(f.name)}</span>
<span class="sl-bar-stats">${lenLabel} · ${priceLabel}</span>
</div>`;
  }).join('\n');

  return `<section class="size-ladder" id="size-ladder" aria-label="Lineup by size">
<h2 class="sl-heading">The lineup at a glance</h2>
<p class="sl-sub muted">All ${famStats.length} families, smallest to largest. Tap to explore.</p>
<div class="sl-chart">
${bars}
</div>
</section>`;
}


// ---------------------------------------------------------------------------
// OWNER'S GUIDE PAGE — Upgrades + Maintenance as two tabs (2026-09 redesign).
// The nav's "Owner's guide" tab points here; upgrades.html / maintenance.html
// are redirect stubs to the corresponding tab.
// ---------------------------------------------------------------------------
export function renderOwnersGuideBody(upgrades, maintenance) {
  const tab = (id, label, checked, panel) => `
<input class="guide-tab-input" type="radio" name="guidetab" id="${id}"${checked ? ' checked' : ''}>
<label class="guide-tab" for="${id}" role="tab" aria-selected="${checked ? 'true' : 'false'}">${label}</label>
<div class="guide-panel" role="tabpanel" aria-label="${label}">${panel}</div>`;
  return `<article class="guide-page">
<header class="page-header">
<p class="eyebrow">OWNERSHIP</p>
<h1>Owner&rsquo;s guide</h1>
<p class="lede">What owners actually add to their Airstreams, and the service calendar that keeps them road-ready &mdash; every recommendation and interval traced to a primary source.</p>
</header>
<div class="guide-tabs" role="tablist" aria-label="Owner's guide sections">
${tab('guide-tab-upgrades', 'Upgrades & options', true, upgrades)}
${tab('guide-tab-maintenance', 'Maintenance schedule', false, maintenance)}
</div>
</article>
<script>
(function () {
  // Deep-link support: owners-guide.html#maintenance selects the right tab.
  var h = (location.hash || '').replace('#', '');
  var map = { upgrades: 'guide-tab-upgrades', maintenance: 'guide-tab-maintenance' };
  if (map[h]) { var el = document.getElementById(map[h]); if (el) el.checked = true; }
})();
</script>`;
}


// ---------------------------------------------------------------------------
// CREDITS & SOURCES PAGE
// ---------------------------------------------------------------------------
export function renderCreditsBody() {
  return `<article class="credits-page">
<header class="page-header">
<p class="eyebrow">REFERENCE</p>
<h1>Credits &amp; sources</h1>
<p class="lede">Where the data comes from, and what this project is.</p>
</header>

<section class="credits-section">
<h2>About</h2>
<p>An independent, spec-accurate field guide to the current Airstream travel trailer and touring coach lineup. This is a personal project &mdash; not affiliated with, endorsed by, or sponsored by Airstream, Inc. or Thor Industries.</p>
<p>Found wrong data? <a href="https://github.com/gzxultra/airstream-explorer/issues" target="_blank" rel="noopener">Open an issue on GitHub</a>.</p>
</section>

<section class="credits-section">
<h2>Sources</h2>
<p>All specifications (weights, dimensions, tank capacities, pricing, towing figures) are compiled from Airstream&rsquo;s officially published sources: <a href="https://www.airstream.com/travel-trailers/" target="_blank" rel="noopener">airstream.com</a> model pages and spec sheets, plus Airstream&rsquo;s official PDF brochures. Component specs referenced in maintenance come from their manufacturers (Dexter Axle, Suburban / Dometic / Atwood). Tow vehicle ratings are sourced from manufacturer-published towing guides and spec sheets &mdash; figures vary by cab, drivetrain, axle ratio, and packages, so always confirm with your vehicle&rsquo;s door-jamb sticker or owner&rsquo;s manual. Model imagery is official Airstream product photography; no user-submitted, AI-generated, or stock photography is used for model images. Every maintenance interval and upgrade recommendation carries at least one primary source link &mdash; see each item&rsquo;s disclosure for the specific source.</p>
<p>When a spec could not be verified against an official source, it is marked n/a. Verify any figure with your dealer before making a purchase decision.</p>
</section>

<section class="credits-section">
<h2>Technology</h2>
<ul>
<li>Static site built with vanilla JavaScript and Node.js</li>
<li>Hosted on Cloudflare Pages</li>
<li>Fonts: Fraunces (display) and DM Sans (body), self-hosted Latin subsets</li>
</ul>
</section>
</article>`;
}
