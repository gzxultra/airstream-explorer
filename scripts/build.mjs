#!/usr/bin/env node
// Build the static site into dist/. Zero dependencies — Node built-ins only.
// Pipeline: validate data -> render index + 59 detail pages -> copy assets.

import { mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { loadTrailers, validateDataset, groupByFamily, resolveAssets, loadDecor, resolveDecor } from '../src/lib/data.mjs';
import { renderIndex, renderFamily, renderDetail, renderExplore, renderCompare, renderSaved, renderGlossaryBody, page } from '../src/lib/render.mjs';
import { loadMotorhomes, validateMotorhomeDataset, groupMotorhomesByFamily, resolveMotorhomeAssets } from '../src/lib/motorhome-data.mjs';
import { renderMotorhomeIndex, renderMotorhomeFamily, renderMotorhomeDetail } from '../src/lib/motorhome-render.mjs';
import { loadCommunityPhotos, validateCommunity, renderCommunityBody, renderCreditsBody } from '../src/lib/community.mjs';
import { loadUpgrades, validateUpgrades, renderUpgradesBody } from '../src/lib/upgrades.mjs';
import { loadMaintenance, validateMaintenance, renderMaintenanceBody } from '../src/lib/maintenance.mjs';
import { loadOvernight, validateOvernight, renderOvernightBody } from '../src/lib/overnight.mjs';
import { loadBoondocking, validateBoondocking, renderCampsitesBody } from '../src/lib/campsites.mjs';
import { loadCampgrounds, validateCampgrounds } from '../src/lib/campgrounds.mjs';
import { renderCampgroundsPage } from '../src/lib/campgrounds-render.mjs';
import { SITE_ORIGIN } from '../src/lib/seo.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const PUBLIC = join(ROOT, 'public');

function log(...a) { console.log('[build]', ...a); }

// Existence check against the source-of-truth public/ tree.
const hasAsset = (rel) => existsSync(join(PUBLIC, rel));
const resolve = (t) => resolveAssets(t, hasAsset);
const resolveMH = (m) => resolveMotorhomeAssets(m, hasAsset);

// 1. Load + validate (fail the build on any data problem)
const trailers = loadTrailers();
validateDataset(trailers);
const families = groupByFamily(trailers);
log(`data ok: ${trailers.length} floorplans in ${families.length} families`);

// 1b. Load + validate community photos (fail the build if any attribution is missing)
const community = loadCommunityPhotos();
validateCommunity(community);
log(`community photos ok: ${community.length} (all attributed)`);

// 1c. Load + validate campground dataset (Recreation.gov, baked static JSON)
const campData = loadCampgrounds();
validateCampgrounds(campData);
const campgrounds = campData.campgrounds;
log(`campgrounds ok: ${campgrounds.length} RV-capable sites in ${campData.stats.states} states`);

// 1d. Load official interior décor options (family slug -> material schemes)
const decorMap = loadDecor();
const decorFamilies = Object.keys(decorMap).length;
const decorSchemes = Object.values(decorMap).reduce((n, s) => n + (Array.isArray(s) ? s.length : 0), 0);
log(`décor ok: ${decorSchemes} schemes across ${decorFamilies} families`);

// 1e. Load + validate upgrades/options (fail the build if any item lacks a
//     type tag or a source link — accuracy is the contract for this page)
const upgrades = loadUpgrades();
const upgradeProblems = validateUpgrades(upgrades);
if (upgradeProblems.length) {
  throw new Error('Upgrades data invalid:\n' + upgradeProblems.join('\n'));
}
const upgradeCount = upgrades.categories.reduce((n, c) => n + c.items.length, 0);
log(`upgrades ok: ${upgradeCount} items in ${upgrades.categories.length} categories (all sourced)`);

// 1e-2. Load + validate maintenance schedule (fail the build if any task lacks
//     a cadence, severity, actionable step, or a source link — every interval
//     on this page must trace to a primary source: Airstream's own schedule,
//     the axle/appliance/tire makers. Inventing a service interval is exactly
//     the failure this page exists to avoid).
const maintenance = loadMaintenance();
const maintenanceProblems = validateMaintenance(maintenance);
if (maintenanceProblems.length) {
  throw new Error('Maintenance data invalid:\n' + maintenanceProblems.join('\n'));
}
const maintenanceCount = maintenance.categories.reduce((n, c) => n + c.items.length, 0);
log(`maintenance ok: ${maintenanceCount} tasks in ${maintenance.categories.length} cadences (all sourced)`);

// 1f. Load + validate curated overnight stays (Recreation.gov campgrounds
//     filtered into two intents: off-grid "Big Views" + serviced "Full
//     Hookups"). Fail the build if any pick lacks a valid lens, a real
//     Recreation.gov url, a photo, coordinates, or violates the hookups
//     contract — every card must be a place you can actually tow into.
const overnightData = loadOvernight();
const overnightProblems = validateOvernight(overnightData);
if (overnightProblems.length) {
  throw new Error('Overnight stays data invalid:\n' + overnightProblems.join('\n'));
}
log(`overnight stays ok: ${overnightData.stays.length} curated picks (${Object.entries(overnightData.byLens).map(([k, v]) => `${v} ${k}`).join(', ')})`);

// 1g. Load + validate boondocking dataset (OpenStreetMap / ODbL dispersed
//     sites). Fail the build if any community site lacks real coordinates,
//     OSM provenance, or — critically — carries a FABRICATED rating, photo, or
//     price. Community data must stay visibly honest next to the gov data.
const boondockingData = loadBoondocking();
const boondockingProblems = validateBoondocking(boondockingData);
if (boondockingProblems.length) {
  throw new Error('Boondocking data invalid:\n' + boondockingProblems.join('\n'));
}
log(`boondocking ok: ${boondockingData.sites.length} OSM dispersed sites (unverified, first-come)`);

// 1h. Load + validate motorhome dataset
const motorhomes = loadMotorhomes();
validateMotorhomeDataset(motorhomes);
const motorhomeFamilies = groupMotorhomesByFamily(motorhomes);
log(`motorhomes ok: ${motorhomes.length} floorplans in ${motorhomeFamilies.length} families`);

// 2. Clean dist
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'm'), { recursive: true });
mkdirSync(join(DIST, 'f'), { recursive: true });
mkdirSync(join(DIST, 'mm'), { recursive: true });
mkdirSync(join(DIST, 'mf'), { recursive: true });

