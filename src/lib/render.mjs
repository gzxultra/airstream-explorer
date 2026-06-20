// HTML rendering — pure functions returning strings. No DOM, no I/O.
// All dynamic text goes through esc() to stay XSS/CSP-safe.

import {
  formatMsrp, formatWeight, formatLength, formatGal, formatTanks,
  formatPriceRange, formatLengthRange, formatMsrpShort,
  hitchPctOfGvwr,
  trailerTitle, trailerLabel,
} from './format.mjs';
import { assetPaths, familySlug, officialUrl, catalogStats } from './data.mjs';
import { motorhomeAssetPaths } from './motorhome-data.mjs';
import { renderMotorhomeExploreCard, renderMotorhomeFamilyCard } from './motorhome-render.mjs';
import { socialMeta, productJsonLd } from './seo.mjs';
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
  ['campsites.html', 'Campsites', 'campsites'],
  ['upgrades.html', 'Upgrades', 'upgrades'],
  ['maintenance.html', 'Maintenance', 'maintenance'],
];

export function page({ title, description, body, relRoot = '', head = '', scripts = '', active = '', canonicalPath = '', ogImage = '', ogType = 'website' }) {
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
<meta name="view-transition" content="same-origin">
${head}</head>
<body>
<a class="skip-link" href="#main-content">Skip to content</a>
<header class="topnav">
<a class="brandbar" href="${relRoot}index.html"><span class="brandbar-mark">▲</span> Airstream Explorer</a>
<nav class="topnav-links" aria-label="Primary">
${navLinks}
</nav>
</header>
<a id="main-content" tabindex="-1"></a>
${body}
<footer class="site-footer">
<p>Airstream Explorer · enthusiast catalog · ${_stats.floorplanCount} floorplans across ${_stats.familyCount} families (2026 + 2025). · <a href="${relRoot}index.html#all">Explore &amp; match</a> · <a href="${relRoot}index.html#all&type=motorhome">Motorhomes</a> · <a href="${relRoot}compare.html">Compare</a> · <a href="${relRoot}campsites.html">Campsites</a> · <a href="${relRoot}campgrounds.html">Campground map</a> · <a href="${relRoot}upgrades.html">Upgrades</a> · <a href="${relRoot}maintenance.html">Maintenance</a> · <a href="${relRoot}community.html">Community photos</a> · <a href="${relRoot}credits.html">Credits</a></p>
<p class="muted">Independent reference. Not affiliated with Airstream, Inc. Specs compiled from published sources; verify with a dealer before purchase. Model imagery is manufacturer product photography, used for editorial and reference identification; community photographs are used under their stated Creative Commons / public-domain licenses (see credits).</p>
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
// HOME: family grid
// ---------------------------------------------------------------------------

/**
 * A family card for the home grid: cinematic hero + name + range stats.
 * `linkPrefix` is prepended to hrefs/img (''=root page, '../'=nested page).
 */
export function renderFamilyCard(fam, linkPrefix = '') {
  const range = formatPriceRange(fam.priceMin, fam.priceMax);
  const len = formatLengthRange(fam.lengthMin, fam.lengthMax);
  const plans = `${fam.floorplanCount} floorplan${fam.floorplanCount === 1 ? '' : 's'}`;
  const limited = fam.limited ? '<span class="fam-flag">Limited edition</span>' : '';
  const yrs = fam.years.join(' + ');
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
${specRow('Sleeps', 'up to ' + fam.sleepsMax)}
${specRow('Years', yrs)}
</dl>
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
<p class="home-hero-cta"><a class="home-hero-btn" href="#all" data-view-go="all">Explore all floorplans</a><a class="home-hero-ghost" href="community.html">Real community photos →</a></p>
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
<section class="hub-view" id="view-families" data-view="families">
<main class="fam-grid" id="families">
${cards}
</main>
</section>
<section class="hub-view" id="view-all" data-view="all">
${renderExploreSections(trailers, resolve, motorhomes)}
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
  const body = `<nav class="detail-nav"><a href="../index.html" class="back-link">← All families</a></nav>
<header class="fam-hero">
<img class="fam-hero-img" src="../${esc(fam.hero)}" alt="Airstream ${esc(fam.family)}" width="1280" height="720" style="view-transition-name:vt-hero-${esc(fam.slug)}">
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
</main>`;
  return page({
    title: `Airstream ${fam.family} — floorplans, specs & prices`,
    description: `Every Airstream ${fam.family} floorplan (${fam.years.join(' + ')}): ${range}, ${len}, sleeps up to ${fam.sleepsMax}. Compare ${fam.floorplanCount} floorplan${fam.floorplanCount === 1 ? '' : 's'} with full specs.`,
    body,
    relRoot: '../',
    active: 'index',
    canonicalPath: `f/${fam.slug}.html`,
    ogImage: fam.hero || '',
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
  return `<section class="estimator offgrid-tool" aria-label="Off-grid endurance estimator"
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

  return `<section class="towtool" aria-label="Tow-safety calculator"
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

  const vehicleOpts = TOW_VEHICLES
    .slice()
    .sort((a, b) => b.maxTowLb - a.maxTowLb)
    .map((v) => `<option value="${esc(v.id)}"${v.id === def.id ? ' selected' : ''}>${esc(v.name)} — ${esc(v.config)}</option>`)
    .join('');

  // Data island for client-side recomputation
  const dataIsland = JSON.stringify({
    trailer: { gvwrLb: t.gvwrLb, weightLb: t.weightLb || null },
    vehicles: TOW_VEHICLES.map((v) => ({ id: v.id, name: v.name, class: v.class, curbWeightLb: v.curbWeightLb })),
    defaultVehicleId: def.id,
    defaults: { distanceMi: DEFAULT_DISTANCE_MI, fuelPriceGal: DEFAULT_FUEL_PRICE },
    classmpg: VEHICLE_CLASS_MPG,
  }).replace(/<\//g, '<\\/');

  return `<section class="estimator fuel-tool" aria-label="Trip fuel cost estimator"
 data-gvwr="${esc(t.gvwrLb)}"${t.weightLb ? ` data-weight="${esc(t.weightLb)}"` : ''}>
<script type="application/json" id="fuel-data">${dataIsland}</script>
<div class="est-head">
<h2>Trip fuel cost</h2>
<p class="est-sub">Estimate what it costs to tow this ${esc(t.model)} ${esc(t.floorplan)} (${esc(formatWeight(t.gvwrLb))} loaded) on a road trip. Fuel economy drops ${Math.round(defResult.penalty * 100)}% when towing — the heavier the trailer relative to the truck, the bigger the hit.</p>
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
<label for="fuel-price">Fuel price</label>
<div class="est-input-suffix"><input type="number" id="fuel-price" value="${DEFAULT_FUEL_PRICE.toFixed(2)}" min="1" max="10" step="0.10"><span>$/gal</span></div>
</div>
</div>
<div class="est-result" id="fuel-result" aria-live="polite" aria-atomic="true">
<div class="est-big">
<span class="est-number" id="fuel-cost">${esc(formatDollars(defResult.totalCost))}</span>
<span class="est-per">estimated fuel</span>
</div>
<div class="fuel-stats" id="fuel-stats">
<div class="fuel-stat"><span class="fuel-stat-value" id="fuel-mpg">${esc(formatMpg(defResult.towingMpg))}</span><span class="fuel-stat-label">Towing economy</span></div>
<div class="fuel-stat"><span class="fuel-stat-value" id="fuel-gallons">${esc(defResult.gallonsUsed.toFixed(1))} gal</span><span class="fuel-stat-label">Fuel needed</span></div>
<div class="fuel-stat"><span class="fuel-stat-value" id="fuel-cpm">${esc(formatDollars(defResult.costPerMile))}/mi</span><span class="fuel-stat-label">Cost per mile</span></div>
</div>
</div>
<details class="est-method">
<summary>How this is calculated</summary>
<p>Towing reduces fuel economy by 30–60% vs. unladen driving. The penalty scales with the weight ratio (trailer GVWR ÷ vehicle curb weight): a 20% base drag from the hitch + aerodynamics, plus 25% per 1.0 weight ratio, capped at 60%. This model aligns with real-world Airstream towing reports (8–15 MPG range across the lineup). Fuel cost = distance ÷ towing MPG × price per gallon. These are planning estimates — your actual mileage depends on speed, terrain, wind, and driving style.</p>
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

  return `<section class="estimator payload-tool" aria-label="Payload packing calculator"
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
// DETAIL: one floorplan
// ---------------------------------------------------------------------------

/** A single trailer detail page. */
export function renderDetail(t, resolve = assetPaths, campgrounds = null, decor = null) {
  const a = resolve(t);
  const fam = familySlug(t.model);
  const official = officialUrl(t.model);
  const heroImg = a.hero
    ? `<img src="../${esc(a.hero)}" alt="${esc(trailerTitle(t))}" class="detail-hero-img" width="1280" height="720">`
    : '';
  const gallery = a.gallery
    .map(
      (g, i) =>
        `<div class="gallery-img-wrap"><img src="../${esc(g)}" alt="${esc(trailerLabel(t))} photo ${i + 1}" loading="lazy" class="gallery-img" width="920" height="600"></div>`,
    )
    .join('\n');
  const fpZones = renderFloorplanZones(t.floorplan, t.slug);
  const fpLegend = renderFloorplanLegend(t.floorplan, t.slug);
  const fpInteractive = fpZones ? ' floorplan--interactive' : '';
  const fpHint = fpZones
    ? `<p class="floorplan-hint" data-fp-hint>Tap a numbered point to see what's where. <span class="muted">Zones placed against the official ${esc(t.floorplan)} diagram.</span></p>`
    : '';
  const floorplanSection = a.floorplan
    ? `<section class="floorplan${fpInteractive}" aria-label="Floor plan" data-floorplan-code="${esc(t.floorplan)}"><h2>Floor plan</h2>${fpHint}<figure class="floorplan-fig"><span class="floorplan-stage"><img src="../${esc(a.floorplan)}" alt="${esc(trailerLabel(t))} floor plan diagram" loading="lazy" class="floorplan-img" width="820" height="1332">${fpZones}</span>${fpLegend}<figcaption class="muted">Official Airstream ${esc(t.floorplan)} floor plan${official ? ` · <a class="official-link" href="${esc(official)}" target="_blank" rel="noopener">View ${esc(t.model)} floor plans on airstream.com ↗</a>` : ''}</figcaption></figure></section>`
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
<p class="tow-callout-value">${formatWeight(t.gvwrLb)}<span>fully-loaded GVWR</span></p>
</div>
<p class="tow-callout-note">This is the official Airstream GVWR — the most this floorplan can weigh loaded, and the minimum tow rating your vehicle needs.${t.hitchWeightLb ? ` Official hitch (tongue) weight is ${esc(formatWeight(t.hitchWeightLb))}${hitchPct ? ` (~${hitchPct}% of GVWR)` : ''}.` : ''} <a href="../index.html#all">Match it to your vehicle →</a></p>
</section>`
    : '';
  const body = `<nav class="detail-nav"><a href="../f/${esc(fam)}.html" class="back-link">← All ${esc(t.model)} floorplans</a></nav>
<article class="detail">
<header class="detail-head">
<p class="eyebrow">${esc(t.year)} MODEL YEAR</p>
<h1>${esc(t.model)} <span>${esc(t.floorplan)}</span></h1>
${tagChips(t.tags)}
${official ? `<p class="official-head"><a class="official-link" href="${esc(official)}" target="_blank" rel="noopener">Official ${esc(t.model)} page on airstream.com ↗</a></p>` : ''}
</header>
<div class="detail-hero">${heroImg}</div>
<p class="detail-desc">${esc(t.description)}</p>
<section class="spec-table" aria-label="Specifications">
<h2>Specifications</h2>
<dl class="specs-grid">
${specRow('Length', formatLength(t.lengthFt))}
${specRow('Dry weight', formatWeight(t.weightLb))}
${specRow('GVWR', formatWeight(t.gvwrLb))}
${specRow('Cargo capacity (CCC)', formatWeight(t.cccLb))}
${specRow('Hitch weight', formatWeight(t.hitchWeightLb))}
${specRow('Sleeps', String(t.sleeps))}
${specRow('Fresh / gray / black', formatTanks(t.freshGal, t.grayGal, t.blackGal))}
${specRow('Solar', t.solarW ? `${t.solarW} W ${t.solarStandard ? '(standard)' : '(optional)'}` : '—')}
${specRow('Battery', t.batteryKwh ? `${t.batteryKwh} kWh` : '—')}
${specRow('Off-grid score', `${t.offGridScore} / 100`)}
${specRow('MSRP', formatMsrp(t.msrp))}
</dl>
${note}
</section>
${towCallout}
${renderTowTool(t)}
${renderFuelTool(t)}
${renderPayloadTool(t)}
${renderOffGridTool(t)}
${floorplanSection}
${decorSection}
${campgrounds ? renderCampgroundFit(t, campgrounds) : ''}
${pros || cons ? `<section class="proscons">
${pros ? `<div class="pros"><h3>Strengths</h3><ul>${pros}</ul></div>` : ''}
${cons ? `<div class="cons"><h3>Trade-offs</h3><ul>${cons}</ul></div>` : ''}
</section>` : ''}
${gallery ? `<section class="gallery" aria-label="Gallery"><h2>Gallery</h2><div class="gallery-grid">${gallery}</div></section>` : ''}
</article>`;
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
    }),
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
export function renderExploreCard(t, resolve = assetPaths, hidden = false) {
  const a = resolve(t);
  const tags = (t.tags || []).join(' ');
  return `<article class="xcard" data-slug="${esc(t.slug)}" data-type="trailer" data-model="${esc(t.model)}" data-floorplan="${esc(t.floorplan)}" data-year="${esc(t.year)}" data-msrp="${esc(t.msrp)}" data-weight="${esc(t.weightLb)}" data-gvwr="${esc(t.gvwrLb)}" data-length="${esc(t.lengthFt)}" data-sleeps="${esc(t.sleeps)}" data-offgrid="${esc(t.offGridScore)}" data-tags="${esc(tags)}" data-name="${esc((t.model + ' ' + t.floorplan).toLowerCase())}"${hidden ? ' hidden' : ''}>
<a class="xcard-link" href="m/${esc(t.slug)}.html">
<div class="xcard-media">
<img src="${esc(a.thumb)}" alt="${esc(trailerTitle(t))}" loading="lazy" width="400" height="260">
<span class="xcard-year">${esc(t.year)}</span>
</div>
<div class="xcard-body">
<h3 class="xcard-title">${esc(t.model)} <span>${esc(t.floorplan)}</span></h3>
<dl class="xcard-specs">
${specRow('Length', formatLength(t.lengthFt))}
${specRow('Dry weight', formatWeight(t.weightLb))}
${specRow('Sleeps', String(t.sleeps))}
${specRow('MSRP', formatMsrp(t.msrp))}
</dl>
</div>
</a>
<div class="xcard-foot">
<span class="xcard-fit" data-fit hidden></span>
<label class="xcard-compare"><input type="checkbox" class="cmp-box" data-slug="${esc(t.slug)}" data-type="trailer" aria-label="Add ${esc(trailerLabel(t))} to compare"> Compare</label>
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
export function renderExploreSections(trailers, resolve = assetPaths, motorhomes = []) {
  const sortOpts = Object.entries(SORT_KEYS)
    .map(([k, def], i) => `<option value="${esc(k)}"${i === 0 ? ' selected' : ''}>${esc(def.label)}</option>`)
    .join('');
  // Use-case tags span BOTH datasets so the chips work whatever type is active.
  const tagChips = exploreTags([...trailers, ...motorhomes])
    .map((tag) => `<button type="button" class="tagfilter" data-tag="${esc(tag)}" aria-pressed="false">${esc(tagLabel(tag))}</button>`)
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
  const cards = merged
    .map(({ item, type }) =>
      type === 'motorhome'
        ? renderMotorhomeExploreCard(item, motorhomeAssetPaths, item.year !== 2026)
        : renderExploreCard(item, resolve, item.year !== 2026),
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
<h1>Every floorplan, by the numbers</h1>
<p class="lede">Search, sort and filter all ${totalPlans} floorplans${hasMotorhomes ? ' — travel trailers and motorhomes' : ''} — match a trailer to your tow vehicle, or browse by size, sleeping capacity or off-grid capability.</p>
${typeSeg}
</header>
<section class="tow-tool" aria-label="Tow vehicle matcher">
<div class="tow-tool-inner">
<div class="tow-field">
<label for="tow-input">Your tow vehicle's max tow rating</label>
<div class="tow-input-row">
<input type="number" id="tow-input" inputmode="numeric" min="1000" max="20000" step="100" placeholder="e.g. 7000">
<span class="tow-unit">lb</span>
<button type="button" id="tow-clear" class="tow-clear" hidden>Clear</button>
</div>
<p class="tow-hint">Check your truck's door jamb or owner's manual. We compare it to each trailer's <strong>fully-loaded GVWR</strong> — not dry weight — the way Airstream recommends.</p>
</div>
<div class="tow-presets" aria-label="Common tow vehicles">
<span class="tow-presets-label">Quick set:</span>
<button type="button" class="tow-preset" data-tow="3500">SUV ~3,500</button>
<button type="button" class="tow-preset" data-tow="5000">Midsize ~5,000</button>
<button type="button" class="tow-preset" data-tow="7700">Half-ton ~7,700</button>
<button type="button" class="tow-preset" data-tow="10000">¾-ton ~10,000</button>
</div>
</div>
<p class="tow-summary" id="tow-summary" hidden></p>
</section>
<section class="explore-controls" aria-label="Search and filter">
<div class="xc-row">
<div class="xc-search">
<input type="search" id="x-search" placeholder="Search model or floorplan…" aria-label="Search floorplans">
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
<button type="button" class="xc-reset" id="x-reset">Reset</button>
</div>
</section>
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
<table class="cmp-table" id="cmp-table"></table>
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
