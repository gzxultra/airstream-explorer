// Motorhome HTML rendering — pure functions returning strings. No DOM, no I/O.
// Mirrors render.mjs patterns for trailers, adapted for Class B motorhomes.

import {
  formatMsrp, formatWeight, formatLength, formatGal, formatTanks,
  formatPriceRange, formatLengthRange, formatMsrpShort,
  trailerTitle, trailerLabel, saveButton,
} from './format.mjs';
import { motorhomeAssetPaths, motorhomeFamilySlug, motorhomeOfficialUrl, motorhomeOfficialUrlBySlug } from './motorhome-data.mjs';
import { catalogStats, rangePosition, towClass, waterAutonomy, offGridTier } from './data.mjs';
import { socialMeta, productJsonLd, iconMeta, breadcrumbJsonLd } from './seo.mjs';
import {
  estimateOffGrid, formatNights,
  LOAD_PRESETS,
} from './estimate.mjs';

/** Escape text for HTML body/attribute context. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Chrome icon set — 2026-09 icon spec (design-2026-09/icons.md): monochrome
// linear inline SVG, 1.5px stroke, currentColor, decorative (aria-hidden).
// Mirrors render.mjs (dual-write: keep both page() copies in sync).
const ICON_COMPASS = '<svg class="nav-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M16 8l-2.6 5.4L8 16l2.6-5.4z"/></svg>';
const ICON_COLUMNS = '<svg class="nav-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/><line x1="12" y1="4" x2="12" y2="20"/></svg>';
const ICON_BOOK = '<svg class="nav-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

// Navigation items — unified Explore hub (motorhomes live inside Explore now).
// 2026-09 redesign: exactly 3 tabs — Explore / Compare / Owner's guide.
const NAV_ITEMS = [
  ['index.html', 'Explore', 'index', ICON_COMPASS],
  ['compare.html', 'Compare', 'compare', ICON_COLUMNS],
  ['owners-guide.html', "Owner's guide", 'owners', ICON_BOOK],
];

function page({ title, description, body, relRoot = '', head = '', scripts = '', active = '', canonicalPath = '', ogImage = '', ogType = 'website' }) {
  const _stats = catalogStats();
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
<p class="footer-about">${_stats.floorplanCount} floorplans across ${_stats.familyCount} families. An independent field guide to Airstream's 2026–2027 touring coach lineup. Specs checked against official Airstream sources (Sept 2026).</p>
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
<div class="kb-row"><kbd>Esc</kbd><span>Close overlay</span></div>
</div>
<div class="kb-group"><h3>Actions</h3>
<div class="kb-row"><kbd>d</kbd><span>Toggle dark mode</span></div>
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

function specRow(label, value, { unit = null, raw = null } = {}) {
  const unitAttr = unit && raw != null ? ` data-unit="${esc(unit)}" data-raw="${esc(String(raw))}"` : '';
  return `<div class="spec"><dt>${esc(label)}</dt><dd${unitAttr}>${esc(value)}</dd></div>`;
}

function tagChips(tags) {
  if (!tags || !tags.length) return '';
  return `<ul class="chips">${tags
    .map((t) => `<li class="chip">${esc(t)}</li>`)
    .join('')}</ul>`;
}

// ---------------------------------------------------------------------------
// MOTORHOME INDEX: family grid
// ---------------------------------------------------------------------------

/**
 * A family card for the motorhome home grid.
 */

// ---------------------------------------------------------------------------
// MOTORHOME DETAIL REDESIGN (2026-09-27, approved): same quiet-luxury system
// as trailers — zero emoji, literal "n/a" for missing values, dsec/dsec-title
// section treatment, unified header actions (Save/Share/Compare only).
// Gallery cutout/photo class mapping is character-for-character preserved.
// ---------------------------------------------------------------------------

/** Missing-value marker for motorhome detail pages: literal "n/a". */
function mna(s) {
  return String(s == null ? '' : s).replace(/—/g, 'n/a');
}

