// Motorhome HTML rendering — pure functions returning strings. No DOM, no I/O.
// Mirrors render.mjs patterns for trailers, adapted for Class B motorhomes.

import {
  formatMsrp, formatWeight, formatLength, formatGal, formatTanks,
  formatPriceRange, formatLengthRange, formatMsrpShort,
  trailerTitle, trailerLabel,
} from './format.mjs';
import { motorhomeAssetPaths, motorhomeFamilySlug, motorhomeOfficialUrl } from './motorhome-data.mjs';
import { catalogStats } from './data.mjs';
import { socialMeta, productJsonLd } from './seo.mjs';
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

// Navigation items — same as trailer pages but with Motorhomes added.
const NAV_ITEMS = [
  ['index.html', 'Explore', 'index'],
  ['motorhomes.html', 'Motorhomes', 'motorhomes'],
  ['campsites.html', 'Campsites', 'campsites'],
  ['upgrades.html', 'Upgrades', 'upgrades'],
];

function page({ title, description, body, relRoot = '', head = '', scripts = '', active = '', canonicalPath = '', ogImage = '', ogType = 'website' }) {
  const _stats = catalogStats();
  const navLinks = NAV_ITEMS.map(([href, label, key]) => {
    const on = key === active;
    return `<a href="${relRoot}${href}"${on ? ' class="is-active" aria-current="page"' : ''}>${label}</a>`;
  }).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${socialMeta({ title, description, canonicalPath, imagePath: ogImage, type: ogType })}
<link rel="stylesheet" href="${relRoot}assets/css/fonts.css">
<link rel="stylesheet" href="${relRoot}assets/css/site.css">
<link rel="stylesheet" href="${relRoot}assets/css/controls.css">
<link rel="stylesheet" href="${relRoot}assets/css/premium.css">
${head}</head>
<body>
<header class="topnav">
<a class="brandbar" href="${relRoot}index.html"><span class="brandbar-mark">▲</span> Airstream Explorer</a>
<nav class="topnav-links" aria-label="Primary">
${navLinks}
</nav>
</header>
${body}
<footer class="site-footer">
<p>Airstream Explorer · enthusiast catalog · ${_stats.floorplanCount} floorplans across ${_stats.familyCount} families (2026 + 2025). · <a href="${relRoot}index.html#all">Explore &amp; match</a> · <a href="${relRoot}motorhomes.html">Motorhomes</a> · <a href="${relRoot}compare.html">Compare</a> · <a href="${relRoot}campsites.html">Campsites</a> · <a href="${relRoot}upgrades.html">Upgrades</a> · <a href="${relRoot}community.html">Community photos</a> · <a href="${relRoot}credits.html">Credits</a></p>
<p class="muted">Independent reference. Not affiliated with Airstream, Inc. Specs compiled from published sources; verify with a dealer before purchase. Some imagery is AI-generated and labeled accordingly; community photographs are real and used under their stated Creative Commons / public-domain licenses (see credits).</p>
</footer>
<script src="${relRoot}assets/js/app.js" defer></script>
${scripts}</body>
</html>`;
}

function specRow(label, value) {
  return `<div class="spec"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
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
  const body = `<nav class="detail-nav"><a href="../motorhomes.html" class="back-link">← All touring coaches</a></nav>
<header class="fam-hero">
<img class="fam-hero-img" src="../${esc(fam.hero)}" alt="Airstream ${esc(fam.family)}" width="1280" height="720">
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
  return page({
    title: `Airstream ${fam.family} — touring coach floorplans, specs & prices`,
    description: `Every Airstream ${fam.family} touring coach floorplan (${fam.years.join(' + ')}): ${range}, ${len}, sleeps up to ${fam.sleepsMax}. Compare ${fam.floorplanCount} floorplan${fam.floorplanCount === 1 ? '' : 's'} with full specs.`,
    body,
    relRoot: '../',
    active: 'motorhomes',
    canonicalPath: `mf/${fam.slug}.html`,
    ogImage: fam.hero || '',
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
  return `<section class="estimator offgrid-tool" aria-label="Off-grid endurance estimator"
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

/** A single motorhome detail page. */
export function renderMotorhomeDetail(m, resolve = motorhomeAssetPaths) {
  const a = resolve(m);
  const fam = motorhomeFamilySlug(m.model);
  const official = motorhomeOfficialUrl(m.model);
  const heroImg = a.hero
    ? `<img src="../${esc(a.hero)}" alt="${esc(trailerTitle(m))}" class="detail-hero-img" width="1280" height="720">`
    : '';
  const gallery = a.gallery
    .map(
      (g, i) =>
        `<div class="gallery-img-wrap"><img src="../${esc(g)}" alt="${esc(trailerLabel(m))} photo ${i + 1}" loading="lazy" class="gallery-img" width="920" height="600"></div>`,
    )
    .join('\n');
  const pros = (m.pros || []).map((p) => `<li>${esc(p)}</li>`).join('');
  const cons = (m.cons || []).map((c) => `<li>${esc(c)}</li>`).join('');
  const body = `<nav class="detail-nav"><a href="../mf/${esc(fam)}.html" class="back-link">← All ${esc(m.model)} floorplans</a></nav>
<article class="detail">
<header class="detail-head">
<p class="eyebrow">${esc(m.year)} MODEL YEAR · CLASS ${esc(m.classType || 'B')} MOTORHOME</p>
<h1>${esc(m.model)} <span>${esc(m.floorplan)}</span></h1>
${tagChips(m.tags)}
${official ? `<p class="official-head"><a class="official-link" href="${esc(official)}" target="_blank" rel="noopener">Official ${esc(m.model)} page on airstream.com ↗</a></p>` : ''}
</header>
<div class="detail-hero">${heroImg}</div>
<p class="detail-desc">${esc(m.description)}</p>
<section class="spec-table" aria-label="Specifications">
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
${renderMotorhomeOffGridTool(m)}
${pros || cons ? `<section class="proscons">
${pros ? `<div class="pros"><h3>Strengths</h3><ul>${pros}</ul></div>` : ''}
${cons ? `<div class="cons"><h3>Trade-offs</h3><ul>${cons}</ul></div>` : ''}
</section>` : ''}
${gallery ? `<section class="gallery" aria-label="Gallery"><h2>Gallery</h2><div class="gallery-grid">${gallery}</div></section>` : ''}
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
    }),
  });
}

// ---------------------------------------------------------------------------
// EXPLORE CARD: for motorhome grid
// ---------------------------------------------------------------------------

/**
 * One explore-grid card for motorhomes. Carries data-* attributes for
 * client-side filtering/sorting.
 */
export function renderMotorhomeExploreCard(m, resolve = motorhomeAssetPaths, hidden = false) {
  const a = resolve(m);
  const tags = (m.tags || []).join(' ');
  return `<article class="xcard" data-slug="${esc(m.slug)}" data-type="motorhome" data-model="${esc(m.model)}" data-floorplan="${esc(m.floorplan)}" data-year="${esc(m.year)}" data-msrp="${esc(m.msrp)}" data-weight="${esc(m.weightLb)}" data-gvwr="${esc(m.gvwrLb)}" data-length="${esc(m.lengthFt)}" data-sleeps="${esc(m.sleeps)}" data-offgrid="${esc(m.offGridScore)}" data-tags="${esc(tags)}" data-name="${esc((m.model + ' ' + m.floorplan).toLowerCase())}"${hidden ? ' hidden' : ''}>
<a class="xcard-link" href="mm/${esc(m.slug)}.html">
<div class="xcard-media">
<img src="${esc(a.thumb)}" alt="${esc(trailerTitle(m))}" loading="lazy" width="400" height="260">
<span class="xcard-year">${esc(m.year)}</span>
</div>
<div class="xcard-body">
<h3 class="xcard-title">${esc(m.model)} <span>${esc(m.floorplan)}</span></h3>
<dl class="xcard-specs">
${specRow('Length', formatLength(m.lengthFt))}
${specRow('Base weight', formatWeight(m.weightLb))}
${specRow('Sleeps', String(m.sleeps))}
${specRow('MSRP', formatMsrp(m.msrp))}
</dl>
</div>
</a>
<div class="xcard-foot">
<span class="xcard-fit" data-fit hidden></span>
<label class="xcard-compare"><input type="checkbox" class="cmp-box" data-slug="${esc(m.slug)}" data-type="motorhome" aria-label="Add ${esc(trailerLabel(m))} to compare"> Compare</label>
</div>
</article>`;
}
