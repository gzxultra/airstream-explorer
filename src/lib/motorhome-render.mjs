// Motorhome HTML rendering — pure functions returning strings. No DOM, no I/O.
// Mirrors render.mjs patterns for trailers, adapted for Class B motorhomes.

import {
  formatMsrp, formatWeight, formatLength, formatGal, formatTanks,
  formatPriceRange, formatLengthRange, formatMsrpShort,
  trailerTitle, trailerLabel, saveButton,
} from './format.mjs';
import { motorhomeAssetPaths, motorhomeFamilySlug, motorhomeOfficialUrl, motorhomeOfficialUrlBySlug } from './motorhome-data.mjs';
import { catalogStats, rangePosition, towClass, waterAutonomy } from './data.mjs';
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

// Navigation items — unified Explore hub (motorhomes live inside Explore now).
const NAV_ITEMS = [
  ['index.html', 'Explore', 'index'],
  ['saved.html', 'Saved', 'saved'],
  ['campsites.html', 'Campsites', 'campsites'],
  ['upgrades.html', 'Upgrades', 'upgrades'],
  ['maintenance.html', 'Maintenance', 'maintenance'],
];

function page({ title, description, body, relRoot = '', head = '', scripts = '', active = '', canonicalPath = '', ogImage = '', ogType = 'website' }) {
  const _stats = catalogStats();
  const navLinks = NAV_ITEMS.map(([href, label, key]) => {
    const on = key === active;
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

function specRow(label, value) {
  return `<div class="spec"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

/** Tiny inline range bar showing where a value sits in the fleet range. */
function renderRangeBar(value, range, label) {
  const pos = rangePosition(value, range);
  if (pos == null) return '';
  return `<span class="range-bar" aria-label="${esc(label)}: ${pos}th percentile in lineup" title="${esc(label)}: ${pos}th percentile"><span class="range-bar-track"><span class="range-bar-fill" style="width:${pos}%"></span></span></span>`;
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

/** Render the key-stats dashboard below the motorhome detail hero. */
function renderMotorhomeKeyStats(m) {
  const days = waterAutonomy(m.freshGal);
  const stats = [
    { icon: '📐', value: formatLength(m.lengthFt), label: 'Length' },
    { icon: '⚖️', value: formatWeight(m.weightLb), label: 'Base weight' },
    { icon: '🛏️', value: String(m.sleeps), label: 'Sleeps' },
    { icon: '💰', value: formatMsrpShort(m.msrp), label: 'Base MSRP' },
    m.offGridScore ? { icon: '🔋', value: `${m.offGridScore}/100`, label: 'Off-grid' } : null,
    days ? { icon: '💧', value: `~${days}`, label: 'Water days (2 ppl)' } : null,
  ].filter(Boolean);
  return `<div class="key-stats" aria-label="Key specifications at a glance">${stats.map((s) =>
    `<div class="key-stat"><span class="key-stat-icon" aria-hidden="true">${s.icon}</span><span class="key-stat-value">${esc(s.value)}</span><span class="key-stat-label">${esc(s.label)}</span></div>`
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
  return `<a class="fam" href="${linkPrefix}mf/${esc(fam.slug)}.html" data-family="${esc(fam.family)}">
<div class="fam-media">
<img src="${linkPrefix}${esc(fam.hero)}" alt="Airstream ${esc(fam.family)}" loading="lazy" width="800" height="500">
<span class="fam-plans">${esc(plans)}</span>
</div>
<div class="fam-body">
<h2 class="fam-name">${esc(fam.family)}</h2>
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
  const cards = families.map((f) => renderMotorhomeFamilyCard(f, '')).join('\n');
  const totalPlans = families.reduce((n, f) => n + f.floorplanCount, 0);
  const heroBand = `<header class="hero-head">
<p class="eyebrow">AIRSTREAM TOURING COACHES · CLASS B</p>
<h1>Motorhomes — every touring coach</h1>
<p class="lede">A spec-accurate guide to the current Airstream Class B motorhome lineup — ${families.length} families, ${totalPlans} floorplans. Drive-away adventure with no tow vehicle needed.</p>
</header>`;
  // Explore cards for all motorhomes
  const ordered = [...motorhomes].sort(
    (a, b) => a.msrp - b.msrp || `${a.model} ${a.floorplan}`.localeCompare(`${b.model} ${b.floorplan}`),
  );
  const exploreCards = ordered.map((m) => renderMotorhomeExploreCard(m, resolve)).join('\n');
  // motorhomes.html is now an entry point INTO the unified Explore hub: with JS
  // it bounces to index.html#all&type=motorhome (Explore pre-filtered to
  // motorhomes). Without JS the full motorhome catalog below still renders, so
  // the nav link / old bookmarks never dead-end. Same shim mechanism as the
  // legacy explore.html redirect.
  const body = `<div class="explore-shim" data-redirect="index.html#all&type=motorhome">
<p class="explore-shim-note"><a href="index.html#all&type=motorhome">Motorhomes now live in the unified Explore hub →</a></p>
</div>
${heroBand}
<main class="fam-grid" id="families">
${cards}
</main>
<section class="explore-head" id="all-motorhomes">
<h2>All ${motorhomes.length} touring coach floorplans</h2>
<p class="lede">Every motorhome by the numbers — compare specs, off-grid capability, and pricing.</p>
</section>
<main class="xgrid" id="xgrid">
${exploreCards}
</main>`;
  return page({
    title: 'Airstream Motorhomes — Class B touring coaches',
    description: `A spec-accurate catalog of every current Airstream Class B motorhome (touring coach): ${families.length} families, ${totalPlans} floorplans, with dimensions, weights, off-grid and pricing.`,
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
<img class="fam-hero-img" src="../${esc(fam.hero)}" alt="Airstream ${esc(fam.family)}" width="1280" height="720" fetchpriority="high">
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
<main class="cards" id="cards">
${cards}
</main>`;
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
    head: breadcrumbJsonLd(mfBreadcrumbItems),
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
  return `<section class="estimator offgrid-tool" id="offgrid" aria-label="Off-grid endurance estimator"
 data-battery="${esc(m.batteryKwh)}" data-solar="${esc(m.solarW || 0)}" data-fresh="${esc(m.freshGal)}" data-gray="${esc(m.grayGal == null ? '' : m.grayGal)}" data-black="${esc(m.blackGal == null ? '' : m.blackGal)}">
<div class="est-head">
<h2>How long off-grid?</h2>
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
function buildMotorhomeSectionNav(galleryCount) {
  const items = [
    ['#specs', 'Specs'],
    ['#offgrid', 'Off-grid'],
    galleryCount ? ['#gallery', 'Gallery'] : null,
  ].filter(Boolean);
  if (items.length < 2) return '';
  const links = items.map(([href, label]) =>
    `<a href="${href}" class="secnav-link">${esc(label)}</a>`).join('');
  return `<nav class="secnav" aria-label="Page sections" data-secnav>${links}</nav>`;
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
    `Off-grid score: ${m.offGridScore}/100`,
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
  return `<section class="related" aria-label="Related motorhomes">
<h2>${heading}</h2>
<div class="related-grid">${cards}</div>
</section>`;
}

/** A single motorhome detail page. */
export function renderMotorhomeDetail(m, resolve = motorhomeAssetPaths, allMotorhomes = []) {
  const a = resolve(m);
  const fam = motorhomeFamilySlug(m.model);
  const official = motorhomeOfficialUrlBySlug(m.slug, m.model);
  const heroImg = a.hero
    ? `<img src="../${esc(a.hero)}" alt="${esc(trailerTitle(m))}" class="detail-hero-img" width="1280" height="720" fetchpriority="high">`
    : '';
  const galleryCount = a.gallery.length;
  const gallery = a.gallery
    .map(
      (g, i) =>
        `<button type="button" class="gallery-img-wrap${a.galleryCutout && a.galleryCutout[i] ? ' is-cutout' : ' is-photo'}" data-lightbox data-full="../${esc(g)}" data-index="${i}" data-caption="${esc(trailerLabel(m))} — photo ${i + 1} of ${galleryCount}" aria-label="Open photo ${i + 1} of ${galleryCount} full screen"><img src="../${esc(g)}" alt="${esc(trailerLabel(m))} photo ${i + 1}" loading="lazy" class="gallery-img${a.galleryCutout && a.galleryCutout[i] ? ' gallery-img--cutout' : ' gallery-img--photo'}" width="920" height="600"><span class="gallery-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></span></button>`,
    )
    .join('\n');
  const pros = (m.pros || []).map((p) => `<li>${esc(p)}</li>`).join('');
  const cons = (m.cons || []).map((c) => `<li>${esc(c)}</li>`).join('');
  // Section quick-nav
  const sectionNav = buildMotorhomeSectionNav(galleryCount);
  // Related motorhomes
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
  const body = `<div class="reading-progress" id="reading-progress" aria-hidden="true"></div>
${mmBreadcrumbHtml}
${sectionNav}
<article class="detail" data-canonical="mm/${esc(m.slug)}.html" data-spec-text="${esc(buildMotorhomeSpecText(m))}">
<header class="detail-head">
<p class="eyebrow">${esc(m.year)} MODEL YEAR · CLASS ${esc(m.classType || 'B')} MOTORHOME</p>
<div class="detail-head-row">
<h1>${esc(m.model)} <span>${esc(m.floorplan)}</span></h1>
${saveButton(m.slug, 'motorhome', trailerLabel(m), 'detail')}
</div>
${tagChips(m.tags)}
<div class="share-actions" data-share-actions>
<button type="button" class="share-btn" id="detail-share" aria-label="Share this page" title="Share this page"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg> Share</button>
<button type="button" class="share-btn" id="detail-copy-specs" aria-label="Copy specs to clipboard" title="Copy specs to clipboard"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg> Copy specs</button>
<button type="button" class="share-btn" id="detail-print" aria-label="Print spec sheet" title="Print spec sheet"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> Print</button>
</div>
${official ? `<p class="official-head"><a class="official-link" href="${esc(official)}" target="_blank" rel="noopener">Official ${esc(m.model)} page on airstream.com ↗</a></p>` : ''}
</header>
<div class="detail-hero">${heroImg}</div>
${renderMotorhomeKeyStats(m)}
<p class="detail-desc">${esc(m.description)}</p>
<section class="spec-table" id="specs" aria-label="Specifications">
<h2>Specifications</h2>
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
${specRow('Drivetrain', m.drivetrain || '—')}
${specRow('Fuel type', m.fuelType || '—')}
${m.transmission ? specRow('Transmission', m.transmission) : ''}
${specRow('Sleeps', String(m.sleeps))}
${m.seats ? specRow('Seats', String(m.seats)) : ''}
${specRow('Fresh / gray / black', formatTanks(m.freshGal, m.grayGal, m.blackGal))}
${m.fuelTankGal ? specRow('Fuel tank', `${m.fuelTankGal} gal`) : ''}
${specRow('Solar', m.solarW ? `${m.solarW} W ${m.solarStandard ? '(standard)' : '(optional)'}` : '—')}
${specRow('Battery', m.batteryKwh ? `${m.batteryKwh} kWh` : '—')}
${m.inverterW ? specRow('Inverter', `${m.inverterW} W`) : ''}
${m.shorePowerAmp ? specRow('Shore power', `${m.shorePowerAmp} A`) : ''}
${specRow('Off-grid score', `${m.offGridScore} / 100`)}
${specRow('MSRP', formatMsrp(m.msrp))}
</dl>
</section>
${renderMotorhomeWeightBar(m)}
${renderMotorhomeOffGridTool(m)}
${pros || cons ? `<section class="proscons">
${pros ? `<div class="pros"><h3>Strengths</h3><ul>${pros}</ul></div>` : ''}
${cons ? `<div class="cons"><h3>Trade-offs</h3><ul>${cons}</ul></div>` : ''}
</section>` : ''}
${gallery ? `<section class="gallery" id="gallery" aria-label="Gallery"><h2>Gallery</h2><div class="gallery-grid" data-gallery>${gallery}</div></section>` : ''}
${relatedSection}
</article>`;
  return page({
    title: `${trailerTitle(m)} — specs, weight & price`,
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
    }) + '\n' + breadcrumbJsonLd(mmBreadcrumbItems),
  });
}

// ---------------------------------------------------------------------------
// EXPLORE CARD: for motorhome grid
// ---------------------------------------------------------------------------

/**
 * One explore-grid card for motorhomes. Carries data-* attributes for
 * client-side filtering/sorting.
 */
export function renderMotorhomeExploreCard(m, resolve = motorhomeAssetPaths, hidden = false, ranges = {}) {
  const a = resolve(m);
  const tags = (m.tags || []).join(' ');
  return `<article class="xcard" data-slug="${esc(m.slug)}" data-type="motorhome" data-model="${esc(m.model)}" data-floorplan="${esc(m.floorplan)}" data-year="${esc(m.year)}" data-msrp="${esc(m.msrp)}" data-weight="${esc(m.weightLb)}" data-gvwr="${esc(m.gvwrLb)}" data-length="${esc(m.lengthFt)}" data-sleeps="${esc(m.sleeps)}" data-offgrid="${esc(m.offGridScore)}" data-tags="${esc(tags)}" data-name="${esc((m.model + ' ' + m.floorplan).toLowerCase())}"${hidden ? ' hidden' : ''}>
<a class="xcard-link" href="mm/${esc(m.slug)}.html">
<div class="xcard-media">
<img src="${esc(a.thumb)}" alt="${esc(trailerTitle(m))}" loading="lazy" width="400" height="260">
<span class="xcard-year">${esc(m.year)}</span>
${a.gallery && a.gallery.length ? `<span class="xcard-photos" aria-label="${a.gallery.length} photos"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> ${a.gallery.length}</span>` : ''}
</div>
<div class="xcard-body">
<h3 class="xcard-title">${esc(m.model)} <span>${esc(m.floorplan)}</span></h3>
<dl class="xcard-specs">
${specRow('Length', formatLength(m.lengthFt))}${renderRangeBar(m.lengthFt, ranges.lengthFt, 'Length')}
${specRow('Base weight', formatWeight(m.weightLb))}${renderRangeBar(m.weightLb, ranges.weightLb, 'Base weight')}
${specRow('Sleeps', String(m.sleeps))}
${specRow('MSRP', formatMsrp(m.msrp))}${renderRangeBar(m.msrp, ranges.msrp, 'MSRP')}
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