/** Single-stroke (1.5px, currentColor) line icons for key stats. */
const MM_KS_ICONS = {
  length: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="9" width="19" height="6" rx="1"/><path d="M6.5 9v2.5M10.5 9v1.8M14.5 9v2.5M18 9v1.8"/></svg>',
  weight: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="14" r="6.5"/><path d="M12 7.5V4M9.5 4h5"/></svg>',
  sleeps: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18V6"/><path d="M3 13h18v5"/><path d="M3 15.5h18"/><circle cx="6.2" cy="9.6" r="1.6"/></svg>',
  price: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 11.5v-8h8L20 12l-8.5 8.5z"/><circle cx="8" cy="8" r="1.3"/></svg>',
  battery: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="8" width="17" height="8.5" rx="1.5"/><path d="M21.8 11v3"/><path d="M7 11v3M11 11v3"/></svg>',
  water: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5c3.4 4.4 5.8 7.6 5.8 10.6a5.8 5.8 0 1 1-11.6 0c0-3 2.4-6.2 5.8-10.6z"/></svg>',
};

/** Render the key-stats dashboard below the motorhome detail hero. */
function renderMotorhomeKeyStats(m) {
  const days = waterAutonomy(m.freshGal);
  const stats = [
    { icon: 'length', value: mna(formatLength(m.lengthFt)), label: 'Length' },
    { icon: 'weight', value: mna(formatWeight(m.weightLb)), label: 'Base weight' },
    { icon: 'sleeps', value: m.sleeps != null ? String(m.sleeps) : 'n/a', label: 'Sleeps', note: m.sleepsNote || null },
    { icon: 'price', value: mna(formatMsrpShort(m.msrp)), label: 'Base MSRP' },
    m.offGridScore ? { icon: 'battery', value: offGridTier(m.offGridScore), label: 'Off-grid', title: `Editorial composite ${m.offGridScore}/100 — not an official Airstream rating` } : null,
    days ? { icon: 'water', value: `~${days}`, label: 'Water days (2 ppl)' } : null,
  ].filter(Boolean);
  return `<div class="key-stats" aria-label="Key specifications at a glance">${stats.map((s) =>
    `<div class="key-stat"><span class="key-stat-icon" aria-hidden="true">${MM_KS_ICONS[s.icon]}</span><span class="key-stat-value"${s.title ? ` title="${esc(s.title)}"` : ''}>${esc(s.value)}</span><span class="key-stat-label">${esc(s.label)}</span>${s.note ? `<span class="key-stat-note">${esc(s.note)}</span>` : ''}</div>`
  ).join('')}</div>`;
}

/** Render weight capacity bar for motorhomes (uses NCC instead of CCC). */
function renderMotorhomeWeightBar(m) {
  if (!(m.weightLb > 0) || !(m.gvwrLb > 0)) return '';
  const dryPct = Math.round((m.weightLb / m.gvwrLb) * 100);
  const cccPct = 100 - dryPct;
  const ncc = m.nccLb || (m.gvwrLb - m.weightLb);
  return `<div class="weight-bar" aria-label="Weight capacity breakdown">
<div class="weight-bar-header"><span class="weight-bar-title">Weight capacity</span><span class="weight-bar-gvwr">${esc(formatWeight(m.gvwrLb))} GVWR</span></div>
<div class="weight-bar-track">
<div class="weight-bar-dry" style="width:${dryPct}%"><span class="weight-bar-seg-label">${esc(formatWeight(m.weightLb))}</span></div>
<div class="weight-bar-ccc" style="width:${cccPct}%"><span class="weight-bar-seg-label">${esc(formatWeight(ncc))}</span></div>
</div>
<div class="weight-bar-legend"><span class="weight-bar-legend-dry">Base weight</span><span class="weight-bar-legend-ccc">Net carrying capacity (NCC)</span></div>
</div>`;
}

export function renderMotorhomeFamilyCard(fam, linkPrefix = '') {
  const range = formatPriceRange(fam.priceMin, fam.priceMax);
  const len = formatLengthRange(fam.lengthMin, fam.lengthMax);
  const plans = `${fam.floorplanCount} floorplan${fam.floorplanCount === 1 ? '' : 's'}`;
  const yrs = fam.years.join(' + ');
  return `<a class="fam" href="${linkPrefix}motorhomes.html#mf-${esc(fam.slug)}" data-family="${esc(fam.family)}">
<div class="fam-media">
<img src="${linkPrefix}${esc(fam.hero)}" alt="Airstream ${esc(fam.family)}" loading="lazy" width="800" height="500">
<span class="fam-plans">${esc(plans)}</span>
</div>
<div class="fam-body">
<span class="fam-name">${esc(fam.family)}</span>
<p class="fam-range">${esc(range)}</p>
<dl class="fam-stats">
${specRow('Length', len)}
${specRow('Sleeps', 'up to ' + fam.sleepsMax)}
${specRow('Years', yrs)}
</dl>
</div>
</a>`;
}