// 3. Explore hub (index.html) — family grid + all-floorplans, one page
writeFileSync(join(DIST, 'index.html'), renderIndex(families, trailers, resolve, motorhomes, motorhomeFamilies));
log('wrote index.html (Explore hub: family grid + all-floorplans)');

// 3b. Family pages
for (const fam of families) {
  writeFileSync(join(DIST, 'f', `${fam.slug}.html`), renderFamily(fam, resolve, families));
}
log(`wrote ${families.length} family pages`);

// 4. Detail pages
for (const t of trailers) {
  writeFileSync(join(DIST, 'm', `${t.slug}.html`), renderDetail(t, resolve, campgrounds, resolveDecor(t, decorMap, hasAsset), trailers));
}
log(`wrote ${trailers.length} detail pages`);

// 4a. Explore & match + Compare (root-level, relRoot = '')
writeFileSync(join(DIST, 'explore.html'), renderExplore(trailers, resolve));
writeFileSync(join(DIST, 'compare.html'), renderCompare(trailers, resolve, motorhomes));
writeFileSync(join(DIST, 'saved.html'), renderSaved(trailers, resolve, motorhomes));
log('wrote explore.html + compare.html + saved.html');

// 4a-mh. Motorhome pages
writeFileSync(join(DIST, 'motorhomes.html'), renderMotorhomeIndex(motorhomeFamilies, motorhomes, resolveMH));
for (const fam of motorhomeFamilies) {
  writeFileSync(join(DIST, 'mf', `${fam.slug}.html`), renderMotorhomeFamily(fam, resolveMH));
}
for (const mh of motorhomes) {
  writeFileSync(join(DIST, 'mm', `${mh.slug}.html`), renderMotorhomeDetail(mh, resolveMH, motorhomes));
}
log(`wrote motorhomes.html + ${motorhomeFamilies.length} family pages + ${motorhomes.length} detail pages`);