/**
 * The Motorhome index page (motorhomes.html). Shows all motorhome families
 * plus an all-floorplans explore section.
 */
export function renderMotorhomeIndex(families, motorhomes = [], resolve = motorhomeAssetPaths) {
  const totalPlans = families.reduce((n, f) => n + f.floorplanCount, 0);
  const heroBand = `<header class="hero-head">
<p class="eyebrow">AIRSTREAM TOURING COACHES · CLASS B</p>
<h1>Motorhomes — every touring coach</h1>
<p class="lede">A guide to Airstream's 2026–2027 Class B motorhome (touring coach) lineup — ${families.length} families, ${totalPlans} floorplans. Drive-away adventure with no tow vehicle needed.</p>
</header>`;
  // One section per family — the old /mf/ family pages, absorbed inline:
  // family title, intro, hero image, and its floorplan cards on one page.
  const sections = families
    .map((fam) => {
      const cards = [...fam.motorhomes]
        .sort((a, b) => a.msrp - b.msrp || `${a.model} ${a.floorplan}`.localeCompare(`${b.model} ${b.floorplan}`))
        .map((m) => renderMotorhomeCard(m, resolve, ''))
        .join('\n');
      const range = formatPriceRange(fam.priceMin, fam.priceMax);
      const len = formatLengthRange(fam.lengthMin, fam.lengthMax);
      const famOfficial = motorhomeOfficialUrl(fam.family);
      const intro = fam.motorhomes.length && fam.motorhomes[0].description
        ? fam.motorhomes[0].description.split('.')[0] + '.'
        : '';
      const famHero = fam.hero
        ? `<div class="mh-family-hero"><img src="${esc(fam.hero)}" ${heroImgAttrs(fam.hero)} alt="Airstream ${esc(fam.family)}" width="1280" height="720" loading="lazy"></div>`
        : '';
      return `<section class="mh-family" id="mf-${esc(fam.slug)}" aria-label="Airstream ${esc(fam.family)}">
${famHero}
<div class="mh-family-head">
<p class="eyebrow">TOURING COACH · ${esc(fam.years.join(' + '))}</p>
<h2>${esc(fam.family)}</h2>
${intro ? `<p class="mh-family-intro">${esc(intro)}</p>` : ''}
<p class="mh-family-meta">${esc(range)} · ${esc(len)} · ${esc(fam.floorplanCount)} floorplan${fam.floorplanCount === 1 ? '' : 's'} · sleeps up to ${esc(fam.sleepsMax)}</p>
${famOfficial ? `<p class="mh-family-official"><a class="official-link" href="${esc(famOfficial)}" target="_blank" rel="noopener">View ${esc(fam.family)} on airstream.com ↗</a></p>` : ''}
</div>
<div class="cards">
${cards}
</div>
</section>`;
    })
    .join('\n');
  const body = `${heroBand}
${sections}`;
  return page({
    title: 'Airstream Motorhomes — Class B touring coaches',
    description: `A catalog of Airstream Class B motorhomes (touring coaches, 2026–2027 model years): ${families.length} families, ${totalPlans} floorplans, with dimensions, weights, off-grid and pricing.`,
    body,
    active: 'motorhomes',
    canonicalPath: 'motorhomes.html',
  });
}


// ---------------------------------------------------------------------------
// MOTORHOME FAMILY: floorplans within one model
// ---------------------------------------------------------------------------

/** A floorplan card for motorhome family pages. */
export function renderMotorhomeCard(m, resolve = motorhomeAssetPaths, linkPrefix = '', hidden = false) {
  const a = resolve(m);
  return `<a class="card" href="${linkPrefix}mm/${esc(m.slug)}.html" data-year="${esc(m.year)}"${hidden ? ' hidden' : ''}>
<div class="card-media">
<img src="${linkPrefix}${esc(a.thumb)}" alt="${esc(trailerTitle(m))}" loading="lazy" width="400" height="260">
<span class="card-year">${esc(m.year)}</span>
</div>
<div class="card-body">
<h3 class="card-title">${esc(m.model)} <span>${esc(m.floorplan)}</span></h3>
<dl class="card-specs">
${specRow('Length', formatLength(m.lengthFt))}
${specRow('Base weight', formatWeight(m.weightLb))}
${specRow('MSRP', formatMsrp(m.msrp))}
</dl>
</div>
</a>`;
}

/** A motorhome family page: hero banner + the floorplans in that family. */
export function renderMotorhomeFamily(fam, resolve = motorhomeAssetPaths) {
  const hasBothYears = fam.years.length > 1;
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
  const cards = fam.motorhomes
    .map((m) => renderMotorhomeCard(m, resolve, '../', hasBothYears && m.year !== latest))
    .join('\n');
  const range = formatPriceRange(fam.priceMin, fam.priceMax);
  const len = formatLengthRange(fam.lengthMin, fam.lengthMax);
  const famOfficial = motorhomeOfficialUrl(fam.family);
  const shownCount = hasBothYears
    ? fam.motorhomes.filter((m) => m.year === latest).length
    : fam.motorhomes.length;
  const body = `<nav class="breadcrumb" aria-label="Breadcrumb"><ol class="breadcrumb-list"><li><a href="../index.html">Home</a></li><li><a href="../motorhomes.html">Touring coaches</a></li><li aria-current="page">${esc(fam.family)}</li></ol></nav>
<header class="fam-hero">
<img class="fam-hero-img" src="../${esc(fam.hero)}" ${fam.hero ? heroImgAttrs(fam.hero, '../') : ''} alt="Airstream ${esc(fam.family)}" width="1280" height="720" fetchpriority="high">
<div class="fam-hero-overlay">
<p class="eyebrow eyebrow-light">AIRSTREAM TOURING COACH ${esc(fam.years.join(' + '))}</p>
<h1>${esc(fam.family)}</h1>
<p class="fam-hero-meta">${esc(range)} · ${esc(len)} · ${esc(fam.floorplanCount)} floorplan${fam.floorplanCount === 1 ? '' : 's'} · sleeps up to ${esc(fam.sleepsMax)}</p>
${famOfficial ? `<p class="fam-hero-official"><a class="official-link official-link-light" href="${esc(famOfficial)}" target="_blank" rel="noopener">View ${esc(fam.family)} on airstream.com ↗</a></p>` : ''}
</div>
</header>
<section class="controls" aria-label="Filters">
${yearSeg}
<span class="count" id="result-count">${shownCount} floorplan${shownCount === 1 ? '' : 's'}</span>
</section>
<div class="cards" id="cards">
${cards}
</div>`;
  const mfBreadcrumbItems = [
    { name: 'Airstream Explorer', path: 'index.html' },
    { name: 'Touring coaches', path: 'motorhomes.html' },
    { name: `Airstream ${fam.family}`, path: `mf/${fam.slug}.html` },
  ];
  return page({
    title: `Airstream ${fam.family} — touring coach floorplans, specs & prices`,
    description: `Every Airstream ${fam.family} touring coach floorplan (${fam.years.join(' + ')}): ${range}, ${len}, sleeps up to ${fam.sleepsMax}. Compare ${fam.floorplanCount} floorplan${fam.floorplanCount === 1 ? '' : 's'} with full specs.`,
    body,
    relRoot: '../',
    active: 'motorhomes',
    canonicalPath: `mf/${fam.slug}.html`,
    ogImage: fam.hero || '',
    head: breadcrumbJsonLd(mfBreadcrumbItems) + (fam.hero ? '\n' + heroPreloadLink(fam.hero, '../') : ''),
  });
}

// ---------------------------------------------------------------------------
// MOTORHOME DETAIL: one floorplan
// ---------------------------------------------------------------------------