// 4a2. Campground Finder (national, map + list)
{
  const { body, payload } = renderCampgroundsPage(campgrounds, trailers);
  // The campground dataset (~905 KB baked) is written to its OWN file rather
  // than inlined into the HTML. Inlining forced every visit to re-download the
  // whole dataset (HTML is no-cache) and blocked first paint on a 900 KB parse.
  // As a standalone file it's fingerprinted + immutable-cached (step 6/8): one
  // download, cached forever, fetched async by app.js without blocking the list.
  mkdirSync(join(DIST, 'assets', 'data'), { recursive: true });
  writeFileSync(join(DIST, 'assets', 'data', 'campgrounds.json'), JSON.stringify(payload));
  log(`wrote campground dataset (${(JSON.stringify(payload).length / 1024).toFixed(0)} KB, external + cacheable)`);
  // MapLibre (~940 KB) is the heaviest asset on the site. We DON'T load it
  // render-blocking here — app.js lazy-loads it after the campground list is on
  // screen, so a slow/blocked/aborted map download can never stop the list from
  // rendering. Keep the CSS (small) and preload the JS at low priority so it's
  // usually warm by the time app.js asks for it.
  const head = '<link rel="stylesheet" href="assets/vendor/maplibre/maplibre-gl.css">\n'
    + '<link rel="preload" href="assets/vendor/maplibre/maplibre-gl.js" as="script">\n';
  writeFileSync(
    join(DIST, 'campgrounds.html'),
    page({
      title: 'Campground Finder — where your Airstream fits',
      description: `Find RV-friendly campgrounds nationwide matched to your Airstream's real length. ${campgrounds.length} campgrounds across ${campData.stats.states} states from Recreation.gov, with posted max-length limits, ratings, and prices.`,
      body,
      head,
      active: 'campgrounds',
      canonicalPath: 'campgrounds.html',
    }),
  );
  log('wrote campgrounds.html (national finder)');
}

// 4b. Community gallery + credits pages (root-level, so relRoot = '')
writeFileSync(
  join(DIST, 'community.html'),
  page({
    title: 'Airstream in the Wild — real community photos',
    description: 'Real, freely-licensed photographs of Airstream travel trailers from photographers via Wikimedia Commons, grouped by model and setting. Every photo credited.',
    body: renderCommunityBody(community, ''),
    active: 'community',
    canonicalPath: 'community.html',
  }),
);
writeFileSync(
  join(DIST, 'credits.html'),
  page({
    title: 'Photo credits & licenses — Airstream Explorer',
    description: 'Full attribution for every community photograph: photographer, license, and original source.',
    body: renderCreditsBody(community, ''),
    active: 'community',
    canonicalPath: 'credits.html',
  }),
);
log('wrote community.html + credits.html');

// 4b-ii. Glossary page (root-level, reference page)
writeFileSync(
  join(DIST, 'glossary.html'),
  page({
    title: 'RV & Airstream Glossary — every spec term explained',
    description: 'Every term you\\u2019ll see on Airstream spec sheets and in campground descriptions — GVWR, CCC, boondocking, shore power, and more — explained in plain language.',
    body: renderGlossaryBody(),
    active: 'glossary',
    canonicalPath: 'glossary.html',
  }),
);
log('wrote glossary.html');

// 4c. Upgrades & options page (root-level, so relRoot = '')
writeFileSync(
  join(DIST, 'upgrades.html'),
  page({
    title: 'Airstream upgrades & options owners actually add',
    description: 'The most-recommended Airstream upgrades — lithium, solar, soft start, anti-sway hitch, TPMS and more — split into factory options and aftermarket mods, each with a price reference and sources.',
    body: renderUpgradesBody(upgrades, ''),
    active: 'upgrades',
    canonicalPath: 'upgrades.html',
  }),
);
log('wrote upgrades.html');

// 4c-2. Maintenance schedule page (root-level, so relRoot = '')
writeFileSync(
  join(DIST, 'maintenance.html'),
  page({
    title: 'Airstream maintenance schedule — a sourced service calendar',
    description: 'A real maintenance calendar for Airstream travel trailers, organized by cadence from before-every-trip to seasonal winterizing. Every interval is traced to a primary source — Airstream\u2019s own schedule, Dexter, Suburban/Dometic, and the tire industry — with the Airstream-specific gotchas (Nev-R-Lube sealed bearings, aluminum sealed seams, Suburban-only anode rods) called out.',
    body: renderMaintenanceBody(maintenance, ''),
    active: 'maintenance',
    canonicalPath: 'maintenance.html',
  }),
);
log('wrote maintenance.html');

// 4d. Campsites hub (root-level, so relRoot = '') — the unified page that
//     merges overnight stays (Big Views + Full Hookups, Recreation.gov) with
//     boondocking (free dispersed, OpenStreetMap) under three filter lenses.
//     Ships the MapLibre CSS + a low-priority JS preload (same as the Finder)
//     because the hub now carries its own all-lenses map; app.js lazy-loads the
//     library when the map scrolls near the viewport, so the list never waits.
const campsitesHead = '<link rel="stylesheet" href="assets/vendor/maplibre/maplibre-gl.css">\n'
  + '<link rel="preload" href="assets/vendor/maplibre/maplibre-gl.js" as="script">\n';
writeFileSync(
  join(DIST, 'campsites.html'),
  page({
    title: 'Campsites — where to park your Airstream tonight',
    description: `${overnightData.stays.length + boondockingData.sites.length} places to park an Airstream on US public land, in one place — ${overnightData.byLens.view || 0} off-grid big-view sites and ${overnightData.byLens.utility || 0} full-hookup sites bookable on Recreation.gov, plus ${boondockingData.sites.length} free first-come boondocking spots mapped from OpenStreetMap. Filter by views, hookups, or free dispersed camping.`,
    body: renderCampsitesBody(overnightData, boondockingData, ''),
    head: campsitesHead,
    active: 'campsites',
    canonicalPath: 'campsites.html',
  }),
);
log('wrote campsites.html (unified hub: stays + boondocking + all-lenses map)');

// 4d-ii. Legacy redirects: stays.html → campsites.html (the Overnight Stays
//     page was absorbed into the hub). Keep the URL alive so old links/bookmarks
//     and any external references don't 404; a meta-refresh + canonical + JS
//     replace covers crawlers and humans.
function redirectStub(to, title) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${title}</title>
<link rel="canonical" href="${to}">
<meta http-equiv="refresh" content="0; url=${to}">
<meta name="robots" content="noindex,follow">
<script>location.replace('${to}');</script>
</head><body><p>This page moved to <a href="${to}">Campsites</a>.</p></body></html>`;
}
writeFileSync(join(DIST, 'stays.html'), redirectStub('campsites.html', 'Overnight stays moved — Campsites'));
log('wrote stays.html (redirect → campsites.html)');

// 4e. Custom 404 — Cloudflare Pages serves /404.html for unmatched routes.
//     A branded, navigable 404 (full site chrome via page()) beats Cloudflare's
//     bare default; noindex so search engines don't list it.
{
  const body404 = `<header class="hero-head" style="text-align:center">