/** Off-grid endurance estimator for motorhomes (same as trailers). */
function renderMotorhomeOffGridTool(m) {
  if (!(m.batteryKwh > 0) || !(m.freshGal > 0)) return '';
  const def = estimateOffGrid(m, { people: 2, intensity: 'moderate', season: 'summer', useSolar: true });
  const intensityOpts = Object.entries(LOAD_PRESETS)
    .map(([k, v]) => `<option value="${esc(k)}"${k === 'moderate' ? ' selected' : ''}>${esc(v.label)} — ${esc(v.blurb)}</option>`)
    .join('');
  return `<section class="estimator offgrid-tool dsec" id="offgrid" aria-label="Off-grid endurance estimator"
 data-battery="${esc(m.batteryKwh)}" data-solar="${esc(m.solarW || 0)}" data-fresh="${esc(m.freshGal)}" data-gray="${esc(m.grayGal == null ? '' : m.grayGal)}" data-black="${esc(m.blackGal == null ? '' : m.blackGal)}">
<div class="est-head">
<h2 class="dsec-title">How long off-grid?</h2>
<p class="est-sub">Boondocking endurance for this motorhome — modeled from its real ${esc(m.batteryKwh)} kWh battery, ${m.solarW ? `${esc(m.solarW)} W solar` : 'no factory solar'}, and ${esc(m.freshGal)} gal fresh tank.</p>
</div>
<div class="est-controls">
<div class="est-field">
<label for="og-people">Campers</label>
<select id="og-people">
<option value="1">1 person</option>
<option value="2" selected>2 people</option>
<option value="3">3 people</option>
<option value="4">4 people</option>
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
<div class="est-result" id="og-result"
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
<p>Power: usable battery = nameplate kWh × 0.8 (blended depth-of-discharge). Daily load presets — light ≈ 1,500, moderate ≈ 2,800, heavy ≈ 5,000 Wh/day — from published boondocking power budgets, <strong>excluding air conditioning</strong> (no motorhome house battery runs rooftop AC for long). Solar harvest = panel watts × peak-sun-hours (summer 5.5, spring/fall 4.0, winter 2.5) × 0.7 system derate. Water: per-person daily use (light 3 / moderate 5 / heavy 8 gal fresh; gray ≈ 80% of fresh; black from toilet use) against the real tank sizes. Endurance is whichever runs out first. Estimates for planning — your real usage varies.</p>
</details>
</section>`;
}

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
// SECTION QUICK-NAV + RELATED for motorhome detail pages
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// HERO RESPONSIVE VARIANTS (perf #28). Every 1280x720 hero ships with -640 and
// -960 WebP variants (scripts/gen-hero-variants.sh). The build's fingerprint
// step rewrites every 'assets/img/...' tail in emitted HTML — srcset and
// preload included — so these canonical paths are safe to emit pre-build.
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

/** Build a plain-text spec summary for clipboard copy (motorhomes). */
function buildMotorhomeSpecText(m) {
  const lines = [
    `${trailerTitle(m)}`,
    `Length: ${formatLength(m.lengthFt)}`,
    m.heightFt ? `Height: ${formatLength(m.heightFt)}` : null,
    `Dry weight: ${formatWeight(m.weightLb)}`,
    `GVWR: ${formatWeight(m.gvwrLb)}`,
    m.gcwrLb ? `GCWR: ${formatWeight(m.gcwrLb)}` : null,
    `Sleeps: ${m.sleeps}`,
    `Tanks: ${formatTanks(m.freshGal, m.grayGal, m.blackGal)}`,
    m.solarW ? `Solar: ${m.solarW}W ${m.solarStandard ? '(standard)' : '(optional)'}` : null,
    m.batteryKwh ? `Battery: ${m.batteryKwh} kWh` : null,
    `Off-grid: ${offGridTier(m.offGridScore) || 'n/a'} (editorial composite ${m.offGridScore}/100)`,
    `MSRP: ${formatMsrp(m.msrp)}`,
  ].filter(Boolean);
  // Use || separator (split back to \n in client JS for clipboard copy)
  return lines.join(' || ');
}