<p class="eyebrow">404 · OFF THE MAP</p>
<h1>This trail doesn't exist</h1>
<p class="lede" style="margin:0 auto 18px">The page you're after has been moved or never existed. Let's get you back to the lineup.</p>
<p class="hero-cta"><a class="home-hero-btn" href="/index.html">Explore all Airstreams →</a></p>
</header>`;
  const html404 = page({
    title: 'Page not found — Airstream Explorer',
    description: 'The page you requested could not be found.',
    body: body404,
    active: '',
    head: '<meta name="robots" content="noindex,follow">\n',
  });
  writeFileSync(join(DIST, '404.html'), html404);
  log('wrote 404.html (branded, noindex)');
}

// 5. Static assets: CSS/JS from src, images from public
cpSync(join(ROOT, 'src', 'assets', 'css'), join(DIST, 'assets', 'css'), { recursive: true });
cpSync(join(ROOT, 'src', 'assets', 'js'), join(DIST, 'assets', 'js'), { recursive: true });
if (existsSync(join(ROOT, 'src', 'assets', 'vendor'))) {
  cpSync(join(ROOT, 'src', 'assets', 'vendor'), join(DIST, 'assets', 'vendor'), { recursive: true });
  log('copied vendor assets (maplibre)');
}
// Self-hosted webfonts (woff2 + fonts.css). Served from this origin so pages
// render where Google Fonts is blocked/throttled (e.g. mainland China).
if (existsSync(join(ROOT, 'src', 'assets', 'fonts'))) {
  cpSync(join(ROOT, 'src', 'assets', 'fonts'), join(DIST, 'assets', 'fonts'), { recursive: true });
  log(`copied ${readdirSync(join(DIST, 'assets', 'fonts')).length} self-hosted font files`);
}
// Self-hosted map basemap: US-states GeoJSON + Open Sans glyph stack. The map
// has ZERO external dependency now — no CARTO/CDN — so it loads anywhere the
// page does. Glyph/GeoJSON paths are templated by MapLibre at runtime, so these
// keep stable names (NOT fingerprinted); they're foundational and rarely change.
if (existsSync(join(ROOT, 'src', 'assets', 'map'))) {
  cpSync(join(ROOT, 'src', 'assets', 'map'), join(DIST, 'assets', 'map'), { recursive: true });
  log('copied self-hosted map basemap (us-states.json + glyphs)');
}
if (existsSync(join(PUBLIC, 'assets', 'img'))) {
  cpSync(join(PUBLIC, 'assets', 'img'), join(DIST, 'assets', 'img'), { recursive: true });
  const counts = ['thumbs', 'heroes', 'gallery', 'floorplans', 'decor'].map((d) => {
    const p = join(DIST, 'assets', 'img', d);
    return `${d}:${existsSync(p) ? readdirSync(p).length : 0}`;
  });
  log('copied images', counts.join(' '));
}

// 5b. Root-served brand assets + crawl/PWA infrastructure.
//     These live at the SITE ROOT with conventional fixed names (favicon.ico,
//     site.webmanifest, robots.txt, sitemap.xml) that browsers and crawlers
//     look up by exact path — so they are deliberately NOT fingerprinted.
{
  // Brand icons (favicon SVG/ICO, apple-touch, PWA 192/512) → dist root.
  const iconDir = join(ROOT, 'src', 'assets');
  for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
    const srcF = join(iconDir, f);
    if (existsSync(srcF)) cpSync(srcF, join(DIST, f));
  }
  // PWA web app manifest — makes the site installable with a real name + icon
  // + theme color instead of a bare URL tile.
  writeFileSync(join(DIST, 'site.webmanifest'), JSON.stringify({
    name: 'Airstream Explorer',
    short_name: 'Airstream',
    description: 'A spec-accurate, cinematic field guide to every current Airstream travel trailer and motorhome.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4EFE6',
    theme_color: '#1F1B16',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }, null, 2));
  log('copied root brand icons + wrote site.webmanifest');
}

// 5c. robots.txt + sitemap.xml — a 90+ page public reference site had neither,
//     so search engines had no crawl directives and no index of its URLs. The
//     sitemap is generated by walking the finished dist/ HTML tree (after ALL
//     pages are written) so it auto-includes any page added later, and excludes
//     non-canonical/noindex stubs (the stays.html legacy redirect).
{
  // Recursively collect every .html under dist/.
  const collectHtml = (dir) => {
    const out = [];
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, ent.name);
      if (ent.isDirectory()) out.push(...collectHtml(abs));
      else if (ent.name.endsWith('.html')) out.push(abs);
    }
    return out;
  };
  const EXCLUDE = new Set(['stays.html', '404.html']); // legacy redirect + 404 (both noindex)
  const urls = collectHtml(DIST)
    .map((abs) => relative(DIST, abs).split('\\').join('/'))
    .filter((rel) => !EXCLUDE.has(rel))
    // Pretty canonical URLs: index.html → '', otherwise keep the .html path
    // (matches the <link rel=canonical> the pages emit via seo.mjs).
    .map((rel) => (rel === 'index.html' ? '' : rel))
    .sort();
  const today = new Date().toISOString().slice(0, 10);
  const body = urls.map((u) => {
    // Homepage + the major hub pages are highest priority; detail pages lower.
    const isHub = u === '' || !u.includes('/');
    const priority = u === '' ? '1.0' : isHub ? '0.8' : '0.6';
    return `  <url>\n    <loc>${SITE_ORIGIN}/${u}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;
  }).join('\n');
  writeFileSync(join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  writeFileSync(join(DIST, 'robots.txt'),
    `# Airstream Explorer — independent enthusiast reference\nUser-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
  log(`wrote sitemap.xml (${urls.length} urls) + robots.txt`);
}

// 6. CONTENT FINGERPRINTING (cache-busting).
//    Images are served with `immutable, max-age=1yr`. If a hero/gallery file
//    keeps the same name (basecamp.jpg) but its bytes change, browsers + the CDN
//    keep serving the OLD cached copy forever — the exact bug where an updated
//    hero never reached returning visitors. Fix: rename every image to include a
//    short content hash (basecamp.a1b2c3d4.jpg). New bytes -> new name -> new URL,
//    so immutable caching is now safe AND always fresh.
{
  const manifest = new Map(); // canonical "assets/<kind>/.." -> hashed "assets/<kind>/.."
  // Fingerprint EVERY cacheable asset (images AND js/css). JS/CSS were the bug:
  // they shipped with stable names ('app.js') under `immutable, max-age=1yr`, so
  // a returning visitor's browser/CDN held the OLD copy for a year and never saw
  // updates (this is exactly how the removed 月供/finance code kept showing up).
  // Content-hashing the name (app.<hash>.js) means new bytes -> new URL -> fresh.
  const counts = {};
  const fingerprintTree = (subdir, extRe) => {
    const root = join(DIST, 'assets', subdir);
    if (!existsSync(root)) return;
    let n = 0;
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const abs = join(dir, name);
        if (statSync(abs).isDirectory()) { walk(abs); continue; }
        if (!extRe.test(name)) continue;
        const bytes = readFileSync(abs);
        const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 8);
        const dot = name.lastIndexOf('.');
        const hashedName = `${name.slice(0, dot)}.${hash}${name.slice(dot)}`;
        const hashedAbs = join(dir, hashedName);
        writeFileSync(hashedAbs, bytes);
        rmSync(abs);
        const canonRel = `assets/${subdir}/` + relative(root, abs).split('\\').join('/');
        const hashedRel = `assets/${subdir}/` + relative(root, hashedAbs).split('\\').join('/');
        manifest.set(canonRel, hashedRel);
        n++;
      }
    };
    walk(root);
    counts[subdir] = n;
  };
  fingerprintTree('img', /\.(jpe?g|png|webp|avif|gif|svg)$/i);
  fingerprintTree('js', /\.js$/i);
  fingerprintTree('css', /\.css$/i);
  // The campground dataset (assets/data/campgrounds.json) is large, immutable
  // per build, and referenced once (in campgrounds.html via #cg-data[data-src]).
  // Fingerprinting it makes it safe to cache forever AND fresh on every rebuild.
  fingerprintTree('data', /\.json$/i);
  log(`fingerprinted ${counts.img || 0} images, ${counts.js || 0} js, ${counts.css || 0} css, ${counts.data || 0} data`);

  // Rewrite every emitted HTML file's image references to the hashed names.
  // References appear as ".../assets/img/<...>" with varying relRoot prefixes
  // ('', '../'); match the canonical tail and swap to the hashed tail.
  const htmlFiles = [
    join(DIST, 'index.html'),
    join(DIST, 'explore.html'),
    join(DIST, 'compare.html'),
    join(DIST, 'saved.html'),
    join(DIST, 'campgrounds.html'),
    join(DIST, 'upgrades.html'),
    join(DIST, 'maintenance.html'),
    join(DIST, 'campsites.html'),
    join(DIST, 'stays.html'),
    join(DIST, '404.html'),
    join(DIST, 'community.html'),
    join(DIST, 'credits.html'),
    join(DIST, 'glossary.html'),
    join(DIST, 'motorhomes.html'),
    ...families.map((f) => join(DIST, 'f', `${f.slug}.html`)),
    ...trailers.map((t) => join(DIST, 'm', `${t.slug}.html`)),
    ...motorhomeFamilies.map((f) => join(DIST, 'mf', `${f.slug}.html`)),
    ...motorhomes.map((mh) => join(DIST, 'mm', `${mh.slug}.html`)),
  ];
  let rewrites = 0;
  for (const file of htmlFiles) {
    if (!existsSync(file)) continue;
    let html = readFileSync(file, 'utf8');
    for (const [canon, hashed] of manifest) {
      // replace the canonical path wherever it appears (prefix-agnostic: the
      // 'assets/img/..' tail is identical regardless of '../' relRoot)
      if (html.includes(canon)) {
        html = html.split(canon).join(hashed);
        rewrites++;
      }
    }
    writeFileSync(file, html);
  }
  log(`rewrote image refs in HTML (${rewrites} path-substitutions)`);
}

// 7. GUARDRAIL: every <img src> emitted into dist must resolve to a real file
//    in dist. A missing file is what Cloudflare serves as fallback HTML and the
//    browser renders as a broken image — so we fail the build instead of shipping it.
{
  const pages = [
    { file: join(DIST, 'index.html'), base: DIST },
    { file: join(DIST, 'explore.html'), base: DIST },
    { file: join(DIST, 'compare.html'), base: DIST },
    { file: join(DIST, 'campgrounds.html'), base: DIST },
    { file: join(DIST, 'upgrades.html'), base: DIST },
    { file: join(DIST, 'maintenance.html'), base: DIST },
    { file: join(DIST, 'campsites.html'), base: DIST },
    { file: join(DIST, 'community.html'), base: DIST },
    { file: join(DIST, 'credits.html'), base: DIST },
    { file: join(DIST, 'glossary.html'), base: DIST },
    { file: join(DIST, 'motorhomes.html'), base: DIST },
    { file: join(DIST, '404.html'), base: DIST },
    ...families.map((f) => ({ file: join(DIST, 'f', `${f.slug}.html`), base: join(DIST, 'f') })),
    ...trailers.map((t) => ({ file: join(DIST, 'm', `${t.slug}.html`), base: join(DIST, 'm') })),
    ...motorhomeFamilies.map((f) => ({ file: join(DIST, 'mf', `${f.slug}.html`), base: join(DIST, 'mf') })),
    ...motorhomes.map((mh) => ({ file: join(DIST, 'mm', `${mh.slug}.html`), base: join(DIST, 'mm') })),
  ];
  const broken = [];
  let checked = 0;
  for (const { file, base } of pages) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)) {
      const ref = m[1];
      if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:')) continue; // external/data URIs
      // /cdn/* is served at runtime by the Pages Function (functions/cdn/[[path]].js),
      // a same-origin proxy to cdn.recreation.gov — not a static file on disk.
      if (ref.startsWith('/cdn/')) continue;
      checked++;
      // resolve ref relative to the page's directory, then check under dist
      const abs = join(base, ref);
      if (!existsSync(abs)) broken.push(`${file.replace(DIST + '/', '')} -> ${ref}`);
    }
  }
  if (broken.length) {
    throw new Error(
      `Image guardrail failed: ${broken.length} <img> reference(s) point at files missing from dist/:\n` +
      broken.map((b) => '  ' + b).join('\n'),
    );
  }
  log(`image guardrail ok: ${checked} <img> references all resolve on disk`);
}

// 8. CF Pages caching headers.
//    - Images/CSS/JS are content-fingerprinted (step 6), so they're safe to
//      cache forever as immutable.
//    - HTML is NOT fingerprinted (stable URLs users bookmark), so it must be
//      revalidated every time — otherwise a cached HTML page keeps pointing at
//      old hashed asset URLs and updates never appear. `no-cache` = always
//      revalidate with the CDN (cheap 304 when unchanged), never serve stale.
writeFileSync(join(DIST, '_headers'), `/assets/*
  Cache-Control: public, max-age=31536000, immutable
/*.html
  Cache-Control: public, no-cache, must-revalidate
/
  Cache-Control: public, no-cache, must-revalidate
`);

log('build complete →', DIST);