function renderMotorhomeRelated(current, allMotorhomes, resolve) {
  if (!allMotorhomes.length) return '';
  let related = allMotorhomes.filter(
    (m) => m.model === current.model && m.slug !== current.slug && m.year === current.year,
  );
  if (related.length < 2) {
    const slugs = new Set(related.map((r) => r.slug));
    slugs.add(current.slug);
    allMotorhomes
      .filter((m) => !slugs.has(m.slug) && m.year === current.year)
      .map((m) => ({ m, dist: Math.abs(m.weightLb - current.weightLb) + Math.abs(m.msrp - current.msrp) / 100 }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 4 - related.length)
      .forEach(({ m }) => related.push(m));
  }
  related = related.slice(0, 4);
  if (!related.length) return '';
  const cards = related.map((m) => {
    const a = resolve(m);
    return `<a class="rel-card" href="${esc(m.slug)}.html">
<div class="rel-media"><img src="../${esc(a.thumb)}" alt="${esc(trailerTitle(m))}" loading="lazy" width="400" height="260"></div>
<div class="rel-body">
<p class="rel-title">${esc(m.model)} <span>${esc(m.floorplan)}</span></p>
<p class="rel-specs">${esc(formatLength(m.lengthFt))} · ${esc(formatWeight(m.weightLb))} · ${esc(formatMsrp(m.msrp))}</p>
</div>
</a>`;
  }).join('\n');
  const heading = related.every((r) => r.model === current.model)
    ? `More ${esc(current.model)} floorplans`
    : 'Explore similar motorhomes';
  return `<section class="dsec related" aria-label="Related motorhomes">
<h2 class="dsec-title">${heading}</h2>
<div class="related-grid">${cards}</div>
</section>`;
}

/** A single motorhome detail page. */
export function renderMotorhomeDetail(m, resolve = motorhomeAssetPaths, allMotorhomes = []) {
  const a = resolve(m);
  const fam = motorhomeFamilySlug(m.model);
  const official = motorhomeOfficialUrlBySlug(m.slug, m.model);
  const heroImg = a.hero
    ? `<img src="../${esc(a.hero)}" ${heroImgAttrs(a.hero, '../')} alt="${esc(trailerTitle(m))}" class="detail-hero-img" width="1280" height="720" fetchpriority="high">`
    : '';
  const galleryCount = a.gallery.length;
  const gallery = a.gallery
    .map(
      (g, i) =>
        `<button type="button" class="gallery-img-wrap${a.galleryCutout && a.galleryCutout[i] ? ' is-cutout' : ' is-photo'}" data-lightbox data-lb-group="gallery" data-full="../${esc(g)}" data-index="${i}" data-caption="${esc(trailerLabel(m))} — photo ${i + 1} of ${galleryCount}" aria-label="Open photo ${i + 1} of ${galleryCount} full screen"><img src="../${esc(g)}" alt="${esc(a.galleryCutout && a.galleryCutout[i] ? trailerLabel(m) + ' — studio exterior view' : trailerLabel(m) + ' — gallery photo ' + (i + 1) + ' of ' + galleryCount)}" loading="lazy" class="gallery-img${a.galleryCutout && a.galleryCutout[i] ? ' gallery-img--cutout' : ' gallery-img--photo'}" width="920" height="600"><span class="gallery-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></span></button>`,
    )
    .join('\n');
  const pros = (m.pros || []).map((p) => `<li>${esc(p)}</li>`).join('');
  const cons = (m.cons || []).map((c) => `<li>${esc(c)}</li>`).join('');
  const relatedSection = renderMotorhomeRelated(m, allMotorhomes, resolve);
  const mmBreadcrumbItems = [
    { name: 'Airstream Explorer', path: 'index.html' },
    { name: 'Touring coaches', path: 'motorhomes.html' },
    { name: m.model, path: `mf/${fam}.html` },
    { name: `${m.model} ${m.floorplan}`, path: `mm/${m.slug}.html` },
  ];
  const mmBreadcrumbHtml = `<nav class="breadcrumb" aria-label="Breadcrumb"><ol class="breadcrumb-list">`
    + `<li><a href="../index.html">Home</a></li>`
    + `<li><a href="../motorhomes.html">Touring coaches</a></li>`
    + `<li><a href="../mf/${esc(fam)}.html">${esc(m.model)}</a></li>`
    + `<li aria-current="page">${esc(m.floorplan)}</li>`
    + `</ol></nav>`;
  const body = `${mmBreadcrumbHtml}
<article class="detail" data-canonical="mm/${esc(m.slug)}.html" data-spec-text="${esc(buildMotorhomeSpecText(m))}">
<header class="detail-head">
<p class="eyebrow">${esc(m.year)} MODEL YEAR · CLASS ${esc(m.classType || 'B')} MOTORHOME</p>
<div class="detail-head-row">
<h1>${esc(m.model)} <span>${esc(m.floorplan)}</span></h1>
${saveButton(m.slug, 'motorhome', trailerLabel(m), 'detail')}
</div>
<div class="detail-actions" data-share-actions>
<button type="button" class="share-btn" id="detail-share" aria-label="Share this page" title="Share this page"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg> Share</button>
<button type="button" class="share-btn" id="detail-compare" data-compare-slug="${esc(m.slug)}" data-compare-type="motorhome" aria-label="Add to comparison" title="Add to comparison"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg> Compare</button>
</div>
${official ? `<p class="official-head"><a class="official-link" href="${esc(official)}" target="_blank" rel="noopener">Official ${esc(m.model)} page on airstream.com ↗</a></p>` : ''}
</header>
<div class="detail-hero"><span class="detail-hero-shade" aria-hidden="true"></span>${heroImg}</div>
${renderMotorhomeKeyStats(m)}
<p class="detail-desc">${esc(m.description)}</p>
<section class="dsec spec-table" id="specs" aria-label="Specifications">
<h2 class="dsec-title">Specifications</h2>
<dl class="specs-grid">
${specRow('Length', formatLength(m.lengthFt))}
${m.heightFt ? specRow('Height', formatLength(m.heightFt)) : ''}
${specRow('Base weight', formatWeight(m.weightLb))}
${specRow('GVWR', formatWeight(m.gvwrLb))}
${specRow('Net Carrying Capacity (NCC)', formatWeight(m.nccLb))}
${m.towCapacityLb ? specRow('Tow capacity', formatWeight(m.towCapacityLb)) : ''}
${specRow('Chassis', m.chassis)}
${specRow('Engine', m.engine)}
${m.horsepower ? specRow('Horsepower', `${m.horsepower} hp`) : ''}
${m.torqueLbFt ? specRow('Torque', `${m.torqueLbFt} lb-ft`) : ''}
${specRow('Drivetrain', m.drivetrain || 'n/a')}
${specRow('Fuel type', m.fuelType || 'n/a')}
${m.transmission ? specRow('Transmission', m.transmission) : ''}
${specRow('Sleeps', String(m.sleeps))}
${m.seats ? specRow('Seats', String(m.seats)) : ''}
${specRow('Fresh / gray / black', mna(formatTanks(m.freshGal, m.grayGal, m.blackGal)))}
${m.fuelTankGal ? specRow('Fuel tank', `${m.fuelTankGal} gal`) : ''}
${specRow('Solar', m.solarW ? `${m.solarW} W ${m.solarStandard ? '(standard)' : '(optional)'}` : 'n/a')}
${specRow('Battery', m.batteryKwh ? `${m.batteryKwh} kWh` : 'n/a')}
${m.inverterW ? specRow('Inverter', `${m.inverterW} W`) : ''}
${m.shorePowerAmp ? specRow('Shore power', `${m.shorePowerAmp} A`) : ''}
${specRow('Off-grid score', offGridTier(m.offGridScore) || 'n/a')}
${specRow('MSRP', formatMsrp(m.msrp))}
</dl>
</section>
${renderMotorhomeWeightBar(m)}
${renderMotorhomeOffGridTool(m)}
${pros || cons ? `<section class="dsec proscons">
${pros ? `<div class="pros"><h3 class="dsec-sub">Strengths</h3><ul>${pros}</ul></div>` : ''}
${cons ? `<div class="cons"><h3 class="dsec-sub">Trade-offs</h3><ul>${cons}</ul></div>` : ''}
</section>` : ''}
${gallery ? `<section class="dsec gallery" id="gallery" aria-label="Gallery"><h2 class="dsec-title">Gallery</h2><div class="gallery-grid" data-gallery>${gallery}</div></section>` : ''}
${relatedSection}
</article>`;
  return page({
    title: `${trailerTitle(m)} - specs, weight & price`,
    description: `${trailerTitle(m)}: ${formatLength(m.lengthFt)}, ${formatWeight(m.weightLb)} base, sleeps ${m.sleeps}, ${formatMsrp(m.msrp)}. Full specs, tanks, off-grid and gallery.`,
    body,
    relRoot: '../',
    active: 'motorhomes',
    canonicalPath: `mm/${m.slug}.html`,
    ogImage: a.hero || '',
    ogType: 'product',
    head: productJsonLd({
      name: trailerTitle(m),
      description: `${trailerTitle(m)}: ${formatLength(m.lengthFt)}, ${formatWeight(m.weightLb)} base, sleeps ${m.sleeps}, ${formatMsrp(m.msrp)}.`,
      imagePath: a.hero || '',
      canonicalPath: `mm/${m.slug}.html`,
      category: 'Class B Motorhome',
      msrp: m.msrp,
    }) + '\n' + breadcrumbJsonLd(mmBreadcrumbItems) + (a.hero ? '\n' + heroPreloadLink(a.hero, '../') : ''),
  });
}

// ---------------------------------------------------------------------------
// EXPLORE CARD: for motorhome grid
// ---------------------------------------------------------------------------

/**
 * One explore-grid card for motorhomes. Carries data-* attributes for
 * client-side filtering/sorting.
 */
/**
 * One motorhome card for the Explore grid. Editorial entry matching the
 * trailer card: big photo, title, description lede, three numbers
 * (GVWR / length / MSRP), and a small Save · Compare action row. Carries the
 * same data-* contract as the trailer card so filters, sort, quick-view, CSV
 * export and compare work across both types. Exported for tests; production
 * grids render client-side from the JSON payload (see exploreCardData).
 */
export function renderMotorhomeExploreCard(m, resolve = motorhomeAssetPaths, hidden = false) {
  const a = resolve(m);
  const tags = (m.tags || []).join(' ');
  const galleryUrls = a.gallery && a.gallery.length ? a.gallery.slice(0, 6).join('|') : '';
  const lede = (m.description || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');
  const gvwr = m.gvwrLb > 0 ? formatWeight(m.gvwrLb) : 'n/a';
  const len = m.lengthFt > 0 ? formatLength(m.lengthFt) : 'n/a';
  const msrp = m.msrp > 0 ? formatMsrp(m.msrp) : 'n/a';
  return `<article class="xcard" data-slug="${esc(m.slug)}" data-type="motorhome" data-model="${esc(m.model)}" data-floorplan="${esc(m.floorplan)}" data-year="${esc(m.year)}" data-msrp="${esc(m.msrp)}" data-weight="${esc(m.weightLb)}" data-gvwr="${esc(m.gvwrLb)}" data-length="${esc(m.lengthFt)}" data-sleeps="${esc(m.sleeps)}" data-offgrid="${esc(m.offGridScore)}" data-tags="${esc(tags)}" data-layout="" data-name="${esc((m.model + ' ' + m.floorplan).toLowerCase())}" data-ccc="${esc(m.nccLb || '')}" data-fresh="${esc(m.freshGal || '')}" data-gray="${esc(m.grayGal == null ? '' : m.grayGal)}" data-black="${esc(m.blackGal == null ? '' : m.blackGal)}" data-solar="${esc(m.solarW || '')}" data-hitch="" data-axle="" data-desc="${esc(m.description || '')}" data-thumb="${esc(a.thumb || '')}" data-gallery-urls="${esc(galleryUrls)}"${hidden ? ' hidden' : ''}>
<a class="xcard-link" href="mm/${esc(m.slug)}.html">
<div class="xcard-media">
<img src="${esc(a.thumb)}" alt="${esc(trailerTitle(m))}" loading="lazy" width="400" height="260">
${a.gallery && a.gallery.length ? `<span class="xcard-photos" aria-label="${a.gallery.length} photos"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> ${a.gallery.length}</span>` : ''}
<button type="button" class="xcard-peek" data-peek aria-label="Quick view ${esc(trailerLabel(m))}" title="Quick view"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
</div>
<div class="xcard-body">
<h3 class="xcard-title">${esc(m.model)} <span>${esc(m.floorplan)}</span></h3>
${lede ? `<p class="xcard-lede">${esc(lede)}</p>` : ''}
<dl class="xcard-specs">
${specRow('GVWR', gvwr, { unit: 'weight', raw: m.gvwrLb })}
${specRow('Length', len, { unit: 'length', raw: m.lengthFt })}
${specRow('MSRP', msrp)}
</dl>
</div>
</a>
<div class="xcard-foot">
<span class="xcard-fit" data-fit hidden></span>
<div class="xcard-foot-actions">
${saveButton(m.slug, 'motorhome', trailerLabel(m), 'card')}
<label class="xcard-compare"><input type="checkbox" class="cmp-box" data-slug="${esc(m.slug)}" data-type="motorhome" aria-label="Add ${esc(trailerLabel(m))} to compare"> Compare</label>
</div>
</div>
</article>`;
}
